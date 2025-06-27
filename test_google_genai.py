#!/usr/bin/env python3

import os

# Set the Google API key that's already in the code
os.environ['GOOGLE_API_KEY'] = 'AIzaSyAzB7O_owmCvb5hyqlRG3mjDecvu_QxugI'

from kg_qa_pipeline_enhanced import create_qa_pipeline

try:
    print("🧪 Testing Google GenAI as primary provider...")
    pipeline = create_qa_pipeline(
        primary_provider='google_genai', 
        fallback_providers=[]  # No fallbacks for cleaner test
    )
    print("✅ Pipeline created successfully")
    
    result = pipeline.process_question("What is a risk-reversal?")
    print("✅ Question processed successfully")
    print("Answer:", result.get('answer', 'No answer'))
    
except Exception as e:
    print("❌ Error:", str(e))
    import traceback
    traceback.print_exc() 