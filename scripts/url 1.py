#!/usr/bin/env python3
import os
import glob
import asyncio
import re
import hashlib
import time
import logging
import numpy as np
from datetime import datetime, timezone
from dotenv import load_dotenv
from pydantic import BaseModel, Field

# Set tokenizers parallelism before importing any HuggingFace libraries
os.environ["TOKENIZERS_PARALLELISM"] = "false"

from graphiti_core import Graphiti
from graphiti_core.nodes import EpisodeType
from graphiti_core.utils.maintenance.graph_data_operations import clear_data
from graphiti_core.llm_client import OpenAIClient, LLMConfig
from graphiti_core.embedder import OpenAIEmbedder, OpenAIEmbedderConfig
from langchain_huggingface import HuggingFaceEmbeddings

from langchain_openai import ChatOpenAI
from langchain_community.embeddings import OpenAIEmbeddings

from langchain_experimental.text_splitter import SemanticChunker
from langchain_core.documents import Document

from langchain_neo4j import Neo4jGraph


# -----------------------------------------------------------------------------
# 1) Load environment variables
# -----------------------------------------------------------------------------
load_dotenv()

# Get OpenAI API key with error handling
openai_api_key = os.getenv("openai_api_key")
if not openai_api_key:
    raise ValueError("OpenAI API key not found. Please check your .env file contains 'openai_api_key=your_key_here'")

os.environ["OPENAI_API_KEY"] = openai_api_key

NEO4J_URI      = os.getenv("NEO4J_URI",      "bolt://localhost:7687")
NEO4J_USER     = os.getenv("NEO4J_USER",     "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "1979@rabu")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")


# -----------------------------------------------------------------------------
# 2) Setup Graphiti clients
# -----------------------------------------------------------------------------
# Create Graphiti-compatible LLM client
llm_config = LLMConfig(
    api_key=openai_api_key,
    model="gpt-4.1-mini",
    temperature=0.2
)
llm_client = OpenAIClient(config=llm_config)

# Create Graphiti-compatible embedder
embedder_client = OpenAIEmbedder(
    config=OpenAIEmbedderConfig(
        embedding_model="text-embedding-3-small"
    )
)

# For text splitting, we still use LangChain's embedder
langchain_embedder = OpenAIEmbeddings(openai_api_key=openai_api_key)
text_splitter = SemanticChunker(
    langchain_embedder,
    breakpoint_threshold_type="percentile",
    breakpoint_threshold_amount=70,  # More aggressive chunking (smaller chunks)
    min_chunk_size=150,
    buffer_size=10
)
# --------------------------
# 3. EMBEDDINGS & TEXT SPLITTER
# --------------------------
# model_name = "Qwen/Qwen3-Embedding-4B"
# model_kwargs = {'device': 'cpu'}
# encode_kwargs = {'normalize_embeddings': True}
# hf_embeddings = HuggingFaceEmbeddings(
#     model_name=model_name,
#     model_kwargs=model_kwargs,
#     encode_kwargs=encode_kwargs,
# )
# text_splitter = SemanticChunker(hf_embeddings,breakpoint_threshold_type="percentile", 
#                                 breakpoint_threshold_amount=75, 
#                                 min_chunk_size=)

# -----------------------------------------------------------------------------
# 3) Define entity descriptions
# -----------------------------------------------------------------------------
entity_descriptions = {
    "Product": "Trading platform products like Spot, Futures, Swap etc.",
    "Module": "Software modules, components, or subsystems within the platform",
    "Role": "User roles, permissions, or access levels in the trading system",
    "Feature": "Platform features, functionalities, or capabilities available to users ",
    "Parameter": "Configuration parameters, settings, or options that control behavior",
    "Workflow": "Business processes, procedures, or sequences of operations",
    "UIComponent": "User interface components like buttons, forms, dialogs, input fields",
    "UIArea": "User interface areas like screens, sections, tabs, workspaces, panels",
    "Configuration": "System configurations, settings, or preferences that affect operation"
}


# -----------------------------------------------------------------------------
# 4) Document metadata parsing for hybrid solution
# -----------------------------------------------------------------------------
def parse_document_metadata(file_path: str) -> dict:
    """Extract meaningful metadata from filename for document-scoped namespacing"""
    filename = os.path.basename(file_path)
    base_name = os.path.splitext(filename)[0]

    # Extract version pattern (e.g., "20.21.10")
    version_match = re.search(r'(\d+\.\d+\.\d+)', base_name)
    version = version_match.group(1) if version_match else "1.0.0"

    # Create short, meaningful document ID
    # Remove common words and create acronym
    words = re.findall(r'\b[A-Za-z]+\b', base_name)
    filtered_words = [w for w in words if w.lower() not in
                     {'user', 'guide', 'data', 'configuration', 'admin', 'the', 'for', 'and', 'of'}]

    if len(filtered_words) >= 2:
        doc_id = ''.join(word[0].upper() for word in filtered_words[:4])
    else:
        # Fallback to hash-based ID
        doc_id = hashlib.md5(base_name.encode()).hexdigest()[:8].upper()

    return {
        "doc_id": f"{doc_id}_v{version}",
        "version": version,
        "type": "user_guide",
        "timestamp": datetime.now().isoformat(),
        "full_filename": filename
    }


# -----------------------------------------------------------------------------
# 5) Helper to create contextual entity models with rich metadata
# -----------------------------------------------------------------------------
def create_contextual_entity_model(name: str, description: str, doc_metadata: dict) -> type[BaseModel]:
    """Create entity model with clean name and rich document context"""
    return type(
        name,  # Keep clean entity name: "Product", "Swap", etc.
        (BaseModel,),
        {
            "__annotations__": {
                "description": str,
                "source_document": str,
                "document_version": str,
                "document_type": str,
                "ingestion_timestamp": str,
                "original_filename": str
            },
            "description": Field(default=description),
            "source_document": Field(default=doc_metadata["doc_id"]),
            "document_version": Field(default=doc_metadata["version"]),
            "document_type": Field(default=doc_metadata["type"]),
            "ingestion_timestamp": Field(default=doc_metadata["timestamp"]),
            "original_filename": Field(default=doc_metadata["full_filename"])
        }
    )


# -----------------------------------------------------------------------------
# 5) Setup Neo4j connection and clear existing data
# -----------------------------------------------------------------------------
graph = Neo4jGraph(
    url=NEO4J_URI,
    username=NEO4J_USER,
    password=NEO4J_PASSWORD,
    database=NEO4J_DATABASE,
    refresh_schema=False,
)

# graph.query("MATCH (n) DETACH DELETE n") # uncomment this to clear the data


# -----------------------------------------------------------------------------
# 6) Initialize Graphiti client
# -----------------------------------------------------------------------------
client = Graphiti(
    NEO4J_URI,
    NEO4J_USER,
    NEO4J_PASSWORD,
    llm_client=llm_client,
    embedder=embedder_client,
    cross_encoder=None,
)


# -----------------------------------------------------------------------------
# 7) Main async function for ingestion
# -----------------------------------------------------------------------------
async def main():
    await client.build_indices_and_constraints()
    # await clear_data(client.driver) # uncomment this to clear the data

    user_guides_base = "user_guides"

    # Ingest all text files in the 360t-kg-api/data/raw_text folder
    input_files = glob.glob("360t-kg-api/data/raw_text/*.txt")
    print(f"Found {len(input_files)} input files.")

    for file_path in input_files:
        # Parse document metadata for hybrid solution
        doc_metadata = parse_document_metadata(file_path)
        print(f"\n📄 Processing document: {doc_metadata['doc_id']} (v{doc_metadata['version']})")
        print(f"   Full filename: {doc_metadata['full_filename']}")

        # Create document-specific entity types with rich metadata
        contextual_entity_types = {}
        for entity_name, entity_desc in entity_descriptions.items():
            contextual_entity_types[entity_name] = create_contextual_entity_model(
                entity_name, entity_desc, doc_metadata
            )

        # Create a document-scoped group_id for namespacing
        doc_group_id = f"{user_guides_base}_{doc_metadata['doc_id']}"
        print(f"   Document group_id: {doc_group_id}")

        with open(file_path, "r", encoding="utf-8") as f:
            full_text = f.read()
        
        # Check token count directly without using the semantic chunker
        import tiktoken
        encoding = tiktoken.get_encoding("cl100k_base")
        token_count = len(encoding.encode(full_text))
        print(f"   Document has {token_count} tokens")
        
        # For very large documents, use simple chunking instead of semantic chunking
        if token_count > 250000:
            print("   Document too large for semantic chunking, using simple chunking")
            # Simple paragraph-based chunking with size limit
            paragraphs = full_text.split('\n\n')
            all_docs = []
            current_chunk = ""
            
            for para in paragraphs:
                # If adding this paragraph would make chunk too large, save current and start new
                if len(current_chunk) + len(para) > 8000 and current_chunk:  # ~2000 tokens
                    all_docs.append(Document(page_content=current_chunk))
                    current_chunk = para
                else:
                    if current_chunk:
                        current_chunk += '\n\n' + para
                    else:
                        current_chunk = para
            
            # Add the last chunk if not empty
            if current_chunk:
                all_docs.append(Document(page_content=current_chunk))
            
            print(f"   Split into {len(all_docs)} chunks using simple chunking")
        else:
            # Use semantic chunker for smaller documents
            docs = text_splitter.create_documents([full_text])
            all_docs = docs
            print(f"   Split into {len(all_docs)} chunks using semantic chunking")
        
        # Continue with processing the chunks
        now = datetime.now(timezone.utc).isoformat()
        
        for i, doc in enumerate(all_docs, start=1):
            chunk_text = doc.page_content.strip()
            
            # Skip empty or very short chunks
            if not chunk_text or len(chunk_text) < 10:
                print(f"   [{i}/{len(all_docs)}] Skipping empty/short chunk {i} ({len(chunk_text)} chars)")
                continue
                
            # Create a unique episode name for this chunk
            episode_name = f"{doc_metadata['doc_id']} - Chunk {i}"
            
            # Process the chunk with Graphiti
            try:
                await client.add_episode(
                    name=episode_name,
                    episode_body=chunk_text,
                    source=EpisodeType.text,
                    reference_time=now,
                    entity_types=contextual_entity_types,
                    source_description=f"Chunk from {doc_metadata['doc_id']} ({doc_metadata['full_filename']})",
                    group_id=doc_group_id
                )
                print(f"   [{i}/{len(all_docs)}] ✅ Ingested episode {episode_name!r}")
            except Exception as e:
                if "ConstraintValidationFailed" in str(e):
                    print(f"   [{i}/{len(all_docs)}] ⚠️ Entity consolidation in {episode_name} (expected within document)")
                else:
                    print(f"   [{i}/{len(all_docs)}] ❌ Error processing {episode_name}: {e}")
                    raise
        
        print(f"✅ Completed document: {doc_metadata['doc_id']}")
        print("=" * 60)

    await client.close()
    print("\n🎉 Hybrid solution ingestion complete!")
    print("📊 Each document now has its own namespace with clean entity names and rich metadata.")


# -----------------------------------------------------------------------------
# 8) Cross-Document Search Helper (for future use)
# -----------------------------------------------------------------------------
class UserGuideSearchManager:
    """Helper class for searching across document-scoped namespaces"""

    def __init__(self, graphiti_client):
        self.client = graphiti_client
        self._group_id_cache = {}

    async def search_concept_across_all_guides(self, concept: str, limit: int = 10):
        """Search for a concept across all user guide documents"""
        # This would need to be implemented to get all user guide group_ids
        # For now, this is a placeholder for future functionality
        all_group_ids = await self._get_all_user_guide_group_ids()
        return await self.client.search(
            query=concept,
            group_ids=all_group_ids,
            limit=limit
        )

    async def search_within_document(self, concept: str, doc_id: str, limit: int = 10):
        """Search within a specific document"""
        group_id = f"user_guides_{doc_id}"
        return await self.client.search(
            query=concept,
            group_ids=[group_id],
            limit=limit
        )

    async def compare_concept_across_versions(self, concept: str, base_doc_pattern: str):
        """Compare how a concept is described across document versions"""
        # This would find all versions of documents matching the pattern
        version_group_ids = await self._get_document_versions(base_doc_pattern)
        return await self.client.search(
            query=concept,
            group_ids=version_group_ids
        )

    async def _get_all_user_guide_group_ids(self):
        """Get all user guide group_ids from the database"""
        # Implementation would query Neo4j for all group_ids starting with "user_guides_"
        # This is a placeholder for future implementation
        pass

    async def _get_document_versions(self, pattern: str):
        """Get all document versions matching a pattern"""
        # Implementation would find all group_ids matching the pattern
        # This is a placeholder for future implementation
        pass


# -----------------------------------------------------------------------------
# 9) Run the async main function
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    asyncio.run(main())
