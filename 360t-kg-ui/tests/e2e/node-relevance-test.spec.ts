import { test, expect } from '@playwright/test';

test('Investigate knowledge graph for risk-reversal content', async ({ page }) => {
  // Test direct API calls to understand what's in the knowledge graph
  const apiBase = 'http://localhost:3002/api';
  
  console.log('🔍 INVESTIGATING KNOWLEDGE GRAPH CONTENT');
  console.log('=====================================');
  
  // Test 1: Search for risk-reversal directly
  const searchTerms = [
    'risk-reversal',
    'risk reversal', 
    'reversal',
    'collar',
    'protective put',
    'covered call',
    'options strategy',
    'synthetic position'
  ];
  
  for (const term of searchTerms) {
    try {
      const response = await page.request.get(`${apiBase}/search?q=${encodeURIComponent(term)}`);
      if (response.ok()) {
        const data = await response.json();
        console.log(`📋 Search for "${term}":`, {
          status: response.status(),
          results: data?.results?.length || 0,
          nodes: data?.nodes?.length || 0
        });
      }
    } catch (e) {
      console.log(`❌ Search for "${term}" failed:`, e.message);
    }
  }
  
  // Test 2: Check what option-related nodes exist
  try {
    const optionResponse = await page.request.post(`${apiBase}/graph/search`, {
      data: {
        query: "MATCH (n) WHERE toLower(n.id) CONTAINS 'option' OR toLower(n.name) CONTAINS 'option' RETURN n.id, n.name, labels(n) LIMIT 20"
      }
    });
    
    if (optionResponse.ok()) {
      const optionData = await optionResponse.json();
      console.log('📊 Option-related nodes in knowledge graph:');
      console.log(JSON.stringify(optionData, null, 2));
    }
  } catch (e) {
    console.log('❌ Option search failed:', e.message);
  }
  
  // Test 3: Check what strategy-related nodes exist
  try {
    const strategyResponse = await page.request.post(`${apiBase}/graph/search`, {
      data: {
        query: "MATCH (n) WHERE toLower(n.id) CONTAINS 'strategy' OR toLower(n.name) CONTAINS 'strategy' RETURN n.id, n.name, labels(n) LIMIT 20"
      }
    });
    
    if (strategyResponse.ok()) {
      const strategyData = await strategyResponse.json();
      console.log('📊 Strategy-related nodes in knowledge graph:');
      console.log(JSON.stringify(strategyData, null, 2));
    }
  } catch (e) {
    console.log('❌ Strategy search failed:', e.message);
  }
  
  // Test 4: Full text search in documents
  try {
    const docResponse = await page.request.post(`${apiBase}/documents/search`, {
      data: {
        query: "risk-reversal strategy",
        limit: 10
      }
    });
    
    if (docResponse.ok()) {
      const docData = await docResponse.json();
      console.log('📄 Documents mentioning risk-reversal:');
      console.log(JSON.stringify(docData, null, 2));
    }
  } catch (e) {
    console.log('❌ Document search failed:', e.message);
  }
  
  console.log('🎯 CONCLUSION: Testing knowledge graph content for risk-reversal');
  expect(true).toBe(true); // Always pass - this is investigative
}); 