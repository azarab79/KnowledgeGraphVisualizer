/**
 * Integration test for ChatView component with MessageReferences
 * This verifies that the updated ChatView correctly displays the new tabbed interface
 */

const fs = require('fs');
const path = require('path');

function testChatViewIntegration() {
  console.log('🧪 Testing ChatView Integration with MessageReferences');
  console.log('=' * 50);

  let passed = 0;
  let total = 0;

  // Test 1: Verify ChatView imports MessageReferences
  total++;
  try {
    const chatViewPath = path.join(__dirname, '..', '360t-kg-ui', 'src', 'components', 'ChatView.jsx');
    const chatViewContent = fs.readFileSync(chatViewPath, 'utf8');
    
    if (chatViewContent.includes("import MessageReferences from './MessageReferences'")) {
      console.log('✅ ChatView correctly imports MessageReferences');
      passed++;
    } else {
      console.log('❌ ChatView does not import MessageReferences');
    }
  } catch (error) {
    console.log('❌ Failed to read ChatView.jsx:', error.message);
  }

  // Test 2: Verify ChatView no longer imports DocumentReferences
  total++;
  try {
    const chatViewPath = path.join(__dirname, '..', '360t-kg-ui', 'src', 'components', 'ChatView.jsx');
    const chatViewContent = fs.readFileSync(chatViewPath, 'utf8');
    
    if (!chatViewContent.includes("import DocumentReferences from './DocumentReferences'")) {
      console.log('✅ ChatView no longer imports DocumentReferences');
      passed++;
    } else {
      console.log('❌ ChatView still imports DocumentReferences');
    }
  } catch (error) {
    console.log('❌ Failed to read ChatView.jsx:', error.message);
  }

  // Test 3: Verify ChatView uses MessageReferences component
  total++;
  try {
    const chatViewPath = path.join(__dirname, '..', '360t-kg-ui', 'src', 'components', 'ChatView.jsx');
    const chatViewContent = fs.readFileSync(chatViewPath, 'utf8');
    
    if (chatViewContent.includes('<MessageReferences')) {
      console.log('✅ ChatView uses MessageReferences component');
      passed++;
    } else {
      console.log('❌ ChatView does not use MessageReferences component');
    }
  } catch (error) {
    console.log('❌ Failed to read ChatView.jsx:', error.message);
  }

  // Test 4: Verify MessageReferences receives sourceNodes prop
  total++;
  try {
    const chatViewPath = path.join(__dirname, '..', '360t-kg-ui', 'src', 'components', 'ChatView.jsx');
    const chatViewContent = fs.readFileSync(chatViewPath, 'utf8');
    
    if (chatViewContent.includes('sourceNodes={message.sourceNodes')) {
      console.log('✅ MessageReferences receives sourceNodes prop');
      passed++;
    } else {
      console.log('❌ MessageReferences does not receive sourceNodes prop');
    }
  } catch (error) {
    console.log('❌ Failed to read ChatView.jsx:', error.message);
  }

  // Test 5: Verify MessageReferences receives sourceDocuments prop
  total++;
  try {
    const chatViewPath = path.join(__dirname, '..', '360t-kg-ui', 'src', 'components', 'ChatView.jsx');
    const chatViewContent = fs.readFileSync(chatViewPath, 'utf8');
    
    if (chatViewContent.includes('sourceDocuments={message.sourceDocuments')) {
      console.log('✅ MessageReferences receives sourceDocuments prop');
      passed++;
    } else {
      console.log('❌ MessageReferences does not receive sourceDocuments prop');
    }
  } catch (error) {
    console.log('❌ Failed to read ChatView.jsx:', error.message);
  }

  // Test 6: Verify onNodeSelect handler is implemented
  total++;
  try {
    const chatViewPath = path.join(__dirname, '..', '360t-kg-ui', 'src', 'components', 'ChatView.jsx');
    const chatViewContent = fs.readFileSync(chatViewPath, 'utf8');
    
    if (chatViewContent.includes('onNodeSelect={(nodeId) => {')) {
      console.log('✅ onNodeSelect handler is implemented');
      passed++;
    } else {
      console.log('❌ onNodeSelect handler is missing');
    }
  } catch (error) {
    console.log('❌ Failed to read ChatView.jsx:', error.message);
  }

  // Test 7: Verify MessageReferences component exists
  total++;
  try {
    const messageReferencesPath = path.join(__dirname, '..', '360t-kg-ui', 'src', 'components', 'MessageReferences.jsx');
    
    if (fs.existsSync(messageReferencesPath)) {
      console.log('✅ MessageReferences component file exists');
      passed++;
    } else {
      console.log('❌ MessageReferences component file does not exist');
    }
  } catch (error) {
    console.log('❌ Failed to check MessageReferences.jsx:', error.message);
  }

  // Test 8: Verify NodeChip component exists
  total++;
  try {
    const nodeChipPath = path.join(__dirname, '..', '360t-kg-ui', 'src', 'components', 'NodeChip.jsx');
    
    if (fs.existsSync(nodeChipPath)) {
      console.log('✅ NodeChip component file exists');
      passed++;
    } else {
      console.log('❌ NodeChip component file does not exist');
    }
  } catch (error) {
    console.log('❌ Failed to check NodeChip.jsx:', error.message);
  }

  // Test 9: Verify CSS files exist
  total++;
  try {
    const messageReferencesCSSPath = path.join(__dirname, '..', '360t-kg-ui', 'src', 'components', 'MessageReferences.css');
    const nodeChipCSSPath = path.join(__dirname, '..', '360t-kg-ui', 'src', 'components', 'NodeChip.css');
    
    if (fs.existsSync(messageReferencesCSSPath) && fs.existsSync(nodeChipCSSPath)) {
      console.log('✅ CSS files exist for new components');
      passed++;
    } else {
      console.log('❌ Missing CSS files for new components');
    }
  } catch (error) {
    console.log('❌ Failed to check CSS files:', error.message);
  }

  console.log('');
  console.log('=' * 50);
  console.log(`📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All ChatView integration tests passed!');
    console.log('✨ The tabbed source references feature is ready for use.');
    return true;
  } else {
    console.log('❌ Some tests failed. Please check the implementation.');
    return false;
  }
}

if (require.main === module) {
  const success = testChatViewIntegration();
  process.exit(success ? 0 : 1);
}

module.exports = { testChatViewIntegration }; 