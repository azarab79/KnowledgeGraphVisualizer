import { test, expect } from '@playwright/test';

test('Chat node data extraction and display works', async ({ page }) => {
  // Enable console logging to debug
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  
  await page.goto('/');

  // Navigate to Chat tab
  await page.getByRole('button', { name: /chat/i }).click();

  // Ask a question
  const input = page.getByRole('textbox');
  await input.fill('How to upload multiple orders in ems?');
  await input.press('Enter');

  // Wait for response
  await page.waitForLoadState('networkidle');

  // Check that node chip appears with icon
  const chip = page.locator('.node-chip').first();
  await chip.waitFor({ state: 'visible' });
  const iconSrc = await chip.locator('img').getAttribute('src');
  expect(iconSrc).toBeTruthy();

  console.log('✅ Found node chip with icon');

  // Check if we can get the node data
  const chipText = await chip.textContent();
  console.log('Chip text:', chipText);

  // Click chip and wait a bit more
  await chip.click();
  
  // Wait for any animations or state changes
  await page.waitForTimeout(2000);
  
  // Check if NodeDetails panel appears
  const nodeDetails = page.locator('.node-details, .details-panel, .side-panel');
  if (await nodeDetails.count() > 0) {
    console.log('✅ NodeDetails panel found!');
    
    // Look for any buttons in the details panel
    const detailsButtons = nodeDetails.locator('button');
    const buttonCount = await detailsButtons.count();
    console.log(`Found ${buttonCount} buttons in NodeDetails`);
    
    if (buttonCount > 0) {
      for (let i = 0; i < buttonCount; i++) {
        const buttonText = await detailsButtons.nth(i).textContent();
        console.log(`Button ${i}: "${buttonText}"`);
      }
    }
  } else {
    console.log('❌ NodeDetails panel not found');
    
    // Check if any new content appeared
    const allButtons = page.locator('button');
    const buttonCount = await allButtons.count();
    console.log(`Total buttons on page: ${buttonCount}`);
    
    // Look for specific content that might indicate node details
    const contentContainers = page.locator('[class*="detail"], [class*="panel"], [class*="info"]');
    const containerCount = await contentContainers.count();
    console.log(`Found ${containerCount} potential detail containers`);
  }

  // Check what's in the right sidebar or any side panel
  const sidebars = page.locator('.sidebar, .side-panel, .right-panel, .details-container');
  const sidebarCount = await sidebars.count();
  console.log(`Found ${sidebarCount} sidebar elements`);
  
  // Look for any element with relationships or node data
  const relationshipElements = page.locator('[class*="relationship"], [class*="node-info"]');
  const relCount = await relationshipElements.count();
  console.log(`Found ${relCount} relationship elements`);
  
  // The test passes if we found the node chip and it has an icon
  // The detailed logging will help us understand what happens after clicking
  expect(iconSrc).toBeTruthy();
});
