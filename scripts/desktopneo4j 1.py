import os
from getpass import getpass

from dotenv import load_dotenv

load_dotenv()

from langchain_core.documents import Document
from langchain_google_genai import (
    ChatGoogleGenerativeAI,
)
from langchain_neo4j import Neo4jGraph
from langchain_experimental.graph_transformers import LLMGraphTransformer
from langchain_experimental.text_splitter import SemanticChunker
# 
from langchain_huggingface import HuggingFaceEmbeddings

# --------------------------
# 1. CONFIGURATION
# --------------------------
os.environ["OPENAI_API_KEY"] = "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"
google_api_key = os.environ.get("GOOGLE_API_KEY", "AIzaSyDL5p9qlju3AYUyPHRdLcd8bMJG2vNdBqM")
neo4j_uri = os.environ.get("NEO4J_URI", "neo4j://127.0.0.1:7687")
neo4j_username = os.environ.get("NEO4J_USERNAME", "neo4j")
neo4j_password = os.environ.get("NEO4J_PASSWORD", "1979@rabu")
neo4j_database = os.environ.get("NEO4J_DATABASE", "neo4j")

# --------------------------
# 2. GRAPH CONNECTION
# --------------------------
graph = Neo4jGraph(
    url=neo4j_uri,
    username=neo4j_username,
    password=neo4j_password,
    database=neo4j_database,
    refresh_schema=False
)

# --------------------------
# 3. EMBEDDINGS & TEXT SPLITTER
# --------------------------
model_name = "Qwen/Qwen3-Embedding-4B"
model_kwargs = {'device': 'cpu'}
encode_kwargs = {'normalize_embeddings': False}
hf_embeddings = HuggingFaceEmbeddings(
    model_name=model_name,
    model_kwargs=model_kwargs,
    encode_kwargs=encode_kwargs,
)
text_splitter = SemanticChunker(hf_embeddings,breakpoint_threshold_type="percentile", breakpoint_threshold_amount=90)

# --------------------------
# 4. LLM FOR GRAPH TRANSFORMATION
# --------------------------
llm_for_schema = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash", api_key=google_api_key
)

graph_transformer = LLMGraphTransformer(
    llm=llm_for_schema,
    allowed_nodes=[
        "Product", "Module", "Role", "Feature", "Parameter",
        "Workflow", "UIComponent", "UIArea", "Configuration"
    ],
    allowed_relationships=[
        "DEPENDS_ON", "CONFIGURES", "USES", "CONTAINS", "TRIGGERS",
        "HAS_PARAMETER", "ASSIGNED_TO", "APPROVES"
    ],
    node_properties=True,
    relationship_properties=True,
    ignore_tool_usage=False,
    additional_instructions="""
    You are a helpful assistant that can extract the schema of a graph from a text User Guide. 
    Annotate All Occurrences: Mark every instance of a defined entity type and relationship type found in the text.
    Exactness: Aim for precision. If unsure, err on the side of not annotating rather than introducing noise.
    Context is Key: Use surrounding sentences to disambiguate meaning when necessary.
    Follow Schema: Only annotate entities and relationships defined in the official lists. Do not introduce new types.
    """
)

# # --------------------------
# # 5. CLEAR EXISTING GRAPH
# # --------------------------
# graph.query("MATCH (n) DETACH DELETE n")

# --------------------------
# 6. PROCESS ALL FILES IN DIRECTORY
# --------------------------
input_directory = "360t-kg-api/data/raw_text"
all_chunks = []
SIMULATED_PAGE_SIZE = 3000  # Approximate number of characters per page

# Get all files from the directory that end with .txt
files_to_process = [
    os.path.join(input_directory, f)
    for f in os.listdir(input_directory)
    if os.path.isfile(os.path.join(input_directory, f)) and f.endswith(".txt")
]

for input_file_path in files_to_process:
    print(f"--- Processing file: {input_file_path} ---")
    try:
        with open(input_file_path, "r", encoding="utf-8") as f:
            full_text = f.read()
    except Exception as e:
        print(f"Could not read file {input_file_path}: {e}")
        continue  # skip to next file

    if not full_text.strip():
        print(f"File {input_file_path} is empty, skipping.")
        continue

    docs = text_splitter.create_documents([full_text])

    cursor = 0
    for i, doc in enumerate(docs):
        chunk_len = len(doc.page_content)

        # Use midpoint to simulate page number more accurately
        midpoint = cursor + (chunk_len // 2)
        page_number = (midpoint // SIMULATED_PAGE_SIZE) + 1

        metadata = {
            "file_name": input_file_path,
            "chunk_number": i + 1,
            "page_number": page_number,
        }
        
        # We need to create a new Document object to avoid modifying the original
        # which can have unintended side effects.
        graph_document_input = Document(page_content=doc.page_content, metadata=metadata)

        print(
            f"Processing {input_file_path} - chunk {i+1}/{len(docs)} - page {page_number}"
        )
        graph_docs = graph_transformer.convert_to_graph_documents([graph_document_input])
        graph.add_graph_documents(graph_docs, include_source=True)

        all_chunks.append(
            {
                "file_name": input_file_path,
                "chunk_number": i + 1,
                "page_number": page_number,
                "chunk": doc.page_content,
            }
        )
        
        cursor += chunk_len



print("Graph building complete with semantic chunking using HuggingFace embeddings.")
