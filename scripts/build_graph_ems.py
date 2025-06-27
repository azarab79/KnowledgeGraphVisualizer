#!/usr/bin/env python
"""
Run the graph-extraction pipeline on a single EMS user-guide file.
Everything is identical to desktopneo4j 1.py except:

• `files_to_process` is hard-wired to the EMS document
• The SemanticChunker is tuned to produce smaller slices
"""

import os
from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_neo4j import Neo4jGraph
from langchain_experimental.graph_transformers import LLMGraphTransformer
from langchain_experimental.text_splitter import SemanticChunker
from langchain_community.embeddings import HuggingFaceEmbeddings

# ------------------------------------------------------------------
# 1  CONFIGURATION
# ------------------------------------------------------------------
load_dotenv()

google_api_key = os.environ.get("GOOGLE_API_KEY", "AIzaSyDL5p9qlju3AYUyPHRdLcd8bMJG2vNdBqM")
neo4j_uri = os.environ.get("NEO4J_URI", "neo4j://127.0.0.1:7687")
neo4j_username = os.environ.get("NEO4J_USERNAME", "neo4j")
neo4j_password = os.getenv("NEO4J_PASSWORD", "1979@rabu")
neo4j_database = os.environ.get("NEO4J_DATABASE", "neo4j")




# ------------------------------------------------------------------
# 2  GRAPH CONNECTION
# ------------------------------------------------------------------
graph = Neo4jGraph(
    url      = neo4j_uri,
    username = neo4j_username,
    password = neo4j_password,
    database = neo4j_database,
    refresh_schema = False,
)

# ------------------------------------------------------------------
# 3  EMBEDDINGS & CHUNKER  (same model, smaller chunks)
# ------------------------------------------------------------------
hf_embeddings = HuggingFaceEmbeddings(
    model_name   = "sentence-transformers/all-mpnet-base-v2",
    model_kwargs = {"device": "cpu"},
    encode_kwargs= {"normalize_embeddings": False},
)

chunker = SemanticChunker(
    embeddings = hf_embeddings,
    buffer_size = 0,                          # evaluate every sentence boundary
    breakpoint_threshold_type = "percentile",
    breakpoint_threshold_amount = 90,         # lower → more cuts
    min_chunk_size = 150,                     # guard against 1-word chunks
)

# ------------------------------------------------------------------
# 4  LLM FOR GRAPH TRANSFORMATION
# ------------------------------------------------------------------
# llm_for_schema = ChatGoogleGenerativeAI(
#     model = "gemini-2.5-flash-preview-04-17",
#     api_key = google_api_key,
# )

# graph_transformer = LLMGraphTransformer(
#     llm = llm_for_schema,
#     allowed_nodes = [
#         "Product", "Module", "Role", "Feature", "Parameter",
#         "Workflow", "UIComponent", "UIArea", "Configuration",
#     ],
#     allowed_relationships = [
#         "DEPENDS_ON", "CONFIGURES", "USES", "CONTAINS", "TRIGGERS",
#         "HAS_PARAMETER", "ASSIGNED_TO", "APPROVES",
#     ],
#     node_properties = True,
#     relationship_properties = True,
# )

# ------------------------------------------------------------------
# 5  RUN ON A SINGLE FILE
# ------------------------------------------------------------------
file_path = "360t-kg-api/data/raw_text/360T User Guide EMS.txt"
if not os.path.exists(file_path):
    raise FileNotFoundError(f"Cannot locate {file_path}")

print(f"Processing only: {file_path}")
with open(file_path, "r", encoding="utf-8") as fh:
    raw_text = fh.read()

docs = chunker.create_documents([raw_text])

SIMULATED_PAGE_SIZE = 3_000
cursor = 0
for i, doc in enumerate(docs, start=1):
    chunk_len   = len(doc.page_content)
    midpoint    = cursor + chunk_len // 2
    page_number = (midpoint // SIMULATED_PAGE_SIZE) + 1

    graph_doc = Document(
        page_content = doc.page_content,
        metadata = {
            "file_name"   : file_path,
            "chunk_number": i,
            "page_number" : page_number,
        },
    )

    print(f"Chunk {i:02}/{len(docs)} – page {page_number}")
    graph_docs = graph_transformer.convert_to_graph_documents([graph_doc])
    graph.add_graph_documents(graph_docs, include_source=True)

    cursor += chunk_len

print("✅ Graph build complete for EMS guide.") 