# Bug Fix Report

## Issue 1: ZigZag Gets Stuck in Loop at Bottom Rows ❌

### Root Cause
The ZigZag algorithm completes its boustrophedon (zigzag) pattern but when it reaches the bottom rows with obstacles, the `pickFallbackMove()` function uses a "recent cells" history that may prevent forward progress. The rover oscillates between cleaned cells without escaping.

### Location
- `src/ZigZagAlgorithm.cpp:56-90` (`getNextMove()`)
- `src/ZigZagAlgorithm.cpp:25-54` (`pickFallbackMove()`)

### Solution
Replace the "recent history" approach with a **stagnation detector** that counts consecutive steps without cleaning new cells, similar to the hybrid algorithms. Once stagnant, allow moves to revisit cells to break the oscillation.

---

## Issue 2: Obstacles Block Critical Paths ❌

### Root Cause
The `RoomGenerator` doesn't guarantee connectivity between start (0,0) and end (n-1,m-1). It:
1. Places random rectangular obstacles
2. Seals unreachable pockets from start position
3. BUT doesn't ensure a complete path exists through the room

This causes situations where the room appears "open" but critical passages are completely blocked by obstacles.

### Location
- `src/RoomGenerator.cpp:56-92` (`placeObstacles()`)
- `src/RoomGenerator.cpp:15-54` (`generateRoom()`)

### Solution
Add **connectivity validation** that ensures:
1. There's always an accessible path from (0,0) to all corners
2. Maximum obstacle density that guarantees corridor width ≥ 2 cells
3. Force rejection of layouts where bottom/right regions are sealed off

---

## Issue 3: ZigZag and ZigZagRandom Give Identical Output ❌

### Root Cause
The `ZigZagRandomEscapeHybrid` in web-simulator only triggers escape mode when `zigzag.getNextMove()` returns 0 (NONE). But ZigZag's `pickFallbackMove()` always returns *some* move via the 4-tier fallback strategy, so escape is never activated.

**Key problem line (web-simulator/js/algorithms.js:309-317):**
```javascript
const zigMove = this.zigzag.getNextMove(grid, rover);
if (zigMove !== 0) {
    return zigMove;  // ← Always takes zigzag path, escape never triggers
}
```

### Location
- `web-simulator/js/algorithms.js:272-355` (ZigZagRandomEscapeHybrid)
- `web-simulator/js/algorithms.js:70-138` (ZigZagAlgorithm)

### Solution
Trigger escape mode based on **stagnation** (steps without progress) instead of just when zigzag returns NONE. This matches the C++ behavior.

---

## Implementation Plan

### Fix #1: ZigZag Stagnation Detection
```cpp
// Add to ZigZagAlgorithm.h:
private:
    int lastCleanedCount_ = -1;
    int stepsSinceProgress_ = 0;
    int stagnationThreshold_ = 0;

// In reset():
lastCleanedCount_ = -1;
stepsSinceProgress_ = 0;
stagnationThreshold_ = 2 * (grid.getWidth() + grid.getHeight());

// In getNextMove():
int cleaned = grid.countCleanedCells();
if (cleaned > lastCleanedCount_) {
    stepsSinceProgress_ = 0;
} else {
    stepsSinceProgress_++;
}
lastCleanedCount_ = cleaned;

// When stagnant:
if (stepsSinceProgress_ >= stagnationThreshold_) {
    return pickFallbackMove(grid, rover);  // Allow revisits to escape
}
```

### Fix #2: Guaranteed Path in Room Generation
```cpp
// Add to RoomGenerator.cpp:
bool RoomGenerator::hasPath(const Grid& grid, int x1, int y1, int x2, int y2) {
    // BFS from (x1,y1) to (x2,y2)
    // Return true if path exists
}

// In generateRoom():
// After sealUnreachablePockets(), verify:
if (!hasPath(grid, startX, startY, width-1, height-1)) {
    continue;  // Retry with new layout
}

// Reduce max density:
case ComplexityLevel::SIMPLE:   return 0.05;   // was 0.06
case ComplexityLevel::MODERATE: return 0.12;   // was 0.15
case ComplexityLevel::COMPLEX:  return 0.20;   // was 0.28
```

### Fix #3: Web Simulator Random Escape Stagnation
```javascript
// In ZigZagRandomEscapeHybrid:
getNextMove(grid, rover) {
    // Track progress like C++ version
    this.cleanedCount = this.countCleanedCells(grid);
    if (this.cleanedCount > this.lastCleanedCount) {
        this.stepsSinceProgress = 0;
    } else {
        this.stepsSinceProgress++;
    }
    this.lastCleanedCount = this.cleanedCount;
    
    // Trigger escape on stagnation, not just when zigzag fails
    const stagnationThreshold = 2 * (grid.width + grid.height);
    if (this.stepsSinceProgress >= stagnationThreshold) {
        this.inEscapeMode = true;
    }
    
    // Rest of logic...
}
```

---

## Testing Strategy

After fixes:

1. **ZigZag stagnation test:**
   - Run ZigZag on 40×40 complex room
   - Should complete cleanable area (not get stuck)
   - Should show progress in metrics

2. **Path connectivity test:**
   - Generate 100 random rooms
   - Run simple BFS from start to (width-1, height-1)
   - All should succeed

3. **Algorithm differentiation test:**
   - Run ZigZag on same room (should be deterministic)
   - Run ZigZagRandom 5 times (should vary)
   - They should produce different coverage/step patterns

---

## Severity & Impact

| Issue | Severity | Impact |
|-------|----------|--------|
| ZigZag loop | **HIGH** | Algorithm appears broken; gets 0% coverage on some rooms |
| Obstacle paths | **HIGH** | Skews all metrics; some rooms impossible to clean |
| Identical outputs | **MEDIUM** | Hybrid algorithm doesn't test; research comparison invalid |

---

## Files to Modify

1. `include/ZigZagAlgorithm.h` — Add stagnation tracking
2. `src/ZigZagAlgorithm.cpp` — Implement stagnation detector
3. `src/RoomGenerator.cpp` — Add path validation, reduce max density
4. `web-simulator/js/algorithms.js` — Fix escape trigger logic

