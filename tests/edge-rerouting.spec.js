// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Edge Re-routing on Drag Tests
 *
 * Tests for the edge re-routing feature:
 * - When a node is dragged, edges connected to it have their bendPoints cleared
 * - When a group is dragged, edges connected to nodes inside the group have their bendPoints cleared
 * - This forces edges to recalculate paths dynamically
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

// Helper to enable edit mode
async function enableEditMode(page) {
  const editBtn = page.getByRole('button', { name: /Edit/i }).first();
  const isEditing = await page.locator('button[aria-pressed="true"]').filter({ hasText: /Edit/i }).count();
  if (!isEditing) {
    await editBtn.click();
    await page.waitForTimeout(100);
  }
}

// Helper to get the path 'd' attribute for an edge
async function getEdgePath(page, edgeLabel) {
  // Find the edge group containing the label, then get the path 'd' attribute
  const edgeGroup = page.locator('svg g[style*="cursor"]').filter({
    has: page.locator(`text`).filter({ hasText: edgeLabel })
  });
  // Get the visible path (second path, first is transparent hit area)
  const path = edgeGroup.locator('path').nth(1);
  return await path.getAttribute('d');
}

// Helper to get node position by finding the text and its bounding box
async function getNodePosition(page, label) {
  const nodeText = page.locator('svg text').filter({ hasText: new RegExp(`^${label}$`) }).first();
  const box = await nodeText.boundingBox();
  if (box) {
    // Return center of the text (which is positioned relative to node center)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  return null;
}

// Helper to drag a node by its label
async function dragNode(page, label, deltaX, deltaY) {
  const nodeText = page.locator('svg text').filter({ hasText: new RegExp(`^${label}$`) }).first();
  await expect(nodeText).toBeVisible();

  const box = await nodeText.boundingBox();
  if (!box) throw new Error(`Could not find node ${label}`);

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}

// Helper to drag a group by clicking on its header area (the rect)
async function dragGroup(page, label, deltaX, deltaY) {
  // Find the group label text
  const groupLabel = page.locator('svg text').filter({ hasText: new RegExp(`^${label}(\\s*\\(collapsed\\))?$`) }).first();
  await expect(groupLabel).toBeVisible();

  // Get the bounding box of the label
  const labelBox = await groupLabel.boundingBox();
  if (!labelBox) throw new Error(`Could not find group label ${label}`);

  // Click to the right of the label (still on the group header rect)
  // The group rect extends past the label, so clicking right of the label should work
  // Avoid the collapse button which is at the left edge (x + 4 to x + 20)
  const startX = labelBox.x + labelBox.width + 30;
  const startY = labelBox.y + labelBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

test.describe('Edge re-routing on drag', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Node drag clears edge bendPoints and updates path', async ({ page }) => {
    // Create a diagram with nodes and an edge
    await loadCustomDiagram(page, {
      title: 'Edge Rerouting Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Source VM', x: 150, y: 200 },
        { id: 'n2', type: 'storage', label: 'Target Storage', x: 400, y: 200 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Data Flow', style: 'solid', bendPoints: [
          { x: 150, y: 200 }, { x: 200, y: 150 }, { x: 350, y: 150 }, { x: 400, y: 200 }
        ]}
      ]
    });

    // Enable edit mode
    await enableEditMode(page);

    // Get initial edge path
    const initialPath = await getEdgePath(page, 'Data Flow');
    expect(initialPath).toBeTruthy();

    // Drag the source node
    await dragNode(page, 'Source VM', 50, 50);

    // Get updated edge path
    const updatedPath = await getEdgePath(page, 'Data Flow');
    expect(updatedPath).toBeTruthy();

    // Path should be different after drag (bendPoints cleared, recalculated)
    expect(updatedPath).not.toBe(initialPath);
  });

  test('Group drag updates edges for contained nodes', async ({ page }) => {
    // Create a diagram with a group containing a node connected to an external node
    await loadCustomDiagram(page, {
      title: 'Group Drag Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'My Group', x: 100, y: 100, w: 200, h: 180, children: ['n1'] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Internal VM', x: 180, y: 180 },
        { id: 'n2', type: 'storage', label: 'External Storage', x: 450, y: 180 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Connection', style: 'solid', bendPoints: [
          { x: 180, y: 180 }, { x: 250, y: 120 }, { x: 400, y: 120 }, { x: 450, y: 180 }
        ]}
      ]
    });

    // Enable edit mode
    await enableEditMode(page);

    // Get initial edge path
    const initialPath = await getEdgePath(page, 'Connection');
    expect(initialPath).toBeTruthy();

    // Get initial node position
    const initialNodePos = await getNodePosition(page, 'Internal VM');
    expect(initialNodePos).toBeTruthy();

    // Drag the group
    await dragGroup(page, 'My Group', 80, 60);

    // Wait for state to update
    await page.waitForTimeout(200);

    // Get updated edge path
    const updatedPath = await getEdgePath(page, 'Connection');
    expect(updatedPath).toBeTruthy();

    // Path should be different after group drag (bendPoints cleared, recalculated)
    expect(updatedPath).not.toBe(initialPath);

    // Verify internal node also moved
    const newNodePos = await getNodePosition(page, 'Internal VM');
    expect(newNodePos).toBeTruthy();
    if (initialNodePos && newNodePos) {
      // Node position should have changed by approximately the drag delta
      expect(Math.abs(newNodePos.x - initialNodePos.x - 80)).toBeLessThan(20);
      expect(Math.abs(newNodePos.y - initialNodePos.y - 60)).toBeLessThan(20);
    }
  });

  test('Edge still renders correctly after drag', async ({ page }) => {
    // Create a simple diagram
    await loadCustomDiagram(page, {
      title: 'Edge Render Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'appservice', label: 'API Server', x: 200, y: 200 },
        { id: 'n2', type: 'sqldb', label: 'Database', x: 450, y: 200 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'SQL Queries', style: 'solid' }
      ]
    });

    // Enable edit mode
    await enableEditMode(page);

    // Verify edge is visible initially
    const edgeLabel = page.locator('svg text').filter({ hasText: 'SQL Queries' });
    await expect(edgeLabel).toBeVisible();

    // Verify edge path exists - use the visible stroke path (nth(1) is the visible one, not transparent hitbox)
    // Note: Horizontal line paths may be considered "hidden" by Playwright due to zero height
    const edgePath = page.locator('svg g[style*="cursor"]').filter({
      has: page.locator('text').filter({ hasText: 'SQL Queries' })
    }).locator('path').nth(1);
    await expect(edgePath).toHaveCount(1);

    // Drag the source node
    await dragNode(page, 'API Server', 100, 0);

    // Edge should still be visible after drag
    await expect(edgeLabel).toBeVisible();

    // Edge path should still exist - check it has valid path data
    const pathD = await edgePath.getAttribute('d');
    expect(pathD).toBeTruthy();
    expect(pathD).toMatch(/^M\s*[\d.-]+/); // Should start with M command
  });

  test('Multiple connected edges all update on node drag', async ({ page }) => {
    // Create a node with multiple edges (incoming and outgoing)
    await loadCustomDiagram(page, {
      title: 'Multi-Edge Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'frontdoor', label: 'Front Door', x: 150, y: 200 },
        { id: 'n2', type: 'appservice', label: 'App Service', x: 350, y: 200 },
        { id: 'n3', type: 'sqldb', label: 'SQL DB', x: 550, y: 200 },
        { id: 'n4', type: 'redis', label: 'Redis Cache', x: 350, y: 350 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'HTTPS', style: 'solid', bendPoints: [
          { x: 150, y: 200 }, { x: 200, y: 150 }, { x: 300, y: 150 }, { x: 350, y: 200 }
        ]},
        { id: 'e2', from: 'n2', to: 'n3', label: 'SQL', style: 'solid', bendPoints: [
          { x: 350, y: 200 }, { x: 400, y: 150 }, { x: 500, y: 150 }, { x: 550, y: 200 }
        ]},
        { id: 'e3', from: 'n2', to: 'n4', label: 'Cache', style: 'dashed', bendPoints: [
          { x: 350, y: 200 }, { x: 350, y: 275 }, { x: 350, y: 350 }
        ]}
      ]
    });

    // Enable edit mode
    await enableEditMode(page);

    // Get initial paths for all edges connected to App Service
    const httpsPath = await getEdgePath(page, 'HTTPS');
    const sqlPath = await getEdgePath(page, 'SQL');
    const cachePath = await getEdgePath(page, 'Cache');

    expect(httpsPath).toBeTruthy();
    expect(sqlPath).toBeTruthy();
    expect(cachePath).toBeTruthy();

    // Drag the middle node (App Service) - connected to all three edges
    await dragNode(page, 'App Service', 0, -80);

    // All connected edges should have updated paths
    const newHttpsPath = await getEdgePath(page, 'HTTPS');
    const newSqlPath = await getEdgePath(page, 'SQL');
    const newCachePath = await getEdgePath(page, 'Cache');

    expect(newHttpsPath).toBeTruthy();
    expect(newSqlPath).toBeTruthy();
    expect(newCachePath).toBeTruthy();

    // All paths should be different (bendPoints cleared, recalculated)
    expect(newHttpsPath).not.toBe(httpsPath);
    expect(newSqlPath).not.toBe(sqlPath);
    expect(newCachePath).not.toBe(cachePath);
  });

  test('Edges to dragged target node also update', async ({ page }) => {
    // Test that dragging the target node (not source) also clears bendPoints
    await loadCustomDiagram(page, {
      title: 'Target Drag Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Producer', x: 150, y: 200 },
        { id: 'n2', type: 'eventhub', label: 'Event Hub', x: 400, y: 200 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Events', style: 'solid', bendPoints: [
          { x: 150, y: 200 }, { x: 200, y: 120 }, { x: 350, y: 120 }, { x: 400, y: 200 }
        ]}
      ]
    });

    // Enable edit mode
    await enableEditMode(page);

    // Get initial path
    const initialPath = await getEdgePath(page, 'Events');
    expect(initialPath).toBeTruthy();

    // Drag the target node (Event Hub)
    await dragNode(page, 'Event Hub', -50, 80);

    // Edge path should update
    const updatedPath = await getEdgePath(page, 'Events');
    expect(updatedPath).toBeTruthy();
    expect(updatedPath).not.toBe(initialPath);
  });

  test('Edge endpoints remain connected to nodes after drag', async ({ page }) => {
    // Verify that edges still visually connect to their source and target nodes
    await loadCustomDiagram(page, {
      title: 'Connection Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'functions', label: 'Function App', x: 200, y: 200 },
        { id: 'n2', type: 'cosmos', label: 'Cosmos DB', x: 500, y: 200 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Documents', style: 'solid' }
      ]
    });

    // Enable edit mode
    await enableEditMode(page);

    // Verify both nodes and edge are initially visible
    await expect(page.locator('svg text').filter({ hasText: 'Function App' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Cosmos DB' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Documents' })).toBeVisible();

    // Get initial edge path
    const initialPath = await getEdgePath(page, 'Documents');
    expect(initialPath).toBeTruthy();

    // Drag source node
    await dragNode(page, 'Function App', 80, -40);

    // Edge should still be rendered
    const edgeLabel = page.locator('svg text').filter({ hasText: 'Documents' });
    await expect(edgeLabel).toBeVisible();

    // Edge path should exist and be valid
    const updatedPath = await getEdgePath(page, 'Documents');
    expect(updatedPath).toBeTruthy();

    // Path should have changed (node moved)
    expect(updatedPath).not.toBe(initialPath);

    // Path should be a valid SVG path
    expect(updatedPath).toMatch(/^M\s*[\d.-]+/);
  });

  test('Group drag with nested group updates all related edges', async ({ page }) => {
    // Test dragging a parent group with nested child group
    await loadCustomDiagram(page, {
      title: 'Nested Group Test',
      groups: [
        { id: 'g1', type: 'region', label: 'East US', x: 50, y: 50, w: 350, h: 280, children: ['g2', 'n1'] },
        { id: 'g2', type: 'vnet_grp', label: 'VNet', x: 80, y: 100, w: 200, h: 150, children: ['n2'] }
      ],
      nodes: [
        { id: 'n1', type: 'frontdoor', label: 'Front Door', x: 320, y: 120 },
        { id: 'n2', type: 'appservice', label: 'Web App', x: 160, y: 180 },
        { id: 'n3', type: 'user', label: 'External User', x: 500, y: 150 }
      ],
      edges: [
        { id: 'e1', from: 'n3', to: 'n1', label: 'Access', style: 'solid', bendPoints: [
          { x: 500, y: 150 }, { x: 450, y: 100 }, { x: 380, y: 100 }, { x: 320, y: 120 }
        ]},
        { id: 'e2', from: 'n1', to: 'n2', label: 'Route', style: 'solid', bendPoints: [
          { x: 320, y: 120 }, { x: 280, y: 150 }, { x: 200, y: 150 }, { x: 160, y: 180 }
        ]}
      ]
    });

    // Enable edit mode
    await enableEditMode(page);

    // Get initial paths
    const accessPath = await getEdgePath(page, 'Access');
    const routePath = await getEdgePath(page, 'Route');
    expect(accessPath).toBeTruthy();
    expect(routePath).toBeTruthy();

    // Drag the parent region group
    await dragGroup(page, 'East US', 60, 40);
    await page.waitForTimeout(300);

    // All edges connected to nodes inside the group should update
    const newAccessPath = await getEdgePath(page, 'Access');
    const newRoutePath = await getEdgePath(page, 'Route');

    expect(newAccessPath).toBeTruthy();
    expect(newRoutePath).toBeTruthy();

    // Both edges should have different paths (bendPoints cleared)
    expect(newAccessPath).not.toBe(accessPath);
    expect(newRoutePath).not.toBe(routePath);
  });

  test('Edge without initial bendPoints works correctly after drag', async ({ page }) => {
    // Test that edges without bendPoints (using computed paths) still work after drag
    await loadCustomDiagram(page, {
      title: 'No BendPoints Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'lb', label: 'Load Balancer', x: 200, y: 200 },
        { id: 'n2', type: 'vmss', label: 'VM Scale Set', x: 450, y: 200 }
      ],
      edges: [
        // Edge without bendPoints - uses computed orthogonal path
        { id: 'e1', from: 'n1', to: 'n2', label: 'Traffic', style: 'solid' }
      ]
    });

    // Enable edit mode
    await enableEditMode(page);

    // Edge should be visible
    const edgeLabel = page.locator('svg text').filter({ hasText: 'Traffic' });
    await expect(edgeLabel).toBeVisible();

    // Get initial path
    const initialPath = await getEdgePath(page, 'Traffic');
    expect(initialPath).toBeTruthy();

    // Drag source node
    await dragNode(page, 'Load Balancer', 80, 0);

    // Edge should still render
    await expect(edgeLabel).toBeVisible();

    // Path should update
    const updatedPath = await getEdgePath(page, 'Traffic');
    expect(updatedPath).toBeTruthy();
    // Path changes because node position changed
    expect(updatedPath).not.toBe(initialPath);
  });

  test('Dashed edge style preserved after drag re-routing', async ({ page }) => {
    // Verify edge styling is preserved when bendPoints are cleared
    await loadCustomDiagram(page, {
      title: 'Style Preservation Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'appservice', label: 'Primary', x: 200, y: 200 },
        { id: 'n2', type: 'appservice', label: 'Failover', x: 450, y: 200 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Sync', style: 'dashed', bendPoints: [
          { x: 200, y: 200 }, { x: 250, y: 150 }, { x: 400, y: 150 }, { x: 450, y: 200 }
        ]}
      ]
    });

    // Enable edit mode
    await enableEditMode(page);

    // Get the edge path element
    const edgePath = page.locator('svg g[style*="cursor"]').filter({
      has: page.locator('text').filter({ hasText: 'Sync' })
    }).locator('path').nth(1);

    // Verify dashed style initially
    const initialDash = await edgePath.getAttribute('stroke-dasharray');
    expect(initialDash).not.toBe('none');
    expect(initialDash).toBeTruthy();

    // Drag a node
    await dragNode(page, 'Primary', 50, 50);

    // Verify dashed style is preserved after drag
    const updatedDash = await edgePath.getAttribute('stroke-dasharray');
    expect(updatedDash).not.toBe('none');
    expect(updatedDash).toBeTruthy();
  });
});
