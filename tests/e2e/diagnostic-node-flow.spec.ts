import { test, expect } from '@playwright/test';

test('Diagnostic: Compare Chat vs Explorer node data flow', async ({ page }) => {
  // Capture all network requests
  const requests = [];
  const responses = [];
  
  page.on('request', request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData()
    });
  });
  
  page.on('response', response => {
    responses.push({
      url: response.url(),
      status: response.status(),
      headers: response.headers()
    });
  });

  await page.goto('/');

  console.log('=== TESTING CHAT TAB ===');
  
  // Test Chat tab flow
  await page.getByRole('button', { name: /chat/i }).click();
  await page.waitForLoadState('networkidle');
  
  const input = page.getByRole('textbox');
  await input.fill('How to upload multiple orders in ems?');
  await input.press('Enter');
  
  // Wait for response and capture the exact structure
  await page.waitForLoadState('networkidle');
  
  // Find and log the first node chip data
  const chatChip = page.locator('.node-chip').first();
  await chatChip.waitFor({ state: 'visible' });
  
  // Log the chip's data attributes and text
  const chipText = await chatChip.textContent();
  const chipDataId = await chatChip.getAttribute('data-node-id');
  const chipHtml = await chatChip.innerHTML();
  
  console.log('CHAT CHIP DATA:', {
    text: chipText,
    dataId: chipDataId,
    html: chipHtml
  });
  
  // Clear previous requests for this specific click
  const beforeClickRequestCount = requests.length;
  
  // Click the chip and monitor API calls
  await chatChip.click();
  await page.waitForTimeout(2000); // Wait for any async operations
  
  // Log all new requests after clicking
  const newRequests = requests.slice(beforeClickRequestCount);
  console.log('CHAT CHIP CLICK API CALLS:', newRequests);
  
  // Check what's in the details panel
  const detailsPanel = page.locator('.details-panel, [class*="details"], [class*="Details"]');
  const detailsPanelHtml = await detailsPanel.innerHTML().catch(() => 'NOT_FOUND');
  console.log('CHAT DETAILS PANEL HTML:', detailsPanelHtml);

  console.log('=== TESTING EXPLORER TAB ===');
  
  // Now test Explorer tab for comparison
  await page.getByRole('button', { name: /explorer/i }).click();
  await page.waitForLoadState('networkidle');
  
  // Wait for the graph to load and find a node
  await page.waitForTimeout(3000);
  
  // Try to find any clickable node in Explorer
  const explorerNode = page.locator('[data-testid*="node"], .node, [class*="node"]').first();
  
  if (await explorerNode.isVisible().catch(() => false)) {
    const beforeExplorerClickRequestCount = requests.length;
    
    await explorerNode.click();
    await page.waitForTimeout(2000);
    
    const explorerRequests = requests.slice(beforeExplorerClickRequestCount);
    console.log('EXPLORER NODE CLICK API CALLS:', explorerRequests);
    
    const explorerDetailsHtml = await detailsPanel.innerHTML().catch(() => 'NOT_FOUND');
    console.log('EXPLORER DETAILS PANEL HTML:', explorerDetailsHtml);
  } else {
    console.log('No Explorer nodes found to click');
  }
  
  // Output summary for analysis
  console.log('=== SUMMARY ===');
  console.log('Total requests captured:', requests.length);
  console.log('Failed responses:', responses.filter(r => r.status >= 400));
  
  // The test "passes" if we captured the data - we're diagnosing, not asserting functionality
  expect(requests.length).toBeGreaterThan(0);
}); 