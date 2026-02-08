# Visualize

A web-based scientific graph creator.

**Live app: [https://fredrikwermeling.github.io/Visualize/](https://fredrikwermeling.github.io/Visualize/)**

## Features

- **Excel-like data input** — paste or type numbers into columns
- **Multiple graph types** — scatter with mean/median, bar charts with SD/SEM error bars, box plots, violin plots
- **Customizable appearance** — editable titles, axis labels, font family/size, bold/italic, graph dimensions
- **Statistical tests** — unpaired/paired t-test (Welch's), Mann-Whitney U, Wilcoxon signed-rank
- **Significance annotations** — automatic brackets with \*/\*\*/\*\*\* on the graph after running a test
- **Export** — download as PNG (2x resolution) or SVG

## Usage

1. Enter data in the table on the left (or use the pre-loaded sample data)
2. Select a graph type from the dropdown
3. Customize titles, fonts, and dimensions
4. Run a statistical test to compare the first two groups
5. Export the graph as PNG or SVG

## Tech Stack

- Vanilla JavaScript (no frameworks)
- [D3.js](https://d3js.org/) for graph rendering
- [jStat](https://jstat.github.io/) for statistical calculations
- [html2canvas](https://html2canvas.hertzen.com/) as PNG export fallback

No build step required — just open `index.html` in a browser.

## License

MIT

## Contact

Fredrik Wermeling
