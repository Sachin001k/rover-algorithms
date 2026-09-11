# Robot Vacuum Simulator - Web Version

Interactive web-based simulator with live visualization and algorithm comparison.

## Phase 1: Core UI & Grid ✅

- [x] HTML layout (sidebar + canvas + dashboard)
- [x] Responsive CSS styling
- [x] Canvas grid rendering
- [x] Interactive obstacle placement (click to toggle)
- [x] Rover start position (right-click)
- [x] Room presets (Chessboard, Corridors, Random)
- [x] Room size selection (20×20 to 60×60)
- [x] Complexity levels (Simple, Moderate, Complex)
- [x] Obstacle density slider
- [x] Live coordinate display on hover
- [x] Sidebar with controls and metrics display

## Usage

### Opening the Simulator

Simply open `index.html` in a web browser:

```bash
# macOS
open index.html

# Linux
firefox index.html

# Or just double-click the file
```

### Features

#### Canvas Grid (Left Side)
- **Click** on cells to toggle obstacles
- **Right-click** to set rover start position
- **Hover** to see coordinates

#### Room Settings (Sidebar)
- **Size**: Choose grid dimensions (20×20 to 60×60)
- **Complexity**: Simple / Moderate / Complex / Custom
- **Density**: Adjust obstacle percentage (0-100%)
- **Seed**: Reproducible random generation
- **Presets**: Chessboard, Corridors, Random patterns
- **Generate**: Create new room with settings
- **Clear**: Remove all obstacles

#### Algorithm Selection
- **ZigZag**: Simple sweep pattern
- **ZigZag + WallFollow**: Hugs obstacles when stuck
- **RandomWalk**: Straight until blocked, then random turn
- **ZigZag + RandomEscape**: Short random walk when stuck

#### Simulation Control (When Phase 2 Ready)
- **Speed**: 1-120 steps per second
- **Start**: Begin simulation
- **Pause**: Pause running simulation
- **Reset**: Stop and clear metrics

#### Live Metrics (Sidebar)
- **Step**: Current step count
- **Coordinates**: Rover position (X, Y)
- **Direction**: Current facing direction
- **Coverage**: % of accessible cells cleaned
- **Revisits**: Count of revisited cells
- **Turns**: Number of direction changes
- **Time**: Elapsed time
- **Progress Bar**: Visual coverage indicator

## Architecture

```
web-simulator/
├── index.html              Main page structure
├── css/
│   └── style.css          Layout & styling (responsive)
├── js/
│   ├── grid-ui.js         Canvas rendering & interaction
│   ├── room-editor.js     Room generation & patterns
│   └── main.js            App initialization & events
└── README.md              This file
```

### Class Breakdown

**GridUI** — Canvas rendering engine
- Renders grid, obstacles, cleaned cells, rover
- Handles mouse clicks for obstacle placement
- Tracks rover position and direction
- Provides utility methods (mark cleaned, check bounds, etc.)

**RoomEditor** — Room generation
- Random room generation with seeded RNG
- Preset patterns (chessboard, corridors)
- Complexity-based generation

**RobotVacuumSimulator** — Main application
- Initializes all components
- Wires up UI event listeners
- Manages simulation state
- Updates metrics display

## Next Steps (Phase 2)

- [ ] Port C++ algorithms to JavaScript
- [ ] Implement simulation loop
- [ ] Add rover animation
- [ ] Real-time metrics updates
- [ ] Comparison mode (run all 4 algorithms)
- [ ] Performance dashboard

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ⚠️ Touch support coming in Phase 2

## Performance Notes

- Smooth 60fps rendering on modern browsers
- Canvas scales automatically for different grid sizes
- No external dependencies (pure HTML/CSS/JavaScript)
- Works entirely offline (no server required)
