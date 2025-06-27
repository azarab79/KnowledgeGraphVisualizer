import { test, expect } from '@playwright/test';

test('Hidden Links analysis displays predicted edges', async ({ page }) => {
  // Navigate directly to analysis view
  await page.goto('/?view=analysis');

  // Click Hidden Links tab
  await page.getByRole('button', { name: /hidden links/i }).click();

  // Click Run button
  const runButton = page.getByRole('button', { name: /run/i });
  await runButton.click();

  // Wait for summary text to appear with predicted links count
  const summaryLocator = page.locator('.summary');
  await expect(summaryLocator).toHaveText(/Predicted links:/, { timeout: 20000 });

  // Ensure at least one predicted edge rendered (dotted)
  // We check SVG lines with stroke-dasharray attribute
  const edgeLocator = page.locator('line[stroke-dasharray]');
  await expect(edgeLocator).toHaveCountGreaterThan(0);
}); 