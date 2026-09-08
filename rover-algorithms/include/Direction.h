#pragma once

// The four cardinal moves a rover can make on the grid.
// Grid convention: x increases to the RIGHT, y increases DOWNWARD (row-major,
// row 0 at the top) — matches how printAscii() draws the room.
enum class Direction { NONE, UP, DOWN, LEFT, RIGHT };

// Translate a direction into a (dx, dy) offset.
inline void directionDelta(Direction dir, int& dx, int& dy) {
    dx = 0;
    dy = 0;
    switch (dir) {
        case Direction::UP:    dy = -1; break;
        case Direction::DOWN:  dy = 1;  break;
        case Direction::LEFT:  dx = -1; break;
        case Direction::RIGHT: dx = 1;  break;
        case Direction::NONE:  break;
    }
}

inline Direction oppositeDirection(Direction dir) {
    switch (dir) {
        case Direction::UP:    return Direction::DOWN;
        case Direction::DOWN:  return Direction::UP;
        case Direction::LEFT:  return Direction::RIGHT;
        case Direction::RIGHT: return Direction::LEFT;
        default:                return Direction::NONE;
    }
}

// 90-degree turns, used by the wall-following hybrid to "hug" an obstacle.
inline Direction turnRight(Direction dir) {
    switch (dir) {
        case Direction::UP:    return Direction::RIGHT;
        case Direction::RIGHT: return Direction::DOWN;
        case Direction::DOWN:  return Direction::LEFT;
        case Direction::LEFT:  return Direction::UP;
        default:                return Direction::NONE;
    }
}

inline Direction turnLeft(Direction dir) {
    switch (dir) {
        case Direction::UP:    return Direction::LEFT;
        case Direction::LEFT:  return Direction::DOWN;
        case Direction::DOWN:  return Direction::RIGHT;
        case Direction::RIGHT: return Direction::UP;
        default:                return Direction::NONE;
    }
}

inline const char* directionName(Direction dir) {
    switch (dir) {
        case Direction::UP:    return "UP";
        case Direction::DOWN:  return "DOWN";
        case Direction::LEFT:  return "LEFT";
        case Direction::RIGHT: return "RIGHT";
        default:                return "NONE";
    }
}
