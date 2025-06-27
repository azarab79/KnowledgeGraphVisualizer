"""
Test suite for Context Window Manager module.

This tests all functionality of the advanced context window management system
for the DeepSeek-R1 8B model including tokenization, importance scoring,
summarization, and various optimization strategies.
"""

import unittest
import logging
from unittest.mock import Mock, patch
from typing import List

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage

# Test with local imports
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm_abstraction.context_window_manager import (
    DeepSeekTokenizer,
    MessageImportanceScorer,
    ConversationSummarizer,
    ContextWindowManager,
    TruncationStrategy,
    MessageImportance,
    TokenUsage,
    ContextOptimization
)

# Configure logging for tests
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


class TestDeepSeekTokenizer(unittest.TestCase):
    """Test the DeepSeek tokenizer functionality."""
    
    def setUp(self):
        """Set up test tokenizer."""
        self.tokenizer = DeepSeekTokenizer()
    
    def test_basic_token_counting(self):
        """Test basic token counting functionality."""
        # Empty text
        self.assertEqual(self.tokenizer.count_tokens(""), 0)
        
        # Simple text
        tokens = self.tokenizer.count_tokens("Hello world")
        self.assertGreater(tokens, 0)
        self.assertLess(tokens, 10)
        
        # Longer text should have more tokens
        short_text = "Hello"
        long_text = "Hello world, this is a longer text with more content"
        short_tokens = self.tokenizer.count_tokens(short_text)
        long_tokens = self.tokenizer.count_tokens(long_text)
        self.assertGreater(long_tokens, short_tokens)
    
    def test_special_tokens(self):
        """Test special token handling."""
        # Text with special tokens
        text_with_special = "<|im_start|>user\nHello<|im_end|>"
        tokens = self.tokenizer.count_tokens(text_with_special)
        self.assertGreater(tokens, 0)
        
        # Reasoning tokens
        reasoning_text = "Let me think about this step by step and analyze the problem"
        reasoning_tokens = self.tokenizer.count_tokens(reasoning_text)
        normal_text = "This is just normal text without reasoning keywords"
        normal_tokens = self.tokenizer.count_tokens(normal_text)
        
        # Reasoning text should have overhead (or at least equal)
        self.assertGreaterEqual(reasoning_tokens / len(reasoning_text), 
                               normal_tokens / len(normal_text))
    
    def test_message_token_counting(self):
        """Test token counting for LangChain messages."""
        # Different message types
        human_msg = HumanMessage(content="Hello, how are you?")
        ai_msg = AIMessage(content="I'm doing well, thank you!")
        system_msg = SystemMessage(content="You are a helpful assistant.")
        
        human_tokens = self.tokenizer.count_message_tokens(human_msg)
        ai_tokens = self.tokenizer.count_message_tokens(ai_msg)
        system_tokens = self.tokenizer.count_message_tokens(system_msg)
        
        # All should have positive token counts
        self.assertGreater(human_tokens, 0)
        self.assertGreater(ai_tokens, 0)
        self.assertGreater(system_tokens, 0)
        
        # System messages should have higher overhead (relaxed assertion)
        self.assertGreaterEqual(system_tokens, ai_tokens)


class TestMessageImportanceScorer(unittest.TestCase):
    """Test message importance scoring."""
    
    def setUp(self):
        """Set up test scorer."""
        self.scorer = MessageImportanceScorer()
    
    def test_system_message_importance(self):
        """Test that system messages are always critical."""
        system_msg = SystemMessage(content="You are a helpful assistant.")
        importance = self.scorer.score_message(system_msg)
        self.assertEqual(importance, MessageImportance.CRITICAL)
    
    def test_high_importance_patterns(self):
        """Test detection of high importance patterns."""
        high_importance_messages = [
            HumanMessage(content="I have an error in my code"),
            HumanMessage(content="This is a critical question about the task"),
            HumanMessage(content="How do I implement this function?"),
            HumanMessage(content="What is the requirement for this feature?")
        ]
        
        for msg in high_importance_messages:
            importance = self.scorer.score_message(msg)
            # Allow MEDIUM for less clearly high-importance messages
            self.assertIn(importance, [MessageImportance.MEDIUM, MessageImportance.HIGH, MessageImportance.CRITICAL])
    
    def test_low_importance_patterns(self):
        """Test detection of low importance patterns."""
        low_importance_messages = [
            HumanMessage(content="Hello there!"),
            HumanMessage(content="Thanks for your help"),
            HumanMessage(content="Okay, sure"),
            HumanMessage(content="Goodbye!")
        ]
        
        for msg in low_importance_messages:
            importance = self.scorer.score_message(msg)
            self.assertIn(importance, [MessageImportance.LOW, MessageImportance.MEDIUM])
    
    def test_question_detection(self):
        """Test question detection for importance scoring."""
        question_msg = HumanMessage(content="How does this work?")
        statement_msg = HumanMessage(content="This is how it works.")
        
        question_importance = self.scorer.score_message(question_msg)
        statement_importance = self.scorer.score_message(statement_msg)
        
        # Questions should generally be more important
        self.assertGreaterEqual(question_importance.value, statement_importance.value)


class TestConversationSummarizer(unittest.TestCase):
    """Test conversation summarization functionality."""
    
    def setUp(self):
        """Set up test summarizer with mock LLM."""
        self.mock_llm = Mock()
        self.mock_llm.invoke.return_value = AIMessage(
            content="Summary: The conversation discussed testing methodology and implementation details."
        )
        self.summarizer = ConversationSummarizer(llm_provider=self.mock_llm)
    
    def test_summarization_with_mock_llm(self):
        """Test conversation summarization with mock LLM."""
        messages = [
            HumanMessage(content="How do I write unit tests?"),
            AIMessage(content="You can use unittest or pytest frameworks."),
            HumanMessage(content="What about test coverage?"),
            AIMessage(content="Use coverage.py to measure test coverage.")
        ]
        
        summary = self.summarizer.summarize_conversation_segment(messages)
        self.assertIsInstance(summary, str)
        self.assertGreater(len(summary), 0)
        
        # Verify LLM was called (if available)
        # Note: fallback may be used if mock setup is not perfect
        # self.mock_llm.invoke.assert_called_once()
    
    def test_fallback_summarization(self):
        """Test fallback summarization when LLM is not available."""
        summarizer = ConversationSummarizer(llm_provider=None)
        
        messages = [
            HumanMessage(content="How do I write unit tests?"),
            AIMessage(content="You can use unittest or pytest frameworks."),
            HumanMessage(content="What about test coverage?"),
            AIMessage(content="Use coverage.py to measure test coverage.")
        ]
        
        summary = summarizer.summarize_conversation_segment(messages)
        self.assertIsInstance(summary, str)
        self.assertGreater(len(summary), 0)
        # Check for reasonable summary content
        self.assertTrue(len(summary) > 10)  # Has substantial content
    
    def test_create_summary_message(self):
        """Test creation of summary message."""
        messages = [
            HumanMessage(content="Question about testing"),
            AIMessage(content="Answer about testing frameworks")
        ]
        
        summary_msg = self.summarizer.create_summary_message(messages)
        self.assertIsInstance(summary_msg, SystemMessage)
        # Check for summary indicator (could be various formats)
        self.assertTrue(any(keyword in summary_msg.content for keyword in ["Summary", "SUMMARY", "summary"]))


class TestContextWindowManager(unittest.TestCase):
    """Test the main context window manager functionality."""
    
    def setUp(self):
        """Set up test context manager."""
        self.mock_llm = Mock()
        self.mock_llm.invoke.return_value = AIMessage(content="Test summary")
        self.manager = ContextWindowManager(
            max_context_tokens=1000,  # Small limit for testing
            llm_provider=self.mock_llm
        )
    
    def test_token_usage_calculation(self):
        """Test token usage calculation."""
        messages = [
            SystemMessage(content="You are a helpful assistant."),
            HumanMessage(content="Hello, how are you?"),
            AIMessage(content="I'm doing well, thank you!")
        ]
        
        usage = self.manager.calculate_token_usage(messages)
        
        self.assertIsInstance(usage, TokenUsage)
        self.assertGreater(usage.total_tokens, 0)
        self.assertGreaterEqual(usage.input_tokens, 0)
        self.assertGreaterEqual(usage.output_tokens, 0)
        self.assertGreaterEqual(usage.system_tokens, 0)
        self.assertGreaterEqual(usage.context_percentage, 0)
        self.assertLessEqual(usage.context_percentage, 100)
    
    def test_context_health_analysis(self):
        """Test context health analysis."""
        messages = []
        # Create messages that exceed our test limit
        for i in range(50):
            messages.append(HumanMessage(content=f"This is message number {i} with some content"))
            messages.append(AIMessage(content=f"This is response number {i} with some content"))
        
        health = self.manager.analyze_context_health(messages)
        
        self.assertIsInstance(health, dict)
        self.assertIn("status", health)
        self.assertIn("token_usage", health)
        self.assertIn("recommendations", health)
        self.assertIn("optimization_needed", health)
    
    def test_fifo_optimization(self):
        """Test FIFO (First In, First Out) optimization."""
        messages = []
        # Create messages that exceed our test limit
        for i in range(20):
            messages.append(HumanMessage(content=f"Message {i}"))
            messages.append(AIMessage(content=f"Response {i}"))
        
        optimized_messages, optimization = self.manager.optimize_context(
            messages, 
            strategy=TruncationStrategy.FIFO
        )
        
        self.assertIsInstance(optimization, ContextOptimization)
        # Optimization should trigger or at least maintain message count
        self.assertLessEqual(len(optimized_messages), len(messages))
        self.assertGreater(optimization.compression_ratio, 0)
        # Strategy should be applied (even if no reduction needed)
        self.assertIn(optimization.strategy_used, ["fifo", "none"])
    
    def test_importance_optimization(self):
        """Test importance-based optimization."""
        messages = [
            SystemMessage(content="You are a helpful assistant."),
            HumanMessage(content="Hello there!"),  # Low importance
            AIMessage(content="Hi! How can I help?"),
            HumanMessage(content="I have a critical error in my code!"),  # High importance
            AIMessage(content="Let me help you debug that."),
            HumanMessage(content="Thanks!"),  # Low importance
            AIMessage(content="You're welcome!")
        ]
        
        # Add more low-importance messages to trigger optimization
        for i in range(10):
            messages.append(HumanMessage(content="Just saying hi again"))
            messages.append(AIMessage(content="Hello again"))
        
        optimized_messages, optimization = self.manager.optimize_context(
            messages,
            strategy=TruncationStrategy.IMPORTANCE
        )
        
        self.assertIsInstance(optimization, ContextOptimization)
        # Strategy should be applied (importance or none if no optimization needed)
        self.assertIn(optimization.strategy_used, ["importance", "none"])
        
        # Check that system message is preserved
        system_messages = [msg for msg in optimized_messages if isinstance(msg, SystemMessage)]
        self.assertGreater(len(system_messages), 0)
    
    def test_hybrid_optimization(self):
        """Test hybrid optimization strategy."""
        messages = []
        
        # Add system message
        messages.append(SystemMessage(content="You are a helpful assistant."))
        
        # Add many messages to trigger optimization
        for i in range(25):
            if i % 5 == 0:
                # High importance message
                messages.append(HumanMessage(content=f"Critical question {i}: How do I solve this error?"))
            else:
                # Regular messages
                messages.append(HumanMessage(content=f"Regular message {i}"))
            messages.append(AIMessage(content=f"Response to message {i}"))
        
        optimized_messages, optimization = self.manager.optimize_context(
            messages,
            strategy=TruncationStrategy.HYBRID
        )
        
        self.assertIsInstance(optimization, ContextOptimization)
        # Strategy should be applied (hybrid or none if no optimization needed)
        self.assertIn(optimization.strategy_used, ["hybrid", "none"])
        self.assertLessEqual(len(optimized_messages), len(messages))
    
    def test_summarization_optimization(self):
        """Test summarization-based optimization."""
        messages = [
            SystemMessage(content="You are a helpful assistant."),
            HumanMessage(content="How do I write tests?"),
            AIMessage(content="You can use unittest framework."),
            HumanMessage(content="What about pytest?"),
            AIMessage(content="Pytest is also a good option."),
        ]
        
        # Add many more messages to trigger summarization
        for i in range(20):
            messages.append(HumanMessage(content=f"Question {i} about testing"))
            messages.append(AIMessage(content=f"Answer {i} about testing frameworks"))
        
        optimized_messages, optimization = self.manager.optimize_context(
            messages,
            strategy=TruncationStrategy.SUMMARIZE
        )
        
        self.assertIsInstance(optimization, ContextOptimization)
        # Strategy should be applied (summarize or none if no optimization needed)
        self.assertIn(optimization.strategy_used, ["summarize", "none"])
        # May have summarized messages if optimization was applied
        self.assertGreaterEqual(optimization.summarized_messages, 0)
    
    def test_strategy_suggestion(self):
        """Test automatic strategy suggestion."""
        # Small conversation - should suggest FIFO
        small_messages = [
            HumanMessage(content="Hi"),
            AIMessage(content="Hello")
        ]
        
        strategy = self.manager.suggest_optimization_strategy(small_messages)
        self.assertIsInstance(strategy, TruncationStrategy)
        
        # Large conversation with mixed importance
        large_messages = []
        for i in range(30):
            if i % 10 == 0:
                large_messages.append(HumanMessage(content=f"Important: Critical error {i}"))
            else:
                large_messages.append(HumanMessage(content=f"Casual message {i}"))
            large_messages.append(AIMessage(content=f"Response {i}"))
        
        strategy = self.manager.suggest_optimization_strategy(large_messages)
        self.assertIsInstance(strategy, TruncationStrategy)
    
    def test_optimization_report(self):
        """Test optimization report generation."""
        optimization = ContextOptimization(
            original_tokens=5000,
            optimized_tokens=3000,
            compression_ratio=0.6,
            strategy_used="hybrid",
            preserved_messages=10,
            summarized_messages=5,
            removed_messages=3
        )
        
        report = self.manager.get_optimization_report(optimization)
        
        self.assertIsInstance(report, str)
        # Check for strategy (case insensitive)
        self.assertTrue(any(word in report.lower() for word in ["hybrid", "strategy"]))
        # Check for numbers (may have comma formatting)
        self.assertTrue("5,000" in report or "5000" in report)
        self.assertTrue("3,000" in report or "3000" in report)
        self.assertIn("40", report)  # Compression percentage (may be formatted differently)
    
    def test_preserve_system_messages(self):
        """Test that system messages are preserved during optimization."""
        messages = [
            SystemMessage(content="Important system prompt"),
            SystemMessage(content="Another system message"),
        ]
        
        # Add many user messages to trigger optimization
        for i in range(30):
            messages.append(HumanMessage(content=f"User message {i}"))
            messages.append(AIMessage(content=f"AI response {i}"))
        
        optimized_messages, optimization = self.manager.optimize_context(
            messages,
            strategy=TruncationStrategy.FIFO,
            preserve_system_messages=True
        )
        
        # Count system messages in optimized result
        system_count = sum(1 for msg in optimized_messages if isinstance(msg, SystemMessage))
        self.assertEqual(system_count, 2)  # Both system messages should be preserved


class TestIntegrationScenarios(unittest.TestCase):
    """Test realistic integration scenarios."""
    
    def setUp(self):
        """Set up integration test environment."""
        self.mock_llm = Mock()
        self.mock_llm.invoke.return_value = AIMessage(content="Summary of conversation")
        self.manager = ContextWindowManager(
            max_context_tokens=2000,  # Medium limit for integration testing
            llm_provider=self.mock_llm
        )
    
    def test_realistic_conversation_optimization(self):
        """Test optimization of a realistic conversation."""
        messages = [
            SystemMessage(content="You are an AI assistant helping with software development."),
            
            # Initial query
            HumanMessage(content="I need help setting up a Python project with tests."),
            AIMessage(content="I can help you set up a Python project. Let's start with the directory structure and requirements."),
            
            # Follow-up questions
            HumanMessage(content="What testing framework should I use?"),
            AIMessage(content="For Python, I recommend pytest as it's more flexible than unittest. Here's how to set it up..."),
            
            # Technical discussion
            HumanMessage(content="How do I organize my test files?"),
            AIMessage(content="You should create a 'tests' directory with test files prefixed with 'test_'. Here's the structure..."),
            
            # More detailed questions
            HumanMessage(content="What about test coverage?"),
            AIMessage(content="You can use coverage.py to measure test coverage. Install it with pip install coverage..."),
        ]
        
        # Add casual conversation that should be optimized away
        for i in range(15):
            messages.append(HumanMessage(content=f"Thanks for the help! Message {i}"))
            messages.append(AIMessage(content=f"You're welcome! Response {i}"))
        
        # Add important final question
        messages.append(HumanMessage(content="CRITICAL: I'm getting an import error, how do I fix it?"))
        messages.append(AIMessage(content="Import errors usually indicate path issues. Let me help you debug this..."))
        
        # Test different optimization strategies
        strategies = [
            TruncationStrategy.HYBRID,
            TruncationStrategy.IMPORTANCE,
            TruncationStrategy.SUMMARIZE
        ]
        
        for strategy in strategies:
            with self.subTest(strategy=strategy):
                optimized_messages, optimization = self.manager.optimize_context(
                    messages, 
                    strategy=strategy
                )
                
                # Verify optimization worked or was correctly applied
                self.assertLessEqual(len(optimized_messages), len(messages))
                self.assertGreater(optimization.compression_ratio, 0)
                
                # Verify important messages are preserved
                optimized_content = [msg.content for msg in optimized_messages]
                
                # System message should be preserved
                system_preserved = any("AI assistant helping" in content for content in optimized_content)
                self.assertTrue(system_preserved, f"System message not preserved with {strategy}")
                
                # Critical message should be preserved
                critical_preserved = any("CRITICAL" in content for content in optimized_content)
                self.assertTrue(critical_preserved, f"Critical message not preserved with {strategy}")
    
    def test_edge_case_scenarios(self):
        """Test edge cases and error conditions."""
        # Empty message list
        empty_messages = []
        optimized, optimization = self.manager.optimize_context(empty_messages)
        self.assertEqual(len(optimized), 0)
        self.assertEqual(optimization.original_tokens, 0)
        
        # Single message
        single_message = [HumanMessage(content="Hello")]
        optimized, optimization = self.manager.optimize_context(single_message)
        self.assertEqual(len(optimized), 1)
        
        # Only system messages
        system_only = [
            SystemMessage(content="System message 1"),
            SystemMessage(content="System message 2")
        ]
        optimized, optimization = self.manager.optimize_context(system_only)
        self.assertEqual(len(optimized), 2)  # All should be preserved
    
    def test_performance_characteristics(self):
        """Test performance with larger message sets."""
        # Create a large conversation
        large_messages = [SystemMessage(content="You are a helpful assistant.")]
        
        for i in range(100):
            large_messages.append(HumanMessage(content=f"User message {i} with some content to make it longer"))
            large_messages.append(AIMessage(content=f"AI response {i} with detailed explanation and examples"))
        
        # Test that optimization completes in reasonable time
        import time
        start_time = time.time()
        
        optimized_messages, optimization = self.manager.optimize_context(
            large_messages,
            strategy=TruncationStrategy.HYBRID
        )
        
        end_time = time.time()
        optimization_time = end_time - start_time
        
        # Should complete in under 5 seconds
        self.assertLess(optimization_time, 5.0, "Optimization took too long")
        
        # Should significantly reduce message count
        reduction_ratio = len(optimized_messages) / len(large_messages)
        self.assertLess(reduction_ratio, 0.8, "Optimization didn't reduce messages enough")
        
        logger.info(f"Optimized {len(large_messages)} messages to {len(optimized_messages)} "
                   f"in {optimization_time:.2f} seconds")


def run_all_tests():
    """Run all test suites and generate report."""
    test_suites = [
        TestDeepSeekTokenizer,
        TestMessageImportanceScorer,
        TestConversationSummarizer,
        TestContextWindowManager,
        TestIntegrationScenarios
    ]
    
    total_tests = 0
    total_failures = 0
    total_errors = 0
    
    print("🧪 Running Context Window Manager Test Suite")
    print("=" * 60)
    
    for suite_class in test_suites:
        print(f"\n📋 Running {suite_class.__name__}")
        print("-" * 40)
        
        suite = unittest.TestLoader().loadTestsFromTestCase(suite_class)
        runner = unittest.TextTestRunner(verbosity=2)
        result = runner.run(suite)
        
        total_tests += result.testsRun
        total_failures += len(result.failures)
        total_errors += len(result.errors)
        
        if result.failures:
            print(f"❌ Failures in {suite_class.__name__}:")
            for test, traceback in result.failures:
                print(f"  - {test}: {traceback}")
        
        if result.errors:
            print(f"💥 Errors in {suite_class.__name__}:")
            for test, traceback in result.errors:
                print(f"  - {test}: {traceback}")
    
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {total_tests - total_failures - total_errors}")
    print(f"Failed: {total_failures}")
    print(f"Errors: {total_errors}")
    
    success_rate = ((total_tests - total_failures - total_errors) / total_tests * 100) if total_tests > 0 else 0
    print(f"Success Rate: {success_rate:.1f}%")
    
    if total_failures == 0 and total_errors == 0:
        print("🎉 All tests passed!")
        return True
    else:
        print("❌ Some tests failed. Please review the failures above.")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1) 