"""
Enhanced Knowledge Graph QA Pipeline with LLM Abstraction Layer

This is an enhanced version of the original kg_qa_pipeline.py that uses the
LLM abstraction layer for better provider management and fallback handling.
"""

import os
import re
import time
import uuid
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_neo4j import Neo4jVector, Neo4jGraph
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain.retrievers import EnsembleRetriever
from langchain_core.retrievers import BaseRetriever
from langchain_core.messages import HumanMessage, SystemMessage

# Import the LLM abstraction layer
from llm_abstraction import LLMManager, create_manager, SelectionPolicy

# -------------------------------
# MARKDOWN FORMATTING UTILITIES
# -------------------------------

def format_markdown_response(content: str, title: str = None, add_metadata: bool = True, 
                           metadata_text: str = None) -> str:
    """
    Utility function to ensure proper Markdown formatting for responses with minimal spacing.
    
    Args:
        content: The main response content
        title: Optional title to add at the top
        add_metadata: Whether to add metadata footer
        metadata_text: Custom metadata text
        
    Returns:
        Properly formatted Markdown string
    """
    formatted = ""
    
    # Add title if provided (reduced spacing)
    if title:
        formatted += f"# {title}\n"
    
    # Ensure content has minimal line breaks
    if content:
        # Clean up excessive line breaks - convert multiple \n\n to single \n\n
        content = re.sub(r'\n\n\n+', '\n\n', content.strip())
        # Reduce excessive spacing between paragraphs
        content = re.sub(r'\n\n', '\n', content)
        formatted += content
    
    # Add metadata footer if requested (minimal spacing)
    if add_metadata and metadata_text:
        if not formatted.endswith('\n'):
            formatted += '\n'
        formatted += f"\n---\n{metadata_text}"
    
    return formatted

def sanitize_markdown(text: str) -> str:
    """
    Clean and sanitize Markdown text to ensure proper rendering with minimal spacing.
    
    Args:
        text: Raw text that may contain Markdown
        
    Returns:
        Cleaned Markdown text with reduced spacing
    """
    # Remove any potential code block markers that might be incorrectly added
    text = re.sub(r'^```markdown\s*\n?', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n?```$', '', text)
    
    # Ensure minimal spacing around headers (single line break instead of double)
    text = re.sub(r'\n(#{1,6})\s*', r'\n\1 ', text)
    
    # Ensure minimal spacing around horizontal rules
    text = re.sub(r'\n-{3,}\n', r'\n---\n', text)
    
    # Collapse 3+ newlines to 2
    text = re.sub(r'\n\n\n+', '\n\n', text)
    # Convert single newlines (not part of double) to spaces to avoid line breaks inside paragraphs
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
    
    return text.strip()

# -------------------------------
# 1. ENV VARIABLES & CONFIGURATION
# -------------------------------

# Neo4j credentials - should be loaded from environment variables
NEO4J_URI = os.getenv("NEO4J_URI", "neo4j+s://9e5b081c.databases.neo4j.io")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "S6OpMYFyJRzRndsqzxPU06EvG2jjVMQ9eRloeYmwrmE")

# Set environment variables for Neo4j
os.environ["NEO4J_URI"] = NEO4J_URI
os.environ["NEO4J_USERNAME"] = NEO4J_USERNAME
os.environ["NEO4J_PASSWORD"] = NEO4J_PASSWORD

# Google API key for embeddings
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "AIzaSyAzB7O_owmCvb5hyqlRG3mjDecvu_QxugI")
os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

# -------------------------------
# 2. ENHANCED QA PIPELINE CLASS
# -------------------------------

class EnhancedQAPipeline:
    """
    Enhanced QA Pipeline that uses the LLM abstraction layer for better
    provider management and fallback handling.
    """
    
    def __init__(self, 
                 conversation_id: Optional[str] = None,
                 primary_provider: str = "ollama",
                 fallback_providers: List[str] = None):
        """
        Initialize the enhanced QA pipeline.
        
        Args:
            conversation_id: Optional conversation ID for session management
            primary_provider: Primary LLM provider to use
            fallback_providers: List of fallback providers
        """
        self.conversation_id = conversation_id or str(uuid.uuid4())
        
        # Initialize LLM manager with fallback support
        if fallback_providers is None:
            fallback_providers = ["google_genai"]
            
        self.llm_manager = create_manager(
            primary_provider=primary_provider,
            fallback_providers=fallback_providers,
            selection_policy=SelectionPolicy.FAILOVER,
            enable_conversation_history=True
        )
        
        # Initialize Neo4j components
        self.graph = Neo4jGraph(
            url=NEO4J_URI, 
            username=NEO4J_USERNAME, 
            password=NEO4J_PASSWORD
        )
        self.graph.refresh_schema()
        self.schema = self.graph.schema
        
        # Initialize embeddings (still using Google for consistency)
        self.google_embeddings = GoogleGenerativeAIEmbeddings(
            model="models/embedding-001"
        )
        
        # Setup vector index
        self.vector_index = Neo4jVector.from_existing_graph(
            embedding=self.google_embeddings,
            search_type="hybrid",
            node_label="Document",
            text_node_properties=["text"],
            embedding_node_property="embedding"
        )
        
        # Setup retrievers
        self.vector_retriever = self.vector_index.as_retriever()
        self.full_text_retriever = Neo4jFullTextRetriever(graph=self.graph)
        self.ensemble_retriever = EnsembleRetriever(
            retrievers=[self.vector_retriever, self.full_text_retriever],
            weights=[0.5, 0.5]
        )
        
    def extract_entities(self, question: str) -> List[str]:
        """
        Extract entities from the user question using the LLM abstraction layer.
        
        Args:
            question: User's question
            
        Returns:
            List of extracted entity names
        """
        system_prompt = (
            "You are extracting entity names from user input based on a forex trading system schema: "
            "Product, Module, Role, Feature, Parameter, Workflow, UIComponent, UIArea, Configuration. "
            "Only return names likely to exist in the graph. "
            "Return your response as a JSON object with a 'names' field containing an array of entity names."
        )
        
        human_prompt = f"Extract entities from this input: {question}"
        
        try:
            # Prepare messages
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=human_prompt)
            ]
            
            response = self.llm_manager.invoke(
                messages,
                conversation_id=f"{self.conversation_id}_entities",
                temperature=0.1
            )
            
            # Parse the JSON response to extract entity names
            import json
            try:
                parsed = json.loads(response)
                return parsed.get('names', [])
            except json.JSONDecodeError:
                # Fallback: extract entities from plain text response
                # Simple regex to find potential entity names
                entities = re.findall(r'\b[A-Z][a-zA-Z]+\b', response)
                return entities[:5]  # Limit to 5 entities
                
        except Exception as e:
            print(f"Error extracting entities: {e}")
            return []
    
    def generate_cypher_query(self, question: str, entities: List[str]) -> str:
        """
        Generate a Cypher query using the LLM abstraction layer.
        
        Args:
            question: User's question
            entities: Extracted entities
            
        Returns:
            Generated Cypher query
        """
        prompt = f"""Task: Generate a Cypher query to search a graph database based on extracted entities.

Instructions:
Based on the provided schema and the extracted entities, construct a Cypher query to answer the user's question.

Schema:
{self.schema}

Query Generation Rules:
* Before adding a node label (e.g., :Product) check whether that label exists in the provided schema text. If unsure, omit the label and match on properties only.
* Do NOT use the deprecated `exists(n.prop)` syntax. If you need to ensure a property is present, use `n.prop IS NOT NULL`.
1.  **If two or more entities are provided:**
    - Do NOT use shortestPath().
    - Pick the first entity as `start`, the last as `end`.
    - Put any middle entities into `extraEntities`.
    - Use the variable-length pattern from above, with a reasonable hop limit (e.g. 10).

2.  **If one entity is provided:**
    - Generate a query to find the node for that entity and its immediate neighbors.
    - Match the entity using a case-insensitive `CONTAINS` search on the `id` property (e.g., `toLower(n.id) CONTAINS 'entity'`).
    - Return the node, its relationships, and its neighbors (e.g., `RETURN n, r, m`). Limit the results to 10.

3.  **If no entities are provided:**
    - Generate a query that does a broad search using the user's original question.
    - Use a case-insensitive `CONTAINS` search on the `id` property of any node (e.g., `toLower(n.id)`).
    - Return the node and its immediate neighbors. Limit the results to 10.

**Important:** Return ONLY the raw Cypher query. Do not include any explanations, comments, or markdown formatting like ```cypher.

User Question:
{question}

Extracted Entities:
{entities}
"""
        
        try:
            response = self.llm_manager.invoke(
                prompt,
                conversation_id=f"{self.conversation_id}_cypher",
                temperature=0.1
            )
            
            # Clean up the response to extract just the query
            cypher_query = response.strip()
            # Remove markdown formatting if present
            cypher_query = re.sub(r'^```cypher\s*\n?', '', cypher_query)
            cypher_query = re.sub(r'\n?```$', '', cypher_query)
            
            # Sanitize deprecated syntax
            cypher_query = self._sanitize_cypher(cypher_query)
            
            return cypher_query
            
        except Exception as e:
            print(f"Error generating Cypher query: {e}")
            return ""
    
    def synthesize_final_answer(self, question: str, context: str, graph_result: str) -> str:
        """
        Synthesize the final answer using the LLM abstraction layer.
        
        Args:
            question: Original user question
            context: Retrieved document context
            graph_result: Graph query results
            
        Returns:
            Final synthesized answer
        """
        synthesis_prompt = f"""
You are a 360T Platform expert. Answer ONLY with information grounded in the material below.

**IMPORTANT**: Format your response in clean, well-structured Markdown with:
- Use ## for main sections
- Use ### for subsections  
- Use bullet points (-) for lists
- Use **bold** for emphasis on key terms
- Use `code blocks` for technical terms, field names, or values
- Use > blockquotes for important notes or warnings
- Include line breaks between sections for readability
- At the end, suggest 2-3 relevant follow-up questions in a "### 💡 Related Questions" section

If the material does not fully answer the question, respond with:
> ⚠️ **Limited Information**: I don't have enough information in the provided documents to fully answer that question.

Do NOT invent or rely on outside knowledge. Keep the answer precise and detailed, in a structured format.

--- Retrieved Context (authoritative user-guide excerpts) ---
{context}

--- Graph Insight (authoritative Neo4j data) ---
{graph_result[:2000]}

--- Question ---
{question}

**Format your response in Markdown starting now:**
"""
        
        try:
            response = self.llm_manager.invoke(
                synthesis_prompt,
                conversation_id=self.conversation_id,
                temperature=0.2
            )
            
            # Sanitize and format the response
            response = sanitize_markdown(response)
            
            # Add metadata footer with Markdown formatting
            if not response.strip().startswith(("❌", "⚠️", "I apologize")):
                metadata_text = "*📊 Response generated using hybrid search across vector embeddings and graph relationships.*"
                response = format_markdown_response(
                    content=response,
                    add_metadata=True,
                    metadata_text=metadata_text
                )
            
            return response
            
        except Exception as e:
            print(f"Error synthesizing final answer: {e}")
            return "❌ **Error**: I apologize, but I encountered an error while processing your question. Please try again."
    
    def process_question(self, question: str) -> Dict[str, Any]:
        """
        Process a question through the complete QA pipeline.
        
        Args:
            question: User's question
            
        Returns:
            Dictionary containing the answer and metadata
        """
        start_time = time.time()
        
        try:
            # 1. Extract entities
            print(f"Extracting entities from: {question}")
            entities = self.extract_entities(question)
            print(f"Extracted entities: {entities}")
            
            # 2. Retrieve context documents
            print("Retrieving context documents...")
            context_docs = self.ensemble_retriever.invoke(question)
            context = "\n\n".join([doc.page_content for doc in context_docs])
            print(f"Retrieved context (first 500 chars): {context[:500]}...")
            
            # 3. Generate and execute Cypher query
            print("Generating Cypher query...")
            cypher_query = self.generate_cypher_query(question, entities)
            print(f"Generated Cypher query: {cypher_query}")
            
            graph_result = ""
            if cypher_query:
                try:
                    graph_data = self.graph.query(cypher_query)
                    graph_result_raw = str(graph_data)
                    # Replace large embedding arrays with placeholder
                    graph_result = re.sub(
                        r"'embedding':\s*\[[^\]]*\]", 
                        "'embedding': [...]", 
                        graph_result_raw, 
                        flags=re.DOTALL
                    )
                    print(f"Graph result: {graph_result}")
                except Exception as e:
                    print(f"Error executing Cypher query: {e}")
                    graph_result = "Error executing graph query."
            
            # 4. Synthesize final answer
            print("Synthesizing final answer...")
            final_answer = self.synthesize_final_answer(question, context, graph_result)
            
            processing_time = time.time() - start_time
            
            return {
                "answer": final_answer,
                "entities_extracted": entities,
                "processing_time": processing_time,
                "cypher_query": cypher_query,
                "sources_used": [
                    f"Vector search ({len(context_docs)} documents)",
                    "Graph database query" if graph_result else "Graph query failed"
                ],
                "conversation_id": self.conversation_id
            }
            
        except Exception as e:
            print(f"Error in process_question: {e}")
            return {
                "answer": "❌ **Error**: I apologize, but I encountered an error while processing your question. Please try again.",
                "entities_extracted": [],
                "processing_time": time.time() - start_time,
                "cypher_query": "",
                "sources_used": [],
                "conversation_id": self.conversation_id,
                "error": str(e)
            }
    
    def _sanitize_cypher(self, cypher: str) -> str:
        """Replace deprecated exists(n.prop) with n.prop IS NOT NULL."""
        return re.sub(
            r"exists\(\s*([a-zA-Z]\w*)\.(\w+)\s*\)",
            r"\1.\2 IS NOT NULL",
            cypher,
            flags=re.IGNORECASE,
        )
    
    def shutdown(self):
        """Clean up resources."""
        if hasattr(self, 'llm_manager'):
            self.llm_manager.shutdown()


# -------------------------------
# 3. CUSTOM RETRIEVERS
# -------------------------------

def remove_lucene_chars(text: str) -> str:
    """
    Remove Lucene special characters from a string.
    Args:
        text (str): Input string.
    Returns:
        str: Cleaned string.
    """
    return re.sub(r'[+\-!(){}\[\]^"~*?:\\/]|&&|\|\|', "", text)


class Neo4jFullTextRetriever(BaseRetriever):
    """
    Custom LangChain retriever for Neo4j full-text search.
    It searches for documents that contain the given query text.
    """
    graph: Neo4jGraph
    
    def _get_relevant_documents(self, query: str, *, run_manager=None) -> List[Document]:
        """
        Retrieves documents from Neo4j based on a full-text search.

        Args:
            query (str): The user's search query.

        Returns:
            List[Document]: A list of matching documents.
        """
        ft_query = remove_lucene_chars(query)
        result = self.graph.query(
            "CALL db.index.fulltext.queryNodes('keyword', $query) YIELD node, score "
            "RETURN node.text AS text, score, node.metadata AS metadata",
            {"query": ft_query},
        )
        return [
            Document(page_content=record["text"], metadata=record.get("metadata") or {})
            for record in result
        ]


# -------------------------------
# 4. CONVENIENCE FUNCTIONS
# -------------------------------

def create_qa_pipeline(conversation_id: Optional[str] = None,
                       primary_provider: str = "ollama",
                       fallback_providers: List[str] = None) -> EnhancedQAPipeline:
    """
    Create and return a configured QA pipeline instance.
    
    Args:
        conversation_id: Optional conversation ID
        primary_provider: Primary LLM provider
        fallback_providers: List of fallback providers
        
    Returns:
        EnhancedQAPipeline instance
    """
    return EnhancedQAPipeline(
        conversation_id=conversation_id,
        primary_provider=primary_provider,
        fallback_providers=fallback_providers
    )


# -------------------------------
# 5. MAIN EXECUTION (for testing)
# -------------------------------

if __name__ == "__main__":
    """
    Test the enhanced QA pipeline.
    """
    # Test question
    question = "What the additional fields in swap which are not present for forward orders"
    
    # Create and run the pipeline
    pipeline = create_qa_pipeline()
    
    try:
        print(f"Processing question: {question}")
        print("=" * 80)
        
        result = pipeline.process_question(question)
        
        print("\n" + "=" * 80)
        print("FINAL RESULTS:")
        print("=" * 80)
        print(f"Answer: {result['answer']}")
        print(f"Entities: {result['entities_extracted']}")
        print(f"Processing time: {result['processing_time']:.2f}s")
        print(f"Sources: {result['sources_used']}")
        
        if 'error' in result:
            print(f"Error: {result['error']}")
            
    finally:
        pipeline.shutdown() 