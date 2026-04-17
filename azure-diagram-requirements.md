# Azure Deployment Diagram Builder — Requirements & User Stories

## Project Overview

An interactive browser-based tool for creating Azure architecture deployment diagrams with real Microsoft Azure icons, grouping containers, smart layout, and export capabilities. Designed for technical professionals who need slide-ready diagrams for presentations, proposals, and architecture reviews.

**Target Users:** Solution Architects, Cloud Engineers, Pre-Sales Engineers, Partnership Leads

**Target Output:** 16:9 slide-ready diagrams for PPTX decks, architecture documentation, customer presentations

## Current Status Snapshot

- Phases 1-4 are complete.
- Phase 4 verification baseline:
  - `tests/phase4-c4model.spec.js`: `51/51` passing
  - full Playwright suite: `151/151` passing
  - `npm run build`: passing
- Accessibility follow-up completed for Phase 4 controls:
  - view mode buttons expose selected state accessibly
  - collapse / expand group controls are keyboard accessible
  - component drill-in panel supports focus management and `Escape`
- Next implementation target: Phase 5 accessibility stories `WAF-40`, `WAF-41`, `WAF-42`
- QA follow-up file: `QA-BUG-REPORT.md`

---

## 1. Service Catalog

### 1.1 Azure Service Nodes

| ID | Story | Status |
|----|-------|--------|
| SVC-01 | As a user, I can add Azure service nodes from a categorized sidebar palette (Compute, Network, Data, AI, Security, Integration, DevOps) | ✅ Implemented |
| SVC-02 | As a user, I see real Microsoft Azure Architecture Icons rendered with proper gradients and colors for each service | ✅ Implemented |
| SVC-03 | As a user, I can rename any service node label after placing it | ✅ Implemented |
| SVC-04 | As a user, I can delete a service node and all its connected edges are automatically removed | ✅ Implemented |
| SVC-05 | As a user, I can see 41 Azure service types across 7 categories | ✅ Implemented |
| SVC-06 | As a user, I can add service-specific metadata (SKU, pricing tier, instance count, region) to each node | 🔲 Not Implemented |
| SVC-07 | As a user, I can search/filter services by name in the palette | 🔲 Not Implemented |
| SVC-08 | As a user, I can see parameter annotations below the node icon (like nwgrm.org shows "2Gbps DIA", "BGP/OSPF") | 🔲 Not Implemented |
| SVC-09 | As a user, I can duplicate an existing node (with a new ID) | 🔲 Not Implemented |
| SVC-10 | As a user, I can access 700+ Azure services from the full Azure icon set | 🔲 Not Implemented |

---

## 2. Grouping & Containers

### 2.1 Group Management

| ID | Story | Status |
|----|-------|--------|
| GRP-01 | As a user, I can add grouping containers from 7 templates: Resource Group, Virtual Network, Subnet, AKS Cluster, Azure Region, On-Premises, Custom | ✅ Implemented |
| GRP-02 | As a user, I can rename group labels | ✅ Implemented |
| GRP-03 | As a user, I can resize groups by dragging the corner handle | ✅ Implemented |
| GRP-04 | As a user, I can delete groups | ✅ Implemented |
| GRP-05 | As a user, I see distinct visual styling per group type (colors, dashed borders for network groups, solid for resource groups) | ✅ Implemented |
| GRP-06 | As a user, when I drag a group, all nodes visually contained within it move together | ✅ Implemented |

### 2.2 Nested Groups

| ID | Story | Status |
|----|-------|--------|
| GRP-10 | As a user, I can nest groups (e.g. Subnet inside VNet inside Region) with proper visual hierarchy | 🔲 Not Implemented |
| GRP-11 | As a user, I see nested groups rendered with visual depth — outer groups have thicker borders, inner groups are indented | 🔲 Not Implemented |
| GRP-12 | As a user, when I drag a parent group, all child groups and their nodes move together | 🔲 Not Implemented |
| GRP-13 | As a user, I can drag a group into or out of another group to change nesting | 🔲 Not Implemented |

### 2.3 Group Data Model

| ID | Story | Status |
|----|-------|--------|
| GRP-20 | As a user, groups track their children explicitly (not just by geometric overlap) so resizing doesn't lose containment | 🔲 Not Implemented |
| GRP-21 | As a user, dropping a node inside a group automatically adds it to that group's children list | 🔲 Not Implemented |
| GRP-22 | As a user, dragging a node outside its group removes it from that group's children | 🔲 Not Implemented |

---

## 3. Connections & Edges

### 3.1 Edge Creation

| ID | Story | Status |
|----|-------|--------|
| EDG-01 | As a user, I can create connections between nodes by clicking Connect → clicking target | ✅ Implemented |
| EDG-02 | As a user, I can create connections between groups (group→group) | ✅ Implemented |
| EDG-03 | As a user, I can create connections between nodes and groups (node→group, group→node) | ✅ Implemented |
| EDG-04 | As a user, I can set a text label on any edge (e.g. "HTTPS/443", "VNet Peering") | ✅ Implemented |
| EDG-05 | As a user, I can choose solid or dashed line style for each edge | ✅ Implemented |
| EDG-06 | As a user, I can click an edge to select it and edit its label/style | ✅ Implemented |
| EDG-07 | As a user, I can delete an edge | ✅ Implemented |

### 3.2 Edge Routing

| ID | Story | Status |
|----|-------|--------|
| EDG-10 | As a user, I see edges rendered with bezier curves that prefer horizontal/vertical routing | ✅ Implemented |
| EDG-11 | As a user, I see directional arrowheads on edge endpoints | ✅ Implemented |
| EDG-12 | As a user, edge labels are displayed in pill-shaped badges at the midpoint | ✅ Implemented |
| EDG-13 | As a user, edges route around nodes and groups to avoid overlapping content | 🔲 Not Implemented |
| EDG-14 | As a user, I can choose edge anchor points (top/bottom/left/right) on nodes | 🔲 Not Implemented |
| EDG-15 | As a user, edge labels auto-position to avoid overlapping other labels | 🔲 Not Implemented |
| EDG-16 | As a user, I can add waypoints to manually route an edge path | 🔲 Not Implemented |

---

## 4. Layout Engine

### 4.1 Auto-Layout

| ID | Story | Status |
|----|-------|--------|
| LAY-01 | As a user, when I load a demo or JSON, nodes are automatically positioned inside their groups in a grid layout | ✅ Implemented |
| LAY-02 | As a user, groups are arranged in columns based on topological sort of edge flow (left→right data flow) | ✅ Implemented |
| LAY-03 | As a user, the layout targets a 16:9 slide aspect ratio (~1200×660) | ✅ Implemented |
| LAY-04 | As a user, ungrouped nodes are positioned to the right of all groups | ✅ Implemented |
| LAY-05 | As a user, I can click "⊙ Fit" to auto-zoom and center the diagram in the viewport | ✅ Implemented |
| LAY-06 | As a user, I can trigger a re-layout after manual edits to clean up the diagram | 🔲 Not Implemented |
| LAY-07 | As a user, nested groups are laid out with inner groups positioned inside outer groups | 🔲 Not Implemented |
| LAY-08 | As a user, the layout minimizes edge crossings | 🔲 Not Implemented |
| LAY-09 | As a user, I can choose between layout modes: left→right flow, top→bottom flow, radial | 🔲 Not Implemented |
| LAY-10 | As a user, nodes snap to a grid while dragging for alignment | 🔲 Not Implemented |

---

## 5. Canvas Interaction

### 5.1 Navigation

| ID | Story | Status |
|----|-------|--------|
| NAV-01 | As a user, I can pan the canvas by dragging empty space | ✅ Implemented |
| NAV-02 | As a user, I can zoom with scroll wheel | ✅ Implemented |
| NAV-03 | As a user, I see the current zoom level displayed | ✅ Implemented |
| NAV-04 | As a user, I can toggle a dot grid background | ✅ Implemented |
| NAV-05 | As a user, I can switch between dark and light themes | ✅ Implemented |
| NAV-06 | As a user, touch interactions work on mobile (drag, pan, pinch-to-zoom) | ⚠️ Partial (drag/pan yes, pinch-zoom no) |

### 5.2 Selection & Editing

| ID | Story | Status |
|----|-------|--------|
| SEL-01 | As a user, I can click a node to select it and see a properties panel | ✅ Implemented |
| SEL-02 | As a user, I can click a group to select it and see its properties | ✅ Implemented |
| SEL-03 | As a user, I can click an edge to select it and edit its properties | ✅ Implemented |
| SEL-04 | As a user, I can toggle Edit Mode on/off to prevent accidental changes | ✅ Implemented |
| SEL-05 | As a user, I see visual feedback on selected items (blue highlight) and connecting items (amber dashed border) | ✅ Implemented |
| SEL-06 | As a user, I can multi-select nodes/groups with Shift+Click | 🔲 Not Implemented |
| SEL-07 | As a user, I can box-select by dragging on empty canvas with Shift held | 🔲 Not Implemented |
| SEL-08 | As a user, I can undo/redo actions with Ctrl+Z / Ctrl+Shift+Z | 🔲 Not Implemented |
| SEL-09 | As a user, I can use keyboard shortcuts: Delete (remove selected), Ctrl+A (select all), Ctrl+D (duplicate) | 🔲 Not Implemented |
| SEL-10 | As a user, I can double-click a node or group label to inline-edit it on the canvas | 🔲 Not Implemented |

---

## 6. Data Input

### 6.1 Demo Presets

| ID | Story | Status |
|----|-------|--------|
| INP-01 | As a user, I can load preset demo diagrams (3-Tier Web, IoT Pipeline, Hybrid Cloud) with one click | ✅ Implemented |
| INP-02 | As a user, demo diagrams include realistic service configurations, edge labels, and group structures | ✅ Implemented |
| INP-03 | As a user, I can add more demo templates (ML Platform, Microservices, Event-Driven, Data Platform) | 🔲 Not Implemented |

### 6.2 JSON Import

| ID | Story | Status |
|----|-------|--------|
| INP-10 | As a user, I can paste diagram JSON into the sidebar and click "Load JSON" to render it | ✅ Implemented |
| INP-11 | As a user, invalid JSON shows a clear error message | ✅ Implemented |
| INP-12 | As a user, unknown service types are silently filtered out without breaking the diagram | ✅ Implemented |

### 6.3 AI Generation

| ID | Story | Status |
|----|-------|--------|
| INP-20 | As a user, I can describe an architecture in natural language and have it auto-generated into a diagram | 🔲 Not Implemented (API proxy blocked in artifact sandbox) |
| INP-21 | As a user, the AI generates nodes, groups, edges with realistic labels from my description | 🔲 Not Implemented |
| INP-22 | As a workaround, I can ask Claude in the chat to generate diagram JSON for any architecture, then paste it into the app | ✅ Implemented (workflow) |

---

## 7. Export & Output

### 7.1 Current Export

| ID | Story | Status |
|----|-------|--------|
| EXP-01 | As a user, I can export the diagram as SVG | ✅ Implemented |

### 7.2 Additional Export Targets

| ID | Story | Status |
|----|-------|--------|
| EXP-10 | As a user, I can export as PNG at configurable resolution (1x, 2x, 4x) | 🔲 Not Implemented |
| EXP-11 | As a user, I can export as a PPTX slide using the Amdocs brand template | 🔲 Not Implemented |
| EXP-12 | As a user, I can copy the diagram as PNG to clipboard for pasting into other apps | 🔲 Not Implemented |
| EXP-13 | As a user, I can export the diagram JSON for sharing/version control | 🔲 Not Implemented |
| EXP-14 | As a user, the SVG export includes proper title, background, and all icons embedded | ⚠️ Partial (title yes, icons depend on base64 rendering) |

---

## 8. Annotations & Documentation

| ID | Story | Status |
|----|-------|--------|
| ANN-01 | As a user, I can add free-text annotation boxes anywhere on the canvas | 🔲 Not Implemented |
| ANN-02 | As a user, I can add a diagram legend showing group type meanings | 🔲 Not Implemented |
| ANN-03 | As a user, I can add numbered callout badges to highlight specific components | 🔲 Not Implemented |

---

## 9. Persistence & Collaboration

| ID | Story | Status |
|----|-------|--------|
| PER-01 | As a user, my diagram is preserved across sessions using browser storage | 🔲 Not Implemented |
| PER-02 | As a user, I can save/load multiple diagrams | 🔲 Not Implemented |
| PER-03 | As a user, I can share a diagram via URL (base64-encoded topology in URL params, like nwgrm.org) | 🔲 Not Implemented |

---

## 10. Responsive & Mobile

| ID | Story | Status |
|----|-------|--------|
| MOB-01 | As a mobile user, I can access the sidebar via hamburger menu drawer | ✅ Implemented |
| MOB-02 | As a mobile user, I can drag nodes and pan the canvas with touch | ✅ Implemented |
| MOB-03 | As a mobile user, I can pinch-to-zoom | 🔲 Not Implemented |

---

## 11. Azure Well-Architected Compliance

*Based on Microsoft's [Well-Architected Framework guidance on design diagrams](https://learn.microsoft.com/en-us/azure/well-architected/architect-role/design-diagrams).*

### 11.1 Diagram Metadata

| ID | Story | Status |
|----|-------|--------|
| WAF-01 | As a user, I can set diagram metadata (title, author, version, last updated date) in a metadata panel | ✅ Implemented |
| WAF-02 | As a user, I can add a description field to document the diagram's purpose and scope | ✅ Implemented |
| WAF-03 | As a user, diagram metadata is included in the SVG export header or as hidden metadata | ✅ Implemented |
| WAF-04 | As a user, I can add external reference URLs (links to ADRs, runbooks, docs) to the diagram | ✅ Implemented |

### 11.2 Legend & Notation

| ID | Story | Status |
|----|-------|--------|
| WAF-10 | As a user, I can generate an auto-legend showing all group types used in the diagram with their colors/borders | ✅ Implemented |
| WAF-11 | As a user, the legend shows edge style meanings (solid = synchronous, dashed = asynchronous) | ✅ Implemented |
| WAF-12 | As a user, the legend is included in SVG/PNG exports | ✅ Implemented |
| WAF-13 | As a user, I can toggle legend visibility on/off | ✅ Implemented |

### 11.3 Trust Boundaries & Security

| ID | Story | Status |
|----|-------|--------|
| WAF-20 | As a user, I can add trust boundary lines to mark security perimeters (rendered as thick red dashed lines) | ✅ Implemented |
| WAF-21 | As a user, I can add data classification labels to edges (Public, Internal, Confidential, Restricted) | ✅ Implemented |
| WAF-22 | As a user, data classification renders as a small badge/icon on the edge | ✅ Implemented |
| WAF-23 | As a user, I can add compliance zone annotations (e.g., "PCI Scope", "HIPAA Zone") to groups | ✅ Implemented |

### 11.4 C4 Model / Layered Views

| ID | Story | Status |
|----|-------|--------|
| WAF-30 | As a user, I can switch between diagram view modes: Context, Container, Component | ✅ Implemented |
| WAF-31 | As a user, in Context view I see the system as a black box with external actors and systems only | ✅ Implemented |
| WAF-32 | As a user, in Container view I see Azure services and groups (current default behavior) | ✅ Implemented |
| WAF-33 | As a user, in Component view I can drill into a specific service to show internal components | ✅ Implemented |
| WAF-34 | As a user, I can add external actor nodes (Users, External Systems) for context diagrams | ✅ Implemented |
| WAF-35 | As a user, I can collapse a group to a single icon for higher-level views | ✅ Implemented |

### 11.5 Accessibility

| ID | Story | Status |
|----|-------|--------|
| WAF-40 | As a user, groups have pattern fills in addition to colors so color-blind users can distinguish them | 🔲 Not Implemented |
| WAF-41 | As a user, all colors meet WCAG 2.1 AA contrast requirements | 🔲 Not Implemented |
| WAF-42 | As a user, I can export diagram with alt-text descriptions for screen readers | 🔲 Not Implemented |

### 11.6 Version Control & History

| ID | Story | Status |
|----|-------|--------|
| WAF-50 | As a user, I can save the diagram to a JSON file for version control | ✅ Implemented |
| WAF-51 | As a user, I can load a diagram from a JSON file | ✅ Implemented |
| WAF-52 | As a user, I can see a changelog of diagram versions when stored in git | 🔲 Not Implemented |
| WAF-53 | As a user, the JSON export is formatted for human-readable diffs | ✅ Implemented |

---

## Summary

| Category | Implemented | Partial | Not Implemented |
|----------|-------------|---------|-----------------|
| Service Catalog | 5 | 0 | 5 |
| Grouping | 6 | 0 | 7 |
| Connections | 9 | 0 | 4 |
| Layout | 5 | 0 | 5 |
| Canvas | 9 | 1 | 5 |
| Data Input | 5 | 0 | 3 |
| Export | 1 | 1 | 4 |
| Annotations | 0 | 0 | 3 |
| Persistence | 0 | 0 | 3 |
| Mobile | 2 | 0 | 1 |
| Well-Architected | 21 | 0 | 4 |
| **Total** | **63** | **2** | **41** |
