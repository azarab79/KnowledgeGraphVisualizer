import os
import re
from typing import List
import time
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_neo4j import Neo4jVector, Neo4jGraph
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain.retrievers import EnsembleRetriever
from langchain_core.retrievers import BaseRetriever
import ollama

# -------------------------------
# 1. ENV VARIABLES
# -------------------------------

# Set API keys and Neo4j credentials (replace with secure loading in production)
os.environ["GOOGLE_API_KEY"] = "AIzaSyAzB7O_owmCvb5hyqlRG3mjDecvu_QxugI"
NEO4J_URI = os.environ.get("NEO4J_URI", "neo4j://127.0.0.1:7687")
NEO4J_USERNAME = os.environ.get("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "1979@rabu")
os.environ["NEO4J_URI"] = NEO4J_URI
os.environ["NEO4J_USERNAME"] = NEO4J_USERNAME
os.environ["NEO4J_PASSWORD"] = NEO4J_PASSWORD


# # -------------------------------
# # 2. LLM Initialization
# # -------------------------------

# graph = Neo4jGraph(url=NEO4J_URI, username=NEO4J_USERNAME, password=NEO4J_PASSWORD)
# graph.refresh_schema()

# # The full-text index is now expected to be created manually in the Aura console.
# # This script assumes 'document_text' and 'entity' indexes already exist.

# llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash-preview-05-20", temperature=0.2)
# google_embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
ollama_embeddings = ollama.embeddings(
    model='nomic-embed-text'  
)

# -------------------------------
# 3. Setup Vector Index
# -------------------------------

vector_index = Neo4jVector.from_existing_graph(
    embedding=ollama_embeddings,
    search_type="hybrid",
    node_label="Document",
    text_node_properties=["text"],
    embedding_node_property="embedding"
)

# # -------------------------------
# # 4. Entity Extraction Chain
# # -------------------------------

# class Entities(BaseModel):
#     """
#     Pydantic model for extracted entity names.
#     Args:
#         names (List[str]): List of entity names.
#     """
#     names: List[str] = Field(
#         ..., description="Entity names of Product, Module, Role, Feature, Parameter, Workflow, UIComponent, UIArea, Configuration in a forex trading system."
#     )

# entity_prompt = ChatPromptTemplate.from_messages([
#     ("system", (
#         "You are extracting entity names from user input based on a forex trading system schema: "
#         "Product, Module, Role, Feature, Parameter, Workflow, UIComponent, UIArea, Configuration. "
#         "Only return names likely to exist in the graph."
#     )),
#     ("human", "Use the format to extract from this input: {question}")
# ])

# entity_chain = entity_prompt | llm.with_structured_output(Entities)

# # graph.query("CREATE FULLTEXT INDEX entity IF NOT EXISTS FOR (e:__Entity__) ON EACH [e.id]")

# def remove_lucene_chars(text: str) -> str:
#     """
#     Remove Lucene special characters from a string.
#     Args:
#         text (str): Input string.
#     Returns:
#         str: Cleaned string.
#     """
#     return re.sub(r'[+\-!(){}\[\]^"~*?:\\/]|&&|\|\|', "", text)

# # -------------------------------
# # 5. Retrievers Setup
# # -------------------------------

# class Neo4jFullTextRetriever(BaseRetriever):
#     """
#     Custom LangChain retriever for Neo4j full-text search.
#     It searches for documents that contain the given query text.
#     """
#     graph: Neo4jGraph
    
#     def _get_relevant_documents(self, query: str, *, run_manager=None) -> List[Document]:
#         """
#         Retrieves documents from Neo4j based on a full-text search.

#         Args:
#             query (str): The user's search query.

#         Returns:
#             List[Document]: A list of matching documents.
#         """
#         ft_query = remove_lucene_chars(query)
#         result = self.graph.query(
#             "CALL db.index.fulltext.queryNodes('keyword', $query) YIELD node, score "
#             "RETURN node.text AS text, score, node.metadata AS metadata",
#             {"query": ft_query},
#         )
#         return [
#             Document(page_content=record["text"], metadata=record.get("metadata") or {})
#             for record in result
#         ]

# # -------------------------------
# # 6. Cypher QA Chain
# # -------------------------------

# schema = graph.schema

# def create_cypher_prompt(query, entities, schema):
#     # This is now a regular function that returns a string, not a LangChain PromptTemplate
#     # This avoids the aggressive parsing of the instruction text.
#     return f"""Task: Generate a Cypher query to search a graph database based on extracted entities.

# Instructions:
# Based on the provided schema and the extracted entities, construct a Cypher query to answer the user's question.

# Schema:
# {schema}

# Query Generation Rules:
# * Before adding a node label (e.g., `:Product`) check whether that label exists in the provided schema text. If unsure, omit the label and match on properties only.
# * Do NOT use the deprecated `exists(n.prop)` syntax. If you need to ensure a property is present, use `n.prop IS NOT NULL`.
# 1.  **If two or more entities are provided:**
#     - Do NOT use shortestPath().
#     - Pick the first entity as `start`, the last as `end`.
#     - Put any middle entities into `extraEntities`.
#     - Use the variable-length pattern from above, with a reasonable hop limit (e.g. 10).

# 2.  **If one entity is provided:**
#     - Generate a query to find the node for that entity and its immediate neighbors.
#     - Match the entity using a case-insensitive `CONTAINS` search on the `id` property (e.g., `toLower(n.{{id}}) CONTAINS 'entity'`).
#     - Return the node, its relationships, and its neighbors (e.g., `RETURN n, r, m`). Limit the results to 10.

# 3.  **If no entities are provided:**
#     - Generate a query that does a broad search using the user's original question.
#     - Use a case-insensitive `CONTAINS` search on the `id` property of any node (e.g., `toLower(n.{{id}})`).
#     - Return the node and its immediate neighbors. Limit the results to 10.

# **Important:** Return ONLY the raw Cypher query. Do not include any explanations, comments, or markdown formatting like ```cypher.

# User Question:
# {query}

# Extracted Entities:
# {entities}
# """

# # -------------------------------
# # 7. Combined QA Function
# # -------------------------------

# def _sanitize_cypher(cypher: str) -> str:
#     """Replace deprecated exists(n.prop) with n.prop IS NOT NULL."""
#     return re.sub(
#         r"exists\(\s*([a-zA-Z]\w*)\.(\w+)\s*\)",
#         r"\1.\2 IS NOT NULL",
#         cypher,
#         flags=re.IGNORECASE,
#     )

# def final_qa_chain(retriever, graph, llm, question, entities):
#     """
#     The final QA chain that combines document retrieval and graph analysis.
#     """
#     start_time = time.time()
#     # Retrieve docs from ensemble retriever (vector answer)
#     context_docs = retriever.invoke(question)
#     context = "\n\n".join([doc.page_content for doc in context_docs])
#     print(f"\nVector Answer (Top Docs):\n{context[:500]}...")
#     print(f"[DEBUG] Retrieval took {time.time() - start_time:.2f}s")

#     # Generate Cypher query
#     cypher_prompt_str = create_cypher_prompt(question, entities, schema)
#     # DEBUG: show the full prompt sent for Cypher generation
#     print("\n[DEBUG] Cypher Generation Prompt:\n" + cypher_prompt_str)
#     # Directly call the LLM to avoid ChatPromptTemplate variable parsing issues
#     start_cypher = time.time()
#     try:
#         cypher_query_raw = llm.invoke(cypher_prompt_str)
#         # `invoke` may return a message object; get the content if needed
#         cypher_query = getattr(cypher_query_raw, "content", cypher_query_raw)
#     except Exception as e:
#         print(f"Error generating Cypher query: {e}")
#         cypher_query = ""  # Fallback to empty query to prevent downstream crash
    
#     # Sanitize the Cypher query
#     cypher_query = _sanitize_cypher(cypher_query)
    
#     # Execute the Cypher query
#     start_query = time.time()
#     try:
#         graph_result = graph.query(cypher_query)
#         cypher_answer_raw = str(graph_result)
#         # Replace large embedding arrays with placeholder
#         cypher_answer = re.sub(r"'embedding':\s*\[[^\]]*\]", "'embedding': [...]", cypher_answer_raw, flags=re.DOTALL)
#         print(f"\nGraph Answer:\n{cypher_answer}")
#         print(f"[DEBUG] Cypher generation took {time.time() - start_cypher:.2f}s")
#     except Exception as e:
#         print(f"\nError executing Cypher query: {e}")
#         cypher_answer = "Error executing query."
#     print(f"[DEBUG] Graph query took {time.time() - start_query:.2f}s")

#     # Synthesis
#     synthesis_prompt = f"""
#     You are a 360T Platform expert. Answer ONLY with information grounded in the material below.
#     If the material does not fully answer the question, respond with "I don't have enough information in the provided documents to answer that."  
#     Do NOT invent or rely on outside knowledge.  Keep the answer precise and detailed, in a structured format. Suggest Follow up questions.

#     --- Retrieved Context (authoritative user-guide excerpts) ---
#     {context}

#     --- Graph Insight (authoritative Neo4j data) ---
#     {cypher_answer[:2000]}

#     --- Question ---
#     {question}
#     """

#     # DEBUG: show synthesis prompt
#     print("\n[DEBUG] Synthesis Prompt:\n" + synthesis_prompt)
#     final_response = llm.invoke(synthesis_prompt)
#     # Extract plain text from LLM response object if needed
#     return getattr(final_response, "content", final_response)


if __name__ == "__main__":
    """
    Main execution block.
    """
    question = "What are the differences in the data input required for a standard risk reversal versus a zero-premium risk reversal when using the custom strategy method?"
    
    # Instantiate retrievers
    vector_retriever = vector_index.as_retriever()
    full_text_retriever = Neo4jFullTextRetriever(graph=graph)

    # Create the ensemble retriever
    ensemble_retriever = EnsembleRetriever(
        retrievers=[vector_retriever, full_text_retriever],
        weights=[0.5, 0.5]  # Can be tuned
    )

    # # Entity extraction
    # entities = entity_chain.invoke({"question": question})
    # print(f"Extracted Entities: {entities.names}")

    # # Run the final QA chain
    # final_answer = final_qa_chain(ensemble_retriever, graph, llm, question, entities.names)

    # print(f"\nFinal Answer:\n{final_answer}")
