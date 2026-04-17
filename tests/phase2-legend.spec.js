// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Phase 2 Legend & Notation Tests
 *
 * Tests for WAF-10, WAF-11, WAF-12, WAF-13
 * - WAF-10: Auto-legend for group types
 * - WAF-11: Legend shows edge style meanings
 * - WAF-12: Legend included in exports
 * - WAF-13: Toggle legend visibility
 */

// Helper to load a demo diagram before testing
async function loadDemoDiagram(page) {
  // Click on a demo example button first
  await page.getByRole('button', { name: 'Contoso Network' }).click();
  // Then click Load Demo
  await page.getByRole('button', { name: 'Load Demo' }).click();
  // Wait for diagram to render (SVG should appear)
  await expect(page.locator('svg')).toBeVisible();
  // Wait a bit for layout to complete
  await page.waitForTimeout(300);
}

// Helper to load a specific diagram via localStorage with both groups and edges
async function loadCustomDiagram(page, { groups = [], nodes = [], edges = [] }) {
  await page.evaluate(({ groups, nodes, edges }) => {
    const state = {
      nodes,
      groups,
      edges,
      title: 'Test Diagram',
      zoom: 1,
      pan: { x: 0, y: 0 },
      metadata: { author: '', version: '1.0', description: '', references: [] }
    };
    localStorage.setItem('azure-diagram-state', JSON.stringify(state));
  }, { groups, nodes, edges });
  await page.reload();
  await page.waitForTimeout(300);
}

// Helper to get a unique temp file path
function getTempPath(filename) {
  const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(7);
  return path.join('/tmp', `playwright-${uniqueId}-${filename}`);
}

// Helper to safely cleanup temp files
function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (e) {
    // File may have been moved or deleted
  }
}

test.describe('WAF-13: Toggle legend visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Legend button is hidden when diagram has no data', async ({ page }) => {
    // Initially no legend button should be visible
    await expect(page.getByRole('button', { name: /Legend/i })).not.toBeVisible();
  });

  test('Legend button is visible when diagram has data', async ({ page }) => {
    await loadDemoDiagram(page);

    // Legend button should be visible
    await expect(page.getByRole('button', { name: /Legend/i })).toBeVisible();
  });

  test('Clicking Legend button opens legend panel', async ({ page }) => {
    await loadDemoDiagram(page);

    // Click the legend button
    await page.getByRole('button', { name: /Legend/i }).click();

    // Legend panel should be visible with title
    await expect(page.locator('text=Legend').first()).toBeVisible();
  });

  test('Legend button shows active state when legend is open', async ({ page }) => {
    await loadDemoDiagram(page);

    const legendButton = page.getByRole('button', { name: /Legend/i });

    // Initially button should not have active styling
    const initialBg = await legendButton.evaluate(el => getComputedStyle(el).background);

    // Click to open legend
    await legendButton.click();

    // Button should now have active styling (blue tint)
    const activeBg = await legendButton.evaluate(el => getComputedStyle(el).background);
    expect(activeBg).not.toBe(initialBg);
  });

  test('Clicking Legend button again closes legend panel', async ({ page }) => {
    await loadDemoDiagram(page);

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();

    // Legend should be visible
    const legendPanel = page.locator('div').filter({ hasText: /^Legend/ }).first();
    await expect(legendPanel).toBeVisible();

    // Click again to close
    await page.getByRole('button', { name: /Legend/i }).click();

    // Wait for panel to disappear
    await page.waitForTimeout(100);

    // The GROUPS or CONNECTIONS sections inside panel should not be visible
    await expect(page.locator('div').filter({ hasText: 'GROUPS' }).first()).not.toBeVisible();
  });

  test('Legend panel has close button (X) that closes it', async ({ page }) => {
    await loadDemoDiagram(page);

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);

    // Find the X close button inside the legend panel
    const closeButton = page.locator('button').filter({ hasText: '×' });
    await expect(closeButton).toBeVisible();

    // Click close button
    await closeButton.click();

    // Legend panel should be closed - verify by checking GROUPS section is gone
    await page.waitForTimeout(100);
    await expect(page.locator('div').filter({ hasText: 'GROUPS' }).first()).not.toBeVisible();
  });
});

test.describe('WAF-10: Auto-legend for group types', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Legend shows only group types used in diagram', async ({ page }) => {
    // Load diagram with specific group types
    await loadCustomDiagram(page, {
      groups: [
        { id: 'g1', type: 'rg', label: 'MyRG', x: 100, y: 100, w: 200, h: 150, children: [] },
        { id: 'g2', type: 'vnet_grp', label: 'MyVNet', x: 350, y: 100, w: 200, h: 150, children: [] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM 1', x: 150, y: 150 }
      ],
      edges: []
    });

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);

    // Should see Resource Group and Virtual Network in legend (use exact match via span)
    await expect(page.locator('span').filter({ hasText: 'Resource Group' })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Virtual Network' })).toBeVisible();

    // Should NOT see other group types like Subnet, AKS, etc. in legend
    await expect(page.locator('span').filter({ hasText: 'Subnet' })).not.toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'AKS Cluster' })).not.toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Azure Region' })).not.toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'On-Premises' })).not.toBeVisible();
  });

  test('Legend displays colored boxes matching group styling', async ({ page }) => {
    await loadCustomDiagram(page, {
      groups: [
        { id: 'g1', type: 'rg', label: 'RG', x: 100, y: 100, w: 200, h: 150, children: [] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM', x: 150, y: 150 }
      ],
      edges: []
    });

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);

    // Find the Resource Group text in legend (span element)
    const legendText = page.locator('span').filter({ hasText: 'Resource Group' });
    await expect(legendText).toBeVisible();

    // The legend row contains a colored box div before the span
    const legendRow = legendText.locator('..');
    const colorBox = legendRow.locator('div').first();
    const border = await colorBox.evaluate(el => getComputedStyle(el).border);
    expect(border).toBeTruthy();
  });

  test('Legend shows group type names correctly', async ({ page }) => {
    // Test with multiple group types - use unique labels to avoid ambiguity
    await loadCustomDiagram(page, {
      groups: [
        { id: 'g1', type: 'region', label: 'EastUS', x: 50, y: 50, w: 400, h: 300, children: ['g2'] },
        { id: 'g2', type: 'vnet_grp', label: 'MyNet', x: 100, y: 100, w: 200, h: 150, children: ['g3'] },
        { id: 'g3', type: 'subnet_grp', label: 'MySub', x: 120, y: 130, w: 150, h: 100, children: [] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM', x: 150, y: 160 }
      ],
      edges: []
    });

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);

    // Verify all three group types are shown in legend (using span selector)
    await expect(page.locator('span').filter({ hasText: 'Azure Region' })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Virtual Network' })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Subnet' })).toBeVisible();
  });

  test('Legend shows GROUPS section header when groups exist', async ({ page }) => {
    await loadCustomDiagram(page, {
      groups: [
        { id: 'g1', type: 'rg', label: 'RG', x: 100, y: 100, w: 200, h: 150, children: [] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM', x: 150, y: 150 }
      ],
      edges: []
    });

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();

    // Should see GROUPS header
    await expect(page.locator('text=GROUPS').first()).toBeVisible();
  });

  test('Legend does not show GROUPS section when no groups exist', async ({ page }) => {
    await loadCustomDiagram(page, {
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM 1', x: 150, y: 150 },
        { id: 'n2', type: 'storage', label: 'Storage', x: 300, y: 150 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Data', style: 'solid' }
      ]
    });

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);

    // Should NOT see GROUPS header
    await expect(page.locator('text=GROUPS')).not.toBeVisible();

    // But should see CONNECTIONS since edges exist
    await expect(page.locator('text=CONNECTIONS').first()).toBeVisible();
  });
});

test.describe('WAF-11: Legend shows edge style meanings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Legend shows Synchronous for solid edge style', async ({ page }) => {
    await loadCustomDiagram(page, {
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM 1', x: 150, y: 150 },
        { id: 'n2', type: 'vm', label: 'VM 2', x: 350, y: 150 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'API', style: 'solid' }
      ]
    });

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);

    // Should see Synchronous label
    await expect(page.locator('text=Synchronous')).toBeVisible();

    // Should NOT see Asynchronous
    await expect(page.locator('text=Asynchronous')).not.toBeVisible();
  });

  test('Legend shows Asynchronous for dashed edge style', async ({ page }) => {
    await loadCustomDiagram(page, {
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM 1', x: 150, y: 150 },
        { id: 'n2', type: 'eventhub', label: 'Event Hub', x: 350, y: 150 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Events', style: 'dashed' }
      ]
    });

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);

    // Should see Asynchronous label in legend (span element)
    await expect(page.locator('span').filter({ hasText: 'Asynchronous' })).toBeVisible();

    // Should NOT see Synchronous in legend
    await expect(page.locator('span').filter({ hasText: /^Synchronous$/ })).not.toBeVisible();
  });

  test('Legend shows both edge styles when diagram uses both', async ({ page }) => {
    await loadCustomDiagram(page, {
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM', x: 150, y: 150 },
        { id: 'n2', type: 'sqldb', label: 'SQL', x: 350, y: 150 },
        { id: 'n3', type: 'eventhub', label: 'Events', x: 250, y: 300 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Query', style: 'solid' },
        { id: 'e2', from: 'n1', to: 'n3', label: 'Publish', style: 'dashed' }
      ]
    });

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);

    // Should see both in legend (span elements)
    await expect(page.locator('span').filter({ hasText: /^Synchronous$/ })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Asynchronous' })).toBeVisible();
  });

  test('Legend shows CONNECTIONS section header when edges exist', async ({ page }) => {
    await loadCustomDiagram(page, {
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM 1', x: 150, y: 150 },
        { id: 'n2', type: 'vm', label: 'VM 2', x: 350, y: 150 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Data', style: 'solid' }
      ]
    });

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();

    // Should see CONNECTIONS header
    await expect(page.locator('text=CONNECTIONS').first()).toBeVisible();
  });

  test('Legend does not show CONNECTIONS section when no edges exist', async ({ page }) => {
    await loadCustomDiagram(page, {
      groups: [
        { id: 'g1', type: 'rg', label: 'RG', x: 100, y: 100, w: 200, h: 150, children: [] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM', x: 150, y: 150 }
      ],
      edges: []
    });

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);

    // Should NOT see CONNECTIONS header
    await expect(page.locator('text=CONNECTIONS')).not.toBeVisible();

    // But should see GROUPS since groups exist
    await expect(page.locator('text=GROUPS').first()).toBeVisible();
  });

  test('Edge styles in legend show correct line styling', async ({ page }) => {
    await loadCustomDiagram(page, {
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM 1', x: 150, y: 150 },
        { id: 'n2', type: 'vm', label: 'VM 2', x: 350, y: 150 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Sync', style: 'solid' },
        { id: 'e2', from: 'n2', to: 'n1', label: 'Async', style: 'dashed' }
      ]
    });

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);

    // Find the SVG elements in the legend panel - should have line elements
    const legendSvgs = page.locator('svg').filter({ has: page.locator('line') });
    const count = await legendSvgs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

test.describe('WAF-12: Legend included in exports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('SVG export includes legend group element when diagram has groups', async ({ page }) => {
    await loadCustomDiagram(page, {
      groups: [
        { id: 'g1', type: 'rg', label: 'RG', x: 100, y: 100, w: 200, h: 150, children: [] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM', x: 150, y: 150 }
      ],
      edges: []
    });

    // Listen for download
    const downloadPromise = page.waitForEvent('download');

    // Click SVG export button
    await page.getByRole('button', { name: 'SVG' }).click();

    const download = await downloadPromise;

    // Save and read the SVG content
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const svgContent = fs.readFileSync(downloadPath, 'utf-8');

    // Verify legend group exists
    expect(svgContent).toContain('class="legend"');
    expect(svgContent).toContain('>Legend<');

    // Cleanup
    safeUnlink(downloadPath);
  });

  test('SVG export legend contains group types used in diagram', async ({ page }) => {
    await loadCustomDiagram(page, {
      groups: [
        { id: 'g1', type: 'rg', label: 'RG', x: 100, y: 100, w: 200, h: 150, children: [] },
        { id: 'g2', type: 'vnet_grp', label: 'VNet', x: 350, y: 100, w: 200, h: 150, children: [] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM', x: 150, y: 150 }
      ],
      edges: []
    });

    // Listen for download
    const downloadPromise = page.waitForEvent('download');

    // Click SVG export
    await page.getByRole('button', { name: 'SVG' }).click();

    const download = await downloadPromise;
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const svgContent = fs.readFileSync(downloadPath, 'utf-8');

    // Should contain group types
    expect(svgContent).toContain('GROUPS');
    expect(svgContent).toContain('Resource Group');
    expect(svgContent).toContain('Virtual Network');

    // Cleanup
    safeUnlink(downloadPath);
  });

  test('SVG export legend contains edge styles used in diagram', async ({ page }) => {
    await loadCustomDiagram(page, {
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM 1', x: 150, y: 150 },
        { id: 'n2', type: 'vm', label: 'VM 2', x: 350, y: 150 },
        { id: 'n3', type: 'eventhub', label: 'Events', x: 250, y: 300 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Sync', style: 'solid' },
        { id: 'e2', from: 'n1', to: 'n3', label: 'Async', style: 'dashed' }
      ]
    });

    // Listen for download
    const downloadPromise = page.waitForEvent('download');

    // Click SVG export
    await page.getByRole('button', { name: 'SVG' }).click();

    const download = await downloadPromise;
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const svgContent = fs.readFileSync(downloadPath, 'utf-8');

    // Should contain edge style labels
    expect(svgContent).toContain('CONNECTIONS');
    expect(svgContent).toContain('Synchronous');
    expect(svgContent).toContain('Asynchronous');

    // Cleanup
    safeUnlink(downloadPath);
  });

  test('SVG export legend is positioned correctly', async ({ page }) => {
    await loadCustomDiagram(page, {
      groups: [
        { id: 'g1', type: 'rg', label: 'RG', x: 100, y: 100, w: 200, h: 150, children: [] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM', x: 150, y: 150 }
      ],
      edges: []
    });

    // Listen for download
    const downloadPromise = page.waitForEvent('download');

    // Click SVG export
    await page.getByRole('button', { name: 'SVG' }).click();

    const download = await downloadPromise;
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const svgContent = fs.readFileSync(downloadPath, 'utf-8');

    // Legend group should exist with proper structure
    expect(svgContent).toContain('class="legend"');

    // Legend should have a background rect with x and y attributes
    const legendRectMatch = svgContent.match(/class="legend"[\s\S]*?<rect[^>]+/);
    expect(legendRectMatch).toBeTruthy();

    // Verify the rect has positioning attributes
    expect(legendRectMatch[0]).toMatch(/x="\d+"/);
    expect(legendRectMatch[0]).toMatch(/y="\d+"/);

    // Cleanup
    safeUnlink(downloadPath);
  });

  test('SVG export legend has background rectangle', async ({ page }) => {
    await loadCustomDiagram(page, {
      groups: [
        { id: 'g1', type: 'rg', label: 'RG', x: 100, y: 100, w: 200, h: 150, children: [] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM', x: 150, y: 150 }
      ],
      edges: []
    });

    // Listen for download
    const downloadPromise = page.waitForEvent('download');

    // Click SVG export
    await page.getByRole('button', { name: 'SVG' }).click();

    const download = await downloadPromise;
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const svgContent = fs.readFileSync(downloadPath, 'utf-8');

    // Should have a rect element inside legend group
    expect(svgContent).toMatch(/class="legend"[\s\S]*?<rect[^>]+fill=/);

    // Cleanup
    safeUnlink(downloadPath);
  });

  test('SVG export does not include legend when diagram is empty', async ({ page }) => {
    // Start with empty diagram (no groups, nodes, or edges)
    // Just add a single node so we can export
    await loadCustomDiagram(page, {
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM', x: 150, y: 150 }
      ],
      edges: []
    });

    // Listen for download
    const downloadPromise = page.waitForEvent('download');

    // Click SVG export
    await page.getByRole('button', { name: 'SVG' }).click();

    const download = await downloadPromise;
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const svgContent = fs.readFileSync(downloadPath, 'utf-8');

    // When no groups and no edges, no legend should be included
    expect(svgContent).not.toContain('class="legend"');

    // Cleanup
    safeUnlink(downloadPath);
  });

  test('SVG export legend only shows styles actually used', async ({ page }) => {
    // Only use solid edges
    await loadCustomDiagram(page, {
      groups: [
        { id: 'g1', type: 'rg', label: 'RG', x: 100, y: 100, w: 200, h: 150, children: [] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM 1', x: 150, y: 150 },
        { id: 'n2', type: 'vm', label: 'VM 2', x: 350, y: 150 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Sync', style: 'solid' }
      ]
    });

    // Listen for download
    const downloadPromise = page.waitForEvent('download');

    // Click SVG export
    await page.getByRole('button', { name: 'SVG' }).click();

    const download = await downloadPromise;
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const svgContent = fs.readFileSync(downloadPath, 'utf-8');

    // Should contain Synchronous but NOT Asynchronous
    expect(svgContent).toContain('Synchronous');
    expect(svgContent).not.toContain('Asynchronous');

    // Cleanup
    safeUnlink(downloadPath);
  });
});

test.describe('Legend with Demo Diagrams', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Demo diagram legend shows all used group types', async ({ page }) => {
    await loadDemoDiagram(page);

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);

    // Contoso Network demo should have groups
    // Verify GROUPS section is visible
    await expect(page.locator('text=GROUPS').first()).toBeVisible();

    // Should show at least one group type name
    const groupTypes = ['Resource Group', 'Virtual Network', 'Subnet', 'AKS Cluster', 'Azure Region', 'On-Premises', 'Custom Group'];
    let foundGroupType = false;
    for (const gt of groupTypes) {
      const locator = page.locator(`text=${gt}`);
      if (await locator.isVisible().catch(() => false)) {
        foundGroupType = true;
        break;
      }
    }
    expect(foundGroupType).toBe(true);
  });

  test('Demo diagram legend shows connection styles', async ({ page }) => {
    await loadDemoDiagram(page);

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);

    // Demo should have edges, so CONNECTIONS should be visible
    await expect(page.locator('text=CONNECTIONS').first()).toBeVisible();

    // Should have at least Synchronous or Asynchronous
    const syncVisible = await page.locator('text=Synchronous').isVisible().catch(() => false);
    const asyncVisible = await page.locator('text=Asynchronous').isVisible().catch(() => false);
    expect(syncVisible || asyncVisible).toBe(true);
  });

  test('Demo diagram SVG export includes complete legend', async ({ page }) => {
    await loadDemoDiagram(page);

    // Listen for download
    const downloadPromise = page.waitForEvent('download');

    // Click SVG export
    await page.getByRole('button', { name: 'SVG' }).click();

    const download = await downloadPromise;
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const svgContent = fs.readFileSync(downloadPath, 'utf-8');

    // Should have legend
    expect(svgContent).toContain('class="legend"');
    expect(svgContent).toContain('>Legend<');

    // Should have both sections
    expect(svgContent).toContain('GROUPS');
    expect(svgContent).toContain('CONNECTIONS');

    // Cleanup
    safeUnlink(downloadPath);
  });
});

test.describe('Legend edge cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Legend shows message when no groups or edges exist', async ({ page }) => {
    // Load diagram with only nodes, no groups or edges
    await loadCustomDiagram(page, {
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM 1', x: 150, y: 150 },
        { id: 'n2', type: 'storage', label: 'Storage', x: 300, y: 150 }
      ],
      edges: []
    });

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);

    // Should show "No groups or edges in diagram" message
    await expect(page.locator('text=No groups or edges in diagram')).toBeVisible();
  });

  test('Legend updates when groups are added', async ({ page }) => {
    // Start with just nodes
    await loadCustomDiagram(page, {
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM', x: 200, y: 200 }
      ],
      edges: []
    });

    // Open legend - should show no groups message
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);
    await expect(page.locator('text=No groups or edges')).toBeVisible();

    // Close legend
    await page.locator('button').filter({ hasText: '×' }).click();

    // Add a group via the UI
    // Click on the "rg" group button in sidebar
    const rgButton = page.locator('button[title="Resource Group"]');
    if (await rgButton.isVisible()) {
      await rgButton.click();
      await page.waitForTimeout(300);

      // Open legend again
      await page.getByRole('button', { name: /Legend/i }).click();
      await page.waitForTimeout(100);

      // Should now show Resource Group
      await expect(page.locator('text=Resource Group')).toBeVisible();
    }
  });

  test('Legend handles all 7 group types correctly', async ({ page }) => {
    // Load diagram with all group types - use unique labels different from group type names
    await loadCustomDiagram(page, {
      groups: [
        { id: 'g1', type: 'rg', label: 'MyRG1', x: 50, y: 50, w: 100, h: 80, children: [] },
        { id: 'g2', type: 'vnet_grp', label: 'MyVNet1', x: 200, y: 50, w: 100, h: 80, children: [] },
        { id: 'g3', type: 'subnet_grp', label: 'MySub1', x: 350, y: 50, w: 100, h: 80, children: [] },
        { id: 'g4', type: 'aks_grp', label: 'MyAKS1', x: 500, y: 50, w: 100, h: 80, children: [] },
        { id: 'g5', type: 'region', label: 'MyRegion1', x: 50, y: 200, w: 100, h: 80, children: [] },
        { id: 'g6', type: 'onprem', label: 'MyOnPrem1', x: 200, y: 200, w: 100, h: 80, children: [] },
        { id: 'g7', type: 'custom', label: 'MyCustom1', x: 350, y: 200, w: 100, h: 80, children: [] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM', x: 500, y: 200 }
      ],
      edges: []
    });

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);

    // All 7 group types should be visible in legend (use span selector to target legend specifically)
    await expect(page.locator('span').filter({ hasText: 'Resource Group' })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Virtual Network' })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Subnet' })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'AKS Cluster' })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Azure Region' })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'On-Premises' })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Custom Group' })).toBeVisible();
  });

  test('Legend panel position is in bottom-left corner', async ({ page }) => {
    await loadDemoDiagram(page);

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);

    // Find the legend panel by its content
    const legendPanel = page.locator('div').filter({ hasText: /^Legend/ }).first();

    // Check its positioning style
    const position = await legendPanel.evaluate(el => {
      const style = getComputedStyle(el);
      return {
        position: style.position,
        bottom: style.bottom,
        left: style.left
      };
    });

    expect(position.position).toBe('absolute');
    expect(position.bottom).toBe('12px');
    expect(position.left).toBe('12px');
  });

  test('Edges default to solid style in legend when style not specified', async ({ page }) => {
    // Create edge without explicit style - should default to solid
    await loadCustomDiagram(page, {
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM 1', x: 150, y: 150 },
        { id: 'n2', type: 'vm', label: 'VM 2', x: 350, y: 150 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Connection' } // No style specified
      ]
    });

    // Open legend
    await page.getByRole('button', { name: /Legend/i }).click();
    await page.waitForTimeout(100);

    // Should show Synchronous (solid is default)
    await expect(page.locator('text=Synchronous')).toBeVisible();
  });
});
