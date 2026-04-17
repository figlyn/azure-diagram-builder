// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Phase 4 C4 Model / Layered Views Tests
 *
 * Tests for WAF-30, WAF-31, WAF-33, WAF-34, WAF-35
 * - WAF-30: View mode toggle (Context, Container, Component)
 * - WAF-31: Context view (System as black box)
 * - WAF-33: Component view drill-in
 * - WAF-34: External actor nodes
 * - WAF-35: Collapsible groups
 */

// Helper to load a demo diagram before testing
async function loadDemoDiagram(page) {
  await page.getByRole('button', { name: 'Contoso Network' }).click();
  await page.getByRole('button', { name: 'Load Demo' }).click();
  await expect(page.locator('svg')).toBeVisible();
  await page.waitForTimeout(300);
}

// Helper to load a specific diagram via localStorage
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

// Helper to enable edit mode
async function enableEditMode(page) {
  const editBtn = page.getByRole('button', { name: /Edit/i }).first();
  const isEditing = await page.locator('button[aria-pressed="true"]').filter({ hasText: /Edit/i }).count();
  if (!isEditing) {
    await editBtn.click();
    await page.waitForTimeout(100);
  }
}

// Helper to click on a node by finding the innermost g element containing the label
async function clickNodeByLabel(page, label) {
  // Find all text elements matching the label
  const textEl = page.locator(`svg text`).filter({ hasText: new RegExp(`^${label}$`) });
  await expect(textEl.first()).toBeVisible();

  // Click on the actual visible label target, matching normal user interaction
  await textEl.first().click();
}

async function clickNodeBodyByLabel(page, label) {
  const nodeGroup = page.locator('svg g').filter({ hasText: label }).first();
  await expect(nodeGroup).toBeVisible();
  await nodeGroup.click();
}

function drillInPanel(page, label) {
  return page.getByRole('dialog', { name: `Component view for ${label}` });
}

test.describe('WAF-30: View mode toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('View mode toggle is hidden when no data', async ({ page }) => {
    // When there's no diagram data, the view mode toggle should not be visible
    const toggleContainer = page.locator('div').filter({ has: page.getByRole('button', { name: 'Context' }) });
    await expect(toggleContainer).not.toBeVisible();
  });

  test('Three view mode buttons are visible when diagram has data', async ({ page }) => {
    await loadDemoDiagram(page);

    // All three view mode buttons should be visible
    await expect(page.getByRole('button', { name: 'Context' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Container' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Component' })).toBeVisible();
  });

  test('Container view is active by default', async ({ page }) => {
    await loadDemoDiagram(page);

    const containerBtn = page.getByRole('button', { name: 'Container' });
    await expect(containerBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('Clicking Context button changes view mode', async ({ page }) => {
    await loadDemoDiagram(page);

    // Click Context button
    await page.getByRole('button', { name: 'Context' }).click();
    await page.waitForTimeout(100);

    const contextBtn = page.getByRole('button', { name: 'Context' });
    await expect(contextBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('Clicking Component button changes view mode', async ({ page }) => {
    await loadDemoDiagram(page);

    // Click Component button
    await page.getByRole('button', { name: 'Component' }).click();
    await page.waitForTimeout(100);

    const componentBtn = page.getByRole('button', { name: 'Component' });
    await expect(componentBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('View mode toggle has visual grouping (border container)', async ({ page }) => {
    await loadDemoDiagram(page);

    // Find the container div that holds all three buttons
    const toggleContainer = page.locator('div').filter({
      has: page.getByRole('button', { name: 'Context' })
    }).filter({
      has: page.getByRole('button', { name: 'Container' })
    }).filter({
      has: page.getByRole('button', { name: 'Component' })
    });

    // Should have border styling
    const border = await toggleContainer.first().evaluate(el => getComputedStyle(el).border);
    expect(border).toBeTruthy();
  });

  test('Switching view modes updates button states correctly', async ({ page }) => {
    await loadDemoDiagram(page);

    // Start in Container view
    await expect(page.getByRole('button', { name: 'Container' })).toHaveAttribute('aria-pressed', 'true');

    // Switch to Context
    await page.getByRole('button', { name: 'Context' }).click();
    await page.waitForTimeout(100);

    await expect(page.getByRole('button', { name: 'Context' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Container' })).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('WAF-31: Context view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Context view shows System box with diagram title', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'My Test System',
      groups: [
        { id: 'g1', type: 'rg', label: 'Resources', x: 100, y: 100, w: 200, h: 150, children: ['n1'] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'App Server', x: 180, y: 180 },
        { id: 'n2', type: 'user', label: 'End User', x: 400, y: 150 }
      ],
      edges: [
        { id: 'e1', from: 'n2', to: 'n1', label: 'HTTPS', style: 'solid' }
      ]
    });

    // Switch to Context view
    await page.getByRole('button', { name: 'Context' }).click();
    await page.waitForTimeout(200);

    // Should show the system title in the blue box (with blue fill #0078D4)
    const systemTitle = page.locator('svg text[fill="#0078D4"]').filter({ hasText: 'My Test System' });
    await expect(systemTitle).toBeVisible();

    // Should show "[Azure Deployment]" subtitle
    const subtitle = page.locator('svg text').filter({ hasText: '[Azure Deployment]' });
    await expect(subtitle.first()).toBeVisible();
  });

  test('Context view shows blue bordered system box', async ({ page }) => {
    await loadDemoDiagram(page);

    // Switch to Context view
    await page.getByRole('button', { name: 'Context' }).click();
    await page.waitForTimeout(200);

    // Find the system box (rect with blue stroke)
    const systemBox = page.locator('svg rect[stroke="#0078D4"]');
    await expect(systemBox).toBeVisible();

    // Should have rounded corners
    const rx = await systemBox.getAttribute('rx');
    expect(parseInt(rx || '0')).toBeGreaterThanOrEqual(1);
  });

  test('Internal nodes are hidden in Context view', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test System',
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Internal VM', x: 150, y: 150 },
        { id: 'n2', type: 'storage', label: 'Internal Storage', x: 250, y: 150 },
        { id: 'n3', type: 'user', label: 'End User', x: 400, y: 150 }
      ],
      edges: []
    });

    // Verify internal nodes visible in Container view
    await expect(page.locator('svg').filter({ hasText: 'Internal VM' })).toBeVisible();

    // Switch to Context view
    await page.getByRole('button', { name: 'Context' }).click();
    await page.waitForTimeout(200);

    // Internal VM icon should not be rendered (no image for that node)
    // The system box should be visible instead
    const systemBox = page.locator('svg rect[stroke="#0078D4"]');
    await expect(systemBox).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Internal VM' })).not.toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Internal Storage' })).not.toBeVisible();
  });

  test('External actors remain visible in Context view', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test System',
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'App Server', x: 150, y: 150 },
        { id: 'n2', type: 'user', label: 'External User', x: 400, y: 150 }
      ],
      edges: [
        { id: 'e1', from: 'n2', to: 'n1', label: 'Access', style: 'solid' }
      ]
    });

    // Switch to Context view
    await page.getByRole('button', { name: 'Context' }).click();
    await page.waitForTimeout(200);

    // External user should still be visible (text label)
    const externalUser = page.locator('svg text').filter({ hasText: 'External User' });
    await expect(externalUser).toBeVisible();
  });

  test('Groups are hidden in Context view (only system box shown)', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test System',
      groups: [
        { id: 'g1', type: 'rg', label: 'My Resource Group', x: 100, y: 100, w: 250, h: 200, children: [] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM', x: 180, y: 180 }
      ],
      edges: []
    });

    // In Container view, group label should be visible
    await expect(page.locator('svg text').filter({ hasText: 'My Resource Group' })).toBeVisible();

    // Switch to Context view
    await page.getByRole('button', { name: 'Context' }).click();
    await page.waitForTimeout(200);

    // Group rect/label should be hidden - only system box visible
    // The group label should not appear in Context view
    const systemBox = page.locator('svg rect[stroke="#0078D4"]');
    await expect(systemBox).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'My Resource Group' })).not.toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'VM' })).not.toBeVisible();
  });

  test('External-to-system edges shown in Context view', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'API System',
      groups: [],
      nodes: [
        { id: 'n1', type: 'appservice', label: 'API', x: 150, y: 150 },
        { id: 'n2', type: 'user', label: 'Client', x: 400, y: 150 }
      ],
      edges: [
        { id: 'e1', from: 'n2', to: 'n1', label: 'REST API', style: 'solid' }
      ]
    });

    // Switch to Context view
    await page.getByRole('button', { name: 'Context' }).click();
    await page.waitForTimeout(200);

    // Edge label should still be visible
    const edgeLabel = page.locator('svg text').filter({ hasText: 'REST API' });
    await expect(edgeLabel).toBeVisible();

    // Line should connect external actor to system box
    const lines = page.locator('svg line');
    const lineCount = await lines.count();
    expect(lineCount).toBeGreaterThan(0);
  });

  test('Multiple external actors shown correctly', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Multi-User System',
      groups: [],
      nodes: [
        { id: 'n1', type: 'appservice', label: 'Backend', x: 150, y: 150 },
        { id: 'n2', type: 'user', label: 'Web User', x: 50, y: 50 },
        { id: 'n3', type: 'mobile_user', label: 'Mobile User', x: 350, y: 50 },
        { id: 'n4', type: 'external_system', label: 'Partner API', x: 350, y: 250 }
      ],
      edges: [
        { id: 'e1', from: 'n2', to: 'n1', label: 'Browser', style: 'solid' },
        { id: 'e2', from: 'n3', to: 'n1', label: 'App', style: 'solid' },
        { id: 'e3', from: 'n4', to: 'n1', label: 'API', style: 'solid' }
      ]
    });

    // Switch to Context view
    await page.getByRole('button', { name: 'Context' }).click();
    await page.waitForTimeout(200);

    // All external actors should be visible
    await expect(page.locator('svg text').filter({ hasText: 'Web User' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Mobile User' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Partner API' })).toBeVisible();
  });

  test('Internal-only edges are not shown in Context view', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Internal System',
      groups: [],
      nodes: [
        { id: 'n1', type: 'appservice', label: 'Web App', x: 100, y: 150 },
        { id: 'n2', type: 'sqldb', label: 'Database', x: 250, y: 150 },
        { id: 'n3', type: 'user', label: 'Admin', x: 400, y: 150 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Internal Query', style: 'solid' },
        { id: 'e2', from: 'n3', to: 'n1', label: 'External Access', style: 'solid' }
      ]
    });

    // In Container view, internal edge should be visible
    await expect(page.locator('svg').filter({ hasText: 'Internal Query' })).toBeVisible();

    // Switch to Context view
    await page.getByRole('button', { name: 'Context' }).click();
    await page.waitForTimeout(200);

    // Internal edge label should not be visible
    const internalEdge = page.locator('svg text').filter({ hasText: 'Internal Query' });
    await expect(internalEdge).not.toBeVisible();

    // External edge should still be visible
    await expect(page.locator('svg text').filter({ hasText: 'External Access' })).toBeVisible();
  });
});

test.describe('WAF-33: Component view (drill-in)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Component view shows prompt when no node selected', async ({ page }) => {
    await loadDemoDiagram(page);

    // Switch to Component view
    await page.getByRole('button', { name: 'Component' }).click();
    await page.waitForTimeout(200);

    // Should show the "Click on any node" prompt
    const prompt = page.locator('text=Click on any node to drill into its components');
    await expect(prompt).toBeVisible();

    // Should also show "Component View" title
    await expect(page.locator('text=Component View').first()).toBeVisible();
  });

  test('Clicking node in Component view shows drill-in panel', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test System',
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Main Server', techName: 'vm-main-001', x: 200, y: 200 }
      ],
      edges: []
    });

    // Switch to Component view
    await page.getByRole('button', { name: 'Component' }).click();
    await page.waitForTimeout(200);

    // Click on the node by clicking on its label text
    await clickNodeByLabel(page, 'Main Server');
    await page.waitForTimeout(200);

    // Drill-in panel should appear with node name
    const panel = drillInPanel(page, 'Main Server');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Component View (MVP placeholder)');
  });

  test('Clicking node body in Component view shows drill-in panel', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test System',
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Body Click Server', techName: 'vm-body-001', x: 200, y: 200 }
      ],
      edges: []
    });

    await page.getByRole('button', { name: 'Component' }).click();
    await clickNodeBodyByLabel(page, 'Body Click Server');

    const panel = drillInPanel(page, 'Body Click Server');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('vm-body-001');
  });

  test('Drill-in panel shows node name and type', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test System',
      groups: [],
      nodes: [
        { id: 'n1', type: 'appservice', label: 'Order API', techName: 'app-orders-001', x: 200, y: 200 }
      ],
      edges: []
    });

    // Switch to Component view and click node
    await page.getByRole('button', { name: 'Component' }).click();
    await page.waitForTimeout(100);

    await clickNodeByLabel(page, 'Order API');
    await page.waitForTimeout(200);

    // Should show node label in panel
    const panel = drillInPanel(page, 'Order API');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Order API');

    // Should show node type name (App Service)
    await expect(panel).toContainText('App Service');
  });

  test('Drill-in panel has close (x) button', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test System',
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'TestServer', x: 200, y: 200 }
      ],
      edges: []
    });

    // Switch to Component view and click node
    await page.getByRole('button', { name: 'Component' }).click();
    await page.waitForTimeout(100);

    await clickNodeByLabel(page, 'TestServer');
    await page.waitForTimeout(200);

    // Find close button (x)
    const closeBtn = page.getByRole('button', { name: 'Close component view' });
    await expect(closeBtn).toBeVisible();

    // Click close button
    await closeBtn.click();
    await page.waitForTimeout(100);

    // Panel should close, prompt should reappear
    await expect(page.locator('text=Click on any node to drill into its components')).toBeVisible();
    const componentBtn = page.getByRole('button', { name: 'Component' });
    await expect(componentBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('Back to Container View button works', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test System',
      groups: [],
      nodes: [
        { id: 'n1', type: 'sqldb', label: 'TestDatabase', x: 200, y: 200 }
      ],
      edges: []
    });

    // Switch to Component view and click node
    await page.getByRole('button', { name: 'Component' }).click();
    await page.waitForTimeout(100);

    await clickNodeByLabel(page, 'TestDatabase');
    await page.waitForTimeout(200);

    // Click "Back to Container View" button
    const backBtn = page.getByRole('button', { name: 'Back to Container View' });
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await page.waitForTimeout(100);

    // Should be back in Container view - check button state
    const containerBtn = page.getByRole('button', { name: 'Container' });
    await expect(containerBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('Drill-in panel shows technical name when available', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test System',
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'WebServer', techName: 'vm-web-prod-001', x: 200, y: 200 }
      ],
      edges: []
    });

    // Switch to Component view and click node
    await page.getByRole('button', { name: 'Component' }).click();
    await page.waitForTimeout(100);

    await clickNodeByLabel(page, 'WebServer');
    await page.waitForTimeout(200);

    // Should show technical name
    const panel = drillInPanel(page, 'WebServer');
    await expect(panel).toContainText('vm-web-prod-001');

    // Should show "Technical Name" label
    await expect(panel).toContainText('Technical Name');
  });

  test('Switching away from Component view clears drill-in state', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test System',
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'MyServer', x: 200, y: 200 }
      ],
      edges: []
    });

    // Switch to Component view and drill in
    await page.getByRole('button', { name: 'Component' }).click();
    await page.waitForTimeout(100);

    await clickNodeByLabel(page, 'MyServer');
    await page.waitForTimeout(200);

    // Panel should be visible
    await expect(drillInPanel(page, 'MyServer')).toContainText('Component View (MVP placeholder)');

    // Switch to Container view
    await page.getByRole('button', { name: 'Container', exact: true }).click();
    await page.waitForTimeout(100);

    // Panel should be gone
    await expect(drillInPanel(page, 'MyServer')).not.toBeVisible();

    // Switch back to Component view
    await page.getByRole('button', { name: 'Component' }).click();
    await page.waitForTimeout(100);

    // Should show prompt again (drill-in cleared)
    await expect(page.locator('text=Click on any node to drill into its components')).toBeVisible();
  });
});

test.describe('WAF-34: External actor nodes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('External category exists in sidebar palette', async ({ page }) => {
    await loadDemoDiagram(page);

    // Open the palette
    await page.getByRole('button', { name: 'Manual Palette' }).click();
    await page.waitForTimeout(100);

    // Look for External category
    await expect(page.locator('button').filter({ hasText: 'External' })).toBeVisible();
  });

  test('External category expands to show actor types', async ({ page }) => {
    await loadDemoDiagram(page);

    // Open the palette
    await page.getByRole('button', { name: 'Manual Palette' }).click();
    await page.waitForTimeout(100);

    // Click External category
    await page.locator('button').filter({ hasText: 'External' }).click();
    await page.waitForTimeout(100);

    // Should show external actor types (use getByRole to be more specific)
    await expect(page.getByRole('button', { name: /^User$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'External System' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mobile User' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'IoT Device' })).toBeVisible();
  });

  test('Adding User external actor creates node on canvas', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [],
      nodes: [{ id: 'n1', type: 'vm', label: 'Server', x: 200, y: 200 }],
      edges: []
    });

    // Open palette and add User
    await page.getByRole('button', { name: 'Manual Palette' }).click();
    await page.waitForTimeout(100);
    await page.locator('button').filter({ hasText: 'External' }).click();
    await page.waitForTimeout(100);
    await page.locator('button').filter({ hasText: /^User$/ }).click();
    await page.waitForTimeout(300);

    // User node should appear on canvas
    const userLabel = page.locator('svg text').filter({ hasText: 'User' });
    await expect(userLabel).toBeVisible();
  });

  test('External actors render with simple shapes (not Azure icons)', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'user', label: 'End User', x: 150, y: 150 },
        { id: 'n2', type: 'external_system', label: 'Partner', x: 300, y: 150 },
        { id: 'n3', type: 'vm', label: 'Server', x: 450, y: 150 }
      ],
      edges: []
    });

    // External actors should use path elements (shapes) not img elements
    // User should have a path with stroke #64748b (gray)
    const userPath = page.locator('svg path[stroke="#64748b"]');
    await expect(userPath.first()).toBeVisible();

    // Server (internal node) should have an img element
    const serverImg = page.locator('svg image');
    await expect(serverImg.first()).toBeVisible();
  });

  test('User renders with stick figure shape', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'user', label: 'Test User', x: 200, y: 200 }
      ],
      edges: []
    });

    // Find the user node's path element
    const userPath = page.locator('svg g').filter({ has: page.locator('text').filter({ hasText: 'Test User' }) }).locator('path');
    await expect(userPath).toBeVisible();

    // Should have gray stroke
    const stroke = await userPath.getAttribute('stroke');
    expect(stroke).toBe('#64748b');
  });

  test('External System renders with rounded rectangle shape', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'external_system', label: 'Third Party API', x: 200, y: 200 }
      ],
      edges: []
    });

    // Find the external system node
    const extPath = page.locator('svg g').filter({ has: page.locator('text').filter({ hasText: 'Third Party API' }) }).locator('path');
    await expect(extPath).toBeVisible();

    // Should have fill (shape has background)
    const fill = await extPath.getAttribute('fill');
    expect(fill).toBeTruthy();
    expect(fill).not.toBe('none');
  });

  test('Mobile User renders with phone shape', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'mobile_user', label: 'App User', x: 200, y: 200 }
      ],
      edges: []
    });

    const mobilePath = page.locator('svg g').filter({ has: page.locator('text').filter({ hasText: 'App User' }) }).locator('path');
    await expect(mobilePath).toBeVisible();

    const stroke = await mobilePath.getAttribute('stroke');
    expect(stroke).toBe('#64748b');
  });

  test('IoT Device renders with device shape', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'iot_device', label: 'Sensor', x: 200, y: 200 }
      ],
      edges: []
    });

    const iotPath = page.locator('svg g').filter({ has: page.locator('text').filter({ hasText: 'Sensor' }) }).locator('path');
    await expect(iotPath).toBeVisible();

    const stroke = await iotPath.getAttribute('stroke');
    expect(stroke).toBe('#64748b');
  });

  test('External actors visible in Context view', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test System',
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Backend', x: 200, y: 200 },
        { id: 'n2', type: 'user', label: 'Web User', x: 50, y: 100 },
        { id: 'n3', type: 'external_system', label: 'Payment Gateway', x: 350, y: 100 }
      ],
      edges: [
        { id: 'e1', from: 'n2', to: 'n1', label: 'Browse', style: 'solid' },
        { id: 'e2', from: 'n1', to: 'n3', label: 'Pay', style: 'solid' }
      ]
    });

    // Switch to Context view
    await page.getByRole('button', { name: 'Context' }).click();
    await page.waitForTimeout(200);

    // External actors should still be visible
    await expect(page.locator('svg text').filter({ hasText: 'Web User' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Payment Gateway' })).toBeVisible();

    // System box should be visible
    const systemBox = page.locator('svg rect[stroke="#0078D4"]');
    await expect(systemBox).toBeVisible();
  });

  test('External actors can be connected to internal nodes', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'appservice', label: 'API', x: 200, y: 200 },
        { id: 'n2', type: 'user', label: 'Customer', x: 400, y: 200 }
      ],
      edges: [
        { id: 'e1', from: 'n2', to: 'n1', label: 'HTTPS', style: 'solid' }
      ]
    });

    // Edge should be visible
    const edgeLabel = page.locator('svg text').filter({ hasText: 'HTTPS' });
    await expect(edgeLabel).toBeVisible();

    // Edge path should exist - check for the visible stroke path (not the transparent hitbox)
    // Note: Horizontal line paths may be considered "hidden" by Playwright due to zero height
    const edgePaths = page.locator('svg g[style*="cursor"] path:not([stroke="transparent"])');
    await expect(edgePaths.first()).toHaveCount(1);
    const pathD = await edgePaths.first().getAttribute('d');
    expect(pathD).toBeTruthy();
  });

  test('Adding User external actor creates a canvas node, not just palette text', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [],
      nodes: [{ id: 'n1', type: 'vm', label: 'Server', x: 200, y: 200 }],
      edges: []
    });

    const userCanvasLabel = page.locator('svg text').filter({ hasText: /^User$/ });
    await expect(userCanvasLabel).toHaveCount(0);

    await page.getByRole('button', { name: 'Manual Palette' }).click();
    await page.locator('button').filter({ hasText: 'External' }).click();
    await page.getByRole('button', { name: /^User$/ }).click();

    await expect(userCanvasLabel).toHaveCount(1);
  });

  test('External actors saved and loaded in JSON', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'External Test',
      groups: [],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Server', x: 200, y: 200 },
        { id: 'n2', type: 'user', label: 'Admin User', x: 400, y: 200 },
        { id: 'n3', type: 'external_system', label: 'Monitoring', x: 300, y: 350 }
      ],
      edges: []
    });

    // Save diagram
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save' }).click();
    const download = await downloadPromise;

    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const content = fs.readFileSync(downloadPath, 'utf-8');
    const json = JSON.parse(content);

    // Verify external node types are preserved
    const userNode = json.nodes.find(n => n.type === 'user');
    const extSysNode = json.nodes.find(n => n.type === 'external_system');

    expect(userNode).toBeDefined();
    expect(userNode.label).toBe('Admin User');
    expect(extSysNode).toBeDefined();
    expect(extSysNode.label).toBe('Monitoring');

    safeUnlink(downloadPath);
  });
});

test.describe('WAF-35: Collapsible groups', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Groups have collapse/expand button', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'My Group', x: 100, y: 100, w: 250, h: 200, children: ['n1'] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Server', x: 180, y: 180 }
      ],
      edges: []
    });

    // Find the collapse button (should show ▼ when expanded)
    const collapseBtn = page.getByRole('button', { name: 'Collapse group My Group' });
    await expect(collapseBtn).toBeVisible();
  });

  test('Clicking collapse button hides children', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Parent Group', x: 100, y: 100, w: 280, h: 220, children: ['n1', 'n2'] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Child VM 1', x: 160, y: 180 },
        { id: 'n2', type: 'storage', label: 'Child Storage', x: 280, y: 180 }
      ],
      edges: []
    });

    // Verify children visible initially
    await expect(page.locator('svg text').filter({ hasText: 'Child VM 1' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Child Storage' })).toBeVisible();

    // Click collapse button (▼)
    const collapseBtn = page.getByRole('button', { name: 'Collapse group Parent Group' });
    await collapseBtn.click();
    await page.waitForTimeout(200);

    // Children should be hidden
    await expect(page.locator('svg text').filter({ hasText: 'Child VM 1' })).not.toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Child Storage' })).not.toBeVisible();
  });

  test('Collapsing a group hides child edge labels too', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Parent Group', x: 100, y: 100, w: 280, h: 220, children: ['n1', 'n2'] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Child VM 1', x: 160, y: 180 },
        { id: 'n2', type: 'storage', label: 'Child Storage', x: 280, y: 180 }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: 'Internal Link', style: 'solid' }
      ]
    });

    await expect(page.locator('svg text').filter({ hasText: 'Internal Link' })).toBeVisible();

    const collapseBtn = page.getByRole('button', { name: 'Collapse group Parent Group' });
    await collapseBtn.click();

    await expect(page.locator('svg text').filter({ hasText: 'Internal Link' })).not.toBeVisible();
  });

  test('Collapsed group shows collapsed indicator', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Test Group', x: 100, y: 100, w: 250, h: 200, children: ['n1'], collapsed: true }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Hidden VM', x: 180, y: 180 }
      ],
      edges: []
    });

    // Should expose expand action when collapsed
    await expect(page.getByRole('button', { name: 'Expand group Test Group' })).toBeVisible();

    // Should show "(collapsed)" in label
    await expect(page.locator('svg text').filter({ hasText: '(collapsed)' })).toBeVisible();
  });

  test('Clicking expand button shows children again', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Test Group', x: 100, y: 100, w: 250, h: 200, children: ['n1'], collapsed: true }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Hidden VM', x: 180, y: 180 }
      ],
      edges: []
    });

    // Child should be hidden initially
    await expect(page.locator('svg text').filter({ hasText: 'Hidden VM' })).not.toBeVisible();

    // Click expand button (▶)
    const expandBtn = page.getByRole('button', { name: 'Expand group Test Group' });
    await expandBtn.click();
    await page.waitForTimeout(200);

    // Child should now be visible
    await expect(page.locator('svg text').filter({ hasText: 'Hidden VM' })).toBeVisible();
  });

  test('Collapsed group has smaller size', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Large Group', x: 100, y: 100, w: 400, h: 300, children: ['n1'] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Child', x: 280, y: 240 }
      ],
      edges: []
    });

    // Get initial group rect size
    const groupRect = page.locator('svg g rect[x]').first();
    const initialWidth = await groupRect.getAttribute('width');
    const initialHeight = await groupRect.getAttribute('height');

    // Collapse the group
    const collapseBtn = page.getByRole('button', { name: 'Collapse group Large Group' });
    await collapseBtn.click();
    await page.waitForTimeout(200);

    // Get collapsed size
    const collapsedWidth = await groupRect.getAttribute('width');
    const collapsedHeight = await groupRect.getAttribute('height');

    // Collapsed should be smaller
    expect(parseInt(collapsedWidth || '0')).toBeLessThan(parseInt(initialWidth || '0'));
    expect(parseInt(collapsedHeight || '0')).toBeLessThan(parseInt(initialHeight || '0'));
  });

  test('Nested groups collapse correctly', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [
        { id: 'g1', type: 'region', label: 'East US', x: 50, y: 50, w: 400, h: 350, children: ['g2', 'n1'] },
        { id: 'g2', type: 'vnet_grp', label: 'VNet', x: 100, y: 120, w: 250, h: 200, children: ['n2'] }
      ],
      nodes: [
        { id: 'n1', type: 'frontdoor', label: 'Front Door', x: 380, y: 100 },
        { id: 'n2', type: 'vm', label: 'App VM', x: 200, y: 220 }
      ],
      edges: []
    });

    // All visible initially
    await expect(page.locator('svg text').filter({ hasText: 'VNet' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'App VM' })).toBeVisible();

    // Collapse outer group
    const outerCollapseBtn = page.getByRole('button', { name: 'Collapse group East US' });
    await outerCollapseBtn.click();
    await page.waitForTimeout(200);

    // Nested group and its contents should be hidden
    await expect(page.locator('svg text').filter({ hasText: 'App VM' })).not.toBeVisible();
  });

  test('Collapse state persists in JSON save/load', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Test Group', x: 100, y: 100, w: 250, h: 200, children: ['n1'] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM', x: 180, y: 180 }
      ],
      edges: []
    });

    // Collapse the group
    const collapseBtn = page.getByRole('button', { name: 'Collapse group Test Group' });
    await collapseBtn.click();
    await page.waitForTimeout(200);

    // Save diagram
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save' }).click();
    const download = await downloadPromise;

    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const content = fs.readFileSync(downloadPath, 'utf-8');
    const json = JSON.parse(content);

    // Verify collapsed state is saved
    expect(json.groups[0].collapsed).toBe(true);

    // Clear and reload
    await page.getByRole('button', { name: 'Clear Diagram' }).click();

    const fileInput = page.locator('input[type="file"][accept=".json,application/json"]');
    await fileInput.setInputFiles(downloadPath);
    await page.waitForTimeout(500);

    // Group should still be collapsed
    await expect(page.getByRole('button', { name: 'Expand group Test Group' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: '(collapsed)' })).toBeVisible();

    // Child should still be hidden
    await expect(page.locator('svg text').filter({ hasText: 'VM' })).not.toBeVisible();

    safeUnlink(downloadPath);
  });

  test('Collapse button has proper styling', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Styled Group', x: 100, y: 100, w: 250, h: 200, children: [] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM', x: 400, y: 150 }
      ],
      edges: []
    });

    // Find the collapse button rect
    const collapseBtn = page.getByRole('button', { name: 'Collapse group Styled Group' });
    await expect(collapseBtn).toBeVisible();
    await expect(collapseBtn).toHaveText('▼');
  });
});

test.describe('Integration: C4 Model with demo diagrams', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Demo diagram works in all three view modes', async ({ page }) => {
    await loadDemoDiagram(page);

    // Container view (default)
    await expect(page.locator('svg')).toBeVisible();
    const containerBtn = page.getByRole('button', { name: 'Container' });
    const containerFw = await containerBtn.evaluate(el => getComputedStyle(el).fontWeight);
    expect(parseInt(containerFw)).toBeGreaterThanOrEqual(600);

    // Switch to Context
    await page.getByRole('button', { name: 'Context' }).click();
    await page.waitForTimeout(200);
    const systemBox = page.locator('svg rect[stroke="#0078D4"]');
    await expect(systemBox).toBeVisible();

    // Switch to Component
    await page.getByRole('button', { name: 'Component' }).click();
    await page.waitForTimeout(200);
    await expect(page.locator('text=Click on any node to drill into its components')).toBeVisible();
  });

  test('Zero-Trust demo with external actors works in Context view', async ({ page }) => {
    // Load Woodgrove Finance (Zero-Trust) demo
    await page.getByRole('button', { name: 'Woodgrove Finance' }).click();
    await page.getByRole('button', { name: 'Load Demo' }).click();
    await expect(page.locator('svg')).toBeVisible();
    await page.waitForTimeout(300);

    // Switch to Context view
    await page.getByRole('button', { name: 'Context' }).click();
    await page.waitForTimeout(200);

    // System box should be visible
    const systemBox = page.locator('svg rect[stroke="#0078D4"]');
    await expect(systemBox).toBeVisible();
  });

  test('View mode buttons remain visible when switching views', async ({ page }) => {
    await loadDemoDiagram(page);

    // All buttons visible in Container
    await expect(page.getByRole('button', { name: 'Context' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Container' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Component' })).toBeVisible();

    // Switch to Context - buttons still visible
    await page.getByRole('button', { name: 'Context' }).click();
    await page.waitForTimeout(100);
    await expect(page.getByRole('button', { name: 'Context' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Container' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Component' })).toBeVisible();

    // Switch to Component - buttons still visible
    await page.getByRole('button', { name: 'Component' }).click();
    await page.waitForTimeout(100);
    await expect(page.getByRole('button', { name: 'Context' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Container' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Component' })).toBeVisible();
  });
});

test.describe('Edge cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Context view handles diagram with no external actors', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Internal Only',
      groups: [
        { id: 'g1', type: 'rg', label: 'Resources', x: 100, y: 100, w: 200, h: 150, children: [] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Server', x: 180, y: 180 }
      ],
      edges: []
    });

    // Switch to Context view
    await page.getByRole('button', { name: 'Context' }).click();
    await page.waitForTimeout(200);

    // Should still show system box
    const systemBox = page.locator('svg rect[stroke="#0078D4"]');
    await expect(systemBox).toBeVisible();

    // No external edges should be shown (no lines)
    const lines = page.locator('svg line');
    const count = await lines.count();
    expect(count).toBe(0);
  });

  test('Context view handles diagram with only external actors', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'External Only',
      groups: [],
      nodes: [
        { id: 'n1', type: 'user', label: 'User 1', x: 100, y: 100 },
        { id: 'n2', type: 'external_system', label: 'External 1', x: 300, y: 100 }
      ],
      edges: []
    });

    // Switch to Context view
    await page.getByRole('button', { name: 'Context' }).click();
    await page.waitForTimeout(200);

    // Both external actors should be visible
    await expect(page.locator('svg text').filter({ hasText: 'User 1' })).toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'External 1' })).toBeVisible();

    // System box should have minimal size (no internal components)
    const systemBox = page.locator('svg rect[stroke="#0078D4"]');
    await expect(systemBox).toBeVisible();
  });

  test('Component view with no nodes shows prompt', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Empty',
      groups: [
        { id: 'g1', type: 'rg', label: 'Empty Group', x: 100, y: 100, w: 200, h: 150, children: [] }
      ],
      nodes: [],
      edges: []
    });

    // Switch to Component view
    await page.getByRole('button', { name: 'Component' }).click();
    await page.waitForTimeout(200);

    // Should still show the prompt (no nodes to click)
    await expect(page.locator('text=Click on any node to drill into its components')).toBeVisible();
  });

  test('Collapsing all groups leaves empty canvas area', async ({ page }) => {
    await loadCustomDiagram(page, {
      title: 'Test',
      groups: [
        { id: 'g1', type: 'rg', label: 'Group 1', x: 100, y: 100, w: 200, h: 150, children: ['n1'] },
        { id: 'g2', type: 'rg', label: 'Group 2', x: 350, y: 100, w: 200, h: 150, children: ['n2'] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'VM 1', x: 180, y: 180 },
        { id: 'n2', type: 'storage', label: 'Storage 1', x: 430, y: 180 }
      ],
      edges: []
    });

    // Collapse both groups
    const collapseButtons = page.getByRole('button', { name: /Collapse group/ });
    while (await collapseButtons.count()) {
      await collapseButtons.first().click();
      await page.waitForTimeout(100);
    }

    // Both nodes should be hidden
    await expect(page.locator('svg text').filter({ hasText: 'VM 1' })).not.toBeVisible();
    await expect(page.locator('svg text').filter({ hasText: 'Storage 1' })).not.toBeVisible();

    // Groups should show collapsed indicators
    await expect(page.locator('svg text').filter({ hasText: '(collapsed)' }).first()).toBeVisible();
  });
});
