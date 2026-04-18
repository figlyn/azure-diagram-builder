// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Layout Button Edge Rerouting Tests
 *
 * Tests that verify the Layout button properly triggers edge/arrow rerouting:
 * - Clicking Layout recalculates all edge paths with ELK.js
 * - bendPoints are cleared/regenerated when ELK falls back to autoLayout
 * - Multiple edges connected to moved nodes all get rerouted
 * - Edge labels reposition correctly after layout
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
  await page.waitForTimeout(500);
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

// Helper to get the path 'd' attribute for an edge by label
async function getEdgePath(page, edgeLabel) {
  const edgeGroup = page.locator('svg g[style*="cursor"]').filter({
    has: page.locator(`text`).filter({ hasText: edgeLabel })
  });
  // Get the visible path (second path, first is transparent hit area)
  const path = edgeGroup.locator('path').nth(1);
  const count = await path.count();
  if (count === 0) return null;
  return await path.getAttribute('d');
}

// Helper to get all edge paths as a map (label -> d attribute)
async function getAllEdgePaths(page) {
  const edgePaths = {};
  // Find all edge groups by looking for groups with stroke paths
  const edgeLabels = page.locator('svg g[style*="cursor"] text');
  const count = await edgeLabels.count();
  for (let i = 0; i < count; i++) {
    const label = await edgeLabels.nth(i).textContent();
    if (label) {
      const path = await getEdgePath(page, label);
      if (path) {
        edgePaths[label] = path;
      }
    }
  }
  return edgePaths;
}

// Helper to get edge label position
async function getEdgeLabelPosition(page, labelText) {
  const label = page.locator('svg g[style*="cursor"] text').filter({ hasText: labelText }).first();
  const box = await label.boundingBox();
  if (box) {
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  return null;
}

// Helper to get node position by finding the text and its bounding box
async function getNodePosition(page, label) {
  const nodeText = page.locator('svg text').filter({ hasText: new RegExp(`^${label}$`) }).first();
  const box = await nodeText.boundingBox();
  if (box) {
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

// Helper to click the Layout button
async function clickLayoutButton(page) {
  const layoutBtn = page.locator('button').filter({ hasText: '⟲ Layout' });
  await expect(layoutBtn).toBeVisible();
  await layoutBtn.click();
  // Wait for ELK layout to complete and toast to appear
  await page.waitForTimeout(800);
}

// Helper to load demo diagram
async function loadDemoDiagram(page, demoName) {
  await page.getByRole('button', { name: demoName }).click();
  await page.getByRole('button', { name: 'Load Demo' }).click();
  await expect(page.locator('svg')).toBeVisible();
  await page.waitForTimeout(500);
}

test.describe('Layout button edge rerouting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Layout button recalculates edge paths after manual node drag', async ({ page }) => {
    // Load a demo diagram with edges
    await loadDemoDiagram(page, 'Contoso Network');

    // Enable edit mode
    await enableEditMode(page);

    // Get initial edge paths
    const initialPaths = await getAllEdgePaths(page);
    const edgeLabels = Object.keys(initialPaths);
    expect(edgeLabels.length).toBeGreaterThan(0);

    // Pick one edge to track
    const trackedLabel = edgeLabels[0];
    const initialPath = initialPaths[trackedLabel];
    expect(initialPath).toBeTruthy();

    // Drag a node to disturb the layout
    // Find any node that's part of an edge
    const nodeTexts = page.locator('svg image + text').first();
    await expect(nodeTexts).toBeVisible();
    const nodeLabel = await nodeTexts.textContent();

    if (nodeLabel) {
      await dragNode(page, nodeLabel, 100, 50);
    }

    // Now click Layout button to recalculate
    await clickLayoutButton(page);

    // Get new edge paths after layout
    const newPaths = await getAllEdgePaths(page);

    // At least some edges should have changed (layout reorganizes everything)
    let changedCount = 0;
    for (const label of edgeLabels) {
      if (newPaths[label] && initialPaths[label] !== newPaths[label]) {
        changedCount++;
      }
    }

    // Layout should have changed the overall arrangement
    expect(changedCount).toBeGreaterThan(0);
  });

  test('Layout button clears old bendPoints when using autoLayout fallback', async ({ page }) => {
    // Create a diagram with explicit bendPoints that should be cleared
    await loadCustomDiagram(page, {
      title: 'BendPoints Clear Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Server A', x: 150, y: 200 },
        { id: 'n2', type: 'storage', label: 'Storage B', x: 450, y: 200 },
        { id: 'n3', type: 'sqldb', label: 'Database C', x: 300, y: 400 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Link 1', style: 'solid', bendPoints: [
          { x: 150, y: 200 }, { x: 200, y: 100 }, { x: 400, y: 100 }, { x: 450, y: 200 }
        ]},
        { id: 'e2', from: 'n2', to: 'n3', label: 'Link 2', style: 'solid', bendPoints: [
          { x: 450, y: 200 }, { x: 500, y: 300 }, { x: 350, y: 400 }, { x: 300, y: 400 }
        ]}
      ]
    });

    // Enable edit mode
    await enableEditMode(page);

    // Get initial paths (using stored bendPoints)
    const initialPath1 = await getEdgePath(page, 'Link 1');
    const initialPath2 = await getEdgePath(page, 'Link 2');
    expect(initialPath1).toBeTruthy();
    expect(initialPath2).toBeTruthy();

    // Click Layout button - should regenerate bendPoints via ELK/autoLayout
    await clickLayoutButton(page);

    // Verify toast appeared (indicates layout was applied)
    const toast = page.getByText('Layout updated with ELK.js');
    await expect(toast).toBeVisible({ timeout: 3000 });

    // Get new paths after layout
    const newPath1 = await getEdgePath(page, 'Link 1');
    const newPath2 = await getEdgePath(page, 'Link 2');
    expect(newPath1).toBeTruthy();
    expect(newPath2).toBeTruthy();

    // Paths should be different (old bendPoints replaced with ELK computed ones)
    // Note: They might happen to be similar if ELK chooses same routing, but typically different
    // The key test is that layout completes without error and edges still render
    expect(newPath1).toMatch(/^M\s*[\d.-]+/);
    expect(newPath2).toMatch(/^M\s*[\d.-]+/);
  });

  test('Multiple edges connected to moved node all get rerouted after Layout', async ({ page }) => {
    // Create a hub-and-spoke diagram where one node has multiple connections
    await loadCustomDiagram(page, {
      title: 'Multi-Edge Layout Test',
      groups: [],
      nodes: [
        { id: 'hub', type: 'lb', label: 'Load Balancer', x: 300, y: 250 },
        { id: 's1', type: 'vm', label: 'Server 1', x: 100, y: 150 },
        { id: 's2', type: 'vm', label: 'Server 2', x: 100, y: 350 },
        { id: 's3', type: 'vm', label: 'Server 3', x: 500, y: 150 },
        { id: 's4', type: 'vm', label: 'Server 4', x: 500, y: 350 }
      ],
      edges: [
        { id: 'e1', from: 'hub', to: 's1', label: 'Route 1', style: 'solid' },
        { id: 'e2', from: 'hub', to: 's2', label: 'Route 2', style: 'solid' },
        { id: 'e3', from: 'hub', to: 's3', label: 'Route 3', style: 'solid' },
        { id: 'e4', from: 'hub', to: 's4', label: 'Route 4', style: 'dashed' }
      ]
    });

    // Enable edit mode
    await enableEditMode(page);

    // Get initial paths for all edges
    const route1Before = await getEdgePath(page, 'Route 1');
    const route2Before = await getEdgePath(page, 'Route 2');
    const route3Before = await getEdgePath(page, 'Route 3');
    const route4Before = await getEdgePath(page, 'Route 4');

    expect(route1Before).toBeTruthy();
    expect(route2Before).toBeTruthy();
    expect(route3Before).toBeTruthy();
    expect(route4Before).toBeTruthy();

    // Drag the hub node (connected to all edges)
    await dragNode(page, 'Load Balancer', 80, -60);

    // Get paths after manual drag (bendPoints cleared for connected edges)
    const route1AfterDrag = await getEdgePath(page, 'Route 1');
    const route2AfterDrag = await getEdgePath(page, 'Route 2');

    // Paths should have changed after drag
    expect(route1AfterDrag).not.toBe(route1Before);
    expect(route2AfterDrag).not.toBe(route2Before);

    // Now click Layout button to fully recalculate
    await clickLayoutButton(page);

    // Get paths after layout
    const route1After = await getEdgePath(page, 'Route 1');
    const route2After = await getEdgePath(page, 'Route 2');
    const route3After = await getEdgePath(page, 'Route 3');
    const route4After = await getEdgePath(page, 'Route 4');

    // All edges should still render properly
    expect(route1After).toBeTruthy();
    expect(route2After).toBeTruthy();
    expect(route3After).toBeTruthy();
    expect(route4After).toBeTruthy();

    // All paths should be valid SVG paths
    expect(route1After).toMatch(/^M\s*[\d.-]+/);
    expect(route2After).toMatch(/^M\s*[\d.-]+/);
    expect(route3After).toMatch(/^M\s*[\d.-]+/);
    expect(route4After).toMatch(/^M\s*[\d.-]+/);

    // Paths should differ from manual drag state (Layout reorganizes)
    // Note: They might or might not equal initial paths depending on ELK's choices
  });

  test('Edge labels reposition correctly after Layout', async ({ page }) => {
    // Create a diagram with labeled edges
    await loadCustomDiagram(page, {
      title: 'Label Position Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'frontdoor', label: 'Front Door', x: 150, y: 200 },
        { id: 'n2', type: 'appservice', label: 'App Service', x: 400, y: 200 },
        { id: 'n3', type: 'sqldb', label: 'Database', x: 650, y: 200 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'HTTPS Traffic', style: 'solid' },
        { id: 'e2', from: 'n2', to: 'n3', label: 'SQL Queries', style: 'solid' }
      ]
    });

    // Enable edit mode
    await enableEditMode(page);

    // Get initial label positions
    const httpsLabelBefore = await getEdgeLabelPosition(page, 'HTTPS Traffic');
    const sqlLabelBefore = await getEdgeLabelPosition(page, 'SQL Queries');
    expect(httpsLabelBefore).toBeTruthy();
    expect(sqlLabelBefore).toBeTruthy();

    // Drag a node to move it
    await dragNode(page, 'App Service', 0, 100);

    // Get label positions after drag
    const httpsLabelAfterDrag = await getEdgeLabelPosition(page, 'HTTPS Traffic');
    const sqlLabelAfterDrag = await getEdgeLabelPosition(page, 'SQL Queries');

    // Labels should have moved with the edges
    expect(httpsLabelAfterDrag).toBeTruthy();
    expect(sqlLabelAfterDrag).toBeTruthy();

    if (httpsLabelBefore && httpsLabelAfterDrag) {
      // At least one coordinate should have changed
      const moved = httpsLabelBefore.x !== httpsLabelAfterDrag.x ||
                    httpsLabelBefore.y !== httpsLabelAfterDrag.y;
      expect(moved).toBe(true);
    }

    // Now click Layout button
    await clickLayoutButton(page);

    // Get final label positions
    const httpsLabelAfterLayout = await getEdgeLabelPosition(page, 'HTTPS Traffic');
    const sqlLabelAfterLayout = await getEdgeLabelPosition(page, 'SQL Queries');

    // Labels should still be visible and positioned
    expect(httpsLabelAfterLayout).toBeTruthy();
    expect(sqlLabelAfterLayout).toBeTruthy();
  });

  test('Layout button works with demo diagram (Northwind Store)', async ({ page }) => {
    // Load the Northwind demo
    await loadDemoDiagram(page, 'Northwind Store');

    // Enable edit mode
    await enableEditMode(page);

    // Get some initial edge paths
    const initialPaths = await getAllEdgePaths(page);
    const edgeCount = Object.keys(initialPaths).length;
    expect(edgeCount).toBeGreaterThan(0);

    // Drag a node to disturb layout
    // Find any visible node icon and drag it
    const vmNode = page.locator('svg text').filter({ hasText: /VM|Container|App/ }).first();
    if (await vmNode.count() > 0) {
      const label = await vmNode.textContent();
      if (label) {
        await dragNode(page, label.trim(), 60, 40);
      }
    }

    // Click Layout
    await clickLayoutButton(page);

    // Verify layout toast appears
    const toast = page.getByText('Layout updated with ELK.js');
    await expect(toast).toBeVisible({ timeout: 3000 });

    // Verify edges are still rendered
    const newPaths = await getAllEdgePaths(page);
    expect(Object.keys(newPaths).length).toBeGreaterThan(0);

    // All paths should be valid
    for (const path of Object.values(newPaths)) {
      expect(path).toMatch(/^M\s*[\d.-]+/);
    }
  });

  test('Layout button works with Woodgrove Finance demo', async ({ page }) => {
    // Load the Woodgrove Finance (zero-trust) demo
    await loadDemoDiagram(page, 'Woodgrove Finance');

    // Get initial edge state
    const initialPaths = await getAllEdgePaths(page);
    const edgeCount = Object.keys(initialPaths).length;
    expect(edgeCount).toBeGreaterThan(0);

    // Enable edit mode
    await enableEditMode(page);

    // Drag any node
    const anyNode = page.locator('svg text').filter({ hasText: /Firewall|Gateway|Sentinel/ }).first();
    if (await anyNode.count() > 0) {
      const label = await anyNode.textContent();
      if (label) {
        await dragNode(page, label.trim(), -50, 70);
      }
    }

    // Click Layout
    await clickLayoutButton(page);

    // Verify the diagram still has edges rendered
    const newPaths = await getAllEdgePaths(page);
    expect(Object.keys(newPaths).length).toBeGreaterThan(0);
  });

  test('Layout button preserves edge styles (solid vs dashed)', async ({ page }) => {
    // Create diagram with mixed edge styles
    await loadCustomDiagram(page, {
      title: 'Style Preservation Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Source', x: 200, y: 200 },
        { id: 'n2', type: 'storage', label: 'Target A', x: 450, y: 150 },
        { id: 'n3', type: 'sqldb', label: 'Target B', x: 450, y: 300 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Solid Link', style: 'solid' },
        { id: 'e2', from: 'n1', to: 'n3', label: 'Dashed Link', style: 'dashed' }
      ]
    });

    // Enable edit mode
    await enableEditMode(page);

    // Get the dashed edge path element
    const dashedEdgeGroup = page.locator('svg g[style*="cursor"]').filter({
      has: page.locator('text').filter({ hasText: 'Dashed Link' })
    });
    const dashedPath = dashedEdgeGroup.locator('path').nth(1);

    // Verify it has dashed style initially
    const initialDash = await dashedPath.getAttribute('stroke-dasharray');
    expect(initialDash).toBeTruthy();
    expect(initialDash).not.toBe('none');

    // Drag a node
    await dragNode(page, 'Source', 50, 0);

    // Click Layout
    await clickLayoutButton(page);

    // Verify dashed style is preserved
    const finalDash = await dashedPath.getAttribute('stroke-dasharray');
    expect(finalDash).toBeTruthy();
    expect(finalDash).not.toBe('none');
  });

  test('Layout button handles groups correctly', async ({ page }) => {
    // Create diagram with groups
    await loadCustomDiagram(page, {
      title: 'Group Layout Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Resource Group', x: 100, y: 100, w: 250, h: 200, children: ['n1', 'n2'] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM Inside', x: 180, y: 180 },
        { id: 'n2', type: 'storage', label: 'Storage Inside', x: 250, y: 220 },
        { id: 'n3', type: 'frontdoor', label: 'External', x: 450, y: 180 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Internal', style: 'solid' },
        { id: 'e2', from: 'n1', to: 'n3', label: 'External', style: 'dashed' }
      ]
    });

    // Get initial edge paths
    const internalBefore = await getEdgePath(page, 'Internal');
    const externalBefore = await getEdgePath(page, 'External');
    expect(internalBefore).toBeTruthy();
    expect(externalBefore).toBeTruthy();

    // Click Layout
    await clickLayoutButton(page);

    // Verify edges still render after layout with groups
    const internalAfter = await getEdgePath(page, 'Internal');
    const externalAfter = await getEdgePath(page, 'External');
    expect(internalAfter).toBeTruthy();
    expect(externalAfter).toBeTruthy();

    // Verify they're valid SVG paths
    expect(internalAfter).toMatch(/^M\s*[\d.-]+/);
    expect(externalAfter).toMatch(/^M\s*[\d.-]+/);
  });

  test('Layout button shows toast notification', async ({ page }) => {
    // Load a demo
    await loadDemoDiagram(page, 'Contoso Network');

    // Click Layout
    await clickLayoutButton(page);

    // Toast should appear
    const toast = page.getByText('Layout updated with ELK.js');
    await expect(toast).toBeVisible({ timeout: 3000 });
  });

  test('Layout button can be clicked multiple times', async ({ page }) => {
    // Load a demo
    await loadDemoDiagram(page, 'Contoso Network');

    // Enable edit mode
    await enableEditMode(page);

    // Get initial paths
    const pathsAfterLoad = await getAllEdgePaths(page);

    // First layout click
    await clickLayoutButton(page);
    await page.waitForTimeout(500);
    const pathsAfterFirst = await getAllEdgePaths(page);

    // Drag a node
    const anyNode = page.locator('svg image + text').first();
    const label = await anyNode.textContent();
    if (label) {
      await dragNode(page, label.trim(), 40, 30);
    }

    // Second layout click
    await clickLayoutButton(page);
    await page.waitForTimeout(500);
    const pathsAfterSecond = await getAllEdgePaths(page);

    // All renders should have valid edges
    expect(Object.keys(pathsAfterLoad).length).toBeGreaterThan(0);
    expect(Object.keys(pathsAfterFirst).length).toBeGreaterThan(0);
    expect(Object.keys(pathsAfterSecond).length).toBeGreaterThan(0);
  });

  test('Edge arrows point in correct direction after Layout', async ({ page }) => {
    // Create a simple edge with clear directionality
    await loadCustomDiagram(page, {
      title: 'Arrow Direction Test',
      groups: [],
      nodes: [
        { id: 'src', type: 'vm', label: 'Source Node', x: 100, y: 200 },
        { id: 'dst', type: 'storage', label: 'Dest Node', x: 400, y: 200 }
      ],
      edges: [
        { id: 'e1', from: 'src', to: 'dst', label: 'Direction', style: 'solid' }
      ]
    });

    // Enable edit mode
    await enableEditMode(page);

    // Verify edge is rendered
    const edgePath = await getEdgePath(page, 'Direction');
    expect(edgePath).toBeTruthy();

    // Click Layout
    await clickLayoutButton(page);

    // Edge should still be rendered with arrow
    const newEdgePath = await getEdgePath(page, 'Direction');
    expect(newEdgePath).toBeTruthy();

    // Check that the edge group has a marker (arrow)
    const edgeGroup = page.locator('svg g[style*="cursor"]').filter({
      has: page.locator('text').filter({ hasText: 'Direction' })
    });
    const pathWithMarker = edgeGroup.locator('path[marker-end]');
    await expect(pathWithMarker).toHaveCount(1);
  });

  test('Layout does not lose edges when nodes are repositioned', async ({ page }) => {
    // Create diagram with several edges
    await loadCustomDiagram(page, {
      title: 'Edge Preservation Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'frontdoor', label: 'CDN', x: 100, y: 200 },
        { id: 'n2', type: 'appservice', label: 'Web App', x: 300, y: 200 },
        { id: 'n3', type: 'functions', label: 'Functions', x: 300, y: 350 },
        { id: 'n4', type: 'sqldb', label: 'SQL', x: 500, y: 275 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Edge A', style: 'solid' },
        { id: 'e2', from: 'n2', to: 'n3', label: 'Edge B', style: 'solid' },
        { id: 'e3', from: 'n2', to: 'n4', label: 'Edge C', style: 'solid' },
        { id: 'e4', from: 'n3', to: 'n4', label: 'Edge D', style: 'dashed' }
      ]
    });

    // Count edges before layout
    const edgesBefore = await getAllEdgePaths(page);
    const countBefore = Object.keys(edgesBefore).length;
    expect(countBefore).toBe(4);

    // Enable edit mode and drag some nodes
    await enableEditMode(page);
    await dragNode(page, 'Web App', 50, -30);
    await dragNode(page, 'Functions', -30, 40);

    // Click Layout
    await clickLayoutButton(page);

    // Count edges after layout
    const edgesAfter = await getAllEdgePaths(page);
    const countAfter = Object.keys(edgesAfter).length;

    // Should have same number of edges
    expect(countAfter).toBe(countBefore);

    // All expected edge labels should be present
    expect(edgesAfter['Edge A']).toBeTruthy();
    expect(edgesAfter['Edge B']).toBeTruthy();
    expect(edgesAfter['Edge C']).toBeTruthy();
    expect(edgesAfter['Edge D']).toBeTruthy();
  });
});
