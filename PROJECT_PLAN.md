# Visualize

## Project Overview
A web-based graph visualization tool for scientific data.

## Phase 1: Core Features (Current Focus)
- [x] Project setup
- [ ] Excel-like data table
- [ ] Column graph with multiple display options:
  - Individual points with mean/median
  - Bar graphs with error bars (SD, SEM)
  - Box plots
  - Violin plots
- [ ] Graph customization:
  - Editable titles (graph, x-axis, y-axis)
  - Font selection, size, bold, italic
  - Adjustable graph dimensions
- [ ] Statistical tests:
  - Parametric/Non-parametric
  - Paired/Unpaired
  - Display p-values on graph
- [ ] Export (PNG, SVG)

## Phase 2: Advanced Features
- [ ] Additional graph types (scatter, line, etc.)
- [ ] Manual annotation (lines, asterisks)
- [ ] Multiple comparison tests
- [ ] Data import/export (CSV, Excel)

## Tech Stack
- Frontend: HTML5, CSS3, Vanilla JavaScript
- Graphing: D3.js (flexible for custom visualizations)
- Statistics: jStat library
- Export: html2canvas (PNG), native SVG
- Table: Simple custom implementation (editable)

## File Structure
```
visualize/
├── index.html          # Main HTML file
├── css/
│   └── styles.css      # All styling
├── js/
│   ├── app.js          # Main application logic
│   ├── table.js        # Data table component
│   ├── graph.js        # Graph rendering
│   ├── stats.js        # Statistical calculations
│   └── export.js       # Export functionality
├── assets/
│   └── logo.png        # Visualize logo
└── README.md           # Project documentation
```

## GitHub Repository
https://github.com/fredrikwermeling/Visualize

## Development Priorities
1. ✅ Set up project structure
2. Create data table with Excel-like interface
3. Implement basic column graph with points + mean
4. Add graph customization controls
5. Implement statistical tests
6. Add export functionality
7. Iterate based on user feedback
