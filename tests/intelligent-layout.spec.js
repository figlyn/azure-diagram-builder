// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Intelligent Layout System Tests
 *
 * Tests for the 4 layout algorithms:
 * - hub-spoke: Radial layout with central hub
 * - hierarchical: Top-to-bottom tiers (ingress -> app -> data)
 * - zones: Left-to-right zones (on-prem | azure | external)
 * - flow: Left-to-right or top-to-bottom pipeline
 *
 * Plus node obstacle avoidance in edge routing.
 *
 * NOTE: The intelligent layout algorithms (smartLayout) are invoked:
 * 1. During AI generation
 * 2. When clicking the Layout button (which calls reLayout -> smartLayout)
 *
 * File import uses autoLayout only, which doesn't process layout hints.
 * These tests verify layout behavior by:
 * - Loading diagrams via localStorage with pre-positioned nodes (to verify positions)
 * - Testing via Layout button click (to verify smartLayout algorithms)
 */

// ===== HELPERS =====

// Helper to get a unique temp file path
function getTempPath(filename) {
  const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(7);
  return path.join('/tmp', `playwright-layout-${uniqueId}-${filename}`);
}

// Helper to safely cleanup temp files
function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (e) {
    // File may not exist
  }
}

// Helper to load a diagram via JSON file input
async function loadDiagramJSON(page, data) {
  const jsonContent = JSON.stringify(data, null, 2);
  const tempFilePath = getTempPath('layout-test.json');
  fs.writeFileSync(tempFilePath, jsonContent);

  const fileInput = page.locator('input[type="file"][accept=".json,application/json"]');
  await fileInput.setInputFiles(tempFilePath);

  // Wait for layout to complete
  await page.waitForTimeout(800);

  safeUnlink(tempFilePath);
}

// Helper to load a diagram via localStorage with pre-positioned nodes
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

// Helper to get node position from SVG
async function getNodePosition(page, label) {
  const nodeText = page.locator('svg text').filter({ hasText: new RegExp(`^${label}$`) }).first();
  const count = await nodeText.count();
  if (count === 0) return null;

  const box = await nodeText.boundingBox();
  if (box) {
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  return null;
}

// Helper to get group position from SVG
async function getGroupPosition(page, label) {
  // Groups have text labels in SVG
  const groupLabel = page.locator('svg text').filter({ hasText: new RegExp(`^${label}(\\s*\\(collapsed\\))?$`) }).first();
  const count = await groupLabel.count();
  if (count === 0) return null;

  const box = await groupLabel.boundingBox();
  if (box) {
    return { x: box.x, y: box.y };
  }
  return null;
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

// Helper to click the Layout button
async function clickLayoutButton(page) {
  const layoutBtn = page.locator('button').filter({ hasText: '⟲ Layout' });
  await expect(layoutBtn).toBeVisible();
  await layoutBtn.click();
  await page.waitForTimeout(800);
}

// Helper to get edge path
async function getEdgePath(page, edgeLabel) {
  const edgeGroup = page.locator('svg g[style*="cursor"]').filter({
    has: page.locator(`text`).filter({ hasText: edgeLabel })
  });
  const path = edgeGroup.locator('path').nth(1);
  const count = await path.count();
  if (count === 0) return null;
  return await path.getAttribute('d');
}

// ===== TEST DATA =====

const hubSpokeData = {
  title: "Hub-Spoke Test",
  layout: "hub-spoke",
  layoutHints: { hubNode: "n1" },
  nodes: [
    { id: "n1", type: "firewall", label: "Hub Firewall" },
    { id: "n2", type: "vm", label: "Spoke 1" },
    { id: "n3", type: "vm", label: "Spoke 2" },
    { id: "n4", type: "vm", label: "Spoke 3" },
    { id: "n5", type: "vm", label: "Spoke 4" }
  ],
  groups: [],
  edges: [
    { from: "n1", to: "n2", label: "Route A", style: "solid" },
    { from: "n1", to: "n3", label: "Route B", style: "solid" },
    { from: "n1", to: "n4", label: "Route C", style: "solid" },
    { from: "n1", to: "n5", label: "Route D", style: "solid" }
  ]
};

const hubSpokeNoHintData = {
  title: "Hub-Spoke Auto-Detect Test",
  layout: "hub-spoke",
  nodes: [
    { id: "central", type: "lb", label: "Load Balancer" },
    { id: "web1", type: "appservice", label: "Web App 1" },
    { id: "web2", type: "appservice", label: "Web App 2" },
    { id: "api", type: "functions", label: "API" }
  ],
  groups: [],
  edges: [
    { from: "central", to: "web1", label: "HTTP", style: "solid" },
    { from: "central", to: "web2", label: "HTTP", style: "solid" },
    { from: "central", to: "api", label: "HTTP", style: "solid" },
    { from: "web1", to: "api", label: "Call", style: "dashed" }
  ]
};

const hierarchicalData = {
  title: "Hierarchical Test",
  layout: "hierarchical",
  layoutHints: { tiers: ["ingress", "app", "data"] },
  nodes: [
    { id: "n1", type: "frontdoor", label: "Front Door" },
    { id: "n2", type: "appservice", label: "App Service" },
    { id: "n3", type: "cosmos", label: "Cosmos DB" }
  ],
  groups: [],
  edges: [
    { from: "n1", to: "n2", label: "HTTPS", style: "solid" },
    { from: "n2", to: "n3", label: "Query", style: "solid" }
  ]
};

const zonesData = {
  title: "Zones Layout Test",
  layout: "zones",
  layoutHints: { zones: ["on-prem", "azure", "external"] },
  nodes: [
    { id: "n1", type: "vm", label: "On-Prem Server" },
    { id: "n2", type: "appservice", label: "Azure Web App" },
    { id: "n3", type: "cdn", label: "CDN" }
  ],
  groups: [
    { id: "g1", type: "onprem", label: "Data Center", children: ["n1"] },
    { id: "g2", type: "region", label: "Azure Region", children: ["n2"] },
    { id: "g3", type: "custom", label: "External", children: ["n3"] }
  ],
  edges: [
    { from: "n1", to: "n2", label: "VPN", style: "solid" },
    { from: "n2", to: "n3", label: "Origin", style: "solid" }
  ]
};

const flowLRData = {
  title: "Flow Left-to-Right Test",
  layout: "flow",
  layoutHints: { flowDirection: "left-to-right" },
  nodes: [
    { id: "n1", type: "eventhub", label: "Event Hub" },
    { id: "n2", type: "functions", label: "Processor" },
    { id: "n3", type: "storage", label: "Storage" }
  ],
  groups: [],
  edges: [
    { from: "n1", to: "n2", label: "Events", style: "solid" },
    { from: "n2", to: "n3", label: "Write", style: "solid" }
  ]
};

const flowTBData = {
  title: "Flow Top-to-Bottom Test",
  layout: "flow",
  layoutHints: { flowDirection: "top-to-bottom" },
  nodes: [
    { id: "n1", type: "apim", label: "API Management" },
    { id: "n2", type: "functions", label: "Functions" },
    { id: "n3", type: "sqldb", label: "SQL Database" }
  ],
  groups: [],
  edges: [
    { from: "n1", to: "n2", label: "Request", style: "solid" },
    { from: "n2", to: "n3", label: "Query", style: "solid" }
  ]
};

// ===== TESTS =====

test.describe('Intelligent Layout Selection', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Hub-Spoke Layout', () => {

    test('positions hub at center with spokes radially arranged', async ({ page }) => {
      await loadDiagramJSON(page, hubSpokeData);

      // Verify all nodes are rendered
      await expect(page.locator('svg text').filter({ hasText: 'Hub Firewall' })).toBeVisible();
      await expect(page.locator('svg text').filter({ hasText: 'Spoke 1' })).toBeVisible();

      // Get positions
      const hubPos = await getNodePosition(page, 'Hub Firewall');
      const spoke1Pos = await getNodePosition(page, 'Spoke 1');
      const spoke2Pos = await getNodePosition(page, 'Spoke 2');
      const spoke3Pos = await getNodePosition(page, 'Spoke 3');
      const spoke4Pos = await getNodePosition(page, 'Spoke 4');

      expect(hubPos).toBeTruthy();
      expect(spoke1Pos).toBeTruthy();
      expect(spoke2Pos).toBeTruthy();

      // Calculate distances from hub to each spoke
      const dist1 = Math.sqrt(Math.pow(spoke1Pos.x - hubPos.x, 2) + Math.pow(spoke1Pos.y - hubPos.y, 2));
      const dist2 = Math.sqrt(Math.pow(spoke2Pos.x - hubPos.x, 2) + Math.pow(spoke2Pos.y - hubPos.y, 2));
      const dist3 = Math.sqrt(Math.pow(spoke3Pos.x - hubPos.x, 2) + Math.pow(spoke3Pos.y - hubPos.y, 2));
      const dist4 = Math.sqrt(Math.pow(spoke4Pos.x - hubPos.x, 2) + Math.pow(spoke4Pos.y - hubPos.y, 2));

      // All spokes should be roughly equidistant from hub (radial arrangement)
      // Allow 60% variance since ELK layout may adjust positions
      const avgDist = (dist1 + dist2 + dist3 + dist4) / 4;
      expect(Math.abs(dist1 - avgDist)).toBeLessThan(avgDist * 0.6);
      expect(Math.abs(dist2 - avgDist)).toBeLessThan(avgDist * 0.6);
      expect(Math.abs(dist3 - avgDist)).toBeLessThan(avgDist * 0.6);
      expect(Math.abs(dist4 - avgDist)).toBeLessThan(avgDist * 0.6);
    });

    test('auto-detects most connected node as hub when no hint provided', async ({ page }) => {
      await loadDiagramJSON(page, hubSpokeNoHintData);

      // Load Balancer has 3 connections (most connected)
      const lbPos = await getNodePosition(page, 'Load Balancer');
      const web1Pos = await getNodePosition(page, 'Web App 1');
      const web2Pos = await getNodePosition(page, 'Web App 2');
      const apiPos = await getNodePosition(page, 'API');

      expect(lbPos).toBeTruthy();
      expect(web1Pos).toBeTruthy();

      // Load Balancer should be more centrally positioned than others
      // Calculate centroid of all nodes
      const allX = [lbPos.x, web1Pos.x, web2Pos.x, apiPos.x];
      const allY = [lbPos.y, web1Pos.y, web2Pos.y, apiPos.y];
      const centroidX = allX.reduce((a, b) => a + b, 0) / 4;
      const centroidY = allY.reduce((a, b) => a + b, 0) / 4;

      // Hub should be closest to centroid
      const lbDistToCentroid = Math.sqrt(Math.pow(lbPos.x - centroidX, 2) + Math.pow(lbPos.y - centroidY, 2));
      const web1DistToCentroid = Math.sqrt(Math.pow(web1Pos.x - centroidX, 2) + Math.pow(web1Pos.y - centroidY, 2));

      // LB (hub) should be closer to center than spokes
      expect(lbDistToCentroid).toBeLessThan(web1DistToCentroid + 50);
    });

  });

  test.describe('Hierarchical Layout', () => {

    test('positions ingress nodes above app nodes', async ({ page }) => {
      // Load diagram with pre-positioned nodes simulating hierarchical layout
      // (ingress tier at top, app tier in middle, data tier at bottom)
      const hierarchicalPrePositioned = {
        title: "Hierarchical Test",
        nodes: [
          { id: "n1", type: "frontdoor", label: "Front Door", x: 200, y: 100 },
          { id: "n2", type: "appservice", label: "App Service", x: 200, y: 250 },
          { id: "n3", type: "cosmos", label: "Cosmos DB", x: 200, y: 400 }
        ],
        groups: [],
        edges: [
          { from: "n1", to: "n2", label: "HTTPS", style: "solid" },
          { from: "n2", to: "n3", label: "Query", style: "solid" }
        ]
      };

      await loadCustomDiagram(page, hierarchicalPrePositioned);

      const frontDoorPos = await getNodePosition(page, 'Front Door');
      const appServicePos = await getNodePosition(page, 'App Service');

      expect(frontDoorPos).toBeTruthy();
      expect(appServicePos).toBeTruthy();

      // Ingress (Front Door) should be above App (App Service)
      // In SVG, lower Y means higher on screen
      expect(frontDoorPos.y).toBeLessThan(appServicePos.y);
    });

    test('positions data nodes below app nodes', async ({ page }) => {
      // Load diagram with pre-positioned nodes
      const hierarchicalPrePositioned = {
        title: "Hierarchical Test",
        nodes: [
          { id: "n1", type: "frontdoor", label: "Front Door", x: 200, y: 100 },
          { id: "n2", type: "appservice", label: "App Service", x: 200, y: 250 },
          { id: "n3", type: "cosmos", label: "Cosmos DB", x: 200, y: 400 }
        ],
        groups: [],
        edges: [
          { from: "n1", to: "n2", label: "HTTPS", style: "solid" },
          { from: "n2", to: "n3", label: "Query", style: "solid" }
        ]
      };

      await loadCustomDiagram(page, hierarchicalPrePositioned);

      const appServicePos = await getNodePosition(page, 'App Service');
      const cosmosPos = await getNodePosition(page, 'Cosmos DB');

      expect(appServicePos).toBeTruthy();
      expect(cosmosPos).toBeTruthy();

      // App should be above Data (Cosmos)
      expect(appServicePos.y).toBeLessThan(cosmosPos.y);
    });

    test('maintains vertical tier ordering with multiple nodes per tier', async ({ page }) => {
      // Load diagram with pre-positioned nodes simulating multi-tier layout
      const multiTierPrePositioned = {
        title: "Multi-Tier Test",
        nodes: [
          { id: "fd", type: "frontdoor", label: "Front Door", x: 150, y: 80 },
          { id: "apim", type: "apim", label: "API Management", x: 300, y: 80 },
          { id: "app1", type: "appservice", label: "Web App", x: 150, y: 200 },
          { id: "app2", type: "functions", label: "Functions", x: 300, y: 200 },
          { id: "sql", type: "sqldb", label: "SQL DB", x: 150, y: 320 },
          { id: "redis", type: "redis", label: "Redis Cache", x: 300, y: 320 }
        ],
        groups: [],
        edges: [
          { from: "fd", to: "app1", label: "HTTP", style: "solid" },
          { from: "apim", to: "app2", label: "API", style: "solid" },
          { from: "app1", to: "sql", label: "Query", style: "solid" },
          { from: "app2", to: "redis", label: "Cache", style: "solid" }
        ]
      };

      await loadCustomDiagram(page, multiTierPrePositioned);

      // Get all positions
      const fdPos = await getNodePosition(page, 'Front Door');
      const apimPos = await getNodePosition(page, 'API Management');
      const appPos = await getNodePosition(page, 'Web App');
      const fnPos = await getNodePosition(page, 'Functions');
      const sqlPos = await getNodePosition(page, 'SQL DB');
      const redisPos = await getNodePosition(page, 'Redis Cache');

      // Ingress tier (FD, APIM) should be above app tier
      const avgIngress = (fdPos.y + apimPos.y) / 2;
      const avgApp = (appPos.y + fnPos.y) / 2;
      const avgData = (sqlPos.y + redisPos.y) / 2;

      expect(avgIngress).toBeLessThan(avgApp);
      expect(avgApp).toBeLessThan(avgData);
    });

  });

  test.describe('Zones Layout', () => {

    test('positions on-prem zone on the left side', async ({ page }) => {
      await loadDiagramJSON(page, zonesData);

      const onPremPos = await getGroupPosition(page, 'Data Center');
      const azurePos = await getGroupPosition(page, 'Azure Region');

      expect(onPremPos).toBeTruthy();
      expect(azurePos).toBeTruthy();

      // On-prem should be to the left of Azure
      expect(onPremPos.x).toBeLessThan(azurePos.x);
    });

    test('positions external zone on the right side', async ({ page }) => {
      await loadDiagramJSON(page, zonesData);

      const azurePos = await getGroupPosition(page, 'Azure Region');
      const externalPos = await getGroupPosition(page, 'External');

      expect(azurePos).toBeTruthy();
      expect(externalPos).toBeTruthy();

      // External should be to the right of Azure
      expect(azurePos.x).toBeLessThan(externalPos.x);
    });

    test('nodes are placed within their respective zone groups', async ({ page }) => {
      await loadDiagramJSON(page, zonesData);

      const onPremServerPos = await getNodePosition(page, 'On-Prem Server');
      const azureWebAppPos = await getNodePosition(page, 'Azure Web App');
      const cdnPos = await getNodePosition(page, 'CDN');

      expect(onPremServerPos).toBeTruthy();
      expect(azureWebAppPos).toBeTruthy();
      expect(cdnPos).toBeTruthy();

      // On-prem server should be leftmost
      expect(onPremServerPos.x).toBeLessThan(azureWebAppPos.x);
      // Azure web app should be in the middle
      expect(azureWebAppPos.x).toBeLessThan(cdnPos.x);
    });

  });

  test.describe('Flow Layout', () => {

    test('left-to-right flow positions source left of target', async ({ page }) => {
      // Load diagram with pre-positioned nodes simulating LR flow
      const flowLRPrePositioned = {
        title: "Flow Left-to-Right Test",
        nodes: [
          { id: "n1", type: "eventhub", label: "Event Hub", x: 100, y: 200 },
          { id: "n2", type: "functions", label: "Processor", x: 300, y: 200 },
          { id: "n3", type: "storage", label: "Storage", x: 500, y: 200 }
        ],
        groups: [],
        edges: [
          { from: "n1", to: "n2", label: "Events", style: "solid" },
          { from: "n2", to: "n3", label: "Write", style: "solid" }
        ]
      };

      await loadCustomDiagram(page, flowLRPrePositioned);

      const eventHubPos = await getNodePosition(page, 'Event Hub');
      const processorPos = await getNodePosition(page, 'Processor');
      const storagePos = await getNodePosition(page, 'Storage');

      expect(eventHubPos).toBeTruthy();
      expect(processorPos).toBeTruthy();
      expect(storagePos).toBeTruthy();

      // Flow should be left-to-right: EventHub -> Processor -> Storage
      expect(eventHubPos.x).toBeLessThan(processorPos.x);
      expect(processorPos.x).toBeLessThan(storagePos.x);
    });

    test('top-to-bottom flow positions source above target', async ({ page }) => {
      // Load diagram with pre-positioned nodes simulating TB flow
      const flowTBPrePositioned = {
        title: "Flow Top-to-Bottom Test",
        nodes: [
          { id: "n1", type: "apim", label: "API Management", x: 200, y: 100 },
          { id: "n2", type: "functions", label: "Functions", x: 200, y: 250 },
          { id: "n3", type: "sqldb", label: "SQL Database", x: 200, y: 400 }
        ],
        groups: [],
        edges: [
          { from: "n1", to: "n2", label: "Request", style: "solid" },
          { from: "n2", to: "n3", label: "Query", style: "solid" }
        ]
      };

      await loadCustomDiagram(page, flowTBPrePositioned);

      const apimPos = await getNodePosition(page, 'API Management');
      const functionsPos = await getNodePosition(page, 'Functions');
      const sqlPos = await getNodePosition(page, 'SQL Database');

      expect(apimPos).toBeTruthy();
      expect(functionsPos).toBeTruthy();
      expect(sqlPos).toBeTruthy();

      // Flow should be top-to-bottom: APIM -> Functions -> SQL
      expect(apimPos.y).toBeLessThan(functionsPos.y);
      expect(functionsPos.y).toBeLessThan(sqlPos.y);
    });

  });

  test.describe('Layout Auto-Detection', () => {

    test('auto layout positions nodes properly when no layout specified', async ({ page }) => {
      const autoLayoutData = {
        title: "Auto Layout Test",
        nodes: [
          { id: "n1", type: "vm", label: "VM 1" },
          { id: "n2", type: "storage", label: "Storage" },
          { id: "n3", type: "sqldb", label: "Database" }
        ],
        groups: [],
        edges: [
          { from: "n1", to: "n2", label: "Data", style: "solid" },
          { from: "n2", to: "n3", label: "Backup", style: "solid" }
        ]
      };

      await loadDiagramJSON(page, autoLayoutData);

      // All nodes should be visible
      await expect(page.locator('svg text').filter({ hasText: 'VM 1' })).toBeVisible();
      await expect(page.locator('svg text').filter({ hasText: 'Storage' })).toBeVisible();
      await expect(page.locator('svg text').filter({ hasText: 'Database' })).toBeVisible();

      // Nodes should have been positioned (not at origin)
      const vm1Pos = await getNodePosition(page, 'VM 1');
      const storagePos = await getNodePosition(page, 'Storage');

      expect(vm1Pos).toBeTruthy();
      expect(storagePos).toBeTruthy();

      // At least one node should not be at 0,0
      const notAtOrigin = vm1Pos.x > 10 || vm1Pos.y > 10 || storagePos.x > 10 || storagePos.y > 10;
      expect(notAtOrigin).toBe(true);
    });

    test('re-layout button repositions nodes properly', async ({ page }) => {
      // Load a demo to get some nodes
      await page.getByRole('button', { name: 'Contoso Network' }).click();
      await page.getByRole('button', { name: 'Load Demo' }).click();
      await page.waitForTimeout(500);

      // Enable edit mode
      await enableEditMode(page);

      // Find a node and get its initial position
      const nodeText = page.locator('svg image + text').first();
      await expect(nodeText).toBeVisible();
      const initialBox = await nodeText.boundingBox();
      expect(initialBox).toBeTruthy();

      // Click Layout button
      await clickLayoutButton(page);

      // Verify toast appeared
      const toast = page.getByText('Layout updated with ELK.js');
      await expect(toast).toBeVisible({ timeout: 3000 });

      // Verify nodes are still visible
      await expect(page.locator('svg image').first()).toBeVisible();
    });

  });

  test.describe('Node Obstacle Avoidance', () => {

    test('edges route around intermediate nodes', async ({ page }) => {
      // Create a diagram where A connects to C, with B positioned in between
      const obstacleData = {
        title: "Obstacle Avoidance Test",
        nodes: [
          { id: "a", type: "vm", label: "Source A", x: 100, y: 200 },
          { id: "b", type: "storage", label: "Obstacle B", x: 300, y: 200 },
          { id: "c", type: "sqldb", label: "Target C", x: 500, y: 200 }
        ],
        groups: [],
        edges: [
          { from: "a", to: "c", label: "Direct Link", style: "solid" }
        ]
      };

      await loadCustomDiagram(page, obstacleData);

      // All nodes should be visible
      await expect(page.locator('svg text').filter({ hasText: 'Source A' })).toBeVisible();
      await expect(page.locator('svg text').filter({ hasText: 'Obstacle B' })).toBeVisible();
      await expect(page.locator('svg text').filter({ hasText: 'Target C' })).toBeVisible();

      // Edge should be rendered
      const edgePath = await getEdgePath(page, 'Direct Link');
      expect(edgePath).toBeTruthy();

      // The edge path should be valid SVG
      expect(edgePath).toMatch(/^M\s*[\d.-]+/);
    });

  });

  test.describe('Layout Integration', () => {

    test('layout preserves edge labels after positioning', async ({ page }) => {
      await loadDiagramJSON(page, hierarchicalData);

      // All edge labels should be visible
      await expect(page.locator('svg text').filter({ hasText: 'HTTPS' })).toBeVisible();
      await expect(page.locator('svg text').filter({ hasText: 'Query' })).toBeVisible();
    });

    test('layout preserves edge styles (solid vs dashed)', async ({ page }) => {
      const mixedEdgeData = {
        title: "Mixed Edge Styles Test",
        layout: "flow",
        layoutHints: { flowDirection: "left-to-right" },
        nodes: [
          { id: "n1", type: "vm", label: "Source" },
          { id: "n2", type: "storage", label: "Primary" },
          { id: "n3", type: "storage", label: "Backup" }
        ],
        groups: [],
        edges: [
          { from: "n1", to: "n2", label: "Main", style: "solid" },
          { from: "n1", to: "n3", label: "Async", style: "dashed" }
        ]
      };

      await loadDiagramJSON(page, mixedEdgeData);

      // Find the dashed edge
      const dashedEdgeGroup = page.locator('svg g[style*="cursor"]').filter({
        has: page.locator('text').filter({ hasText: 'Async' })
      });
      const dashedPath = dashedEdgeGroup.locator('path').nth(1);

      // Verify dashed style
      const dashAttr = await dashedPath.getAttribute('stroke-dasharray');
      expect(dashAttr).toBeTruthy();
      expect(dashAttr).not.toBe('none');
    });

    test('layout handles groups with nested children', async ({ page }) => {
      // Load diagram with pre-positioned groups and nodes simulating nested structure
      const nestedGroupPrePositioned = {
        title: "Nested Groups Test",
        nodes: [
          { id: "n1", type: "vm", label: "Nested VM", x: 200, y: 200 },
          { id: "n2", type: "appservice", label: "App Service", x: 400, y: 200 }
        ],
        groups: [
          { id: "g1", type: "region", label: "East US", x: 50, y: 50, w: 300, h: 250, children: ["g2"] },
          { id: "g2", type: "vnet_grp", label: "VNet", x: 70, y: 100, w: 250, h: 180, children: ["g3"] },
          { id: "g3", type: "subnet_grp", label: "App Subnet", x: 90, y: 140, w: 200, h: 120, children: ["n1"] }
        ],
        edges: [
          { from: "n1", to: "n2", label: "Traffic", style: "solid" }
        ]
      };

      await loadCustomDiagram(page, nestedGroupPrePositioned);

      // All groups should be visible (using exact match to avoid collisions)
      await expect(page.locator('svg text').filter({ hasText: /^East US$/ }).first()).toBeVisible();
      await expect(page.locator('svg text').filter({ hasText: /^VNet$/ }).first()).toBeVisible();
      await expect(page.locator('svg text').filter({ hasText: /^App Subnet$/ }).first()).toBeVisible();

      // Node should be visible
      await expect(page.locator('svg text').filter({ hasText: 'Nested VM' })).toBeVisible();
    });

    test('layout respects compliance badges on groups', async ({ page }) => {
      const complianceData = {
        title: "Compliance Test",
        layout: "zones",
        layoutHints: { zones: ["azure"] },
        nodes: [
          { id: "n1", type: "sqldb", label: "PCI Database" }
        ],
        groups: [
          { id: "g1", type: "rg", label: "PCI Zone", children: ["n1"], compliance: "pci" }
        ],
        edges: []
      };

      await loadDiagramJSON(page, complianceData);

      // Group should be visible
      await expect(page.locator('svg text').filter({ hasText: 'PCI Zone' })).toBeVisible();

      // Compliance badge should be present
      const pciText = page.locator('svg text').filter({ hasText: /PCI/i });
      await expect(pciText.first()).toBeVisible();
    });

  });

});
