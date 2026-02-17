# Project Instructions

## Token Usage — CRITICAL
- Minimize token consumption at all times. This is a top priority.
- Use haiku or sonnet for any subagent tasks — only use opus for tasks that truly require it.
- Avoid spawning unnecessary subagents. Prefer direct tool calls (Read, Grep, Glob, Edit) over Task agents.
- Do not read entire files upfront. Use Grep or Read with offset/limit to read only the sections needed for the current edit.
- Keep responses short. Do not over-explain.
- After context compaction, re-read this file to remember these rules.

## Git Workflow
- Always push changes to remote after committing. Never leave commits local-only.

---

## Project Summary — Visualize

**Visualize** is a browser-based scientific graph/chart application for researchers. It runs entirely client-side (no backend) using D3.js v7 for SVG rendering and jStat for statistics.

### File Locations
All files are at: `/Users/fredrikwermeling/Documents/graph app/visualize/`

| File | Purpose |
|------|---------|
| `index.html` | Main HTML — all UI controls, settings panels, mode-specific sections |
| `js/app.js` | **Main controller** — mode switching, settings binding, stats orchestration, export, text settings panel ("Aa"), group order manager |
| `js/graph.js` | **Column chart renderer** — bar/scatter/box/violin plots, significance brackets, stats legend, zero line, drag/dblclick text editing |
| `js/growth.js` | **Time Series renderer** — line charts with group means, error bars/ribbons, individual lines, significance markers, stats legend, zero line |
| `js/heatmap.js` | **Heatmap renderer** — clustered heatmaps, dendrograms, color scales, group labels |
| `js/volcano.js` | **Volcano plot renderer** — fold-change vs p-value scatter |
| `js/table.js` | **Data table** — editable HTML table, sample datasets, CSV import/export, +column/+row |
| `js/stats.js` | **Statistics** — t-tests, ANOVA, Kruskal-Wallis, post-hoc tests, growth RM ANOVA with per-timepoint ANOVA gatekeeper |
| `js/export.js` | **Export** — PNG (with scale), SVG, clipboard copy, inline style cloning |
| `js/annotations.js` | **Drawing tools** — text, lines, arrows, brackets overlay |
| `css/styles.css` | All styling — control grids, panels, popups |

### Four Graph Modes
1. **Column** (`graph.js`) — bar charts, scatter, box plots, violin plots with significance testing
2. **Heatmap** (`heatmap.js`) — clustered heatmaps with dendrograms
3. **Time Series** (`growth.js`) — longitudinal data with group means +/- error
4. **Volcano** (`volcano.js`) — differential expression plots

### CRITICAL Design Principle: Cross-Mode Consistency
All modes should behave consistently. When adding or fixing a feature, check if the same pattern exists (or should exist) in other modes. Learn from the most developed implementation before writing new code.

**Shared patterns that must stay in sync:**
- **Text editing**: dblclick to edit text (title, axis labels) with font toolbar popup (family, size, bold, italic). Methods: `_createFontToolbar()`, `_startInlineEdit()`, `_openTickFontPopup()`
- **Drag + nudge**: click-drag to reposition labels, arrow keys for fine nudge. Methods: `_makeLabelDrag()`, `_selectLabelForNudge()`
- **Font settings**: Each mode stores `titleFont`, `xLabelFont`, `yLabelFont`, `xTickFont`, `yTickFont` as `{family, size, bold, italic}` objects
- **Visibility toggles**: `showTitle`, `showXLabel`, `showYLabel` booleans
- **Offset objects**: `titleOffset`, `xLabelOffset`, `yLabelOffset` as `{x, y}`
- **Text Settings panel** ("Aa" button in header): unified panel in app.js listing all text elements for current mode with per-element and per-group controls
- **Zero line**: auto-enabled with dashed style when negative values detected. Settings: `showZeroLine`, `zeroLineWidth`, `zeroLineDash`, `zeroLineColor`. Dblclick popup to customize.
- **Stats legend**: `showStatsLegend`, `statsLegendExtended`, `statsTestName`, `statsLegendOffset`. Select dropdown: None/Simple/Extended. Works in column and time series.
- **Group overrides**: `groupOverrides: { groupName: { color, symbol, label, lineDash } }` — per-group customization
- **Export**: PNG (with configurable scale), SVG, clipboard, CSV, stats text, Export All (ZIP). `_expandToFit()` handles negative bbox for complete capture.

### Key Architectural Details
- `app.js` manages all mode switching in `_applyMode()` — shows/hides controls per mode
- Settings flow: HTML inputs → `_getXxxSettings()` → `renderer.render(data, settings)` which does `Object.assign(this.settings, settings)`
- Persistent settings (fonts, offsets, overrides, stats) live on the renderer object and survive re-renders
- Transient settings (width, height, axis range) are read from HTML inputs each render
- Statistics: column mode uses `graphRenderer.setSignificance()` / `graphRenderer.updateSettings()`. Time series uses `growthRenderer.setSignificance()` and direct `growthRenderer.settings.xxx = yyy`
- Empty columns in column mode use unique zero-width space labels (`' ' + '\u200B'.repeat(n)`) for spacing
- Sample datasets cycle via index on "Test Data" button click (index 5 has negative values for both column and time series)
- JSZip loaded dynamically for Export All feature

### Statistics Implementation
- Column: t-tests (paired/unpaired), Mann-Whitney, ANOVA, Kruskal-Wallis, Friedman, with Tukey/Dunn/Bonferroni post-hoc
- Time Series: Two-way RM ANOVA (Group × Time), post-hoc uses **per-timepoint one-way ANOVA as gatekeeper** (>2 groups), then pairwise t-tests with Holm-Bonferroni/Bonferroni/Šidák correction
- Stats panel only visible for column and time series modes
- Stats export button hidden for heatmap and volcano

### Recent Work (as of Feb 2026)
- Unified text handling across all modes with Aa panel
- Per-group line dash styles in time series
- Zero line auto-enable with dashed style when negatives detected
- Extended stats legend with test name
- X-Min/X-Max/X-Step/Y-Step for time series
- Y-axis starts at 0 unless data has negatives
- Export All as ZIP (PNG + SVG + CSV + stats)
- Default titles: "Column" and "Time Series"
- Temperature-drop test datasets with negative values
