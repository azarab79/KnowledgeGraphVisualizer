import { test, expect } from '@playwright/test';

test('Deep investigation: LLM to GUI data flow analysis', async ({ page }) => {
  // Intercept and log all network requests to trace data flow
  const apiCalls: any[] = [];
  const responses: any[] = [];
  
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      apiCalls.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
        timestamp: new Date().toISOString()
      });
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      try {
        const responseData = await response.json();
        responses.push({
          url: response.url(),
          status: response.status(),
          data: responseData,
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        responses.push({
          url: response.url(),
          status: response.status(),
          error: 'Could not parse JSON',
          timestamp: new Date().toISOString()
        });
      }
    }
  });

  // Enable detailed console logging
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[BROWSER-${type.toUpperCase()}]:`, text);
  });

  await page.goto('/');

  // Navigate to Chat tab
  await page.getByRole('button', { name: /chat/i }).click();

  console.log('🔍 INVESTIGATION STARTED: Tracing data flow from LLM to GUI');
  console.log('=====================================');

  // Ask a specific question about finance/trading
  const testQuestion = 'What is a risk-reversal strategy in options trading?';
  console.log(`📝 STEP 1: Asking question: "${testQuestion}"`);

  const input = page.getByRole('textbox');
  await input.fill(testQuestion);
  await input.press('Enter');

  console.log('⏳ STEP 2: Waiting for API response...');

  // Wait for the response to complete
  await page.waitForLoadState('networkidle');
  
  // Wait a bit more to ensure all data is processed
  await page.waitForTimeout(3000);

  console.log('📊 STEP 3: ANALYZING API CALLS AND RESPONSES');
  console.log('=====================================');

  // Log all API calls made
  apiCalls.forEach((call, index) => {
    console.log(`API CALL ${index + 1}:`);
    console.log(`  URL: ${call.url}`);
    console.log(`  Method: ${call.method}`);
    console.log(`  Time: ${call.timestamp}`);
    if (call.postData) {
      try {
        const parsedData = JSON.parse(call.postData);
        console.log(`  Post Data:`, JSON.stringify(parsedData, null, 2));
      } catch (e) {
        console.log(`  Post Data: ${call.postData}`);
      }
    }
    console.log('---');
  });

  // Log all API responses
  responses.forEach((response, index) => {
    console.log(`API RESPONSE ${index + 1}:`);
    console.log(`  URL: ${response.url}`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Time: ${response.timestamp}`);
    
    if (response.data) {
      console.log(`  Response Keys:`, Object.keys(response.data));
      
      // Check for LLM response
      if (response.data.response) {
        console.log(`  LLM Response Text: "${response.data.response.slice(0, 200)}..."`);
      }
      
      // Check for source nodes at different levels
      if (response.data.sourceNodes) {
        console.log(`  🎯 SOURCE NODES (Top Level): ${response.data.sourceNodes.length} nodes`);
        response.data.sourceNodes.forEach((node, i) => {
          console.log(`    Node ${i + 1}: ID=${node.id}, Name="${node.name || node.properties?.name}", Labels=${node.labels?.join(',')}`);
        });
      }
      
      if (response.data.response?.sourceNodes) {
        console.log(`  🎯 SOURCE NODES (Nested): ${response.data.response.sourceNodes.length} nodes`);
        response.data.response.sourceNodes.forEach((node, i) => {
          console.log(`    Node ${i + 1}: ID=${node.id}, Name="${node.name || node.properties?.name}", Labels=${node.labels?.join(',')}`);
        });
      }
      
      // Check for source documents
      if (response.data.sourceDocuments) {
        console.log(`  📄 SOURCE DOCUMENTS (Top Level): ${response.data.sourceDocuments.length} documents`);
      }
      
      if (response.data.response?.sourceDocuments) {
        console.log(`  📄 SOURCE DOCUMENTS (Nested): ${response.data.response.sourceDocuments.length} documents`);
      }
    }
    console.log('---');
  });

  console.log('🖥️ STEP 4: ANALYZING GUI STATE');
  console.log('=====================================');

  // Get the assistant's response text
  const assistantMessages = page.locator('.message.assistant .message-text');
  const messageCount = await assistantMessages.count();
  console.log(`Found ${messageCount} assistant messages`);

  if (messageCount > 0) {
    const lastMessage = assistantMessages.last();
    const messageText = await lastMessage.textContent();
    console.log(`📝 LLM Response Text: "${messageText?.slice(0, 300)}..."`);
    
    // Analyze if the response is about the question asked
    const isRelevant = messageText?.toLowerCase().includes('risk') || 
                      messageText?.toLowerCase().includes('option') ||
                      messageText?.toLowerCase().includes('reversal') ||
                      messageText?.toLowerCase().includes('trading');
    console.log(`🎯 Response Relevance Check: ${isRelevant ? '✅ RELEVANT' : '❌ NOT RELEVANT'}`);
  }

  // Analyze node chips
  const nodeChips = page.locator('.node-chip');
  const chipCount = await nodeChips.count();
  console.log(`🔗 Found ${chipCount} node chips in GUI`);

  const chipData: any[] = [];
  for (let i = 0; i < Math.min(chipCount, 10); i++) {
    const chip = nodeChips.nth(i);
    const chipText = await chip.textContent();
    const chipTitle = await chip.getAttribute('title');
    
    chipData.push({
      index: i,
      text: chipText?.trim(),
      title: chipTitle?.trim()
    });
    
    console.log(`  Chip ${i + 1}: Text="${chipText?.trim()}", Title="${chipTitle?.trim()}"`);
  }

  console.log('🔍 STEP 5: RELEVANCE ANALYSIS');
  console.log('=====================================');

  // Analyze if any nodes are relevant to the question
  const questionKeywords = ['risk', 'reversal', 'option', 'trading', 'strategy', 'finance'];
  
  chipData.forEach((chip, index) => {
    const isRelevant = questionKeywords.some(keyword => 
      chip.text?.toLowerCase().includes(keyword) || 
      chip.title?.toLowerCase().includes(keyword)
    );
    
    console.log(`  Chip ${index + 1} Relevance: ${isRelevant ? '✅ RELEVANT' : '❌ NOT RELEVANT'} (${chip.text})`);
  });

  console.log('📋 STEP 6: DETAILED NODE INVESTIGATION');
  console.log('=====================================');

  if (chipCount > 0) {
    // Click on the first node chip to see its details
    const firstChip = nodeChips.first();
    const firstChipText = await firstChip.textContent();
    console.log(`🖱️ Clicking on first node chip: "${firstChipText?.trim()}"`);
    
    await firstChip.click();
    await page.waitForTimeout(2000);
    
    // Check what details appear
    const nodeDetails = page.locator('.node-details, .details-panel, .side-panel');
    if (await nodeDetails.count() > 0) {
      console.log('✅ NodeDetails panel opened');
      
      // Try to extract node information from the details panel
      const detailsText = await nodeDetails.textContent();
      console.log(`📋 Node Details Content: "${detailsText?.slice(0, 500)}..."`);
      
      // Look for relationships
      const relationshipElements = page.locator('[class*="relationship"], [class*="node-info"]');
      const relCount = await relationshipElements.count();
      console.log(`🔗 Found ${relCount} relationship elements in details`);
    } else {
      console.log('❌ NodeDetails panel did not open');
    }
  }

  console.log('📊 STEP 7: FINAL ANALYSIS & CONCLUSIONS');
  console.log('=====================================');

  // Summary
  console.log('🎯 INVESTIGATION SUMMARY:');
  console.log(`  - Question asked: "${testQuestion}"`);
  console.log(`  - API calls made: ${apiCalls.length}`);
  console.log(`  - API responses received: ${responses.length}`);
  console.log(`  - Node chips displayed: ${chipCount}`);
  
  // Check if we have a response with nodes
  const chatResponse = responses.find(r => r.url.includes('/message'));
  if (chatResponse) {
    const hasTopLevelNodes = chatResponse.data?.sourceNodes?.length > 0;
    const hasNestedNodes = chatResponse.data?.response?.sourceNodes?.length > 0;
    console.log(`  - Source nodes in response: ${hasTopLevelNodes ? 'TOP LEVEL' : ''} ${hasNestedNodes ? 'NESTED' : ''}`);
    
    if (hasTopLevelNodes || hasNestedNodes) {
      const totalNodes = (chatResponse.data?.sourceNodes?.length || 0) + (chatResponse.data?.response?.sourceNodes?.length || 0);
      console.log(`  - Total source nodes received: ${totalNodes}`);
    }
  }

  // Test passes regardless - this is investigative
  expect(chipCount).toBeGreaterThanOrEqual(0);
  
  console.log('🔍 INVESTIGATION COMPLETE');
  console.log('=====================================');
}); 