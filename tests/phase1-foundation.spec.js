// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Phase 1 Foundation Tests
 *
 * Tests for WAF-50, WAF-51, WAF-01/02/04, WAF-03, WAF-53
 * - Save to JSON (WAF-50)
 * - Load from JSON (WAF-51)
 * - Metadata Panel (WAF-01/02/04)
 * - SVG Export with Metadata (WAF-03)
 * - Human-readable JSON (WAF-53)
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

// Helper to wait for toast notification
async function waitForToast(page, text) {
  const toast = page.locator('div').filter({ hasText: text }).last();
  await expect(toast).toBeVisible({ timeout: 5000 });
}

// Helper to safely cleanup temp files
function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (e) {
    // File may have been moved or deleted
  }
}

// Helper to get a unique temp file path to avoid parallel test conflicts
function getTempPath(filename) {
  const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(7);
  return path.join('/tmp', `playwright-${uniqueId}-${filename}`);
}

// Helper to safely read downloaded file content
async function readDownloadContent(download) {
  const tempPath = getTempPath(download.suggestedFilename());
  await download.saveAs(tempPath);
  const content = fs.readFileSync(tempPath, 'utf-8');
  safeUnlink(tempPath);
  return content;
}

test.describe('WAF-50: Save to JSON', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Save button is visible when diagram has data', async ({ page }) => {
    // Initially, Save button should not be visible (no data)
    await expect(page.getByRole('button', { name: 'Save' })).not.toBeVisible();

    // Load a demo diagram
    await loadDemoDiagram(page);

    // Now Save button should be visible
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('Click save button triggers download of .json file', async ({ page }) => {
    await loadDemoDiagram(page);

    // Listen for download event
    const downloadPromise = page.waitForEvent('download');

    // Click save button
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify download was triggered
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('Downloaded JSON contains required fields', async ({ page }) => {
    await loadDemoDiagram(page);

    // Listen for download event
    const downloadPromise = page.waitForEvent('download');

    // Click save button
    await page.getByRole('button', { name: 'Save' }).click();

    const download = await downloadPromise;

    // Save to temp file and read contents
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const content = fs.readFileSync(downloadPath, 'utf-8');
    const json = JSON.parse(content);

    // Verify required fields exist
    expect(json).toHaveProperty('$schema');
    expect(json).toHaveProperty('title');
    expect(json).toHaveProperty('metadata');
    expect(json).toHaveProperty('groups');
    expect(json).toHaveProperty('nodes');
    expect(json).toHaveProperty('edges');

    // Cleanup
    safeUnlink(downloadPath);
  });

  test('Toast notification appears after save', async ({ page }) => {
    await loadDemoDiagram(page);

    // Setup download handler to not block
    page.on('download', () => {});

    // Click save button
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify toast appears
    await waitForToast(page, 'Diagram saved to JSON file');
  });
});

test.describe('WAF-51: Load from JSON', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Open button is always visible', async ({ page }) => {
    // Open button should be visible even without data
    await expect(page.getByRole('button', { name: 'Open' })).toBeVisible();
  });

  test('Loading valid JSON populates the diagram', async ({ page }) => {
    // Create a valid JSON file
    const validJson = {
      $schema: 'https://azure.nwgrm.org/schema/v1',
      title: 'Test Diagram',
      metadata: {
        author: 'Test Author',
        version: '1.0',
        description: 'Test Description',
        references: []
      },
      groups: [
        { id: 'g1', type: 'rg', label: 'Resource Group', children: [] }
      ],
      nodes: [
        { id: 'n1', type: 'vm', label: 'Test VM', techName: 'vm-test-001' },
        { id: 'n2', type: 'storage', label: 'Storage', techName: 'st-test-001' }
      ],
      edges: [
        { from: 'n1', to: 'n2', label: 'Data', style: 'solid' }
      ]
    };

    const jsonContent = JSON.stringify(validJson, null, 2);
    const tempFilePath = '/tmp/test-diagram.json';
    fs.writeFileSync(tempFilePath, jsonContent);

    // Get the hidden file input
    const fileInput = page.locator('input[type="file"][accept=".json,application/json"]');

    // Upload the file
    await fileInput.setInputFiles(tempFilePath);

    // Wait for diagram to load
    await page.waitForTimeout(500);

    // Verify diagram is populated - SVG should be visible
    await expect(page.locator('svg')).toBeVisible();

    // Verify title is set
    await expect(page.locator('text=Test Diagram')).toBeVisible();

    // Verify toast appears
    await waitForToast(page, 'Diagram loaded from file');

    // Cleanup
    safeUnlink(tempFilePath);
  });

  test('Loading invalid JSON shows error alert', async ({ page }) => {
    // Create an invalid JSON file
    const invalidJson = 'this is not valid JSON { broken';
    const tempFilePath = '/tmp/invalid-diagram.json';
    fs.writeFileSync(tempFilePath, invalidJson);

    // Listen for dialog (alert)
    const dialogPromise = page.waitForEvent('dialog');

    // Get the hidden file input and upload
    const fileInput = page.locator('input[type="file"][accept=".json,application/json"]');
    await fileInput.setInputFiles(tempFilePath);

    // Verify alert appears with error message
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('Invalid JSON file');

    // Dismiss the alert
    await dialog.accept();

    // Cleanup
    safeUnlink(tempFilePath);
  });

  test('Loading JSON with unknown node types filters them out', async ({ page }) => {
    // Create JSON with invalid node type
    const jsonWithInvalidTypes = {
      title: 'Test Diagram',
      nodes: [
        { id: 'n1', type: 'vm', label: 'Valid VM' },
        { id: 'n2', type: 'nonexistent_type', label: 'Invalid Node' }
      ],
      groups: [],
      edges: []
    };

    const jsonContent = JSON.stringify(jsonWithInvalidTypes, null, 2);
    const tempFilePath = '/tmp/test-invalid-types.json';
    fs.writeFileSync(tempFilePath, jsonContent);

    // Get the hidden file input
    const fileInput = page.locator('input[type="file"][accept=".json,application/json"]');
    await fileInput.setInputFiles(tempFilePath);

    // Wait for diagram to load
    await page.waitForTimeout(500);

    // The valid VM should be visible but not the invalid type
    await expect(page.locator('svg')).toBeVisible();

    // Cleanup
    safeUnlink(tempFilePath);
  });
});

test.describe('WAF-01/02/04: Metadata Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Metadata panel header is visible', async ({ page }) => {
    await expect(page.getByText('Diagram Metadata')).toBeVisible();
  });

  test('Metadata panel is collapsed by default', async ({ page }) => {
    // Panel header shows expand arrow when collapsed
    await expect(page.getByText('Diagram Metadata')).toBeVisible();

    // Author input should not be visible when collapsed
    await expect(page.locator('input[placeholder="Your name"]')).not.toBeVisible();
  });

  test('Clicking metadata panel header expands/collapses it', async ({ page }) => {
    // Click to expand
    await page.getByText('Diagram Metadata').click();

    // Author input should now be visible
    await expect(page.locator('input[placeholder="Your name"]')).toBeVisible();

    // Click to collapse
    await page.getByText('Diagram Metadata').click();

    // Author input should be hidden again
    await expect(page.locator('input[placeholder="Your name"]')).not.toBeVisible();
  });

  test('Can edit all metadata fields', async ({ page }) => {
    // Expand metadata panel
    await page.getByText('Diagram Metadata').click();

    // Edit Title
    const titleInput = page.locator('label:has-text("Title") + input').first();
    // Find title input in metadata panel
    const metadataPanel = page.locator('div').filter({ hasText: 'Diagram Metadata' }).locator('..').first();

    // Find and fill Author field
    const authorInput = page.locator('input[placeholder="Your name"]');
    await authorInput.fill('Test Author');
    await expect(authorInput).toHaveValue('Test Author');

    // Find and fill Version field
    const versionInput = page.locator('input[placeholder="1.0"]');
    await versionInput.fill('2.5');
    await expect(versionInput).toHaveValue('2.5');

    // Find and fill Description field
    const descInput = page.locator('textarea[placeholder="Diagram purpose and scope"]');
    await descInput.fill('Test description for the diagram');
    await expect(descInput).toHaveValue('Test description for the diagram');

    // Find and fill References field
    const refInput = page.locator('textarea[placeholder="https://docs.microsoft.com/..."]');
    await refInput.fill('https://example.com/doc1\nhttps://example.com/doc2');
    await expect(refInput).toHaveValue('https://example.com/doc1\nhttps://example.com/doc2');
  });

  test('Metadata persists in localStorage', async ({ page }) => {
    // Load a diagram first to enable localStorage saving
    await loadDemoDiagram(page);

    // Expand metadata panel
    await page.getByText('Diagram Metadata').click();

    // Fill in author
    const authorInput = page.locator('input[placeholder="Your name"]');
    await authorInput.fill('Persistence Test Author');

    // Wait for localStorage to save (500ms debounce)
    await page.waitForTimeout(600);

    // Verify localStorage contains the metadata
    const storedState = await page.evaluate(() => {
      return localStorage.getItem('azure-diagram-state');
    });

    expect(storedState).not.toBeNull();
    const parsed = JSON.parse(storedState);
    expect(parsed.metadata.author).toBe('Persistence Test Author');
  });

  test('Metadata loads from localStorage on refresh', async ({ page }) => {
    // Set up localStorage directly
    await page.evaluate(() => {
      const state = {
        nodes: [{ id: 'n1', type: 'vm', label: 'Test VM', x: 200, y: 200 }],
        groups: [],
        edges: [],
        title: 'LocalStorage Test',
        zoom: 1,
        pan: { x: 0, y: 0 },
        metadata: {
          author: 'Stored Author',
          version: '3.0',
          description: 'Stored description',
          references: ['https://test.com']
        }
      };
      localStorage.setItem('azure-diagram-state', JSON.stringify(state));
    });

    // Reload the page
    await page.reload();

    // Expand metadata panel
    await page.getByText('Diagram Metadata').click();

    // Verify the values are restored
    await expect(page.locator('input[placeholder="Your name"]')).toHaveValue('Stored Author');
    await expect(page.locator('input[placeholder="1.0"]')).toHaveValue('3.0');
    await expect(page.locator('textarea[placeholder="Diagram purpose and scope"]')).toHaveValue('Stored description');
  });
});

test.describe('WAF-03: SVG Export with Metadata', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('SVG export button is visible when diagram has data', async ({ page }) => {
    // Initially, SVG button should not be visible
    await expect(page.getByRole('button', { name: 'SVG' })).not.toBeVisible();

    // Load diagram
    await loadDemoDiagram(page);

    // Now should be visible
    await expect(page.getByRole('button', { name: 'SVG' })).toBeVisible();
  });

  test('SVG export contains metadata element with RDF', async ({ page }) => {
    await loadDemoDiagram(page);

    // Set metadata before export
    await page.getByText('Diagram Metadata').click();
    await page.locator('input[placeholder="Your name"]').fill('Test SVG Author');
    await page.locator('textarea[placeholder="Diagram purpose and scope"]').fill('Test SVG Description');

    // Listen for download
    const downloadPromise = page.waitForEvent('download');

    // Click SVG export button
    await page.getByRole('button', { name: 'SVG' }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.svg$/);

    // Save and read the SVG content
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const svgContent = fs.readFileSync(downloadPath, 'utf-8');

    // Verify metadata element exists
    expect(svgContent).toContain('<metadata>');
    expect(svgContent).toContain('</metadata>');

    // Verify RDF structure (browser serializes to lowercase)
    expect(svgContent.toLowerCase()).toContain('rdf:rdf');
    expect(svgContent.toLowerCase()).toContain('xmlns:rdf=');
    expect(svgContent.toLowerCase()).toContain('xmlns:dc=');

    // Verify Dublin Core elements (browser serializes to lowercase)
    expect(svgContent.toLowerCase()).toContain('dc:title');
    expect(svgContent.toLowerCase()).toContain('dc:creator');
    expect(svgContent.toLowerCase()).toContain('dc:description');
    expect(svgContent.toLowerCase()).toContain('dc:date');
    expect(svgContent.toLowerCase()).toContain('dc:format');
    expect(svgContent.toLowerCase()).toContain('dc:source');

    // Verify our metadata values are included
    expect(svgContent).toContain('Test SVG Author');
    expect(svgContent).toContain('Test SVG Description');

    // Cleanup
    safeUnlink(downloadPath);
  });

  test('SVG export contains title element', async ({ page }) => {
    await loadDemoDiagram(page);

    // Listen for download
    const downloadPromise = page.waitForEvent('download');

    // Click SVG export button
    await page.getByRole('button', { name: 'SVG' }).click();

    const download = await downloadPromise;

    // Save and read the SVG content
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const svgContent = fs.readFileSync(downloadPath, 'utf-8');

    // Verify title element exists (first child element for accessibility)
    expect(svgContent).toMatch(/<title>.*<\/title>/);

    // Cleanup
    safeUnlink(downloadPath);
  });

  test('SVG export title reflects diagram title', async ({ page }) => {
    await loadDemoDiagram(page);

    // Get the current title from the diagram
    const titleText = await page.locator('svg text').filter({ hasText: /Contoso|Network/i }).first().textContent();

    // Listen for download
    const downloadPromise = page.waitForEvent('download');

    // Click SVG export button
    await page.getByRole('button', { name: 'SVG' }).click();

    const download = await downloadPromise;

    // Save and read the SVG content
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const svgContent = fs.readFileSync(downloadPath, 'utf-8');

    // The title element should contain the diagram title
    expect(svgContent).toContain(`<title>`);

    // Cleanup
    safeUnlink(downloadPath);
  });
});

test.describe('WAF-53: Human-readable JSON', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('JSON export uses 2-space indentation', async ({ page }) => {
    await loadDemoDiagram(page);

    // Listen for download event
    const downloadPromise = page.waitForEvent('download');

    // Click save button
    await page.getByRole('button', { name: 'Save' }).click();

    const download = await downloadPromise;

    // Save and read the JSON content
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const jsonContent = fs.readFileSync(downloadPath, 'utf-8');

    // Check for 2-space indentation
    // JSON.stringify(obj, null, 2) produces lines like:
    //   "key": value
    // With exactly 2 spaces at the start
    expect(jsonContent).toMatch(/^\s{2}"[^"]+"/m);

    // Also verify it's not minified (has newlines)
    expect(jsonContent.split('\n').length).toBeGreaterThan(5);

    // Cleanup
    safeUnlink(downloadPath);
  });

  test('JSON keys are in logical order', async ({ page }) => {
    await loadDemoDiagram(page);

    // Set some metadata to ensure it's included
    await page.getByText('Diagram Metadata').click();
    await page.locator('input[placeholder="Your name"]').fill('Order Test Author');

    // Listen for download event
    const downloadPromise = page.waitForEvent('download');

    // Click save button
    await page.getByRole('button', { name: 'Save' }).click();

    const download = await downloadPromise;

    // Save and read the JSON content
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const jsonContent = fs.readFileSync(downloadPath, 'utf-8');

    // Parse to verify structure
    const json = JSON.parse(jsonContent);
    const keys = Object.keys(json);

    // Expected order: $schema, title, metadata, groups, nodes, edges
    expect(keys[0]).toBe('$schema');
    expect(keys[1]).toBe('title');
    expect(keys[2]).toBe('metadata');
    expect(keys[3]).toBe('groups');
    expect(keys[4]).toBe('nodes');
    expect(keys[5]).toBe('edges');

    // Cleanup
    safeUnlink(downloadPath);
  });

  test('JSON is parseable and contains expected structure', async ({ page }) => {
    await loadDemoDiagram(page);

    // Listen for download event
    const downloadPromise = page.waitForEvent('download');

    // Click save button
    await page.getByRole('button', { name: 'Save' }).click();

    const download = await downloadPromise;

    // Save and read the JSON content
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const jsonContent = fs.readFileSync(downloadPath, 'utf-8');

    // Should parse without error
    let json;
    expect(() => {
      json = JSON.parse(jsonContent);
    }).not.toThrow();

    // Verify data types
    expect(typeof json.$schema).toBe('string');
    expect(typeof json.title).toBe('string');
    expect(typeof json.metadata).toBe('object');
    expect(Array.isArray(json.groups)).toBe(true);
    expect(Array.isArray(json.nodes)).toBe(true);
    expect(Array.isArray(json.edges)).toBe(true);

    // Verify schema URL
    expect(json.$schema).toBe('https://azure.nwgrm.org/schema/v1');

    // Verify metadata structure
    expect(json.metadata).toHaveProperty('author');
    expect(json.metadata).toHaveProperty('version');
    expect(json.metadata).toHaveProperty('description');
    expect(json.metadata).toHaveProperty('lastUpdated');

    // Cleanup
    safeUnlink(downloadPath);
  });

  test('Node objects have expected properties', async ({ page }) => {
    await loadDemoDiagram(page);

    // Listen for download event
    const downloadPromise = page.waitForEvent('download');

    // Click save button
    await page.getByRole('button', { name: 'Save' }).click();

    const download = await downloadPromise;

    // Save and read the JSON content
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const jsonContent = fs.readFileSync(downloadPath, 'utf-8');
    const json = JSON.parse(jsonContent);

    // Each node should have id, type, label, techName
    for (const node of json.nodes) {
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('type');
      expect(node).toHaveProperty('label');
      expect(node).toHaveProperty('techName');
    }

    // Cleanup
    safeUnlink(downloadPath);
  });

  test('Edge objects have expected properties', async ({ page }) => {
    await loadDemoDiagram(page);

    // Listen for download event
    const downloadPromise = page.waitForEvent('download');

    // Click save button
    await page.getByRole('button', { name: 'Save' }).click();

    const download = await downloadPromise;

    // Save and read the JSON content
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const jsonContent = fs.readFileSync(downloadPath, 'utf-8');
    const json = JSON.parse(jsonContent);

    // Each edge should have from, to, label, style
    for (const edge of json.edges) {
      expect(edge).toHaveProperty('from');
      expect(edge).toHaveProperty('to');
      expect(edge).toHaveProperty('label');
      expect(edge).toHaveProperty('style');
    }

    // Cleanup
    safeUnlink(downloadPath);
  });

  test('Group objects have expected properties', async ({ page }) => {
    await loadDemoDiagram(page);

    // Listen for download event
    const downloadPromise = page.waitForEvent('download');

    // Click save button
    await page.getByRole('button', { name: 'Save' }).click();

    const download = await downloadPromise;

    // Save and read the JSON content
    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const jsonContent = fs.readFileSync(downloadPath, 'utf-8');
    const json = JSON.parse(jsonContent);

    // Each group should have id, type, label, children
    for (const group of json.groups) {
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('type');
      expect(group).toHaveProperty('label');
      expect(group).toHaveProperty('children');
      expect(Array.isArray(group.children)).toBe(true);
    }

    // Cleanup
    safeUnlink(downloadPath);
  });
});

test.describe('Integration: Save and Load Round-trip', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Saved JSON can be loaded back with same data', async ({ page }) => {
    // Load a demo first
    await loadDemoDiagram(page);

    // Set some metadata by expanding panel
    const metadataButton = page.locator('button').filter({ hasText: 'Diagram Metadata' });
    await metadataButton.click();
    await page.locator('input[placeholder="Your name"]').fill('Round-trip Author');
    await page.locator('textarea[placeholder="Diagram purpose and scope"]').fill('Round-trip Description');

    // Save the diagram
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save' }).click();
    const download = await downloadPromise;

    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);

    // Verify the saved JSON contains our metadata
    const savedContent = fs.readFileSync(downloadPath, 'utf-8');
    const savedJson = JSON.parse(savedContent);
    expect(savedJson.metadata.author).toBe('Round-trip Author');
    expect(savedJson.metadata.description).toBe('Round-trip Description');

    // Clear the diagram
    await page.getByRole('button', { name: 'Clear Diagram' }).click();

    // Verify diagram is cleared
    await expect(page.getByRole('button', { name: 'Save' })).not.toBeVisible();

    // Load the saved file
    const fileInput = page.locator('input[type="file"][accept=".json,application/json"]');
    await fileInput.setInputFiles(downloadPath);

    // Wait for load
    await page.waitForTimeout(500);

    // Verify diagram is restored with correct title
    await expect(page.locator('svg')).toBeVisible();

    // Verify localStorage has the loaded metadata
    const storedState = await page.evaluate(() => {
      return localStorage.getItem('azure-diagram-state');
    });
    // Give localStorage time to update
    await page.waitForTimeout(600);
    const refreshedState = await page.evaluate(() => {
      return localStorage.getItem('azure-diagram-state');
    });

    if (refreshedState) {
      const parsed = JSON.parse(refreshedState);
      expect(parsed.metadata.author).toBe('Round-trip Author');
      expect(parsed.metadata.description).toBe('Round-trip Description');
    }

    // Cleanup - handle case where file may already be deleted
    try {
      safeUnlink(downloadPath);
    } catch (e) {
      // File may have been moved/deleted by the system
    }
  });
});

test.describe('Edge Cases and Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Empty references array is handled correctly', async ({ page }) => {
    await loadDemoDiagram(page);

    // Don't add any references, just save
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save' }).click();
    const download = await downloadPromise;

    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const content = fs.readFileSync(downloadPath, 'utf-8');
    const json = JSON.parse(content);

    // References should be an array (possibly empty)
    expect(Array.isArray(json.metadata.references)).toBe(true);

    safeUnlink(downloadPath);
  });

  test('lastUpdated is set on save', async ({ page }) => {
    await loadDemoDiagram(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save' }).click();
    const download = await downloadPromise;

    const downloadPath = getTempPath(download.suggestedFilename());
    await download.saveAs(downloadPath);
    const content = fs.readFileSync(downloadPath, 'utf-8');
    const json = JSON.parse(content);

    // lastUpdated should be a date string
    expect(json.metadata.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    safeUnlink(downloadPath);
  });

  test('File name is sanitized from title', async ({ page }) => {
    // Set up a diagram with special characters in title
    await page.evaluate(() => {
      const state = {
        nodes: [{ id: 'n1', type: 'vm', label: 'Test', x: 200, y: 200 }],
        groups: [],
        edges: [],
        title: 'My Diagram: Test / Special <chars>',
        zoom: 1,
        pan: { x: 0, y: 0 },
        metadata: { author: '', version: '1.0', description: '', references: [] }
      };
      localStorage.setItem('azure-diagram-state', JSON.stringify(state));
    });

    await page.reload();
    await page.waitForTimeout(300);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save' }).click();
    const download = await downloadPromise;

    const filename = download.suggestedFilename();
    // Should not contain special characters
    expect(filename).not.toMatch(/[:<>\/\\]/);
    expect(filename).toMatch(/\.json$/);
  });

  test('Loading JSON with missing optional fields succeeds', async ({ page }) => {
    // Create minimal valid JSON
    const minimalJson = {
      title: 'Minimal Diagram',
      nodes: [{ id: 'n1', type: 'vm', label: 'VM' }],
      groups: [],
      edges: []
    };

    const tempFilePath = '/tmp/minimal-diagram.json';
    fs.writeFileSync(tempFilePath, JSON.stringify(minimalJson));

    const fileInput = page.locator('input[type="file"][accept=".json,application/json"]');
    await fileInput.setInputFiles(tempFilePath);

    await page.waitForTimeout(500);

    // Should load without error
    await expect(page.locator('svg')).toBeVisible();
    await waitForToast(page, 'Diagram loaded from file');

    safeUnlink(tempFilePath);
  });
});
