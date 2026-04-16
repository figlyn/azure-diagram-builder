# Changelog

All notable changes to the Azure Deployment Diagram Builder will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Agent system for orchestrated feature development
- ELK.js layout engine for hierarchical automatic layout

### Changed

### Fixed
- Corner rounding in orthogonal paths now curves outward correctly
- Ungrouped nodes positioned closer to grouped content instead of far right
- Edge bendPoints properly adjusted when nodes are repositioned

### Removed

---

## [1.0.0] - 2025-04-16

### Added
- 41 Azure service icons (Compute, Network, Data, AI, Security, Integration, DevOps)
- 7 group types (Resource Group, VNet, Subnet, AKS, Region, On-Premises, Custom)
- Nested groups with recursive layout
- Node-to-node, node-to-group, group-to-group connections
- Edge labels with solid/dashed styles and directional arrows
- Orthogonal (Manhattan) edge routing with rounded corners
- Flow-based auto-layout (topological sort → left-to-right columns)
- Slide-fit targeting 16:9 aspect ratio
- Re-layout button for manual edit cleanup
- Zoom-to-fit, pan, scroll zoom
- Dark/light theme toggle
- SVG export
- 4 demo presets (Contoso, Northwind, Tailwind, Woodgrove)
- JSON paste import
- AI generation via Anthropic API proxy
- Mobile responsive with drawer sidebar
- CAF naming convention validation
- Azure hierarchy validation
- Undo/redo support
