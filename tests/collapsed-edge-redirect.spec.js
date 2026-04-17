// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Collapsed Group Edge Redirection Tests
 *
 * Tests for edge behavior when groups are collapsed:
 * - Edges to nodes inside collapsed groups redirect to the group boundary
 * - Redirected edges have dashed style and reduced opacity
 * - Internal edges (both endpoints in same collapsed group) are hidden
 * - Works with nested collapsed groups
 */

// Helper to load a custom diagram via localStorage
async function loadCustomDiagram(page, { groups = [], nodes = [], edges = [], title = 'Test Diagram' }) {
  await page.evaluate(({ groups, nodes, edges, title }) => {
    const state = {
      nodes,
      groups,
      edges,
      title,
      zoom: 1,
      pan: { x: 0, y: 0 },
      metadata: { author: '', version: '1.0', description: '', references: [] }
    };
    localStorage.setItem('azure-diagram-state', JSON.stringify(state));
  }, { groups, nodes, edges, title });
  await page.reload();
  await page.waitForTimeout(300);
}

// Helper to collapse a group by clicking its collapse button
async function collapseGroup(page, groupLabel) {
  const collapseBtn = page.getByRole('button', { name: `Collapse group ${groupLabel}` });
  await expect(collapseBtn).toBeVisible();
  await collapseBtn.click();
  await page.waitForTimeout(200);
}

// Helper to expand a group by clicking its expand button
async function expandGroup(page, groupLabel) {
  const expandBtn = page.getByRole('button', { name: `Expand group ${groupLabel}` });
  await expect(expandBtn).toBeVisible();
  await expandBtn.click();
  await page.waitForTimeout(200);
}

// Helper to get the visible edge path (not the transparent hit area)
// Edge groups have: <g style="cursor:pointer"><path stroke="transparent" ...><path stroke={color} ...>
async function getVisibleEdgePath(page) {
  // Find edge groups with cursor:pointer style, then get the second path (visible one)
  const edgeGroups = page.locator('svg g[style*="cursor: pointer"], svg g[style*="cursor:pointer"]');
  const count = await edgeGroups.count();
  if (count === 0) return null;
  // The visible path is the one that's not transparent - use :nth-child(2)
  return edgeGroups.first().locator('path:nth-child(2)');
}

// Helper to get all visible edge paths
async function getAllVisibleEdgePaths(page) {
  return page.locator('svg g[style*="cursor: pointer"] path:nth-child(2), svg g[style*="cursor:pointer"] path:nth-child(2)');
}

test.describe('Collapsed Group Edge Redirection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Edge redirects to collapsed group boundary', async ({ page }) => {
    // Create diagram: external node -> node inside group
    await loadCustomDiagram(page, {
      title: 'Edge Redirect Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'My Group', x: 200, y: 100, w: 200, h: 150, children: ['n2'] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'External VM', x: 80, y: 175 },
        { id: 'n2', type: 'storage', label: 'Internal Storage', x: 300, y: 175 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Data Flow', style: 'solid' }
      ]
    });

    // Verify edge and internal node visible initially
    await expect(page.locator('svg text').filter({ hasText: 'Data Flow' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Internal Storage' })).toBeVisible();

    // Collapse the group
    await collapseGroup(page, 'My Group');

    // Internal node should be hidden
    await expect(page.locator('svg text').filter({ hasText: 'Internal Storage' })).not.toBeVisible();

    // Edge label should still be visible (redirected to group)
    await expect(page.locator('svg text').filter({ hasText: 'Data Flow' })).toBeVisible();

    // External node should still be visible
    await expect(page.locator('svg text').filter({ hasText: 'External VM' })).toBeVisible();

    // Edge path should still exist
    const edgePaths = page.locator('svg g[style*="cursor"] path');
    await expect(edgePaths.first()).toBeVisible();
  });

  test('Internal edges hidden when group collapsed', async ({ page }) => {
    // Create diagram: two nodes inside same group with internal edge
    await loadCustomDiagram(page, {
      title: 'Internal Edge Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Container Group', x: 100, y: 100, w: 300, h: 180, children: ['n1', 'n2'] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'App Server', x: 180, y: 180 },
        { id: 'n2', type: 'sqldb', label: 'Database', x: 320, y: 180 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Internal Query', style: 'solid' }
      ]
    });

    // Verify internal edge visible initially
    await expect(page.locator('svg text').filter({ hasText: 'Internal Query' })).toBeVisible();

    // Collapse the group
    await collapseGroup(page, 'Container Group');

    // Both internal nodes should be hidden
    await expect(page.locator('svg text').filter({ hasText: 'App Server' })).not.toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Database' })).not.toBeVisible();

    // Internal edge label should be hidden (both endpoints in same collapsed group)
    await expect(page.locator('svg text').filter({ hasText: 'Internal Query' })).not.toBeVisible();
  });

  test('Redirected edge has dashed style', async ({ page }) => {
    // Create diagram with external connection to internal node
    await loadCustomDiagram(page, {
      title: 'Dashed Style Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Backend Group', x: 200, y: 100, w: 200, h: 150, children: ['n2'] }
      ],
      nodes: [
        { id: 'n1', type: 'user', label: 'User', x: 80, y: 175 },
        { id: 'n2', type: 'appservice', label: 'API', x: 300, y: 175 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'HTTPS', style: 'solid' }
      ]
    });

    // Get edge path before collapse - should be solid (no dasharray or "none")
    const edgePath = await getVisibleEdgePath(page);
    const initialDash = await edgePath.getAttribute('stroke-dasharray');
    expect(initialDash === null || initialDash === 'none').toBeTruthy();

    // Collapse the group
    await collapseGroup(page, 'Backend Group');

    // Edge should now have dashed pattern (strokeDasharray="4 2")
    const redirectedPath = await getVisibleEdgePath(page);
    const dashArray = await redirectedPath.getAttribute('stroke-dasharray');
    expect(dashArray).toBe('4 2');
  });

  test('Redirected edge has reduced opacity', async ({ page }) => {
    // Create diagram with external connection
    await loadCustomDiagram(page, {
      title: 'Opacity Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Service Group', x: 200, y: 100, w: 200, h: 150, children: ['n2'] }
      ],
      nodes: [
        { id: 'n1', type: 'frontdoor', label: 'Front Door', x: 80, y: 175 },
        { id: 'n2', type: 'appservice', label: 'Web App', x: 300, y: 175 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', style: 'solid' }
      ]
    });

    // Get edge opacity before collapse (should be 0.7 for normal edges)
    const edgePath = await getVisibleEdgePath(page);
    const initialOpacity = await edgePath.getAttribute('opacity');
    expect(parseFloat(initialOpacity || '0.7')).toBeCloseTo(0.7, 1);

    // Collapse the group
    await collapseGroup(page, 'Service Group');

    // Find the redirected edge path and check opacity
    const redirectedPath = await getVisibleEdgePath(page);
    const opacity = await redirectedPath.getAttribute('opacity');
    expect(parseFloat(opacity || '1')).toBeCloseTo(0.6, 1);
  });

  test('Edge restores to original when group expanded', async ({ page }) => {
    // Create diagram with external connection
    await loadCustomDiagram(page, {
      title: 'Restore Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Restore Group', x: 200, y: 100, w: 200, h: 150, children: ['n2'] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Source VM', x: 80, y: 175 },
        { id: 'n2', type: 'storage', label: 'Target Storage', x: 300, y: 175 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Sync', style: 'solid' }
      ]
    });

    // Verify target node visible
    await expect(page.locator('svg text').filter({ hasText: 'Target Storage' })).toBeVisible();

    // Collapse the group - edge redirects
    await collapseGroup(page, 'Restore Group');
    await expect(page.locator('svg text').filter({ hasText: 'Target Storage' })).not.toBeVisible();

    // Edge should still be visible (redirected)
    await expect(page.locator('svg text').filter({ hasText: 'Sync' })).toBeVisible();

    // Check redirected style (dashed)
    const redirectedPath = await getVisibleEdgePath(page);
    const redirectedDash = await redirectedPath.getAttribute('stroke-dasharray');
    expect(redirectedDash).toBe('4 2');

    // Expand the group
    await expandGroup(page, 'Restore Group');

    // Target node should be visible again
    await expect(page.locator('svg text').filter({ hasText: 'Target Storage' })).toBeVisible();

    // Edge should restore to solid (no dasharray)
    const restoredPath = await getVisibleEdgePath(page);
    const restoredDash = await restoredPath.getAttribute('stroke-dasharray');
    expect(restoredDash === null || restoredDash === 'none').toBeTruthy();
  });

  test('Nested collapsed groups redirect to outermost', async ({ page }) => {
    // Create nested groups: outer > inner > node
    await loadCustomDiagram(page, {
      title: 'Nested Redirect Test',
      groups: [
        { id: 'g1', type: 'region', label: 'East US', x: 150, y: 80, w: 300, h: 250, children: ['g2'] },
        { id: 'g2', type: 'vnet_grp', label: 'VNet', x: 180, y: 150, w: 200, h: 150, children: ['n2'] }
      ],
      nodes: [
        { id: 'n1', type: 'frontdoor', label: 'Front Door', x: 60, y: 200 },
        { id: 'n2', type: 'appservice', label: 'App Service', x: 280, y: 225 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'HTTPS', style: 'solid' }
      ]
    });

    // Verify both groups and node visible
    await expect(page.locator('svg text').filter({ hasText: 'East US' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'VNet' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'App Service' })).toBeVisible();

    // Collapse inner VNet group first
    await collapseGroup(page, 'VNet');
    await expect(page.locator('svg text').filter({ hasText: 'App Service' })).not.toBeVisible();

    // Edge should redirect to VNet group (dashed style)
    let edgePath = await getVisibleEdgePath(page);
    let dashArray = await edgePath.getAttribute('stroke-dasharray');
    expect(dashArray).toBe('4 2');

    // Now collapse outer East US group
    await collapseGroup(page, 'East US');

    // VNet group should be hidden too
    await expect(page.locator('svg text').filter({ hasText: /^VNet/ })).not.toBeVisible();

    // Edge should still be visible and redirect to outermost (East US)
    await expect(page.locator('svg text').filter({ hasText: 'HTTPS' })).toBeVisible();

    // Edge should still have redirected style
    edgePath = await getVisibleEdgePath(page);
    dashArray = await edgePath.getAttribute('stroke-dasharray');
    expect(dashArray).toBe('4 2');
  });

  test('Multiple edges to collapsed group aggregate correctly', async ({ page }) => {
    // Create group with multiple nodes, each with external edges
    await loadCustomDiagram(page, {
      title: 'Multi-Edge Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Backend Services', x: 200, y: 80, w: 250, h: 200, children: ['n2', 'n3', 'n4'] }
      ],
      nodes: [
        { id: 'n1', type: 'frontdoor', label: 'Front Door', x: 60, y: 180 },
        { id: 'n2', type: 'appservice', label: 'API 1', x: 280, y: 130 },
        { id: 'n3', type: 'appservice', label: 'API 2', x: 380, y: 180 },
        { id: 'n4', type: 'functions', label: 'Functions', x: 280, y: 230 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Route A', style: 'solid' },
        { id: 'e2', from: 'n1', to: 'n3', label: 'Route B', style: 'solid' },
        { id: 'e3', from: 'n1', to: 'n4', label: 'Route C', style: 'solid' }
      ]
    });

    // Verify all edges visible initially
    await expect(page.locator('svg text').filter({ hasText: 'Route A' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Route B' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Route C' })).toBeVisible();

    // Collapse the group
    await collapseGroup(page, 'Backend Services');

    // Internal nodes should be hidden
    await expect(page.locator('svg text').filter({ hasText: 'API 1' })).not.toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'API 2' })).not.toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Functions' })).not.toBeVisible();

    // All edge labels should still be visible (all redirect to group)
    await expect(page.locator('svg text').filter({ hasText: 'Route A' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Route B' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Route C' })).toBeVisible();

    // Count visible edge paths (should have 3 redirected edges)
    const edgeGroups = page.locator('svg g[style*="cursor"]').filter({
      has: page.locator('path[stroke-dasharray="4 2"]')
    });
    const count = await edgeGroups.count();
    expect(count).toBe(3);
  });

  test('Trust boundary edge redirects when collapsed', async ({ page }) => {
    // Create trust boundary edge to node inside group
    await loadCustomDiagram(page, {
      title: 'Trust Boundary Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Secure Zone', x: 200, y: 100, w: 200, h: 150, children: ['n2'] }
      ],
      nodes: [
        { id: 'n1', type: 'user', label: 'External User', x: 60, y: 175 },
        { id: 'n2', type: 'appservice', label: 'Internal API', x: 300, y: 175 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Secure Access', style: 'trust_boundary' }
      ]
    });

    // Verify trust boundary edge visible (should be red dashed line)
    await expect(page.locator('svg text').filter({ hasText: 'Secure Access' })).toBeVisible();

    // Get trust boundary edge - should have red stroke and dashed pattern
    // Note: Horizontal line paths may be considered "hidden" by Playwright due to zero height
    const trustPath = page.locator('svg g[style*="cursor"] path[stroke="#dc2626"]').first();
    await expect(trustPath).toHaveCount(1);
    const initialDash = await trustPath.getAttribute('stroke-dasharray');
    expect(initialDash).toBe('8 4'); // Trust boundary default dash

    // Collapse the group
    await collapseGroup(page, 'Secure Zone');

    // Internal node should be hidden
    await expect(page.locator('svg text').filter({ hasText: 'Internal API' })).not.toBeVisible();

    // Trust boundary edge should still be visible and redirect to group
    await expect(page.locator('svg text').filter({ hasText: 'Secure Access' })).toBeVisible();

    // Edge should still be a trust boundary (red color preserved)
    const redirectedTrustPath = page.locator('svg g[style*="cursor"] path[stroke="#dc2626"]').first();
    await expect(redirectedTrustPath).toHaveCount(1);

    // Trust boundary keeps its own dash pattern (not overridden by redirect)
    const redirectedDash = await redirectedTrustPath.getAttribute('stroke-dasharray');
    expect(redirectedDash).toBe('8 4');
  });

  test('Edge label visible on redirected edge', async ({ page }) => {
    // Create labeled edge to node inside group
    await loadCustomDiagram(page, {
      title: 'Label Visibility Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Service Group', x: 200, y: 100, w: 200, h: 150, children: ['n2'] }
      ],
      nodes: [
        { id: 'n1', type: 'lb', label: 'Load Balancer', x: 60, y: 175 },
        { id: 'n2', type: 'vmss', label: 'VM Scale Set', x: 300, y: 175 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Port 443', style: 'solid' }
      ]
    });

    // Verify edge label visible initially
    const edgeLabel = page.locator('svg text').filter({ hasText: 'Port 443' });
    await expect(edgeLabel).toBeVisible();

    // Collapse the group
    await collapseGroup(page, 'Service Group');

    // Edge label should still be visible on redirected edge
    await expect(edgeLabel).toBeVisible();

    // Verify the label is within an edge group (has a background rect)
    const labelRect = page.locator('svg g[style*="cursor"] rect').filter({
      has: page.locator(`+ text:text-is("Port 443")`)
    });
    // Label should have a pill/badge background
    const labelBg = page.locator('svg g[style*="cursor"]').filter({
      has: page.locator('text').filter({ hasText: 'Port 443' })
    }).locator('rect');
    await expect(labelBg.first()).toBeVisible();
  });

  test('Bidirectional edges both redirect when group collapsed', async ({ page }) => {
    // Create edges going both directions between external and internal nodes
    await loadCustomDiagram(page, {
      title: 'Bidirectional Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Processing Group', x: 200, y: 100, w: 200, h: 150, children: ['n2'] }
      ],
      nodes: [
        { id: 'n1', type: 'eventhub', label: 'Event Hub', x: 60, y: 175 },
        { id: 'n2', type: 'functions', label: 'Processor', x: 300, y: 175 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Events In', style: 'solid' },
        { id: 'e2', from: 'n2', to: 'n1', label: 'Results Out', style: 'solid' }
      ]
    });

    // Verify both edges visible
    await expect(page.locator('svg text').filter({ hasText: 'Events In' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Results Out' })).toBeVisible();

    // Collapse the group
    await collapseGroup(page, 'Processing Group');

    // Both edge labels should still be visible (both redirect to group)
    await expect(page.locator('svg text').filter({ hasText: 'Events In' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Results Out' })).toBeVisible();

    // Internal node should be hidden
    await expect(page.locator('svg text').filter({ hasText: 'Processor' })).not.toBeVisible();
  });

  test('Expanding nested group restores edge to inner target', async ({ page }) => {
    // Create nested groups and verify edge restores correctly
    await loadCustomDiagram(page, {
      title: 'Nested Restore Test',
      groups: [
        { id: 'g1', type: 'region', label: 'Region', x: 150, y: 80, w: 300, h: 250, children: ['g2'], collapsed: true },
        { id: 'g2', type: 'vnet_grp', label: 'VNet', x: 180, y: 150, w: 200, h: 150, children: ['n2'], collapsed: true }
      ],
      nodes: [
        { id: 'n1', type: 'frontdoor', label: 'CDN', x: 60, y: 200 },
        { id: 'n2', type: 'appservice', label: 'Origin', x: 280, y: 225 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Fetch', style: 'solid' }
      ]
    });

    // Both groups collapsed, edge should redirect to outer Region
    await expect(page.locator('svg text').filter({ hasText: 'Origin' })).not.toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Fetch' })).toBeVisible();

    // Expand outer Region
    await expandGroup(page, 'Region');

    // VNet should now be visible but still collapsed
    await expect(page.locator('svg text').filter({ hasText: /^VNet/ })).toBeVisible();

    // Edge still redirects (to VNet now, which is still collapsed)
    await expect(page.locator('svg text').filter({ hasText: 'Fetch' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Origin' })).not.toBeVisible();

    // Expand inner VNet
    await expandGroup(page, 'VNet');

    // Origin node should now be visible
    await expect(page.locator('svg text').filter({ hasText: 'Origin' })).toBeVisible();

    // Edge should be solid again (not redirected)
    const edgePath = await getVisibleEdgePath(page);
    const dashArray = await edgePath.getAttribute('stroke-dasharray');
    expect(dashArray === null || dashArray === 'none').toBeTruthy();
  });
});
