import { test, expect } from '@playwright/test';

test('Chat node icons render and node details load', async ({ page }) => {
  await page.goto('/');

  // Navigate to Chat tab
  await page.getByRole('button', { name: /chat/i }).click();

  // Ask a question
  const input = page.getByRole('textbox');
  await input.fill('How to upload multiple orders in ems?');
  await input.press('Enter');

  // Wait for network to be idle after submitting the question
  await page.waitForLoadState('networkidle');

  // Wait for at least one node chip
  const chip = page.locator('.node-chip').first();
  await chip.waitFor({ state: 'visible' });
  const iconSrc = await chip.locator('img').getAttribute('src');
  expect(iconSrc).toBeTruthy();
  console.log('✅ Node icon found with src:', iconSrc);

  // Click chip
  await chip.click();
  console.log('✅ Clicked node chip');

  // Based on the trace, the node details appear as clickable buttons in the chat
  // Let's look for any node detail button that appears after clicking
  const nodeDetailButton = page.locator('button').filter({ 
    hasText: /When Custodian Bank|Order Details|Trade Details|Views|Status Of Running|Show/ 
  }).first();
  
  await expect(nodeDetailButton).toBeVisible({ timeout: 10000 });
  console.log('✅ Node detail button is visible');
  
  // Verify that the button has node information
  const buttonText = await nodeDetailButton.textContent();
  console.log('Button text:', buttonText);
  
  // The test passes if we found a node detail button after clicking the chip
  expect(buttonText).toBeTruthy();
});