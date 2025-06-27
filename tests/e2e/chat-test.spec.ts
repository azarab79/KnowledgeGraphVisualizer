import { test, expect } from '@playwright/test';

test('Chat node icons and details work', async ({ page }) => {
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

  // Click chip and verify node details appear
  await chip.click();
  
  // Based on the trace, look for the actual button text patterns that appear
  const nodeDetailButton = page.locator('button').filter({ 
    hasText: /When Custodian Bank|Order Details|Trade Details|Views|Status Of Running/ 
  });
  
  await expect(nodeDetailButton.first()).toBeVisible({ timeout: 10000 });
  
  console.log('✅ Node details appeared after clicking');
}); 