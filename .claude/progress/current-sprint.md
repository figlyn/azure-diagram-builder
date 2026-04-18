# Current Sprint: Azure Well-Architected Compliance

**Goal:** Implement full Microsoft Well-Architected Framework compliance for diagram documentation
**Started:** 2026-04-16
**Target:** Complete all 21 WAF stories

## Sprint Phases

### Phase 1: Foundation (Save/Load + Metadata)
*Enables all other features to be persisted and documented*

| ID | Story | Status | Notes |
|----|-------|--------|-------|
| WAF-50 | Save diagram to JSON file | ✅ Done | 💾 Save button - 5 tests pass |
| WAF-51 | Load diagram from JSON file | ✅ Done | 📂 Open button - 4 tests pass |
| WAF-53 | JSON formatted for human-readable diffs | ✅ Done | Pretty-print - 6 tests pass |
| WAF-01 | Diagram metadata panel (title, author, version, date) | ✅ Done | Collapsible panel - 6 tests pass |
| WAF-02 | Description field for diagram purpose | ✅ Done | Part of metadata panel |
| WAF-03 | Metadata included in SVG export | ✅ Done | RDF metadata - 4 tests pass |
| WAF-04 | External reference URLs (ADRs, docs) | ✅ Done | References field - tested |

#### Phase 1 Agent Checklist
- [x] 💻 Developer: Code implemented
- [x] ✅ QA: Playwright tests written (29 tests in `tests/phase1-foundation.spec.js`)
- [x] ✅ QA: Tests executed and passing (29/29 pass)
- [x] 🚀 Deployment: Build verified (1.7MB bundle, 539KB gzipped)
- [ ] 🎨 UX: Visual review complete

### Phase 2: Legend & Notation
*Professional output with self-documenting diagrams*

| ID | Story | Status | Notes |
|----|-------|--------|-------|
| WAF-10 | Auto-legend for group types | ✅ Done | 5 tests pass |
| WAF-11 | Legend shows edge style meanings | ✅ Done | 6 tests pass |
| WAF-12 | Legend included in exports | ✅ Done | 8 tests pass |
| WAF-13 | Toggle legend visibility | ✅ Done | 6 tests pass |

#### Phase 2 Agent Checklist
- [x] 💻 Developer: Legend features implemented
- [x] ✅ QA: Playwright tests written (32 tests in `tests/phase2-legend.spec.js`)
- [x] ✅ QA: Tests executed and passing (32/32 pass)
- [x] 🚀 Deployment: Build verified (1.77MB bundle, 540KB gzipped)

### Phase 3: Security & Compliance
*Trust boundaries and data classification for threat modeling*

| ID | Story | Status | Notes |
|----|-------|--------|-------|
| WAF-20 | Trust boundary lines | ✅ Done | 7 tests pass |
| WAF-21 | Data classification labels on edges | ✅ Done | 5 tests pass |
| WAF-22 | Classification badge rendering | ✅ Done | 10 tests pass |
| WAF-23 | Compliance zone annotations | ✅ Done | 15 tests pass |

#### Phase 3 Agent Checklist
- [x] 💻 Developer: Security features implemented
- [x] ✅ QA: Playwright tests written (39 tests in `tests/phase3-security.spec.js`)
- [x] ✅ QA: Tests executed and passing (39/39 pass)
- [x] 🚀 Deployment: Build verified (1.78MB bundle, 542KB gzipped)

### Phase 4: C4 Model / Layered Views
*Context → Container → Component abstraction*

| ID | Story | Status | Notes |
|----|-------|--------|-------|
| WAF-30 | View mode toggle (Context/Container/Component) | ✅ Done | 7 tests pass |
| WAF-31 | Context view (system as black box) | ✅ Done | 8 tests pass |
| WAF-33 | Component view (drill into services) | ✅ Done | 10 tests pass |
| WAF-34 | External actor nodes (Users, External Systems) | ✅ Done | 11 tests pass |
| WAF-35 | Collapsible groups | ✅ Done | 12 tests pass |

#### Phase 4 Agent Checklist
- [x] 💻 Developer: C4 model features implemented
- [x] ✅ QA: Playwright tests written (51 tests in `tests/phase4-c4model.spec.js`)
- [x] ✅ QA: Tests executed and passing (51/51 pass)
- [x] 🚀 Deployment: Build verified (1.79MB bundle, 544KB gzipped)
- [ ] 🎨 UX: Visual review complete

### Phase 5: Accessibility
*WCAG compliance and inclusive design*

| ID | Story | Status | Notes |
|----|-------|--------|-------|
| WAF-40 | Pattern fills for color-blind users | 🔲 Pending | SVG patterns per group type |
| WAF-41 | WCAG 2.1 AA contrast compliance | 🔲 Pending | Audit and fix colors |
| WAF-42 | Alt-text in exports | 🔲 Pending | Screen reader support |

---

## Dependencies Graph

```
Phase 1 (Foundation)
├── WAF-50/51 (Save/Load) ← All other phases depend on this
├── WAF-01/02/04 (Metadata) → WAF-03 (Export metadata)
└── WAF-53 (Readable JSON)

Phase 2 (Legend)
├── WAF-10/11 (Legend content) → WAF-12 (Export legend)
└── WAF-13 (Toggle)

Phase 3 (Security)
├── WAF-20 (Trust boundaries) - standalone edge style
├── WAF-21/22 (Data classification) - edge enhancement
└── WAF-23 (Compliance zones) - group enhancement

Phase 4 (C4 Model) - Most complex
├── WAF-34 (External actors) - prerequisite for context view
├── WAF-30 (View toggle) → WAF-31 (Context) + WAF-33 (Component)
└── WAF-35 (Collapsible) - supports all views

Phase 5 (Accessibility)
├── WAF-40 (Patterns) - independent
├── WAF-41 (Contrast) - independent
└── WAF-42 (Alt-text) - depends on export
```

## Blockers

None currently

## Session Achievements

### 2026-04-18: Edge Routing Separation & New Demos

**Bug Fixes:**
- Fixed edges overlapping from collapsed groups
- Fixed labels positioned incorrectly on overlapping edges
- Added `channelOffset` to separate edge channels
- Increased edge spacing (14px → 20px) and stagger (25+i*12 → 30+i*15)
- Labels now placed on longest segment, not array midpoint

**Demo Updates:**
- Replaced 8 demos with 6 cleaner ones:
  - Contoso Hub-Spoke, Northwind N-Tier, Tailwind Events
  - Woodgrove Zero-Trust, Adventure Data, Litware DR

**Tests:**
- Fixed toast message assertions in layout tests
- Full suite: 223 tests passing

**Deployment:**
- Deployed to staging: https://staging.nwgrm.org

### 2026-04-17: Visualization Modes & Edge Routing

**New Features:**
- Label Style dropdown with 3 modes: Compact (monospace), Minimal (hover-to-reveal), Legend (numbered circles)
- Icon Style dropdown with 3 modes: Standard (28px), Compact (22px), Minimal (16px)
- Toolbar reorganized with logical groupings (View, Actions, Display, Export)

**Bug Fixes:**
- Fixed ELK edge routing coordinate mismatch (edges going off-canvas)
- Fixed Layout button not triggering edge rerouting
- Fixed toolbar layout breaking on smaller screens
- Improved edge label collision detection

**Tests:**
- Added 12 new layout-rerouting tests
- Full suite now at `183/183` passing

**Commits:**
- `b1159f2` fix: improve edge label collision detection system
- `e8fd70d` feat: add 3 edge label visualization modes
- `3360afa` feat: add 3 icon visualization modes
- `4dea210` fix: reorganize toolbar with logical groupings
- `cf6c406` fix: disable ELK edge routing to fix coordinate mismatch

### Previous: Phase 4 C4 Model

- Completed Phase 4 implementation and validation end-to-end.
- Fixed WAF-33 component drill-in regressions and WAF-35 collapsed-group persistence / nested hiding behavior.
- Hardened `tests/phase4-c4model.spec.js` from 48 to 51 passing scenarios with stronger behavior-focused assertions.
- Fixed Phase 4 accessibility gaps:
  - view mode toggle now exposes selected state with `aria-pressed`
  - collapse / expand control is a keyboard-accessible button
  - component drill-in dialog now focuses correctly, supports `Escape`, and restores focus on close
- Added [QA-BUG-REPORT.md](/Users/vadim/Projects/mcp/azure-diagram-builder/QA-BUG-REPORT.md:1) to track resolved issues and remaining QA risks.

## Progress

```
Phase 1: 7/7 done  [██████████] ✅ COMPLETE (29 tests)
Phase 2: 4/4 done  [██████████] ✅ COMPLETE (32 tests)
Phase 3: 4/4 done  [██████████] ✅ COMPLETE (39 tests)
Phase 4: 5/5 done  [██████████] ✅ COMPLETE (51 tests)
Phase 5: 0/3 done  [░░░░░░░░░░]
Extras:            [██████████] ✅ Edge routing + demos (72 tests)
─────────────────────────────────
Total:  20/23 WAF done [█████████░] 87%
Full test suite: 223 tests passing
```

## Recommended Resume Point

- Start with Phase 5 accessibility work:
  - WAF-40 pattern fills
  - WAF-41 WCAG contrast audit and remediation
  - WAF-42 alt-text in exports
- After that, clean up the residual QA risks logged in `QA-BUG-REPORT.md`.

## Acceptance Criteria

### Story Completion Checklist (Required for each story)

| Step | Agent | Validation |
|------|-------|------------|
| 1. Implementation | 💻 Developer | Code changes made via Developer agent |
| 2. Tests Written | ✅ QA | Playwright tests created for feature |
| 3. Tests Pass | ✅ QA | All tests green, no regressions |
| 4. Build Passes | 🚀 Deployment | `npm run build` succeeds |
| 5. Manual Review | 🎨 UX | Visual/UX review in browser |

**A story is NOT complete until all 5 steps are validated by the appropriate agent.**

### Definition of Done per Story
- [ ] Developer agent implemented the feature
- [ ] QA agent wrote Playwright tests
- [ ] QA agent ran tests (all pass)
- [ ] Deployment agent verified build
- [ ] Works in both dark and light themes
- [ ] Included in SVG export where applicable
- [ ] Story marked ✅ in `azure-diagram-requirements.md`

### Sprint Complete When
- [ ] All 21 WAF stories implemented
- [ ] All exports include metadata + legend
- [ ] C4 view modes functional
- [ ] Accessibility audit passed
- [ ] Deployed to staging.nwgrm.org
- [ ] Deployed to azure.nwgrm.org
- [ ] CHANGELOG updated

## Notes

- WAF-32 (Container view) already implemented - it's current default behavior
- WAF-52 (Git changelog) is informational only - no code needed
- Phase 1 is blocking - must complete before parallel work on Phases 2-5
- Phases 2-5 can be parallelized after Phase 1 completes
