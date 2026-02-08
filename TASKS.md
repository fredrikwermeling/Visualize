# Development Tasks for Visualize

## Phase 1: Core Functionality (Priority)

### Completed ✅
- [x] Project structure setup
- [x] HTML layout with all sections
- [x] CSS styling with responsive design
- [x] Table.js - Data input management
- [x] Stats.js - Statistical calculations

### Next Up - Graph Rendering 🎯

#### Task 1: Create graph.js - Basic Column Graph
**Priority: CRITICAL**
Create `js/graph.js` with a GraphRenderer class that:
- Takes data from DataTable
- Creates SVG using D3.js
- Implements "Column: Points with Mean" graph type
- Shows individual data points (circles)
- Shows mean as a horizontal line or bar
- Includes proper axes with labels
- Responsive to dimension controls

**Acceptance criteria:**
- Data points visible as circles
- Mean calculated and displayed
- Axes show correct labels from controls
- Graph updates when data changes

#### Task 2: Create app.js - Application Controller
**Priority: CRITICAL**
Create `js/app.js` to coordinate all modules:
- Initialize DataTable instance
- Initialize GraphRenderer instance
- Wire up all event listeners
- Handle graph type changes
- Handle customization changes (title, font, dimensions)
- Coordinate data flow between components

**Acceptance criteria:**
- All controls work
- Graph updates in real-time
- Sample data can be loaded
- No console errors

#### Task 3: Create export.js - Export Functionality
**Priority: HIGH**
Create `js/export.js` with ExportHandler class:
- Export graph as PNG (using html2canvas)
- Export graph as SVG (using native D3.js)
- Maintain exact appearance from screen
- Handle file download

**Acceptance criteria:**
- PNG export works with correct dimensions
- SVG export preserves all styling
- Files download with appropriate names
- Image quality is publication-ready

### Phase 2: Enhanced Graph Types

#### Task 4: Column Graph Variants
Add to graph.js:
- "Column: Points with Median" 
- "Column: Bar with Mean ± SD"
- "Column: Bar with Mean ± SEM"

Each should:
- Show appropriate summary statistic
- Display error bars correctly
- Handle missing/empty data gracefully

#### Task 5: Box Plots
Add box plot rendering:
- Show quartiles (Q1, median, Q3)
- Show whiskers (1.5 × IQR)
- Show outliers as individual points
- Clean scientific graph style

#### Task 6: Violin Plots
Add violin plot rendering:
- Show kernel density estimation
- Include median line
- Show quartile markers
- Overlay individual points

### Phase 3: Statistical Tests

#### Task 7: Wire Up Statistical Tests
Connect stats.js to UI:
- Run selected test when button clicked
- Display results in stats panel
- Show: test statistic, p-value, degrees of freedom
- Highlight significance level

#### Task 8: Visual Statistics Display
Add statistics to graph:
- Draw significance brackets between groups
- Add asterisks (*, **, ***)
- Position text appropriately
- Make it toggleable

### Phase 4: Advanced Customization

#### Task 9: Interactive Title Editing
Make titles directly editable on graph:
- Click to edit graph title
- Click to edit axis labels
- Changes reflect in control panel
- Font settings apply immediately

#### Task 10: Color Customization
Add color controls:
- Color picker for each data series
- Preset color schemes
- Export with correct colors

#### Task 11: Manual Annotations
Add drawing tools:
- Draw lines between groups
- Add text annotations
- Draw asterisks
- Select line thickness
- Position elements freely

### Phase 5: Data Management

#### Task 12: Data Import
Add import functionality:
- Paste from clipboard (Excel/CSV)
- Import CSV files
- Import Excel files
- Auto-detect columns

#### Task 13: Data Export
Add data export:
- Export to CSV
- Export to Excel
- Include summary statistics
- Include test results

#### Task 14: Save/Load Projects
Add project management:
- Save current project (JSON)
- Load saved projects
- Store in browser localStorage
- Export/import project files

## Testing Checklist

### Before Each Push
- [ ] Test all graph types render correctly
- [ ] Test with empty data
- [ ] Test with single data point
- [ ] Test with many columns (5+)
- [ ] Test statistical calculations accuracy
- [ ] Test export PNG quality
- [ ] Test export SVG validity
- [ ] Test responsive design (mobile/tablet)
- [ ] Check browser console for errors
- [ ] Test in Chrome, Firefox, Safari

### Regression Testing
- [ ] Data input still works
- [ ] Existing graph types unchanged
- [ ] Controls still responsive
- [ ] Statistics still accurate
- [ ] Export still functions

## Performance Considerations
- Debounce graph updates (wait 300ms after typing)
- Cache statistical calculations
- Optimize D3 rendering for large datasets
- Lazy load graph types

## Code Quality Standards
- Comment complex functions
- Use meaningful variable names
- Keep functions under 50 lines
- Modular design (single responsibility)
- No global variables (except window.app)
- Handle errors gracefully

## Claude Code Prompts

### For graph.js Creation
"Create js/graph.js that renders column graphs using D3.js. It should take data from the DataTable class and render a graph showing individual points with mean. Include proper axes, labels, and responsive sizing based on the graphWidth and graphHeight inputs."

### For app.js Creation
"Create js/app.js as the main application controller. Initialize the DataTable, connect all event listeners from the controls, and coordinate updates between the data table, graph renderer, and UI controls."

### For Export
"Create js/export.js that handles exporting the graph. Use html2canvas for PNG export and native SVG serialization for SVG export. Ensure the exported graph matches what's shown on screen."

### For Adding Graph Types
"Add [graph type] to the GraphRenderer class in graph.js. It should follow the same pattern as the existing column graphs but display [specific features]. Update the graph type selector to include this new option."

### For Statistical Features
"Wire up the statistical test functionality. When the 'Run Test' button is clicked, it should run the selected test using the Statistics class, display the results in the statsResults div, and optionally show significance brackets on the graph."

## Documentation Needs
- [ ] API documentation for each class
- [ ] Usage examples
- [ ] Troubleshooting guide
- [ ] Contributing guidelines
- [ ] Changelog

## Future Enhancements (Phase 6+)
- Multiple graph comparison
- Animation of data changes
- Real-time collaboration
- Template library
- Batch processing
- API for programmatic use
- Plugin system
- Keyboard shortcuts
- Undo/redo functionality
- Dark mode

## Known Issues to Address
- [ ] Validate that jStat is loaded before running tests
- [ ] Handle division by zero in statistics
- [ ] Improve mobile responsiveness
- [ ] Add loading indicators for slow operations
- [ ] Better error messages for invalid data
