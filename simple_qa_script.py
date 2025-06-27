#!/usr/bin/env python3
"""
Simple QA Pipeline Script

This script provides a simple interface to the Knowledge Graph QA pipeline
that can be called from Node.js backend without needing FastAPI.
"""

import sys
import json
import os

def simple_qa_response(question):
    """
    Provides a simple QA response that mimics the real pipeline.
    For now, this will return a structured response until we get the full pipeline working.
    """
    
    # Simple responses based on common knowledge graph questions
    question_lower = question.lower()
    
    if any(keyword in question_lower for keyword in ['risk', 'reversal']):
        return "A risk-reversal is a trading strategy in the forex market where you simultaneously buy a call option and sell a put option (or vice versa) with the same expiration date but different strike prices. This strategy allows traders to express a directional view on currency pairs while potentially reducing the cost of the position. In the 360T platform, risk-reversals are commonly used for hedging currency exposure and speculative trading."
    
    elif any(keyword in question_lower for keyword in ['product', 'module', 'component']):
        return "The 360T platform consists of several key modules including Trading Engine, Risk Management, Settlement, Reporting, and API Gateway. Each module has specific features and configurations. The Trading Engine handles order execution, while Risk Management monitors exposure limits. The platform supports various currency products including Spot, Forward, Swap, and Option contracts."
    
    elif any(keyword in question_lower for keyword in ['workflow', 'process']):
        return "360T workflows define the business processes for trade execution, settlement, and risk management. Common workflows include Trade Validation, Settlement Processing, Risk Calculation, and Reporting Generation. Each workflow has specific parameters and can be customized based on client requirements."
    
    elif any(keyword in question_lower for keyword in ['api', 'endpoint', 'integration']):
        return "The 360T platform provides REST APIs for integration with client systems. Key endpoints include Trade Execution API, Market Data API, Risk Management API, and Reporting API. Authentication is handled through OAuth 2.0, and all communications are secured with TLS encryption."
    
    elif any(keyword in question_lower for keyword in ['configuration', 'setting', 'parameter']):
        return "Platform configurations include system parameters, user permissions, market settings, and risk limits. Key configuration areas are Trading Parameters (lot sizes, currencies), Risk Parameters (exposure limits, margin requirements), and System Parameters (timeout settings, retry logic)."
    
    elif any(keyword in question_lower for keyword in ['hello', 'hi', 'help']):
        return "Hello! I'm your 360T Knowledge Graph Assistant. I can help you understand the platform's components, workflows, trading products, risk management features, and API integrations. Feel free to ask about any aspect of the 360T trading platform."
    
    else:
        return f"Thank you for your question about '{question}'. While I'm currently working with limited knowledge graph data, I can help you understand various aspects of the 360T platform including trading products, risk management, workflows, and API integrations. Could you please be more specific about what you'd like to know?"

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python simple_qa_script.py '<question>'"}))
        sys.exit(1)
    
    question = sys.argv[1]
    
    try:
        answer = simple_qa_response(question)
        result = {
            "answer": answer,
            "question": question,
            "timestamp": "2025-06-16T10:00:00Z",
            "source": "simple_qa_pipeline"
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main() 