# Azure Deployment Diagram Builder

## Project Overview
Interactive Azure architecture diagram builder with real Microsoft Azure icons, nested grouping containers, slide-fit layout, and AI generation via Anthropic API.

Live at: https://azure.nwgrm.org
Sister project: https://nwgrm.org (Network Topology Agent)

## Architecture
- **Frontend:** React 18 + Vite, single-file component (`src/App.jsx`)
- **Backend:** Cloudflare Worker (`src/worker.ts`) — proxies Anthropic API, serves static assets
- **Icons:** 41 real Azure Architecture Icons embedded as base64 data URIs (extracted from `@threeveloper/azure-react-icons`)
- **No external dependencies at runtime** — all icons inline, no CDN calls

## Key Files
- `src/App.jsx` — Main app component (~420 lines + ~100KB icon data)
- `src/worker.ts` — Cloudflare Worker with `/api/anthropic` proxy
- `src/cors.ts` — CORS helpers
- `wrangler.jsonc` — Cloudflare deployment config for `azure.nwgrm.org`

## Commands
```bash
npm install          # Install dependencies
npm run dev          # Local dev server on :3001
npm run build        # Build for production
npm run deploy       # Build + deploy to Cloudflare
```

## Secrets
```bash
npx wrangler secret put ANTHROPIC_API_KEY   # Required for AI generation
```

## DNS Setup
Add CNAME record in Cloudflare DNS for nwgrm.org zone:
```
azure.nwgrm.org → azure-diagram-builder.YOUR_ACCOUNT.workers.dev
```

## Features
### Implemented
- 41 Azure service icons (Compute, Network, Data, AI, Security, Integration, DevOps)
- 7 group types (Resource Group, VNet, Subnet, AKS, Region, On-Premises, Custom)
- **Nested groups** — VNet inside Region, Subnet inside VNet (recursive layout)
- Group drag cascades to all children (groups + nodes)
- Node-to-node, node-to-group, group-to-group connections
- Edge labels with solid/dashed styles and directional arrows
- Flow-based auto-layout (topological sort → left-to-right columns)
- Slide-fit targeting 16:9 aspect ratio
- Re-layout button to clean up after manual edits
- Zoom-to-fit, pan, scroll zoom
- Dark/light theme toggle
- SVG export
- 3 demo presets with nested architecture
- JSON paste import
- AI generation via `/api/anthropic` proxy
- Mobile responsive with drawer sidebar

### Not Yet Implemented
- Undo/redo (Ctrl+Z)
- Multi-select / box-select
- Snap-to-grid
- PNG / PPTX export
- Annotations / text boxes
- Session persistence (localStorage)
- URL sharing (base64 topology in URL params)
- Keyboard shortcuts
- Node parameters / metadata
- Edge obstacle avoidance
- Pinch-to-zoom on mobile

## Data Model
```json
{
  "title": "Diagram Title",
  "groups": [
    { "id": "g1", "type": "region", "label": "East US", "children": ["g2", "n1"] },
    { "id": "g2", "type": "vnet_grp", "label": "VNet", "children": ["n2", "n3"] }
  ],
  "nodes": [
    { "id": "n1", "type": "frontdoor", "label": "Front Door" }
  ],
  "edges": [
    { "from": "n1", "to": "n2", "label": "HTTPS", "style": "solid" }
  ]
}
```

### Service Types
vm, vmss, aks, appservice, functions, container, vnet, nsg, lb, appgw, frontdoor, firewall, dns, expressroute, vpngw, cdn, sqldb, cosmos, redis, storage, synapse, datafactory, cognitive, mlworkspace, eventhub, streamanalytics, bot, entra, keyvault, sentinel, condaccess, servicebus, logicapp, apim, eventgrid, signalr, devops, acr, monitor, appinsights, loganalytics

### Group Types
rg, vnet_grp, subnet_grp, aks_grp, region, onprem, custom

## Layout Algorithm
1. Parse group nesting tree from `children[]` arrays
2. Size groups bottom-up (leaf groups first based on node count, parents wrap children)
3. Topological sort root groups by edge flow between them
4. Position root groups left-to-right
5. Recursively position child groups and nodes inside parents
6. Ungrouped nodes placed to the right
7. Auto zoom-to-fit after layout

## Testing
See `azure-diagram-testcases.md` for 57 test cases.
See `azure-diagram-requirements.md` for 84 user stories.
