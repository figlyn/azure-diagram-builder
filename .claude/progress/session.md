# Session State

> **To Resume:** Say "resume session" and I'll read this file to restore context.

## Current Feature

**Feature:** Edge Routing Improvements - Separation & Labels
**Phase:** COMPLETED
**Completed:** 2026-04-18

## Summary

Fixed edge overlapping from collapsed groups and improved label positioning on overlapping edges.

## Changes Made

### 1. Edge Separation Improvements (`src/App.jsx:~1765-1898`)
- Added `channelOffset` parameter to `createOrthogonalPoints()`
- Increased edge spacing from 14px to 20px
- Increased exitDist stagger from `25 + i*12` to `30 + i*15`
- Added channelOffset of `(i - center) * 18` for intermediate segments
- Edges from same port now use different vertical/horizontal channels

### 2. Label Positioning Fix (`src/App.jsx:~3005-3020`)
- Labels now placed on longest segment, not array midpoint
- Smart Y offset based on segment orientation (horizontal vs vertical)
- Prevents labels from being placed at corners

### 3. New Demo Topologies (`src/App.jsx:~78-205`)
- Replaced 8 demos with 6 cleaner ones:
  - Contoso Hub-Spoke Network
  - Northwind N-Tier Web App
  - Tailwind Event Processing
  - Woodgrove Zero-Trust
  - Adventure Data Platform
  - Litware Global DR

## Test Results

```
223 passed, 0 failed
```

All edge routing tests pass including:
- edges do not visually overlap at exit point
- converging edges maintain separate visual paths
- crossing edges maintain separate paths

## Deployment

- Staging: https://staging.nwgrm.org (deployed 2026-04-18)
- Production: https://azure.nwgrm.org (pending)

## Files Modified

| File | Changes |
|------|---------|
| `src/App.jsx` | Edge routing, label positioning, new demos |
| `tests/layout-rerouting.spec.js` | Fixed toast message assertion |
| `tests/intelligent-layout.spec.js` | Fixed toast message assertion |

---

## Previous Feature (Completed)

**Feature:** Intelligent Layout Selection
**Status:** Complete - Deployed to staging

---

## Last Updated

2026-04-18
