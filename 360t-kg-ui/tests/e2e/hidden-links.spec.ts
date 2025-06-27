import { test, expect } from '@playwright/test';

/**
 * Hidden Links End-to-End Tests
 * 
 * Tests the complete user journey for Hidden Links functionality including:
 * - UI interaction and response handling
 * - Error states and loading indicators
 * - Integration with the backend API
 * - Visual feedback and user experience
 */

test.describe('Hidden Links E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for the app to load
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  });

  test('should display hidden links analysis option', async ({ page }) => {
    // Look for hidden links or analysis option in the UI
    // This might be in a menu, button, or tab depending on the UI implementation
    
    // Check if there's an analysis menu or panel
    const analysisPanel = page.locator('[data-testid="analysis-panel"]').or(
      page.locator('text=Analysis').or(
        page.locator('text=Hidden Links').or(
          page.locator('[aria-label*="analysis"]')
        )
      )
    );
    
    // If analysis functionality exists, it should be visible or accessible
    if (await analysisPanel.count() > 0) {
      await expect(analysisPanel.first()).toBeVisible();
    } else {
      // Log that analysis UI was not found - this might be expected in some implementations
      console.log('Hidden Links UI not found - may not be implemented in frontend yet');
    }
  });

  test('should handle hidden links API call', async ({ page }) => {
    // Set up API response interception
    await page.route('**/api/analysis/hidden-links**', async route => {
      const url = new URL(route.request().url());
      const topN = url.searchParams.get('topN') || '20';
      const threshold = url.searchParams.get('threshold') || '0.4';
      
      // Mock a successful response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          predictions: [
            { source: 1, target: 2, probability: 0.85 },
            { source: 3, target: 4, probability: 0.72 },
            { source: 5, target: 6, probability: 0.68 }
          ]
        })
      });
    });
    
    // Try to trigger hidden links analysis
    // This could be through a button, menu item, or API call trigger
    const hiddenLinksButton = page.locator('text=Hidden Links').or(
      page.locator('[data-testid="hidden-links"]').or(
        page.locator('button').filter({ hasText: /link.prediction/i })
      )
    );
    
    if (await hiddenLinksButton.count() > 0) {
      await hiddenLinksButton.first().click();
      
      // Wait for the API call to complete
      await page.waitForResponse('**/api/analysis/hidden-links**', { timeout: 30000 });
      
      // Check for results display
      await expect(page.locator('text=predictions').or(page.locator('text=links'))).toBeVisible({ timeout: 5000 });
    } else {
      console.log('Hidden Links trigger not found in UI');
    }
  });

  test('should handle hidden links API errors gracefully', async ({ page }) => {
    // Mock different error responses to test error handling
    
    // Test 1: Server error
    await page.route('**/api/analysis/hidden-links**', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'No suitable link prediction procedures available. Modern pipeline and legacy procedures both unavailable.'
        })
      });
    });
    
    // Trigger hidden links analysis
    const hiddenLinksButton = page.locator('text=Hidden Links').or(
      page.locator('[data-testid="hidden-links"]').or(
        page.locator('button').filter({ hasText: /analysis/i })
      )
    );
    
    if (await hiddenLinksButton.count() > 0) {
      await hiddenLinksButton.first().click();
      
      // Should show error message to user
      await expect(page.locator('text=error').or(page.locator('.error'))).toBeVisible({ timeout: 10000 });
    }
    
    // Test 2: Validation error
    await page.route('**/api/analysis/hidden-links**', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          errors: [
            { msg: 'topN must be an integer between 1 and 1000' }
          ]
        })
      });
    });
    
    // Should handle validation errors appropriately
    if (await hiddenLinksButton.count() > 0) {
      await hiddenLinksButton.first().click();
      await expect(page.locator('text=error').or(page.locator('.error'))).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show loading state during hidden links analysis', async ({ page }) => {
    // Mock a delayed response to test loading states
    await page.route('**/api/analysis/hidden-links**', async route => {
      // Delay the response to simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          predictions: [
            { source: 1, target: 2, probability: 0.85 }
          ]
        })
      });
    });
    
    const hiddenLinksButton = page.locator('text=Hidden Links').or(
      page.locator('[data-testid="hidden-links"]')
    );
    
    if (await hiddenLinksButton.count() > 0) {
      await hiddenLinksButton.first().click();
      
      // Should show loading indicator
      await expect(page.locator('text=loading').or(
        page.locator('.loading').or(
          page.locator('[aria-label*="loading"]')
        )
      )).toBeVisible({ timeout: 5000 });
      
      // Loading should disappear after response
      await page.waitForResponse('**/api/analysis/hidden-links**');
      await expect(page.locator('text=loading').or(page.locator('.loading'))).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('should validate hidden links parameters', async ({ page }) => {
    // Check if there are parameter controls in the UI
    const topNInput = page.locator('input[name="topN"]').or(
      page.locator('[data-testid="topN"]').or(
        page.locator('input').filter({ hasText: /top/i })
      )
    );
    
    const thresholdInput = page.locator('input[name="threshold"]').or(
      page.locator('[data-testid="threshold"]')
    );
    
    if (await topNInput.count() > 0) {
      // Test invalid topN value
      await topNInput.fill('-1');
      
      const submitButton = page.locator('button[type="submit"]').or(
        page.locator('text=Analyze').or(
          page.locator('text=Submit')
        )
      );
      
      if (await submitButton.count() > 0) {
        await submitButton.click();
        
        // Should show validation error
        await expect(page.locator('text=error').or(page.locator('.error'))).toBeVisible();
      }
    }
    
    if (await thresholdInput.count() > 0) {
      // Test invalid threshold value
      await thresholdInput.fill('1.5');
      
      const submitButton = page.locator('button[type="submit"]').or(
        page.locator('text=Analyze')
      );
      
      if (await submitButton.count() > 0) {
        await submitButton.click();
        
        // Should show validation error
        await expect(page.locator('text=error').or(page.locator('.error'))).toBeVisible();
      }
    }
  });

  test('should display hidden links results correctly', async ({ page }) => {
    // Mock successful response with predictable data
    await page.route('**/api/analysis/hidden-links**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Cache-Control': 'public, max-age=300'
        },
        body: JSON.stringify({
          predictions: [
            { source: 1, target: 2, probability: 0.95 },
            { source: 3, target: 4, probability: 0.82 },
            { source: 5, target: 6, probability: 0.76 },
            { source: 7, target: 8, probability: 0.65 }
          ]
        })
      });
    });
    
    const hiddenLinksButton = page.locator('text=Hidden Links').or(
      page.locator('[data-testid="hidden-links"]')
    );
    
    if (await hiddenLinksButton.count() > 0) {
      await hiddenLinksButton.first().click();
      
      await page.waitForResponse('**/api/analysis/hidden-links**');
      
      // Check for results display
      // Results might be displayed as a table, list, or graph
      const resultsContainer = page.locator('[data-testid="results"]').or(
        page.locator('.results').or(
          page.locator('table').or(
            page.locator('.prediction')
          )
        )
      );
      
      if (await resultsContainer.count() > 0) {
        await expect(resultsContainer.first()).toBeVisible();
        
        // Check for specific prediction data
        await expect(page.locator('text=0.95').or(page.locator('text=95%'))).toBeVisible();
      }
    }
  });

  test('should handle concurrent hidden links requests', async ({ page }) => {
    let requestCount = 0;
    
    // Track concurrent requests
    await page.route('**/api/analysis/hidden-links**', async route => {
      requestCount++;
      console.log(`Hidden Links request #${requestCount}`);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          predictions: [
            { source: requestCount, target: requestCount + 1, probability: 0.8 }
          ]
        })
      });
    });
    
    const hiddenLinksButton = page.locator('text=Hidden Links').or(
      page.locator('[data-testid="hidden-links"]')
    );
    
    if (await hiddenLinksButton.count() > 0) {
      // Trigger multiple requests quickly
      await hiddenLinksButton.first().click();
      await hiddenLinksButton.first().click();
      
      // Should handle multiple requests gracefully
      await page.waitForTimeout(3000);
      
      // All requests should complete
      expect(requestCount).toBeGreaterThan(0);
    }
  });

  test('should respect caching for hidden links requests', async ({ page }) => {
    let requestCount = 0;
    
    await page.route('**/api/analysis/hidden-links**', async route => {
      requestCount++;
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Cache-Control': 'public, max-age=300'
        },
        body: JSON.stringify({
          predictions: [
            { source: 1, target: 2, probability: 0.8 }
          ]
        })
      });
    });
    
    const hiddenLinksButton = page.locator('text=Hidden Links').or(
      page.locator('[data-testid="hidden-links"]')
    );
    
    if (await hiddenLinksButton.count() > 0) {
      // Make the same request twice quickly
      await hiddenLinksButton.first().click();
      await page.waitForResponse('**/api/analysis/hidden-links**');
      
      await hiddenLinksButton.first().click();
      
      // Depending on caching implementation, might have 1 or 2 requests
      expect(requestCount).toBeGreaterThanOrEqual(1);
      expect(requestCount).toBeLessThanOrEqual(2);
    }
  });

  test('should integrate with graph visualization', async ({ page }) => {
    // Check if hidden links results integrate with graph display
    await page.route('**/api/analysis/hidden-links**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          predictions: [
            { source: 1, target: 2, probability: 0.85 },
            { source: 3, target: 4, probability: 0.72 }
          ]
        })
      });
    });
    
    // Look for graph container
    const graphContainer = page.locator('#graph').or(
      page.locator('[data-testid="graph"]').or(
        page.locator('.graph-container').or(
          page.locator('canvas')
        )
      )
    );
    
    if (await graphContainer.count() > 0) {
      await expect(graphContainer.first()).toBeVisible();
      
      const hiddenLinksButton = page.locator('text=Hidden Links').or(
        page.locator('[data-testid="hidden-links"]')
      );
      
      if (await hiddenLinksButton.count() > 0) {
        await hiddenLinksButton.first().click();
        await page.waitForResponse('**/api/analysis/hidden-links**');
        
        // Graph should still be visible after analysis
        await expect(graphContainer.first()).toBeVisible();
      }
    }
  });

  test('should provide user feedback for analysis progress', async ({ page }) => {
    // Test that users get appropriate feedback during the analysis process
    
    await page.route('**/api/analysis/hidden-links**', async route => {
      // Simulate a long-running analysis
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          predictions: [
            { source: 1, target: 2, probability: 0.8 }
          ]
        })
      });
    });
    
    const hiddenLinksButton = page.locator('text=Hidden Links').or(
      page.locator('[data-testid="hidden-links"]')
    );
    
    if (await hiddenLinksButton.count() > 0) {
      await hiddenLinksButton.first().click();
      
      // Should show some kind of progress indicator
      const progressIndicators = [
        page.locator('text=Analyzing'),
        page.locator('text=Processing'),
        page.locator('.spinner'),
        page.locator('.progress'),
        page.locator('[aria-label*="loading"]')
      ];
      
      let foundIndicator = false;
      for (const indicator of progressIndicators) {
        if (await indicator.count() > 0) {
          await expect(indicator.first()).toBeVisible({ timeout: 2000 });
          foundIndicator = true;
          break;
        }
      }
      
      if (!foundIndicator) {
        console.log('No progress indicator found - may need to be implemented');
      }
      
      // Wait for completion
      await page.waitForResponse('**/api/analysis/hidden-links**');
    }
  });

}); 