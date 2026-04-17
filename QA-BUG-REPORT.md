# QA Bug Report

Date: 2026-04-17
Scope: Phase 4 C4 Model / Layered Views

## Verification Baseline

- Hardened Phase 4 Playwright suite: `51/51` passing
- Full suite after accessibility fixes: `151/151` passing
- Production build: passing

This report now reflects post-fix status. The originally confirmed accessibility bugs listed in the earlier QA pass have been addressed. The remaining items are open risks and coverage gaps.

## Resolved Bugs

### FIXED-001: View mode toggle selected state is now exposed accessibly

- Area: WAF-30
- Evidence: [src/App.jsx](/Users/vadim/Projects/mcp/azure-diagram-builder/src/App.jsx:1340)

Status:
- Resolved by adding `aria-pressed` semantics to the three mode buttons.
- Tests now assert state via accessibility attributes instead of CSS weight.

### FIXED-002: Collapse/expand control is now keyboard accessible

- Area: WAF-35
- Evidence: [src/App.jsx](/Users/vadim/Projects/mcp/azure-diagram-builder/src/App.jsx:1438)

Status:
- Resolved by replacing the SVG-only click target with a real button in a `foreignObject`.
- The control now exposes readable names like `Collapse group <name>` / `Expand group <name>`.

### FIXED-003: Component drill-in dialog now supports focus and Escape dismissal

- Area: WAF-33
- Evidence: [src/App.jsx](/Users/vadim/Projects/mcp/azure-diagram-builder/src/App.jsx:1622)

Status:
- Resolved by focusing the close button when the dialog opens.
- Added `Escape` handling and focus restore to the previously focused control.

## Residual QA Risks

### RISK-001: External-to-internal connection is still not validated end-to-end through UI

- Area: WAF-34
- Evidence: [tests/phase4-c4model.spec.js](/Users/vadim/Projects/mcp/azure-diagram-builder/tests/phase4-c4model.spec.js:781)

Current state:
- Coverage proves rendering of a preloaded connection.
- Coverage does not yet prove the full user flow: enable edit mode, select source, press `Connect`, pick target, verify resulting edge.

### RISK-002: Component drill-in is not yet covered for tech-name click target or wrapped multi-line label edge cases

- Area: WAF-33
- Evidence: [src/App.jsx](/Users/vadim/Projects/mcp/azure-diagram-builder/src/App.jsx:1610)

Current state:
- Coverage now includes normal label click and node-body click.
- Coverage still does not explicitly validate wrapped labels or tech-name click targets.

### RISK-003: Several remaining assertions still depend on styling or SVG structure

- Area: WAF-30 / WAF-35
- Evidence: [tests/phase4-c4model.spec.js](/Users/vadim/Projects/mcp/azure-diagram-builder/tests/phase4-c4model.spec.js:147), [tests/phase4-c4model.spec.js](/Users/vadim/Projects/mcp/azure-diagram-builder/tests/phase4-c4model.spec.js:642), [tests/phase4-c4model.spec.js](/Users/vadim/Projects/mcp/azure-diagram-builder/tests/phase4-c4model.spec.js:1060)

Current state:
- Some assertions still inspect borders, raw SVG paths, or fill/stroke values.
- These are more brittle than behavior- or accessibility-driven checks.

### RISK-004: The Phase 4 spec still uses fixed sleeps in many places

- Area: Test stability
- Evidence: [tests/phase4-c4model.spec.js](/Users/vadim/Projects/mcp/azure-diagram-builder/tests/phase4-c4model.spec.js:22)

Current state:
- The hardened spec is better than before, but it still relies on `waitForTimeout()` in many flows.
- This increases flake risk and hides missing readiness conditions.

## Recommended Next Steps

1. Add one true end-to-end external-to-internal connection workflow test.
2. Add explicit drill-in coverage for wrapped labels and tech-name click targets.
3. Replace high-value `waitForTimeout()` calls with explicit state-based waits.
4. Reduce remaining SVG-style-coupled assertions where practical.
