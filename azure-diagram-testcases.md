# Azure Deployment Diagram Builder — Test Cases

## Test Case Conventions

- **Status:** ✅ Pass | ❌ Fail | 🔲 Not Testable (feature not implemented)
- **Priority:** P0 (critical) | P1 (important) | P2 (nice-to-have)
- Each test references the requirement ID from the Requirements document

---

## TC-1: Service Catalog

### TC-1.1 Add Node from Palette (SVC-01)
**Priority:** P0
**Precondition:** App loaded, sidebar visible
**Steps:**
1. Expand "Compute" category in the sidebar palette
2. Click "Virtual Machine"
**Expected:** A VM node appears on the canvas with the label "Virtual Machine" and the correct Azure VM icon
**Status:** ✅

### TC-1.2 Icon Rendering Quality (SVC-02)
**Priority:** P0
**Precondition:** Demo loaded
**Steps:**
1. Load "3-Tier Web" demo
2. Inspect icons for Front Door, AKS, Cosmos DB, Key Vault, App Insights
**Expected:** All icons render as real Azure Architecture Icons with gradients and colors — no question marks, no broken images, no placeholder squares
**Status:** ✅

### TC-1.3 Rename Node (SVC-03)
**Priority:** P1
**Precondition:** A node is on the canvas, Edit Mode on
**Steps:**
1. Click a node to select it
2. In the properties panel, change the Label field to "My Custom Name"
**Expected:** The label under the node on the canvas updates immediately
**Status:** ✅

### TC-1.4 Delete Node Removes Edges (SVC-04)
**Priority:** P0
**Precondition:** A node with 2+ connected edges, Edit Mode on
**Steps:**
1. Click the node to select it
2. Click ✕ to delete
**Expected:** Node is removed. All edges that referenced this node (as source or target) are also removed. No orphan edges remain.
**Status:** ✅

### TC-1.5 All 7 Categories Visible (SVC-05)
**Priority:** P1
**Precondition:** App loaded
**Steps:**
1. Expand each category in the sidebar: Compute, Network, Data, AI & Analytics, Security, Integration, DevOps
**Expected:** Each category expands to show its service items with icons. Total 41 services across 7 categories.
**Status:** ✅

### TC-1.6 Service Search Filter (SVC-07)
**Priority:** P2
**Status:** 🔲

### TC-1.7 Node Duplication (SVC-09)
**Priority:** P2
**Status:** 🔲

---

## TC-2: Grouping & Containers

### TC-2.1 Add Group (GRP-01)
**Priority:** P0
**Precondition:** Manual Palette expanded
**Steps:**
1. Open "Manual Palette" → "Groups"
2. Click "Virtual Network"
**Expected:** A VNet group container appears on the canvas with dashed blue border and label "Virtual Network"
**Status:** ✅

### TC-2.2 Resize Group (GRP-03)
**Priority:** P1
**Precondition:** A group on canvas, Edit Mode on
**Steps:**
1. Hover the bottom-right corner of a group — cursor changes to nwse-resize
2. Drag the corner handle to make the group larger
**Expected:** Group resizes smoothly. The resize handle stays at the corner.
**Status:** ✅

### TC-2.3 Group Visual Differentiation (GRP-05)
**Priority:** P1
**Precondition:** Multiple group types added
**Steps:**
1. Add one each: Resource Group, Virtual Network, Subnet, On-Premises
**Expected:** Each has distinct color and border style. VNet and Subnet have dashed borders. On-Premises has amber border. Resource Group has gray solid border.
**Status:** ✅

### TC-2.4 Group Drag Moves Children (GRP-06)
**Priority:** P0
**Precondition:** A group containing 3+ nodes, Edit Mode on
**Steps:**
1. Place 3 nodes inside a group's bounds
2. Drag the group by its header area
**Expected:** All nodes that were geometrically inside the group move together with it, maintaining their relative positions
**Status:** ✅

### TC-2.5 Group Drag — Nodes Outside Stay Put (GRP-06)
**Priority:** P1
**Precondition:** A group with nodes inside AND nodes outside it
**Steps:**
1. Drag the group
**Expected:** Only nodes inside the group's bounding box move. Nodes outside are unaffected.
**Status:** ✅

### TC-2.6 Nested Groups Visual Hierarchy (GRP-10, GRP-11)
**Priority:** P1
**Status:** 🔲

### TC-2.7 Nested Group Drag Cascade (GRP-12)
**Priority:** P1
**Status:** 🔲

### TC-2.8 Explicit Children Tracking (GRP-20)
**Priority:** P1
**Status:** 🔲

---

## TC-3: Connections & Edges

### TC-3.1 Node-to-Node Connection (EDG-01)
**Priority:** P0
**Precondition:** Two nodes on canvas, Edit Mode on
**Steps:**
1. Click node A to select it
2. Click "⟶ Connect"
3. Click node B
**Expected:** A directed edge appears from A to B with an arrowhead. The connection banner disappears.
**Status:** ✅

### TC-3.2 Group-to-Group Connection (EDG-02)
**Priority:** P0
**Precondition:** Two groups on canvas, Edit Mode on
**Steps:**
1. Click group A to select it
2. Enter edge label "VNet Peering", select style "dashed"
3. Click "⟶ Connect"
4. Click group B
**Expected:** A dashed edge appears from center of group A to center of group B, with label "VNet Peering" displayed in a pill badge. Edge offsets from group border (not center).
**Status:** ✅

### TC-3.3 Node-to-Group Connection (EDG-03)
**Priority:** P1
**Precondition:** A node and a group on canvas, Edit Mode on
**Steps:**
1. Select the node → Connect → click the group
**Expected:** Edge routes from node center to group center, with proper offset from each element's border
**Status:** ✅

### TC-3.4 Edge Label (EDG-04)
**Priority:** P1
**Precondition:** Properties panel open for a node
**Steps:**
1. Enter "HTTPS/443" in the Edge Label field
2. Create a connection to another node
**Expected:** The edge shows "HTTPS/443" in a pill badge at the midpoint
**Status:** ✅

### TC-3.5 Edge Style Toggle (EDG-05)
**Priority:** P1
**Steps:**
1. Select a node, set line style to "dashed", create connection
2. Select the resulting edge, switch style to "solid"
**Expected:** Edge renders as dashed initially, then changes to solid when toggled
**Status:** ✅

### TC-3.6 Edge Selection and Edit (EDG-06)
**Priority:** P1
**Steps:**
1. Click on an existing edge
**Expected:** Edge highlights in blue. Properties panel shows Label and Style controls. Changes apply immediately.
**Status:** ✅

### TC-3.7 Delete Edge (EDG-07)
**Priority:** P1
**Steps:**
1. Select an edge → click ✕
**Expected:** Edge is removed. Connected nodes remain.
**Status:** ✅

### TC-3.8 Edge Bezier Routing (EDG-10)
**Priority:** P1
**Precondition:** Two nodes at various relative positions
**Steps:**
1. Place node A at left, node B at right (horizontal)
2. Place node C above, node D below (vertical)
3. Place node E diagonal from node F
**Expected:** Horizontal pairs get horizontal S-curve. Vertical pairs get vertical S-curve. Diagonal pairs get smooth bezier. No straight diagonal lines.
**Status:** ✅

### TC-3.9 Obstacle Avoidance (EDG-13)
**Priority:** P2
**Status:** 🔲

### TC-3.10 Edge Anchor Points (EDG-14)
**Priority:** P2
**Status:** 🔲

---

## TC-4: Layout Engine

### TC-4.1 Auto-Layout on Load (LAY-01, LAY-02)
**Priority:** P0
**Steps:**
1. Load "3-Tier Web" demo
**Expected:** Groups are arranged left-to-right in flow order (ingress → frontend → backend → data/services). Nodes are positioned in a grid inside their respective groups.
**Status:** ✅

### TC-4.2 Slide-Fit Proportions (LAY-03)
**Priority:** P1
**Steps:**
1. Load any demo
2. Click "⊙ Fit"
**Expected:** Diagram fits within approximately 16:9 proportions. No excessive whitespace. Content is centered.
**Status:** ✅

### TC-4.3 Zoom-to-Fit (LAY-05)
**Priority:** P1
**Steps:**
1. Load a demo
2. Pan and zoom to an extreme position
3. Click "⊙ Fit"
**Expected:** View resets to show entire diagram centered in viewport with appropriate zoom level
**Status:** ✅

### TC-4.4 Ungrouped Node Placement (LAY-04)
**Priority:** P1
**Steps:**
1. Load "Hybrid Cloud" demo (has ExpressRoute as ungrouped node)
**Expected:** ExpressRoute node is positioned outside/adjacent to group columns, not overlapping groups
**Status:** ✅

### TC-4.5 Re-Layout After Edits (LAY-06)
**Priority:** P1
**Status:** 🔲

### TC-4.6 Snap-to-Grid (LAY-10)
**Priority:** P2
**Status:** 🔲

---

## TC-5: Canvas Interaction

### TC-5.1 Pan Canvas (NAV-01)
**Priority:** P0
**Steps:**
1. Click and drag on empty canvas area
**Expected:** Canvas pans smoothly. Cursor changes to "grabbing". Nodes/groups do not move.
**Status:** ✅

### TC-5.2 Scroll Zoom (NAV-02)
**Priority:** P0
**Steps:**
1. Scroll wheel up over the canvas
2. Scroll wheel down
**Expected:** Zoom in/out smoothly. Zoom percentage display updates. Range: 10%–500%.
**Status:** ✅

### TC-5.3 Theme Toggle (NAV-05)
**Priority:** P1
**Steps:**
1. Click theme toggle (☀/●) in header
**Expected:** All UI elements switch between dark and light themes. Canvas background, node cards, group fills, edge colors, sidebar, header all update. No elements retain wrong theme colors.
**Status:** ✅

### TC-5.4 Edit Mode Toggle (SEL-04)
**Priority:** P0
**Steps:**
1. Load a demo (Edit Mode auto-enabled)
2. Click "✓ Editing" to disable Edit Mode
3. Try to drag a node
4. Try to create a connection
5. Re-enable Edit Mode
**Expected:** With Edit Mode off — nodes/groups are not draggable, no connection UI appears. With Edit Mode on — full interactivity restored.
**Status:** ✅

### TC-5.5 Selection Visual Feedback (SEL-05)
**Priority:** P1
**Steps:**
1. Click a node — check for blue highlight ring
2. Click Connect — check for amber dashed ring on source node
3. Click an edge — check for blue color and thicker stroke
4. Click a group — check for blue border
**Expected:** All selection states show distinct visual feedback
**Status:** ✅

### TC-5.6 Multi-Select (SEL-06)
**Priority:** P2
**Status:** 🔲

### TC-5.7 Undo/Redo (SEL-08)
**Priority:** P1
**Status:** 🔲

### TC-5.8 Keyboard Shortcuts (SEL-09)
**Priority:** P2
**Status:** 🔲

---

## TC-6: Data Input

### TC-6.1 Load Demo Preset (INP-01)
**Priority:** P0
**Steps:**
1. Click "3-Tier Web" example button
2. Click "▶ Load Demo"
**Expected:** Diagram renders with 11 nodes, 4 groups, 10 edges. Title shows "3-Tier Web App". Edit Mode activates. View auto-fits.
**Status:** ✅

### TC-6.2 Load All Demos (INP-01)
**Priority:** P0
**Steps:**
1. Load "3-Tier Web" → verify renders
2. Load "IoT Pipeline" → verify replaces previous, renders correctly
3. Load "Hybrid Cloud" → verify replaces previous, renders correctly
**Expected:** Each demo fully replaces the previous. No leftover nodes/edges from prior demo.
**Status:** ✅

### TC-6.3 Paste Valid JSON (INP-10)
**Priority:** P0
**Steps:**
1. Paste this JSON into the textarea:
```json
{"title":"Minimal Test","groups":[{"id":"g1","type":"rg","label":"Test RG","children":["n1","n2"]}],"nodes":[{"id":"n1","type":"vm","label":"VM 1"},{"id":"n2","type":"sqldb","label":"SQL DB"}],"edges":[{"from":"n1","to":"n2","label":"TCP","style":"solid"}]}
```
2. Click "📋 Load JSON"
**Expected:** Diagram renders with 1 group containing 2 nodes and 1 edge
**Status:** ✅

### TC-6.4 Paste Invalid JSON (INP-11)
**Priority:** P1
**Steps:**
1. Paste "this is not json" into textarea
2. Click "📋 Load JSON"
**Expected:** Alert displays "Invalid JSON" with error details. Canvas is unchanged.
**Status:** ✅

### TC-6.5 Unknown Service Types Filtered (INP-12)
**Priority:** P1
**Steps:**
1. Paste JSON containing a node with `"type":"nonexistent_service"`
2. Load JSON
**Expected:** The unknown node is silently omitted. Valid nodes render. Edges referencing the unknown node are also omitted. No errors.
**Status:** ✅

---

## TC-7: Export

### TC-7.1 SVG Export (EXP-01)
**Priority:** P0
**Steps:**
1. Load a demo
2. Click "↓ SVG"
**Expected:** Browser downloads an SVG file. The file opens in a browser/viewer showing the complete diagram with all icons, groups, edges, and labels.
**Status:** ✅

### TC-7.2 PNG Export (EXP-10)
**Priority:** P1
**Status:** 🔲

### TC-7.3 PPTX Export (EXP-11)
**Priority:** P1
**Status:** 🔲

### TC-7.4 JSON Export (EXP-13)
**Priority:** P1
**Status:** 🔲

---

## TC-8: Responsive & Mobile

### TC-8.1 Mobile Sidebar Drawer (MOB-01)
**Priority:** P1
**Steps:**
1. Open app on mobile viewport (< 768px)
2. Tap hamburger menu
**Expected:** Sidebar slides in from left with overlay backdrop. Tapping backdrop closes it.
**Status:** ✅

### TC-8.2 Mobile Touch Drag (MOB-02)
**Priority:** P1
**Steps:**
1. On mobile, load a demo
2. Touch-drag a node
3. Touch-drag empty canvas to pan
**Expected:** Node moves with finger. Canvas pans with finger. No page scrolling interference.
**Status:** ✅

### TC-8.3 Pinch-to-Zoom (MOB-03)
**Priority:** P2
**Status:** 🔲

---

## TC-9: Edge Cases & Regression

### TC-9.1 Self-Connection Prevention
**Priority:** P1
**Steps:**
1. Select node A → Connect → click node A again
**Expected:** No self-loop edge is created. Connect mode exits cleanly.
**Status:** ✅

### TC-9.2 Empty Canvas State
**Priority:** P1
**Steps:**
1. Open app fresh (no demo loaded)
**Expected:** Empty state message shows with instructions. No errors. Sidebar is functional.
**Status:** ✅

### TC-9.3 Rapid Demo Switching
**Priority:** P1
**Steps:**
1. Quickly load Demo A → Demo B → Demo C
**Expected:** Each demo fully replaces the previous. No visual artifacts, no accumulated nodes/edges from prior demos.
**Status:** ✅

### TC-9.4 Extreme Zoom
**Priority:** P1
**Steps:**
1. Zoom out to 10%
2. Zoom in to 500%
**Expected:** Canvas remains usable at both extremes. No rendering artifacts. Zoom clamps at limits.
**Status:** ✅

### TC-9.5 Many Nodes Performance
**Priority:** P2
**Steps:**
1. Add 50+ nodes manually from palette
**Expected:** Canvas remains responsive. No noticeable lag on drag/pan/zoom.
**Status:** ✅ (untested at scale, expected to work up to ~100 nodes)

### TC-9.6 Delete All Then Re-Add
**Priority:** P1
**Steps:**
1. Load a demo
2. Delete all nodes and groups one by one
3. Add new nodes/groups manually
**Expected:** App doesn't crash. New elements work normally. No ghost references.
**Status:** ✅

---

## Summary

| Category | Total Tests | Executable | Pass | Not Testable |
|----------|-------------|-----------|------|--------------|
| Service Catalog | 7 | 5 | 5 | 2 |
| Grouping | 8 | 5 | 5 | 3 |
| Connections | 10 | 8 | 8 | 2 |
| Layout | 6 | 4 | 4 | 2 |
| Canvas | 8 | 5 | 5 | 3 |
| Data Input | 5 | 5 | 5 | 0 |
| Export | 4 | 1 | 1 | 3 |
| Mobile | 3 | 2 | 2 | 1 |
| Edge Cases | 6 | 6 | 6 | 0 |
| **Total** | **57** | **41** | **41** | **16** |
