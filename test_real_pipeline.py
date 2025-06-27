#!/usr/bin/env python3

from kg_qa_pipeline_enhanced import create_qa_pipeline

try:
    print("🧪 Testing real knowledge graph pipeline...")
    pipeline = create_qa_pipeline()
    print("✅ Pipeline created successfully")
    
    result = pipeline.process_question("What is a risk-reversal?")
    print("✅ Question processed successfully")
    print("Answer:", result.get('final_answer', 'No answer'))
    print("Sources:", result.get('sources', []))
    
except Exception as e:
    print("❌ Error:", str(e))
    import traceback
    traceback.print_exc() 