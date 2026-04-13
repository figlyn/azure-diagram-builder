# Orthogonal Edge Routing — Design Document

**Project:** Azure Diagram Builder  
**Date:** 2026-04-13  
**Status:** Proposed  
**Replaces:** Bezier curve routing (`edgePath()` in App.jsx, lines 326–348)

---

## Problem Statement

The current edge routing uses cubic/quadratic Bezier curves that compute a smooth arc between node centers offset by a fixed radius (30px). This produces three failure modes:

1. **Curves pass through node icons.** The control points are derived from the midpoint between source and target, so for tightly spaced nodes the curve belly clips the icon rect (56×56px).
2. **Connections are impossible to trace.** When multiple Bezier curves overlap in the same region their paths merge visually — a user cannot tell which source connects to which target.
3. **No visual affordance for direction.** A smooth arc between two nodes at similar Y positions reads as decorative, not directional. The existing arrowhead marker (`#ah`, 12×9px polygon) is too small relative to the curve to communicate flow.

Orthogonal (Manhattan) routing solves all three: segments are axis-aligned, each bend is explicit, paths are easy to trace visually, and horizontal/vertical segments clearly show flow direction.

---

## Architecture Overview

The change is scoped to three functions and one SVG `<defs>` block, all inside `App.jsx`. No new files, no new dependencies.

| Component | Current | Proposed |
|-----------|---------|----------|
| `resolvePoint(id)` | Returns `{x, y, r}` (center + radius) | Returns `{x, y, w, h, ports}` (bounds + 4 cardinal ports) |
| `edgePath(a, b)` | Bezier `C` / `Q` commands | Orthogonal `M` / `H` / `V` / `Q` commands |
| `selectPorts(src, tgt)` | N/A (implicit from direction vector) | New function: picks best port pair |
| Edge `<g>` in render | Single `<path>` + hit area + label | Same structure, new path data |
| Arrow markers in `<defs>` | Unchanged | Unchanged (marker-end on last segment) |

---

## 1. Port Model

### 1.1 Port Positions

Every connectable element exposes four ports at the center of each side of its bounding box.

**Nodes** (bounding box: 56×56px centered on `(x, y)`):

```
                  TOP
              (x, y − 28)
                   │
       ┌───────────┼───────────┐
       │           │           │
LEFT ──┤       (x, y)         ├── RIGHT
(x−28,y)          │        (x+28,y)
       │           │           │
       └───────────┼───────────┘
                   │
               BOTTOM
              (x, y + 28)
```

```javascript
function nodePorts(node) {
  const hw = 28, hh = 28; // half-width, half-height of render rect
  return {
    top:    { x: node.x,       y: node.y - hh },
    right:  { x: node.x + hw,  y: node.y       },
    bottom: { x: node.x,       y: node.y + hh },
    left:   { x: node.x - hw,  y: node.y       },
  };
}
```

**Groups** (bounding box: `(g.x, g.y, g.w, g.h)`):

```javascript
function groupPorts(group) {
  const cx = group.x + group.w / 2;
  const cy = group.y + group.h / 2;
  return {
    top:    { x: cx,              y: group.y            },
    right:  { x: group.x + group.w, y: cy               },
    bottom: { x: cx,              y: group.y + group.h  },
    left:   { x: group.x,        y: cy                  },
  };
}
```

### 1.2 Unified `resolveAnchor(id)`

Replaces the existing `resolvePoint(id)`. Returns the full bounding box and all four ports.

```javascript
function resolveAnchor(id) {
  const nd = nodes.find(n => n.id === id);
  if (nd) {
    return {
      cx: nd.x, cy: nd.y,
      x: nd.x - 28, y: nd.y - 28, w: 56, h: 56,
      ports: nodePorts(nd),
    };
  }
  const g = groups.find(g => g.id === id);
  if (g) {
    return {
      cx: g.x + g.w / 2, cy: g.y + g.h / 2,
      x: g.x, y: g.y, w: g.w, h: g.h,
      ports: groupPorts(g),
    };
  }
  return null;
}
```

---

## 2. Port Selection Algorithm

### 2.1 Rules

Given a source anchor `S` and target anchor `T`, pick the port pair that produces the shortest orthogonal path without crossing through either bounding box.

**Primary rule — relative position of centers:**

| Condition | Source port | Target port |
|-----------|------------|-------------|
| Target center is right of source (dx > 0, abs(dx) ≥ abs(dy)) | RIGHT | LEFT |
| Target center is left of source (dx < 0, abs(dx) ≥ abs(dy)) | LEFT | RIGHT |
| Target center is below source (dy > 0, abs(dy) > abs(dx)) | BOTTOM | TOP |
| Target center is above source (dy < 0, abs(dy) > abs(dx)) | TOP | BOTTOM |

**Diagonal tie-breaking:** When `abs(dx)` and `abs(dy)` are within 20% of each other, prefer horizontal exit (RIGHT/LEFT) for left-to-right flow readability. The threshold is `abs(dx) >= abs(dy) * 0.8`.

### 2.2 Multi-edge conflict resolution

When two edges share the same source port, offset them by ±6px perpendicular to the exit direction to prevent overlap:

```
Port RIGHT, edge 0: exits at (x+28, y - 6)
Port RIGHT, edge 1: exits at (x+28, y + 6)
```

The offset index is derived from sorting all edges sharing that port by target Y position (ascending).

### 2.3 Implementation

```javascript
function selectPorts(srcAnchor, tgtAnchor) {
  const dx = tgtAnchor.cx - srcAnchor.cx;
  const dy = tgtAnchor.cy - srcAnchor.cy;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Horizontal preference with diagonal tie-breaking
  if (absDx >= absDy * 0.8) {
    if (dx >= 0) return { srcPort: 'right', tgtPort: 'left' };
    else         return { srcPort: 'left',  tgtPort: 'right' };
  } else {
    if (dy >= 0) return { srcPort: 'bottom', tgtPort: 'top' };
    else         return { srcPort: 'top',    tgtPort: 'bottom' };
  }
}
```

---

## 3. Path Generation Algorithm

### 3.1 Margin constant

```javascript
const MARGIN = 20; // clearance around node bounding boxes
const CORNER_RADIUS = 8; // rounded bend radius
```

### 3.2 Core `orthogonalPath(srcPort, tgtPort, srcPoint, tgtPoint)`

Three routing shapes depending on geometry:

#### Case A — Straight line (same axis)

If source and target ports are on the same axis and aligned:
- RIGHT→LEFT with `srcPoint.y === tgtPoint.y`: horizontal line
- BOTTOM→TOP with `srcPoint.x === tgtPoint.x`: vertical line

```
M srcX,srcY H tgtX        (horizontal)
M srcX,srcY V tgtY        (vertical)
```

#### Case B — L-shape (one bend)

The most common case. Exit source port direction, travel, make one 90° turn, enter target port direction.

**Example: RIGHT→LEFT (target is right and slightly below)**

```
src exits RIGHT at (280, 200)
tgt enters LEFT at  (450, 300)

midX = (280 + 450) / 2 = 365

Path:
  M 280,200           ← start at source port
  H 357               ← travel right to (midX − cornerRadius)
  Q 365,200 365,208   ← rounded corner: quadratic curve
  V 300               ← travel down to target Y
  → but wait, need second bend to enter target from LEFT

This is actually a Z-shape. True L-shape:
  src exits RIGHT at (280, 200)
  tgt enters TOP at  (450, 300)

  M 280,200
  H 442              ← travel right to (tgt.x − cornerRadius)
  Q 450,200 450,208  ← rounded corner
  V 300              ← travel down into target port
```

#### Case C — Z-shape (two bends)

When source and target ports are on parallel axes (both horizontal or both vertical).

**Example: RIGHT→LEFT routing**

```
src exits RIGHT at (280, 200)
tgt enters LEFT at  (450, 350)

midX = (280 + 450) / 2 = 365
r = 8 (corner radius)

Path:
  M 280,200                       ← start
  H (365 − r)                     ← horizontal to first bend
  Q 365,200  365,(200 + r)        ← first rounded corner (turn down)
  V (350 − r)                     ← vertical segment
  Q 365,350  (365 + r),350        ← second rounded corner (turn right)
  H 450                           ← horizontal into target port
```

**Example: BOTTOM→TOP routing**

```
src exits BOTTOM at (300, 228)
tgt enters TOP at   (500, 400)

midY = (228 + 400) / 2 = 314

Path:
  M 300,228
  V (314 − r)
  Q 300,314  (300 + r),314
  H (500 − r)
  Q 500,314  500,(314 + r)
  V 400
```

### 3.3 Backtrack handling

When the target is *behind* the source relative to the exit direction (e.g., source exits RIGHT but target is to the left), use a U-shape with three bends:

```
src exits RIGHT at (400, 200), tgt enters LEFT at (300, 350)

The target is to the LEFT of the source but ports say RIGHT→LEFT.
Re-select ports: since dx < 0, selectPorts would actually pick LEFT→RIGHT.
So this case is handled by port selection, not path generation.
```

If port selection is overridden (e.g., forced ports for aesthetic reasons), the path generator falls back to a 3-bend U-route:

```
M 400,200  H (400 + MARGIN)  V 350  H 300
```

With rounded corners at each bend.

### 3.4 Full implementation

```javascript
function orthogonalPath(srcPort, tgtPort, sp, tp) {
  const r = CORNER_RADIUS;
  const segments = [];

  // Start
  segments.push(`M ${sp.x},${sp.y}`);

  // Determine shape based on port pair
  const horizontal = (srcPort === 'right' || srcPort === 'left');
  const parallel = (
    (srcPort === 'right'  && tgtPort === 'left')  ||
    (srcPort === 'left'   && tgtPort === 'right') ||
    (srcPort === 'bottom' && tgtPort === 'top')   ||
    (srcPort === 'top'    && tgtPort === 'bottom')
  );

  if (parallel && horizontal) {
    // Z-shape horizontal: H → V → H
    const midX = (sp.x + tp.x) / 2;
    const dy = tp.y - sp.y;

    if (Math.abs(dy) < 1) {
      // Straight horizontal line
      segments.push(`H ${tp.x}`);
    } else {
      const signY = dy > 0 ? 1 : -1;
      segments.push(`H ${midX - r}`);
      segments.push(`Q ${midX},${sp.y} ${midX},${sp.y + signY * r}`);
      segments.push(`V ${tp.y - signY * r}`);
      segments.push(`Q ${midX},${tp.y} ${midX + (tp.x > sp.x ? r : -r)},${tp.y}`);
      segments.push(`H ${tp.x}`);
    }

  } else if (parallel && !horizontal) {
    // Z-shape vertical: V → H → V
    const midY = (sp.y + tp.y) / 2;
    const dx = tp.x - sp.x;

    if (Math.abs(dx) < 1) {
      // Straight vertical line
      segments.push(`V ${tp.y}`);
    } else {
      const signX = dx > 0 ? 1 : -1;
      segments.push(`V ${midY - r}`);
      segments.push(`Q ${sp.x},${midY} ${sp.x + signX * r},${midY}`);
      segments.push(`H ${tp.x - signX * r}`);
      segments.push(`Q ${tp.x},${midY} ${tp.x},${midY + (tp.y > sp.y ? r : -r)}`);
      segments.push(`V ${tp.y}`);
    }

  } else {
    // L-shape: perpendicular ports → one bend
    if (horizontal) {
      // Horizontal first, then vertical
      const signY = tp.y > sp.y ? 1 : -1;
      segments.push(`H ${tp.x - (horizontal ? 0 : r)}`);
      // Corner at (tp.x, sp.y)
      if (Math.abs(tp.y - sp.y) > r * 2) {
        segments.push(`H ${tp.x}`);
        segments.push(`Q ${tp.x},${sp.y} ${tp.x},${sp.y + signY * r}`);
        segments.push(`V ${tp.y}`);
      } else {
        segments.push(`H ${tp.x}`);
        segments.push(`V ${tp.y}`);
      }
    } else {
      // Vertical first, then horizontal
      const signX = tp.x > sp.x ? 1 : -1;
      if (Math.abs(tp.x - sp.x) > r * 2) {
        segments.push(`V ${tp.y}`);
        segments.push(`Q ${sp.x},${tp.y} ${sp.x + signX * r},${tp.y}`);
        segments.push(`H ${tp.x}`);
      } else {
        segments.push(`V ${tp.y}`);
        segments.push(`H ${tp.x}`);
      }
    }
  }

  return segments.join(' ');
}
```

---

## 4. Obstacle Avoidance (v1 — Minimal)

Full obstacle avoidance (A*, visibility graph) is deferred. The v1 strategy:

1. **Source/target clearance.** The path starts/ends at the bounding box border (port), so it never crosses through its own source or target node.
2. **Midpoint offset.** For Z-shape routes, the midpoint of the bridging segment (`midX` or `midY`) is placed halfway between source and target. If this midpoint falls inside any other node's bounding box (inflated by `MARGIN`), shift it to `node.boundingBox.edge + MARGIN` on the nearer side.

```javascript
function adjustMidpoint(mid, axis, allNodes, srcId, tgtId) {
  for (const nd of allNodes) {
    if (nd.id === srcId || nd.id === tgtId) continue;
    const box = { x: nd.x - 28 - MARGIN, y: nd.y - 28 - MARGIN,
                  w: 56 + MARGIN * 2, h: 56 + MARGIN * 2 };
    if (axis === 'x' && mid >= box.x && mid <= box.x + box.w) {
      // Push midpoint to left or right of box
      const toLeft  = Math.abs(mid - box.x);
      const toRight = Math.abs(mid - (box.x + box.w));
      return toLeft < toRight ? box.x - 1 : box.x + box.w + 1;
    }
    if (axis === 'y' && mid >= box.y && mid <= box.y + box.h) {
      const toTop    = Math.abs(mid - box.y);
      const toBottom = Math.abs(mid - (box.y + box.h));
      return toTop < toBottom ? box.y - 1 : box.y + box.h + 1;
    }
  }
  return mid; // no collision
}
```

---

## 5. Visual Design Specification

### 5.1 Edge stroke

| Property | Default | Selected |
|----------|---------|----------|
| `stroke-width` | 2 | 3.5 |
| `stroke` | Theme `normalColor` (current: `#64748b`) | `#3b82f6` |
| `opacity` | 0.7 | 1.0 |
| `stroke-dasharray` | `none` (solid) or `6 3` (dashed) | Same |

### 5.2 Rounded corners

Each 90° bend uses a quadratic Bezier (`Q`) with radius 8px. The corner is inscribed in the bend:

```
    ─────╮
         │       ← smooth 8px radius
         │
```

SVG: `H (bendX - 8) Q bendX,bendY bendX,(bendY ± 8)`

### 5.3 Arrowhead

Reuse existing `<marker id="ah">` definition (12×9px polygon). The `marker-end` attribute on the final path segment ensures the arrowhead appears at the target port and auto-orients to the segment direction.

Since the final segment is always axis-aligned (horizontal or vertical), the arrowhead will point cleanly in one of the four cardinal directions.

### 5.4 Edge labels

Labels are placed at the midpoint of the **longest segment** in the path.

```javascript
function labelPosition(segments) {
  // Parse segments into coordinate pairs
  // Find the longest segment (by pixel length)
  // Return the midpoint of that segment
  // For horizontal segments: label centered above (y - 12)
  // For vertical segments: label centered to the right (x + 12)
}
```

Label rendering remains unchanged: rounded rect background with text, Consolas 10px bold.

### 5.5 Hit area

A transparent `<path>` with `stroke-width="14"` overlaid on the visible path, identical to current implementation. Because orthogonal paths have axis-aligned segments, the 14px hit area covers ±7px on each side — more forgiving than Bezier hit testing.

---

## 6. Interaction Design

### 6.1 Edge selection

No change to the interaction model. Clicking the 14px hit-area `<path>` triggers `onClick` on the edge `<g>`. Selected state applies the blue highlight and thicker stroke.

### 6.2 Edge creation

No change. The existing `connectFrom` state and drag interaction remain. The only difference: during drag-to-connect, the preview path uses `orthogonalPath()` instead of `edgePath()` to show a live preview of the orthogonal route.

### 6.3 Hover preview (future)

Deferred. Possible enhancement: highlight the port circles on hover when in connect mode.

---

## 7. Migration Plan

### Step 1 — Add new functions (non-breaking)

Add `resolveAnchor()`, `selectPorts()`, `orthogonalPath()`, `adjustMidpoint()`, and `labelPosition()` below the existing `edgePath()` function in App.jsx.

### Step 2 — Replace `edgePath()` call site

In the edge rendering loop (line ~636), replace:

```javascript
// Before
const a = resolvePoint(edge.from), b = resolvePoint(edge.to);
const p = edgePath(a, b);

// After
const srcA = resolveAnchor(edge.from), tgtA = resolveAnchor(edge.to);
if (!srcA || !tgtA) return null;
const { srcPort, tgtPort } = selectPorts(srcA, tgtA);
const sp = srcA.ports[srcPort], tp = tgtA.ports[tgtPort];
const p = orthogonalPath(srcPort, tgtPort, sp, tp);
```

### Step 3 — Update label midpoint calculation

Replace the current `mx, my` midpoint (average of source/target centers) with the output of `labelPosition()` applied to the generated path segments.

### Step 4 — Remove `edgePath()` and `resolvePoint()`

Delete the old functions after verifying all edges render correctly.

---

## 8. Edge Cases and Constraints

| Scenario | Handling |
|----------|----------|
| Source and target are the same node | Skip rendering (return empty path) |
| Nodes overlap (zero or negative gap) | Fall back to straight line between centers |
| Node inside a group connecting to group border | Group port is at group bounding box edge; node port at node edge — standard Z-shape |
| Very small gap (< 2 × CORNER_RADIUS) | Reduce corner radius to `gap / 2` to prevent overshoot |
| Multiple edges between same two nodes | Future: offset parallel edges by 8px. v1: they overlap (same as current) |
| Zoom level extremes | Stroke width and corner radius scale with SVG transform (no compensation needed) |

---

## Test Cases

### TC-EDGE-1: Horizontal connection (same row)

**Precondition:** Two nodes at the same Y coordinate, Node A at (200, 300), Node B at (500, 300).

**Steps:**
1. Create an edge from Node A to Node B.
2. Inspect the generated SVG path.

**Expected Result:**
- Path is `M 228,300 H 472` (source RIGHT port to target LEFT port, straight horizontal line).
- No bends or vertical segments present in the path.
- Arrow starts at Node A right border (x = 228) and ends at Node B left border (x = 472).

**Acceptance Criteria:**
- Path contains only `M` and `H` commands.
- The Y coordinate is constant across the entire path.
- Arrowhead points rightward at the target.
- Hit area covers the full horizontal segment.

---

### TC-EDGE-2: Vertical connection (same column)

**Precondition:** Two nodes at the same X coordinate, Node A at (300, 150), Node B at (300, 450).

**Steps:**
1. Create an edge from Node A to Node B.
2. Inspect the generated SVG path.

**Expected Result:**
- Path is `M 300,178 V 422` (source BOTTOM port to target TOP port, straight vertical line).
- No bends or horizontal segments present.

**Acceptance Criteria:**
- Path contains only `M` and `V` commands.
- The X coordinate is constant across the entire path.
- Arrowhead points downward at the target.

---

### TC-EDGE-3: L-shape right-then-down

**Precondition:** Node A at (200, 200), Node B at (500, 450). Target is to the right and below. Since horizontal distance (300) exceeds vertical distance (250) × 0.8 = 200, port selection picks RIGHT→LEFT.

**Steps:**
1. Create an edge from Node A to Node B.
2. Verify the path shape.

**Expected Result:**
- Path exits Node A from the RIGHT port (228, 200).
- Path enters Node B from the LEFT port (472, 450).
- Path follows a Z-shape: horizontal → rounded corner → vertical → rounded corner → horizontal.
- The midpoint horizontal segment is at x = 350 (midpoint between 228 and 472).

**Acceptance Criteria:**
- Path contains `M`, `H`, `Q`, `V`, `Q`, `H` commands in sequence.
- Both rounded corners use radius 8px.
- No path segment crosses through Node A or Node B bounding boxes.

---

### TC-EDGE-4: L-shape right-then-up

**Precondition:** Node A at (200, 450), Node B at (500, 200). Target is to the right and above.

**Steps:**
1. Create an edge from Node A to Node B.
2. Verify the path shape.

**Expected Result:**
- Path exits Node A from the RIGHT port (228, 450).
- Path enters Node B from the LEFT port (472, 200).
- Z-shape: horizontal right → corner up → vertical upward → corner right → horizontal into target.
- Vertical segment travels upward (decreasing Y).

**Acceptance Criteria:**
- Path contains `M`, `H`, `Q`, `V`, `Q`, `H` commands.
- Vertical segment Y values decrease from source Y to target Y.
- Arrowhead points leftward (into Node B's LEFT port).

---

### TC-EDGE-5: Z-shape with two bends

**Precondition:** Node A at (200, 200), Node B at (600, 500). Significant horizontal and vertical distance.

**Steps:**
1. Create an edge from Node A to Node B.
2. Count the number of 90° bends in the path.

**Expected Result:**
- Port selection: RIGHT → LEFT (dx = 400 > dy = 300 × 0.8 = 240).
- Path: `M 228,200 H 392 Q 400,200 400,208 V 492 Q 400,500 408,500 H 572`.
- Two rounded bends: one at (400, 200) turning downward, one at (400, 500) turning rightward.

**Acceptance Criteria:**
- Exactly two `Q` commands in the path (one per bend).
- The bridging vertical segment spans from source Y to target Y.
- Total path length is approximately `|dx| + |dy|` (Manhattan distance from port to port).

---

### TC-EDGE-6: Connection between groups (port at group border)

**Precondition:** Group A with bounds (100, 100, 300, 200) — i.e., left=100, top=100, width=300, height=200. Group B with bounds (600, 150, 250, 180). Edge connects Group A to Group B.

**Steps:**
1. Create an edge from Group A to Group B.
2. Verify port positions are on group borders.

**Expected Result:**
- Group A RIGHT port: (400, 200) — right edge of group, vertical center.
- Group B LEFT port: (600, 240) — left edge of group, vertical center.
- Path connects these two ports with a Z-shape or straight horizontal (depending on Y difference).

**Acceptance Criteria:**
- Source port x-coordinate equals `group.x + group.w` (right border).
- Target port x-coordinate equals `group.x` (left border).
- Path does not enter either group's bounding box interior.

---

### TC-EDGE-7: Arrow direction (arrowhead at target)

**Precondition:** Edges in all four cardinal directions: right, left, up, down.

**Steps:**
1. Create four edges: A→B (right), B→A (left), C→D (down), D→C (up).
2. Inspect arrowhead orientation for each edge.

**Expected Result:**
- Right edge: arrowhead points right (→) at target LEFT port.
- Left edge: arrowhead points left (←) at target RIGHT port.
- Down edge: arrowhead points down (↓) at target TOP port.
- Up edge: arrowhead points up (↑) at target BOTTOM port.

**Acceptance Criteria:**
- `marker-end` is set on every edge path.
- `marker-start` is never set (no arrowhead at source).
- The SVG `orient="auto"` on the marker definition ensures correct rotation for axis-aligned segments.
- Arrowhead is flush with the target node border (no gap, no overlap).

---

### TC-EDGE-8: Edge label placement on longest segment

**Precondition:** Edge with label "HTTPS/443" connecting Node A at (200, 200) to Node B at (600, 200). Straight horizontal path.

**Steps:**
1. Create a labeled edge.
2. Verify label position.

**Expected Result:**
- The longest (and only) segment is horizontal, length ≈ 344px.
- Label is centered on this segment: x = (228 + 572) / 2 = 400, y = 200 − 12 = 188 (above the line).
- Label background rect is positioned correctly around the text.

**Steps for Z-shape:**
1. Change Node B to (600, 500).
2. Vertical segment (length ≈ 292px) is now the longest.
3. Label should appear centered on the vertical segment: x = midX + 12, y = (200 + 500) / 2 = 350.

**Acceptance Criteria:**
- Label always appears on the single longest segment of the path.
- For horizontal segments: label is centered horizontally, offset 12px above.
- For vertical segments: label is centered vertically, offset 12px to the right.
- Label background rect does not overlap with nodes.

---

### TC-EDGE-9: Rounded corners at bends

**Precondition:** Z-shape edge with two bends. Corner radius = 8px.

**Steps:**
1. Create an edge that produces a Z-shape path.
2. Parse the SVG path and inspect `Q` commands.

**Expected Result:**
- Each bend is a quadratic Bezier `Q` command.
- The control point of `Q` is at the exact corner coordinate.
- The start of `Q` is 8px before the corner (on the incoming segment).
- The end of `Q` is 8px after the corner (on the outgoing segment).

**Example:** Corner at (400, 200) turning from horizontal to downward:
- Incoming: `H 392` (stop 8px before corner).
- Corner: `Q 400,200 400,208` (quadratic through corner point, end 8px into vertical).
- Outgoing: `V ...` continues downward.

**Acceptance Criteria:**
- Every 90° bend in the path uses a `Q` command (not a sharp `H` then `V` transition).
- The distance from the Q start/end to the control point equals `CORNER_RADIUS` (8px).
- Corners render as visually smooth curves (no sharp angles) at all zoom levels.
- When two nodes are very close (gap < 16px), the corner radius reduces to `gap / 2` to prevent path overshoot.

---

### TC-EDGE-10: Click to select any segment

**Precondition:** Z-shape edge with three segments (H, V, H).

**Steps:**
1. Render the edge.
2. Click on the first horizontal segment.
3. Verify edge is selected.
4. Deselect. Click on the vertical segment.
5. Verify edge is selected.
6. Deselect. Click on the second horizontal segment.
7. Verify edge is selected.
8. Click 20px away from any segment.
9. Verify edge is not selected.

**Expected Result:**
- Clicking anywhere on the transparent hit-area path (14px wide) selects the edge.
- Selection applies to the entire edge (all segments highlight), not just the clicked segment.
- Clicking outside the hit area does not select the edge.

**Acceptance Criteria:**
- Hit area `<path>` has `stroke-width="14"` and `stroke="transparent"`.
- Hit area path exactly matches the visible path (same `d` attribute).
- `onClick` on the hit area sets `sel` state to the edge ID.
- Selected edge shows `stroke="#3b82f6"`, `stroke-width="3.5"`, `opacity="1"`.
- Deselection occurs when clicking canvas or another element.

---

### TC-EDGE-11: Dashed style on orthogonal edge

**Precondition:** Edge with `style: "dashed"` between two nodes.

**Steps:**
1. Create a dashed edge.
2. Verify the dash pattern renders on orthogonal segments.

**Expected Result:**
- The `stroke-dasharray="6 3"` attribute is applied to the visible `<path>`.
- Dashes are visible on all segments (horizontal and vertical).
- Dashes flow continuously across bends (no reset at corners).
- Hit area path does NOT have dash styling (remains transparent solid).

**Acceptance Criteria:**
- `stroke-dasharray` is `"6 3"` for dashed edges, `"none"` for solid.
- Dashes are consistent length regardless of segment direction.
- Selected dashed edge retains dash pattern but uses selected color and width.

---

### TC-EDGE-12: Multiple edges from same node (different ports)

**Precondition:** Node A at (300, 300) with three outgoing edges: to Node B (right, at 600,300), to Node C (below, at 300,600), to Node D (upper-right, at 600,100).

**Steps:**
1. Create edges A→B, A→C, A→D.
2. Verify each edge uses a different source port.

**Expected Result:**
- A→B: exits RIGHT port (328, 300) → enters B LEFT port. Straight horizontal.
- A→C: exits BOTTOM port (300, 328) → enters C TOP port. Straight vertical.
- A→D: exits RIGHT port (328, 300) → enters D LEFT port (572, 100). Z-shape horizontal then up.
  - Note: A→B and A→D share the RIGHT port. Multi-edge offset applies: A→B at (328, 294), A→D at (328, 306).

**Acceptance Criteria:**
- Port selection uses the correct port for each target direction.
- No two edges from the same node exit from the exact same pixel coordinate (offset applied when ports conflict).
- All three edges are independently selectable.
- No edge path crosses through Node A's bounding box.
- Arrowheads appear at the correct target port for each edge.

---

## Appendix A: SVG Path Command Reference

| Command | Meaning | Example |
|---------|---------|---------|
| `M x,y` | Move to (start point) | `M 228,200` |
| `H x` | Horizontal line to x | `H 400` |
| `V y` | Vertical line to y | `V 350` |
| `Q cx,cy ex,ey` | Quadratic Bezier (one control point) | `Q 400,200 400,208` |

## Appendix B: Color Tokens

| Token | Light theme | Dark theme |
|-------|-------------|------------|
| `normalColor` | `#64748b` | `#64748b` |
| `selectedColor` | `#3b82f6` | `#3b82f6` |
| `surfaceColor` | `#1e293b` | `#1e293b` |
| `textColor` | `#e2e8f0` | `#e2e8f0` |

## Appendix C: Dimension Constants

| Constant | Value | Usage |
|----------|-------|-------|
| `nodeW` / `nodeH` | 56px | Node render rect |
| `MARGIN` | 20px | Obstacle clearance |
| `CORNER_RADIUS` | 8px | Bend smoothing |
| `HIT_AREA_WIDTH` | 14px | Click target stroke |
| `LABEL_OFFSET` | 12px | Label distance from segment |
| `PORT_MULTI_OFFSET` | 6px | Spacing for shared ports |
