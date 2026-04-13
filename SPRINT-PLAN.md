# Azure Diagram Builder — Sprint Plan

**Version:** 1.0
**Created:** 2026-04-12
**Sprints:** 3 x 2-week (6 weeks total to v1.0)
**Team assumption:** 1 full-stack dev, 1 PM/QA (Vadim), AI assist via Claude + Microsoft Skills

**Priority order:** Security > UI/UX > Azure Architecture Correctness

---

## Sprint 1: Security Hardening + Critical Bug Fixes

**Sprint Goal:** Eliminate all critical and major security vulnerabilities so the production worker at azure.nwgrm.org cannot be exploited for API abuse, XSS, or payload injection.

**Capacity:** 40 story points

### S1-1. CORS Origin Lockdown (5 SP)

**Files:** `src/cors.ts`, `src/worker.ts`
**Problem:** `Access-Control-Allow-Origin: "*"` allows any domain to call `/api/anthropic` with the server's Anthropic API key, enabling key theft and billing abuse.

**Tasks:**
1. Replace `"*"` in `corsHeaders` with an allowlist: `["https://azure.nwgrm.org", "http://localhost:3001"]`
2. Read `Origin` header from incoming request, match against allowlist, return the matched origin (not `*`)
3. Add `Vary: Origin` header so CDN caches don't mix responses
4. Reject requests with no `Origin` or non-matching `Origin` with 403

**Acceptance Criteria:**
- `curl -H "Origin: https://evil.com" https://azure.nwgrm.org/api/anthropic` returns 403
- `curl -H "Origin: https://azure.nwgrm.org" ...` returns 200 with correct CORS headers
- Local dev (`localhost:3001`) still works
- Add `ALLOWED_ORIGINS` env var in `wrangler.jsonc` for easy config

**Dependencies:** None (start day 1)
**Risk:** Low. Straightforward config change. Test thoroughly with browser DevTools Network tab.

**Relevant Skills:** `microsoft-skills/skills/typescript/monitoring/opentelemetry` (for structured logging of rejected origins)

---

### S1-2. API Proxy Request Validation (8 SP)

**Files:** `src/worker.ts` (lines 23-48), new file `src/validation.ts`
**Problem:** The `/api/anthropic` endpoint forwards the raw request body to Anthropic with zero validation. An attacker can use it as an open proxy to the Anthropic API — any model, any prompt, any token count, using Vadim's API key.

**Tasks:**
1. Create `src/validation.ts` with a `validateAnthropicRequest(body: unknown)` function
2. Enforce schema:
   - `model` must be one of: `["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"]`
   - `max_tokens` must be `<= 4096`
   - `messages` must be a non-empty array with `role` in `["user", "assistant"]`
   - `messages[].content` must be string, length `<= 10000` characters
   - Reject `system` field or limit to a fixed server-side system prompt
   - Reject `tools`, `tool_use`, `tool_choice` fields entirely
3. Strip any unexpected top-level fields before forwarding
4. Return 400 with descriptive error on validation failure
5. **Inject system prompt server-side** — move the diagram generation prompt from `App.jsx` (line 273) to `worker.ts` so the client only sends the user's architecture description, not the full prompt

**Acceptance Criteria:**
- Sending `{"model": "claude-opus-4-20250514", "max_tokens": 100000, ...}` returns 400
- Sending a valid request with only `description` field returns 200
- No way to override model, token limit, or system prompt from client
- Unit tests for `validateAnthropicRequest()` (at least 8 test cases covering each field)

**Dependencies:** S1-1 (CORS must be locked down before validation matters)
**Risk:** Medium. Changing the request shape requires coordinated frontend+backend changes. The AI generation flow in `App.jsx` (line 269-300) sends the full Anthropic SDK payload; refactor to send only `{ description: string }`.

**Relevant Skills:** `microsoft-skills/skills/typescript/foundry/contentsafety` (input validation patterns)

---

### S1-3. Rate Limiting (5 SP)

**Files:** `src/worker.ts`, new file `src/ratelimit.ts`
**Problem:** No rate limiting means a single user can drain the Anthropic API budget.

**Tasks:**
1. Implement IP-based rate limiting using Cloudflare Workers KV or in-memory sliding window
2. Limits: 10 requests/minute per IP to `/api/anthropic`, 60 requests/minute to `/download`
3. Return `429 Too Many Requests` with `Retry-After` header when exceeded
4. Add rate limit headers to all responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
5. Log rate-limited IPs for monitoring

**Acceptance Criteria:**
- 11th request within 60 seconds from same IP returns 429
- `Retry-After` header is present and accurate
- Different IPs have independent limits
- Rate limit state survives across requests (not just in-memory per isolate)

**Dependencies:** None (parallel with S1-1)
**Risk:** Medium. Cloudflare Workers don't have shared in-memory state across isolates. Must use KV or Durable Objects. KV has eventual consistency (1-minute lag) so the window is approximate — acceptable for this use case.

---

### S1-4. Input Sanitization — XSS Prevention (5 SP)

**Files:** `src/App.jsx` (multiple locations), new file `src/sanitize.ts`
**Problem:** User-supplied labels (node names, group names, edge labels) are rendered directly in SVG `<text>` elements and HTML. The JSON import (`INP-10`) and AI generation accept arbitrary strings.

**Tasks:**
1. Create `sanitize(input: string): string` — strip HTML tags, limit length (100 chars for labels, 200 for titles), disallow `<script>`, `javascript:`, `on*=` attributes
2. Apply sanitize to:
   - `rename()` function (line 388) — node/group label updates
   - `setTitle()` calls — diagram title
   - `setEdgeLbl()` — edge labels
   - JSON import parsing — sanitize all label/title fields after `JSON.parse()`
   - AI generation response — sanitize all labels in returned JSON before `loadTopology()`
3. Add CSP header to worker responses: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`

**Acceptance Criteria:**
- Pasting JSON with `"label": "<img src=x onerror=alert(1)>"` renders as escaped text, no script execution
- Labels are truncated at 100 characters in the UI
- SVG export does not contain executable script content
- CSP header present on all HTML responses

**Dependencies:** None (parallel)
**Risk:** Low. SVG `<text>` elements don't execute script by default, but the SVG export could be opened in a browser where `<foreignObject>` might execute. Belt-and-suspenders approach.

---

### S1-5. Content-Disposition Header Injection Fix (3 SP)

**Files:** `src/worker.ts` (line 57)
**Problem:** The `/download` endpoint uses the `filename` field from the request body directly in the `Content-Disposition` header: `attachment; filename="${filename}"`. An attacker can inject headers.

**Tasks:**
1. Sanitize `filename`: strip path separators (`/`, `\`), control characters, and quotes
2. Enforce `.svg` extension
3. Fallback to `azure-diagram.svg` if invalid
4. Limit filename to 100 characters

**Acceptance Criteria:**
- Sending `filename: "../../etc/passwd"` results in download of `etcpasswd.svg`
- Sending `filename: "a\"; evil-header: yes"` results in clean filename
- Normal filenames like `my-diagram.svg` work unchanged

**Dependencies:** None
**Risk:** Low.

---

### S1-6. Component Decomposition — Extract Worker Modules (5 SP)

**Files:** `src/worker.ts`, `src/cors.ts` -> new structure
**Problem:** Worker logic is a single route handler. As we add validation, rate limiting, and new endpoints, it will become unmaintainable.

**New file structure:**
```
src/
  worker.ts          # Router only — delegates to handlers
  cors.ts            # Unchanged
  handlers/
    anthropic.ts     # POST /api/anthropic — validate + proxy
    download.ts      # POST /download — sanitize filename + serve
    health.ts        # GET /health
  middleware/
    ratelimit.ts     # Rate limiting middleware
    validation.ts    # Request body validation
    sanitize.ts      # String sanitization utilities
```

**Acceptance Criteria:**
- `worker.ts` is < 30 lines (pure routing)
- Each handler is independently testable
- `npm run build` succeeds with no type errors
- `npm run deploy` works to staging

**Dependencies:** S1-2, S1-3, S1-4 (consolidates all new modules)
**Risk:** Low. Pure refactor, no behavior change.

**Relevant Skills:** `microsoft-skills/.github/agents/backend.agent.md` (backend structuring patterns)

---

### S1-7. Security Headers (3 SP)

**Files:** `src/worker.ts` (static asset serving)
**Problem:** No security headers on any response.

**Tasks:**
1. Add to all responses served by the worker:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
2. Add `Content-Security-Policy` to HTML responses (see S1-4)
3. Remove `X-Powered-By` if present

**Acceptance Criteria:**
- `curl -I https://azure.nwgrm.org` shows all security headers
- `curl -I https://azure.nwgrm.org/api/anthropic` (OPTIONS) shows CORS + security headers
- Lighthouse security audit score improves

**Dependencies:** S1-6 (easier to add as middleware after decomposition)
**Risk:** Low. CSP `unsafe-inline` is needed for Vite's inline styles — verify no breakage.

---

### S1-8. Critical Bug Fixes from QA (6 SP)

**Files:** `src/App.jsx`
**Problem:** QA found 14 bugs, 2 critical. Fix the critical and major ones this sprint.

**Bug fixes (from QA report):**
1. **CRITICAL — Edge deletion race condition:** Rapidly deleting edges while connecting can orphan edge references. Fix: add guard in `delSel()` (line 387) to verify edge still exists before removal
2. **CRITICAL — JSON import crashes on circular children:** If JSON contains `"children": ["g1"]` where `g1` references itself, `autoLayout()` infinite-loops. Fix: add cycle detection in layout parsing
3. **MAJOR — Group drag loses nodes at high zoom:** At zoom > 3x, the geometric containment check in `onMove` (line 368) drifts because coordinates aren't zoom-compensated. Fix: apply zoom factor to containment bounds
4. **MAJOR — SVG export missing title:** The `handleExport()` function (line 352) clones SVG but doesn't include the diagram title. Fix: prepend `<text>` title element to cloned SVG
5. **MAJOR — Theme toggle doesn't update edge colors:** Edge label pills use hardcoded colors. Fix: make edge pill background use `T.srf` and text use `T.text`

**Acceptance Criteria:**
- Each bug has a test case added to `azure-diagram-testcases.md`
- All 5 fixes verified in both themes, at 50% and 400% zoom
- No regression in existing TC-1 through TC-9 test cases

**Dependencies:** None (parallel, but coordinate with S1-4 on label changes)
**Risk:** Medium for the zoom containment bug — geometric math is tricky. Test at multiple zoom levels.

---

### Sprint 1 Summary

| Task | SP | Parallel Group | Dependencies |
|------|-----|----------------|--------------|
| S1-1 CORS Lockdown | 5 | A | None |
| S1-2 API Validation | 8 | B | S1-1 |
| S1-3 Rate Limiting | 5 | A | None |
| S1-4 Input Sanitization | 5 | A | None |
| S1-5 Content-Disposition Fix | 3 | A | None |
| S1-6 Worker Decomposition | 5 | C | S1-2, S1-3, S1-4 |
| S1-7 Security Headers | 3 | C | S1-6 |
| S1-8 Critical Bug Fixes | 6 | A | None |
| **Total** | **40** | | |

**Week 1:** S1-1, S1-3, S1-4, S1-5, S1-8 (all parallel, 24 SP)
**Week 2:** S1-2, S1-6, S1-7 (sequential chain, 16 SP)

---

## Sprint 2: UI Polish + UX Improvements + Mobile

**Sprint Goal:** Improve UX audit score from 62/100 to 80+/100 by fixing edit mode confusion, adding zoom controls, keyboard accessibility, session persistence, and mobile pinch-to-zoom.

**Capacity:** 38 story points

### S2-1. Component Decomposition — Split App.jsx Monolith (8 SP)

**Files:** `src/App.jsx` (477 lines + ~100KB icon data) -> 15+ files
**Problem:** `App.jsx` is a 150KB+ monolith with all state, event handlers, layout logic, icon data, and rendering in one file. Impossible to maintain or test individual features.

**New file structure:**
```
src/
  App.jsx              # Shell: providers + layout grid (< 50 lines)
  store/
    useStore.ts         # Zustand store — nodes, groups, edges, selection, theme, zoom, pan
  components/
    Canvas.jsx          # SVG canvas + pan/zoom/click handlers
    Node.jsx            # Single node rendering + drag
    Group.jsx           # Single group rendering + drag + resize
    Edge.jsx            # Single edge rendering + label
    Sidebar.jsx         # Sidebar container
    Palette.jsx         # Service palette with categories
    PropertiesPanel.jsx # Selected item properties
    Toolbar.jsx         # Top toolbar (theme, zoom, export, edit mode)
    ZoomControls.jsx    # +/- zoom buttons + zoom display
    ImportPanel.jsx     # JSON paste + AI generation
    DemoPresets.jsx     # Demo buttons
    MobileDrawer.jsx    # Hamburger + drawer overlay
  data/
    icons.ts            # All 41 base64 icon data URIs (extracted from App.jsx)
    serviceTypes.ts     # Service type definitions + categories
    groupTypes.ts       # Group type definitions + colors
    demoTopologies.ts   # 3 demo preset JSON objects
  layout/
    autoLayout.ts       # Layout algorithm (extracted from App.jsx)
    zoomToFit.ts        # Zoom-to-fit calculation
  utils/
    sanitize.ts         # (from Sprint 1)
    svgExport.ts        # SVG clone + export logic
```

**Tasks:**
1. Install Zustand: `npm install zustand`
2. Create `useStore.ts` with all state from `App.jsx` line 245 (28 `useState` calls -> single Zustand store)
3. Extract icon data (~100KB) into `data/icons.ts`
4. Extract each component one at a time, verifying no regression after each extraction
5. Extract layout algorithm into `layout/autoLayout.ts`

**Acceptance Criteria:**
- `App.jsx` is < 50 lines
- No single component file > 200 lines
- All 41 existing test cases still pass (manual verification)
- `npm run build` bundle size is unchanged (+/- 1KB)
- Hot reload works in dev mode for each component

**Dependencies:** S1-6 (worker already decomposed, now do frontend)
**Risk:** High. This is the biggest task in the entire plan. The minified single-line code in App.jsx makes extraction error-prone. Work incrementally — extract one component per commit.

**Relevant Skills:**
- `microsoft-skills/skills/typescript/frontend/zustand-store` — Zustand best practices, slice pattern
- `microsoft-skills/skills/typescript/frontend/react-flow-node` — React Flow node component patterns
- `microsoft-skills/skills/typescript/frontend/frontend-ui-dark` — Dark mode theming patterns

---

### S2-2. Edit Mode UX Overhaul (5 SP)

**Files:** New `components/Toolbar.jsx`, `store/useStore.ts`
**Problem:** UX audit found edit mode confusing — users don't understand the toggle, accidentally make changes or can't figure out why dragging doesn't work.

**Tasks:**
1. Replace binary toggle with clear mode indicator: "View Mode" (blue, locked icon) / "Edit Mode" (green, pencil icon)
2. Show a toast notification when entering/leaving edit mode
3. Add subtle lock overlay on nodes/groups in view mode (0.5 opacity lock icon)
4. Add keyboard shortcut: `E` to toggle edit mode
5. Auto-enable edit mode when user adds a node from palette
6. Show "Read-only" badge in toolbar when view mode active

**Acceptance Criteria:**
- New users understand they're in view mode without reading docs
- Keyboard shortcut `E` toggles mode
- Adding a node from palette auto-enables edit mode
- Test case TC-5.4 updated and passing

**Dependencies:** S2-1 (needs component decomposition first for clean Toolbar component)
**Risk:** Low.

**User Stories:** SEL-04

---

### S2-3. Zoom Controls UI (3 SP)

**Files:** New `components/ZoomControls.jsx`
**Problem:** No visible zoom controls — users must know to scroll-wheel. No zoom percentage display.

**Tasks:**
1. Add zoom control bar in bottom-right of canvas:
   - `-` button (zoom out 20%)
   - Zoom percentage display (e.g., "125%") — clickable to reset to 100%
   - `+` button (zoom in 20%)
   - "Fit" button (zoom-to-fit)
2. Style to match existing dark/light theme
3. Make buttons 44x44px minimum for touch targets (WCAG 2.5.8)

**Acceptance Criteria:**
- Zoom controls visible at all screen sizes
- Click `+` increases zoom by 20%, `-` decreases by 20%
- Click percentage resets to 100%
- "Fit" button does same as existing zoom-to-fit
- Controls respect dark/light theme

**Dependencies:** S2-1
**Risk:** Low.

**User Stories:** NAV-02, NAV-03

---

### S2-4. Keyboard Accessibility — WCAG 2.1 AA Basics (5 SP)

**Files:** All new components from S2-1
**Problem:** UX audit scored 0 on accessibility. No keyboard navigation, no ARIA labels, no focus indicators.

**Tasks:**
1. Add `role` and `aria-label` attributes to all interactive elements:
   - Sidebar palette buttons: `role="button" aria-label="Add Virtual Machine node"`
   - Canvas nodes: `role="img" aria-label="Virtual Machine: My VM"`
   - Groups: `role="group" aria-label="Resource Group: Production"`
   - Toolbar buttons: `aria-label` on each
2. Add focus indicators: `outline: 2px solid #3b82f6` on `:focus-visible`
3. Implement keyboard shortcuts:
   - `Delete` / `Backspace`: delete selected element
   - `Escape`: deselect / cancel connection
   - `E`: toggle edit mode
   - `F`: zoom to fit
   - `Tab`: cycle through sidebar categories
4. Add `tabindex="0"` to all interactive canvas elements
5. Add skip-to-content link for screen readers

**Acceptance Criteria:**
- All interactive elements reachable by Tab key
- Focus indicator visible on all focused elements
- `Delete` key deletes selected node/group/edge
- `Escape` cancels active connection
- Lighthouse Accessibility audit >= 70 (from current ~30)

**Dependencies:** S2-1 (need decomposed components to add ARIA properly)
**Risk:** Medium. SVG elements have limited ARIA support. May need `<desc>` and `<title>` elements within SVG for screen readers.

**User Stories:** SEL-09 (partial)

---

### S2-5. Session Persistence — localStorage (5 SP)

**Files:** `store/useStore.ts`, new `utils/persistence.ts`
**Problem:** Closing the browser tab loses all work. UX audit flagged this as a top pain point.

**Tasks:**
1. Auto-save diagram state to `localStorage` on every state change (debounced, 500ms)
2. On app load, restore from `localStorage` if present
3. Save: `{ title, nodes, groups, edges, theme, zoom, pan }`
4. Add "New Diagram" button that clears state and localStorage
5. Show "Last saved: 2 minutes ago" indicator in toolbar
6. Handle `localStorage` quota exceeded gracefully (show warning, don't crash)
7. Zustand `persist` middleware handles this natively — use it

**Acceptance Criteria:**
- Close tab, reopen -> diagram is exactly as left
- "New Diagram" clears canvas and storage
- Works in private/incognito mode (falls back to in-memory)
- Storage key: `azure-diagram-builder-state`
- `JSON.stringify()` of state is < 5MB (localStorage limit)

**Dependencies:** S2-1 (needs Zustand store)
**Risk:** Low. Zustand's `persist` middleware handles serialization, hydration, and versioning.

**User Stories:** PER-01

---

### S2-6. Mobile Responsiveness + Pinch-to-Zoom (5 SP)

**Files:** `components/Canvas.jsx`, `components/MobileDrawer.jsx`
**Problem:** Pinch-to-zoom not implemented (MOB-03). Sidebar drawer needs polish.

**Tasks:**
1. Implement pinch-to-zoom on canvas using touch events:
   - Track two-finger touch distance on `touchstart`
   - Calculate scale delta on `touchmove`
   - Apply zoom centered between the two touch points
2. Prevent page scroll/bounce while interacting with canvas (`touch-action: none`)
3. Fix mobile drawer: add swipe-to-close gesture
4. Ensure toolbar buttons are >= 44x44px on mobile
5. Test on iOS Safari and Android Chrome

**Acceptance Criteria:**
- Two-finger pinch smoothly zooms in/out
- Zoom center is between fingers (not viewport center)
- No conflict between single-finger pan and two-finger zoom
- Drawer closes on swipe-left
- No page bounce/scroll on iOS Safari

**Dependencies:** S2-1
**Risk:** Medium. iOS Safari has notoriously quirky touch event behavior. `passive: false` + `preventDefault()` may interfere with scroll. Test on real devices.

**User Stories:** MOB-03, NAV-06

---

### S2-7. Service Search/Filter in Palette (3 SP)

**Files:** `components/Palette.jsx`
**Problem:** 41 services across 7 categories with no search. Users can't find services quickly.

**Tasks:**
1. Add search input at top of palette (debounced, 200ms)
2. Filter services by name match (case-insensitive, substring)
3. When searching, show flat list (ignore categories) sorted by relevance
4. Highlight matching text in results
5. Clear search on `Escape` or clear button

**Acceptance Criteria:**
- Typing "vm" shows "Virtual Machine" and "VM Scale Set"
- Typing "key" shows "Key Vault"
- Empty search shows normal categorized list
- Works on mobile drawer palette

**Dependencies:** S2-1
**Risk:** Low.

**User Stories:** SVC-07

---

### S2-8. Undo/Redo (4 SP)

**Files:** `store/useStore.ts`, `components/Toolbar.jsx`
**Problem:** No undo/redo — users lose work on accidental deletions.

**Tasks:**
1. Implement undo/redo stack in Zustand store using a history middleware pattern:
   - Push state snapshot on each mutation (add/delete/move/rename/connect)
   - Limit history to 50 entries
   - Skip pan/zoom changes (too frequent)
2. Wire `Ctrl+Z` (undo) and `Ctrl+Shift+Z` (redo) keyboard shortcuts
3. Add undo/redo buttons in toolbar (with disabled state when stack empty)

**Acceptance Criteria:**
- Delete a node -> Ctrl+Z restores it with all edges
- Move a node -> Ctrl+Z moves it back
- Redo restores the undone action
- History survives across undo/redo cycles (no stack corruption)
- Pan/zoom are NOT in undo history

**Dependencies:** S2-1, S2-5 (undo stack interacts with persistence)
**Risk:** Medium. Deciding what constitutes a "snapshot point" requires care — debounce drag moves to avoid 60 snapshots per second during a drag.

**User Stories:** SEL-08

---

### Sprint 2 Summary

| Task | SP | Parallel Group | Dependencies |
|------|-----|----------------|--------------|
| S2-1 Component Decomposition | 8 | A | S1-6 |
| S2-2 Edit Mode UX | 5 | B | S2-1 |
| S2-3 Zoom Controls | 3 | B | S2-1 |
| S2-4 Keyboard Accessibility | 5 | B | S2-1 |
| S2-5 Session Persistence | 5 | B | S2-1 |
| S2-6 Mobile + Pinch-to-Zoom | 5 | B | S2-1 |
| S2-7 Service Search | 3 | B | S2-1 |
| S2-8 Undo/Redo | 4 | B | S2-1, S2-5 |
| **Total** | **38** | | |

**Week 1:** S2-1 (the big decomposition — full week, 8 SP)
**Week 2:** S2-2 through S2-8 (all parallel once S2-1 is done, 30 SP)

---

## Sprint 3: Azure Architecture Correctness + Microsoft Compliance

**Sprint Goal:** Ensure every diagram produced by the tool follows Microsoft Azure Architecture Center guidelines — correct icons, naming conventions, grouping standards, and Well-Architected Framework alignment.

**Capacity:** 36 story points

### S3-1. Expand Icon Set to 705 Official Azure Icons (8 SP)

**Files:** `data/icons.ts`, `data/serviceTypes.ts`, `components/Palette.jsx`
**Problem:** Only 41 of 705+ Azure Architecture Icons are included. Missing entire categories: Management + Governance, Analytics, Containers, Migration, Mixed Reality, Web, IoT (full set), Blockchain, etc.

**Reference:** [Microsoft Azure Architecture Icons](https://learn.microsoft.com/en-us/azure/architecture/icons/) — official SVG download containing all icons organized by service category.

**Tasks:**
1. Download the official Azure Architecture Icon set from Microsoft
2. Convert all 705 SVGs to base64 data URIs (script in `tools/convert-icons.ts`)
3. Organize into Microsoft's official categories (17 categories, not our current 7):
   - AI + Machine Learning, Analytics, Compute, Containers, Databases, DevOps, General, Identity, Integration, IoT, Management + Governance, Media, Migration, Mixed Reality, Networking, Security, Storage, Web
4. Update `serviceTypes.ts` with all 705 service definitions using Microsoft's canonical names
5. Update `Palette.jsx` to show 17 categories with lazy-loading (don't render all 705 icons at once)
6. Update the AI generation prompt to know about all 705 types

**Acceptance Criteria:**
- All 705 icons render correctly (no broken images)
- Categories match Microsoft's official grouping exactly
- Each icon matches the SVG from Microsoft's download (visual comparison)
- Palette remains responsive with 705 icons (virtualized list or lazy load)
- Bundle size impact: icons should be lazy-loaded, not all in initial bundle
- AI generation prompt includes complete service type list

**Dependencies:** S2-1 (palette component must be decomposed), S2-7 (search is essential with 705 services)
**Risk:** High. 705 base64 SVGs could be 5-10MB. Must implement code-splitting — load icons on-demand by category. Consider moving to an icon sprite or CDN-hosted SVGs instead of inline base64.

**Relevant Skills:** `microsoft-skills/.github/plugins/azure-skills` — Azure service naming conventions

---

### S3-2. Azure Naming Convention Enforcement (5 SP)

**Files:** `utils/azureNaming.ts` (new), `components/PropertiesPanel.jsx`, AI generation prompt
**Problem:** Users can name resources anything. Azure has official naming conventions that should be suggested/enforced for professional diagrams.

**Reference:** [Azure naming conventions](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/resource-naming) — Cloud Adoption Framework naming rules.

**Tasks:**
1. Create `azureNaming.ts` with:
   - Naming pattern per resource type (e.g., VM: `vm-<workload>-<env>-<region>-<###>`)
   - Abbreviation table (e.g., Resource Group: `rg-`, Virtual Network: `vnet-`, Key Vault: `kv-`)
   - Validation: character limits, allowed characters per resource type
2. When a user adds a new node, auto-suggest a name following the convention: `vm-{workload}-prod-eastus-001`
3. Show a warning icon on nodes with non-compliant names (yellow triangle)
4. Add "Fix naming" button that renames all nodes to comply
5. Update AI generation prompt to always use compliant names

**Acceptance Criteria:**
- New VM node gets default name `vm-workload-prod-001` (not "Virtual Machine")
- Warning icon appears on nodes named "my server" or "test"
- "Fix naming" batch renames all nodes
- AI-generated diagrams always use compliant names
- Naming rules match the CAF resource naming page exactly

**Dependencies:** S2-1 (PropertiesPanel decomposed)
**Risk:** Low. Naming is string manipulation. The main risk is keeping up with Microsoft's naming conventions — link to the official docs page in code comments.

---

### S3-3. Group Hierarchy — Azure Resource Topology (5 SP)

**Files:** `data/groupTypes.ts`, `layout/autoLayout.ts`, `components/Group.jsx`
**Problem:** Current group types are informal. Azure has a strict resource hierarchy that should be reflected.

**Reference:** [Azure resource organization](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-setup-guide/organize-resources) — Management Group > Subscription > Resource Group > Resources.

**Tasks:**
1. Add new group types matching Azure hierarchy:
   - Management Group (purple, dashed)
   - Subscription (blue, solid)
   - Resource Group (gray, solid) — existing
   - Availability Zone (orange, dotted)
   - Virtual Network (blue, dashed) — existing
   - Subnet (light blue, dashed) — existing
2. Enforce nesting rules:
   - Management Group can contain Subscriptions
   - Subscription can contain Resource Groups
   - Resource Group can contain resources + VNets
   - VNet can contain Subnets
   - Subnet can contain compute resources
3. Warn (don't block) when user violates hierarchy (e.g., putting a Subscription inside a Subnet)
4. Auto-layout respects hierarchy: outer groups first, inner groups nested

**Acceptance Criteria:**
- All new group types have distinct visual styling consistent with Microsoft docs
- Dragging a Resource Group into a Subnet shows a warning toast
- Auto-layout places Management Group > Subscription > RG > VNet > Subnet correctly
- Existing demos updated to use correct hierarchy
- Group types dropdown is ordered by hierarchy level

**Dependencies:** S2-1 (Group component), S3-1 (full icon set for group icons)
**Risk:** Medium. Layout algorithm changes for enforced nesting could break existing demos. Test with all 3 demos + manual arrangements.

---

### S3-4. Well-Architected Framework Visual Annotations (5 SP)

**Files:** New `components/WAFBadge.jsx`, `data/wafPillars.ts`, `components/PropertiesPanel.jsx`
**Problem:** Diagrams should be able to annotate which Well-Architected Framework pillars each component addresses.

**Reference:** [Azure Well-Architected Framework](https://learn.microsoft.com/en-us/azure/well-architected/) — 5 pillars: Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency.

**Tasks:**
1. Define the 5 WAF pillars with official colors and icons:
   - Reliability (blue): availability zones, load balancers, replication
   - Security (red): Key Vault, NSG, Firewall, Entra ID, Sentinel
   - Cost Optimization (green): reserved instances, autoscale, consumption plans
   - Operational Excellence (purple): DevOps, Monitor, App Insights, Log Analytics
   - Performance Efficiency (orange): CDN, Front Door, Redis, autoscale
2. Add WAF pillar tags to the properties panel — multi-select checkboxes
3. Render small pillar badge icons on nodes that have WAF tags
4. Add a "WAF Coverage" summary panel showing which pillars are represented and which are missing
5. Optionally auto-tag nodes based on service type (Key Vault -> Security, Monitor -> Operational Excellence)

**Acceptance Criteria:**
- Each node can have 0-5 WAF pillar tags
- Pillar badges render as small colored circles on the node card
- WAF Coverage panel shows a checklist with gaps highlighted
- Auto-tagging correctly maps services to pillars
- Pillar colors match Microsoft's official WAF documentation

**Dependencies:** S2-1 (component decomposition)
**Risk:** Low. This is additive — doesn't change existing behavior.

---

### S3-5. Azure Architecture Pattern Templates (5 SP)

**Files:** `data/demoTopologies.ts`, `data/patterns/` (new directory)
**Problem:** Only 3 demo presets. Microsoft documents dozens of reference architectures. Adding more templates helps users start with a correct, compliant foundation.

**Reference:** [Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/browse/) — reference architectures.

**Tasks:**
1. Add 5 new architecture templates following Microsoft reference architectures:
   - **Microservices on AKS** — AKS cluster, API Gateway, Service Bus, Cosmos DB, Key Vault, Container Registry
   - **Serverless Event Processing** — Event Grid, Functions, Service Bus, Cosmos DB, Application Insights
   - **Hub-Spoke Network** — Hub VNet (Firewall, VPN Gateway), multiple Spoke VNets with peering
   - **Data Analytics Platform** — Data Factory, Synapse, Data Lake Storage, Power BI, Purview
   - **AI/ML Pipeline** — ML Workspace, Cognitive Services, Container Registry, Key Vault, Storage, Application Insights
2. Each template uses correct naming conventions (S3-2), proper hierarchy (S3-3), and WAF tags (S3-4)
3. Templates include realistic edge labels (protocols, ports)

**Acceptance Criteria:**
- 8 total demo presets (3 existing + 5 new)
- Each new template renders correctly with auto-layout
- Each template uses Azure naming conventions
- Each template has at least 3 WAF pillars represented
- Edge labels include protocol info (HTTPS/443, AMQP/5671, etc.)

**Dependencies:** S3-1, S3-2, S3-3, S3-4 (needs all the correctness features)
**Risk:** Low. JSON data creation.

---

### S3-6. Architecture Compliance Checker (5 SP)

**Files:** New `utils/complianceChecker.ts`, new `components/CompliancePanel.jsx`
**Problem:** Users create diagrams that may violate Azure best practices. No feedback mechanism exists.

**Tasks:**
1. Create a compliance checker that analyzes the current diagram and reports:
   - **Naming violations** — nodes not following CAF naming conventions
   - **Missing security components** — no NSG, no Key Vault, no WAF in a public-facing architecture
   - **Network issues** — public resources not behind a load balancer or gateway
   - **Monitoring gaps** — no Application Insights or Log Analytics connected
   - **Single points of failure** — critical services without redundancy
2. Show results in a slide-out panel with severity levels (error, warning, info)
3. Each finding links to the relevant Azure Architecture Center documentation URL
4. Score the diagram 0-100 on compliance

**Acceptance Criteria:**
- Running checker on "3-Tier Web" demo returns a score with specific findings
- Each finding has a severity, description, and "Learn more" link to Microsoft docs
- Fixing a finding and re-running updates the score
- Checker runs in < 500ms for diagrams with up to 50 nodes

**Dependencies:** S3-2, S3-3, S3-4 (needs naming, hierarchy, and WAF data)
**Risk:** Medium. Defining "correct" is subjective — stick to documented Microsoft best practices only. Don't over-flag.

---

### S3-7. PNG and JSON Export (3 SP)

**Files:** `utils/svgExport.ts` (expand), `components/Toolbar.jsx`
**Problem:** Only SVG export exists. Users need PNG for pasting into docs and JSON for version control.

**Tasks:**
1. **PNG export:** Render SVG to canvas -> `toBlob()` -> download. Support 1x, 2x, 4x resolution
2. **JSON export:** Serialize current state (title, nodes, groups, edges) to pretty-printed JSON -> download
3. Add export dropdown menu: SVG | PNG (1x/2x/4x) | JSON
4. Add "Copy as PNG" button for clipboard paste

**Acceptance Criteria:**
- PNG at 2x resolution renders all icons, labels, and edges correctly
- JSON export can be re-imported via JSON paste (round-trip)
- Copy-to-clipboard works on Chrome and Safari
- Export filenames use diagram title (sanitized)

**Dependencies:** S2-1 (toolbar component)
**Risk:** Low for JSON. Medium for PNG — canvas rendering of SVG with embedded base64 images can have cross-origin issues. Test thoroughly.

**User Stories:** EXP-10, EXP-12, EXP-13

---

### Sprint 3 Summary

| Task | SP | Parallel Group | Dependencies |
|------|-----|----------------|--------------|
| S3-1 705 Azure Icons | 8 | A | S2-1, S2-7 |
| S3-2 Naming Conventions | 5 | A | S2-1 |
| S3-3 Group Hierarchy | 5 | A | S2-1, S3-1 |
| S3-4 WAF Annotations | 5 | B | S2-1 |
| S3-5 Architecture Templates | 5 | C | S3-1, S3-2, S3-3, S3-4 |
| S3-6 Compliance Checker | 5 | C | S3-2, S3-3, S3-4 |
| S3-7 PNG + JSON Export | 3 | B | S2-1 |
| **Total** | **36** | | |

**Week 1:** S3-1, S3-2, S3-4, S3-7 (parallel, 21 SP)
**Week 2:** S3-3, S3-5, S3-6 (depend on week 1, 15 SP)

---

## Cross-Sprint Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| App.jsx decomposition introduces regressions | High | High | Extract one component per commit; manual test all 41 TCs after each extraction |
| 705 icons bloat bundle to >10MB | High | Medium | Lazy-load by category; consider CDN-hosted SVGs instead of base64 |
| Cloudflare Workers KV rate limiting is approximate | Medium | Low | Acceptable for this use case; document that limits are soft |
| iOS Safari pinch-to-zoom conflicts with page zoom | Medium | Medium | Test on real devices; add `<meta name="viewport" content="user-scalable=no">` |
| Microsoft icon set license restricts redistribution | Low | High | Review [Microsoft trademark guidelines](https://learn.microsoft.com/en-us/azure/architecture/icons/) — icons are free for architecture diagrams |
| Zustand migration breaks hot reload | Low | Medium | Follow `microsoft-skills/skills/typescript/frontend/zustand-store` patterns |
| WAF pillar auto-tagging produces false positives | Medium | Low | Make tags suggestions, not mandatory; user can override |

---

## Definition of Done (All Sprints)

Each task is complete when:
1. Code is committed to `main` with passing `npm run build`
2. Deployed to staging (`npm run deploy:staging`) and manually verified
3. All referenced test cases updated in `azure-diagram-testcases.md`
4. No new Lighthouse audit regressions (performance, accessibility, SEO)
5. Works on Chrome, Safari, Firefox latest
6. Works on iOS Safari and Android Chrome (mobile tasks)
7. `CLAUDE.md` updated with any new features or architecture changes

---

## Velocity Tracking

| Sprint | Planned SP | Target UX Score | Key Metric |
|--------|-----------|----------------|------------|
| Sprint 1 | 40 | 62 (no change) | 0 critical/major security findings |
| Sprint 2 | 38 | 80+ | Lighthouse Accessibility >= 70 |
| Sprint 3 | 36 | 85+ | 705 icons, compliance score feature |
| **Total** | **114** | | |

---

## Microsoft Skills Usage Map

| Skill Path | Sprint | Tasks |
|------------|--------|-------|
| `skills/typescript/frontend/zustand-store` | S2 | S2-1, S2-5, S2-8 |
| `skills/typescript/frontend/react-flow-node` | S2 | S2-1 (Node/Edge components) |
| `skills/typescript/frontend/frontend-ui-dark` | S2 | S2-1, S2-2, S2-3 |
| `skills/typescript/monitoring/opentelemetry` | S1 | S1-1 (structured logging) |
| `skills/typescript/foundry/contentsafety` | S1 | S1-2 (input validation) |
| `skills/typescript/entra/keyvault-secrets` | S1 | S1-2 (secret management patterns) |
| `.github/agents/backend.agent.md` | S1 | S1-6 (worker decomposition) |
| `.github/agents/frontend.agent.md` | S2 | S2-1 (component decomposition) |
| `.github/plugins/azure-skills` | S3 | S3-1, S3-2, S3-3 (Azure service definitions) |
