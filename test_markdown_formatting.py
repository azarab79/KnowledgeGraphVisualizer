#!/usr/bin/env python3
"""
Test script to demonstrate enhanced Markdown formatting for LLM responses.
"""

import json
import sys
import os

# Add the current directory to Python path so we can import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from real_llm_kg_script import get_real_kg_data, generate_llm_response

def test_markdown_formatting():
    """Test the enhanced Markdown formatting with a sample question."""
    
    # Sample question
    test_question = "What are the key features of hybrid margin in 360T?"
    
    print("🧪 Testing Enhanced Markdown Formatting")
    print("=" * 60)
    print(f"Question: {test_question}")
    print("=" * 60)
    
    try:
        # Get knowledge graph data
        print("📊 Retrieving knowledge graph data...")
        kg_data = get_real_kg_data(test_question)
        
        if kg_data["success"]:
            print(f"✅ Found {kg_data['num_docs']} documents")
        else:
            print(f"❌ Error: {kg_data.get('error')}")
        
        # Generate formatted response
        print("🤖 Generating Markdown-formatted response...")
        answer = generate_llm_response(test_question, kg_data)
        
        print("\n" + "=" * 60)
        print("📝 COMPACT MARKDOWN RESPONSE:")
        print("=" * 60)
        print(answer)
        print("=" * 60)
        
        # Also show how it would look in JSON format (for API responses)
        result = {
            "answer": answer,
            "question": test_question,
            "formatted": True,
            "content_type": "markdown",
            "kg_success": kg_data["success"],
            "documents_found": kg_data["num_docs"]
        }
        
        print("\n🔧 JSON API Response Format:")
        print("-" * 30)
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"❌ Error during test: {e}")
        
def show_markdown_features():
    """Demonstrate the Markdown features that will be used in responses."""
    
    sample_response = """## Hybrid Margin Overview

**Hybrid margin** is a specialized margin type in the 360T platform that combines different margin calculation methods.

### Key Features

- **Mixed Margin Units**: Allows spot bid/offer margin in `pips` while forward/swap margins use `percent`
- **Product Availability**: 
  - FX Spot ✅
  - FX Forward ✅  
  - FX Swap ✅
- **Calculation Options**:
  - Forward margin based on forward points or spot rate
  - Swap margin based on swap points or spot rate

### Important Notes

> ⚠️ **Uneven Swaps**: The "Apply Spot Margin to Uneven Swaps" feature is compatible with hybrid margin.

### Example Configuration

```yaml
margin_type: hybrid
spot_margin: 2.5 pips
forward_margin: 0.15 percent
calculation_method: spot_rate
```

### 💡 Related Questions

- How do I configure hybrid margin for a specific currency pair?
- What's the difference between fixed and variable margin types?
- Can hybrid margin be used with risk reversal strategies?

---
*📊 This response is based on **8 documents** from the 360T knowledge graph.*"""

    print("\n" + "=" * 60)
    print("🎨 COMPACT MARKDOWN FORMATTING DEMONSTRATION")
    print("=" * 60)
    print(sample_response)
    print("=" * 60)
    
    print("\n🔍 NEW Features:")
    print("✅ COMPACT FORMATTING:")
    print("  - Reduced line heights and margins")
    print("  - Tighter spacing between elements")
    print("  - More content visible in same space")
    print("\n🖱️ CLICKABLE RELATED QUESTIONS:")
    print("  - Questions ending with '?' are automatically clickable")
    print("  - Hover effects with visual feedback")
    print("  - Click to automatically send as new question")
    print("  - Works in the 'Related Questions' section")
    
    print("\n🔍 Other Markdown Features Used:")
    print("- ## Main sections (h2)")
    print("- ### Subsections (h3)")  
    print("- **Bold text** for emphasis")
    print("- `Code blocks` for technical terms")
    print("- ✅❌ Emojis for visual feedback")
    print("- > Blockquotes for warnings/notes")
    print("- Bullet points for lists")
    print("- Code blocks for examples")
    print("- Horizontal rules (---) for separation")
    print("- Metadata footer with icons")

def test_clickable_questions():
    """Test the clickable questions functionality."""
    print("\n" + "=" * 60)
    print("🖱️ CLICKABLE QUESTIONS TEST")
    print("=" * 60)
    
    print("In the frontend, the following items will be clickable:")
    print()
    
    clickable_examples = [
        "How do I configure hybrid margin for a specific currency pair?",
        "What's the difference between fixed and variable margin types?", 
        "Can hybrid margin be used with risk reversal strategies?",
        "What are margins defined for FX Swaps?",
        "How are margin rules created and managed?"
    ]
    
    for i, question in enumerate(clickable_examples, 1):
        print(f"  {i}. {question}")
        print(f"     → 🖱️ Click to automatically send this question")
    
    print("\n💡 Visual Features:")
    print("  - Blue color (#0366d6) to indicate clickable")
    print("  - Hover: Light blue background (#f1f8ff)")
    print("  - Click: Brief animation with darker blue (#cce8ff)")
    print("  - Cursor changes to pointer on hover")

if __name__ == "__main__":
    print("🚀 Enhanced Compact Markdown + Clickable Questions Test Suite")
    print("=" * 70)
    
    # Show what markdown features will be used
    show_markdown_features()
    
    # Show clickable functionality
    test_clickable_questions()
    
    # Test with real knowledge graph if available
    choice = input("\n🤔 Test with real knowledge graph? (y/N): ").lower().strip()
    if choice in ['y', 'yes']:
        test_markdown_formatting()
    else:
        print("✅ Skipping real KG test. Demo complete!")
        print("\n🌐 Visit http://localhost:5177 and go to the Chat tab to see the features in action!") 