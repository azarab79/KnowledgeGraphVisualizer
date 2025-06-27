import { test, expect } from '@playwright/test';

test.describe('Explorer Initial Load', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5177');
    
    // Wait for the application to load
    await page.waitForLoadState('networkidle');
  });

  test('should load full graph when clicking Explorer tab', async ({ page }) => {
    // First, navigate to a different tab (Chat) to ensure we're not starting in Explorer
    await page.click('button:has-text("Chat")');
    await page.waitForTimeout(1000);
    
    // Verify we're in the Chat view
    await expect(page.locator('.content-wrapper h2:has-text("Knowledge Graph Assistant")')).toBeVisible();
    
    // Now click on the Explorer tab
    await page.click('button:has-text("Explorer")');
    
    // Wait for the graph to load
    await page.waitForTimeout(5000);
    
    // Check that the explorer content is visible
    await expect(page.locator('.explorer-content')).toBeVisible();
    
    // Check that the graph SVG is present (indicating the graph has loaded)
    await expect(page.locator('.graph-svg')).toBeVisible();
    
    // Check that we have nodes in the graph (not just the search bar)
    // The graph should contain SVG elements representing nodes
    const svgNodes = page.locator('.graph-svg .node-group');
    await expect(svgNodes.first()).toBeVisible({ timeout: 15000 });
    
    // Verify that we have multiple nodes (indicating full graph load)
    const nodeCount = await svgNodes.count();
    expect(nodeCount).toBeGreaterThan(3); // Should have nodes in the full graph
    
    // Verify the search bar is also present
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
    
    // Check that no error message is displayed
    await expect(page.locator('.error-message')).not.toBeVisible();
    
    // Most importantly, check that we don't see the placeholder message
    await expect(page.locator('text=Search for a node or select a relationship type to visualize')).not.toBeVisible();
  });

  test('should not show only search bar when clicking Explorer tab', async ({ page }) => {
    // Start from Documentation tab
    await page.click('button:has-text("Documentation")');
    await page.waitForTimeout(1000);
    
    // Verify we're in Documentation view by checking the content wrapper
    await expect(page.locator('.content-wrapper h2').first()).toContainText('Documentation');
    
    // Click Explorer tab
    await page.click('button:has-text("Explorer")');
    
    // Wait for loading to complete
    await page.waitForTimeout(5000);
    
    // Should NOT show the placeholder text that indicates only search bar is visible
    await expect(page.locator('text=Search for a node or select a relationship type to visualize')).not.toBeVisible();
    
    // Should show the actual graph
    await expect(page.locator('.graph-svg')).toBeVisible();
    
    // Should have nodes visible
    const nodes = page.locator('.graph-svg .node-group');
    await expect(nodes.first()).toBeVisible({ timeout: 15000 });
  });

  test('should maintain graph when switching between tabs and back to Explorer', async ({ page }) => {
    // Start in Explorer (should load initial graph)
    await page.click('button:has-text("Explorer")');
    await page.waitForTimeout(5000);
    
    // Verify graph is loaded
    await expect(page.locator('.graph-svg .node-group').first()).toBeVisible({ timeout: 15000 });
    const initialNodeCount = await page.locator('.graph-svg .node-group').count();
    
    // Switch to Analysis tab
    await page.click('button:has-text("Analysis")');
    await page.waitForTimeout(1000);
    
    // Switch back to Explorer
    await page.click('button:has-text("Explorer")');
    await page.waitForTimeout(3000);
    
    // Graph should still be loaded (not just search bar)
    await expect(page.locator('.graph-svg .node-group').first()).toBeVisible();
    const finalNodeCount = await page.locator('.graph-svg .node-group').count();
    
    // Should have similar number of nodes (graph maintained)
    expect(Math.abs(finalNodeCount - initialNodeCount)).toBeLessThan(10);
  });

  test('should load graph after performing a search and then clicking Explorer tab', async ({ page }) => {
    // Start in Explorer and perform a search
    await page.click('button:has-text("Explorer")');
    await page.waitForTimeout(3000);
    
    // Wait for initial graph to load first
    await expect(page.locator('.graph-svg')).toBeVisible({ timeout: 15000 });
    
    // Perform a search
    await page.fill('input[placeholder*="Search"]', 'test');
    await page.press('input[placeholder*="Search"]', 'Enter');
    await page.waitForTimeout(2000);
    
    // Switch to another tab
    await page.click('button:has-text("Chat")');
    await page.waitForTimeout(1000);
    
    // Switch back to Explorer
    await page.click('button:has-text("Explorer")');
    await page.waitForTimeout(6000); // Increased timeout
    
    // Should show full graph, not search results
    await expect(page.locator('.graph-svg')).toBeVisible({ timeout: 15000 });
    const nodeCount = await page.locator('.graph-svg .node-group').count();
    expect(nodeCount).toBeGreaterThan(3); // Should show full graph, not limited search results
  });
}); 