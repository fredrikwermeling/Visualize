// heatmap.js - D3.js heatmap renderer with optional clustering & dendrograms

class HeatmapRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.settings = {
            cluster: 'none',
            linkage: 'average',
            normalize: 'none',
            normMethod: 'zscore',
            winsorize: 'none',
            colorScheme: 'RdBu',
            showValues: false,
            showGroupBar: false,
            legendTitle: null,  // null = auto-generate, '' = hidden, string = custom
            title: 'Heatmap',
            groupColorOverrides: {},  // { groupName: '#color' }
            titleFont: { family: 'Aptos Display', size: 18, bold: true, italic: false },
            legendTitleFont: { family: 'Aptos Display', size: 15, bold: false, italic: false },
            groupLabelFont: { family: 'Aptos Display', size: 15, bold: false, italic: false },
            groupLabelOverrides: {},  // { groupName: 'overriddenText' }
            groupLabelItemOffsets: {},  // { groupName: {x,y} } per-item drag offsets
            groupColorTheme: 'default',  // color theme for group bar
            colOrder: [],       // manual column order (array of col label strings); empty = data order
            hiddenCols: [],     // columns to hide from the heatmap (array of col label strings)
            clusterFlipRows: 'none',
            clusterFlipCols: 'none',
            colLabelAngle: 45,
            colLabelOverrides: {},
            rowLabelOverrides: {},
            excludedCells: new Set()
        };
        // Drag offsets for movable elements
        this._titleOffset = { x: 0, y: 0 };
        this._legendOffset = { x: 0, y: 0 };
        this._groupLegendOffset = { x: 0, y: 0 };
        this._legendTitleOffset = { x: 0, y: 0 };
    }

    render(matrixData, settings) {
        Object.assign(this.settings, settings);
        this.container.innerHTML = '';

        const { colLabels: rawColLabels, rowLabels, matrix: rawMatrix, groupAssignments } = matrixData;
        // Store raw column labels for the column manager UI
        this._rawColLabels = rawColLabels;
        this._groupAssignments = groupAssignments || [];
        if (!rawMatrix || rawMatrix.length === 0 || rawMatrix[0].length === 0) {
            this.container.innerHTML = '<div class="empty-state"><h3>Enter numeric data to generate heatmap</h3></div>';
            return;
        }

        const filteredRowLabels = rowLabels;
        const filteredGroupAssignments = this._groupAssignments;

        // Filter out hidden columns
        const hiddenCols = this.settings.hiddenCols || [];
        let visibleColIndices = rawColLabels.map((_, i) => i);
        if (hiddenCols.length > 0) {
            visibleColIndices = visibleColIndices.filter(i => !hiddenCols.includes(rawColLabels[i]));
        }
        const colLabels = visibleColIndices.map(i => rawColLabels[i]);
        const matrix = rawMatrix.map(row => visibleColIndices.map(i => row[i]));

        if (matrix.length === 0 || matrix[0].length === 0) {
            this.container.innerHTML = '<div class="empty-state"><h3>All rows/columns are hidden</h3></div>';
            return;
        }

        // Build working matrix: replace excluded cells with NaN for normalization/clustering
        const excludedCells = this.settings.excludedCells || new Set();
        const workingMatrix = matrix.map((row, ri) => row.map((v, ci) => {
            // Map visible indices back to raw indices for exclusion lookup
            const rawRi = ri;  // row indices unchanged
            const rawCi = visibleColIndices[ci];
            return excludedCells.has(`${rawRi}_${ci}`) ? NaN : v;
        }));

        // Normalize (using workingMatrix so excluded cells don't affect stats)
        const normMatrix = this._normalize(workingMatrix, this.settings.normalize, this.settings.normMethod);

        // Winsorize for color mapping
        const displayMatrix = this._winsorize(normMatrix, this.settings.winsorize);

        // Store for CSV export
        this._lastExport = { colLabels, rowLabels: filteredRowLabels, normMatrix, rowOrder: null, colOrder: null };

        // Clustering (on normalized, non-winsorized data)
        let rowOrder = Array.from({ length: normMatrix.length }, (_, i) => i);
        let colOrder = Array.from({ length: normMatrix[0].length }, (_, i) => i);
        let rowTree = null;
        let colTree = null;

        const clusterMode = this.settings.cluster;
        const flipRows = this.settings.clusterFlipRows || 'none';
        const flipCols = this.settings.clusterFlipCols || 'none';
        if (clusterMode === 'rows' || clusterMode === 'both') {
            rowTree = HierarchicalClustering.cluster(normMatrix, this.settings.linkage);
            if (rowTree) {
                const flipped = flipRows === 'reverse' ? HierarchicalClustering.flipTree(rowTree)
                    : flipRows === 'root' ? HierarchicalClustering.flipRoot(rowTree) : rowTree;
                rowOrder = HierarchicalClustering.leafOrder(flipped);
            }
        }
        if (clusterMode === 'cols' || clusterMode === 'both') {
            const transposed = this._transpose(normMatrix);
            colTree = HierarchicalClustering.cluster(transposed, this.settings.linkage);
            if (colTree) {
                const flipped = flipCols === 'reverse' ? HierarchicalClustering.flipTree(colTree)
                    : flipCols === 'root' ? HierarchicalClustering.flipRoot(colTree) : colTree;
                colOrder = HierarchicalClustering.leafOrder(flipped);
            }
        }

        // Apply manual column order when not clustering columns
        const manualColOrder = this.settings.colOrder || [];
        if (manualColOrder.length > 0 && !(clusterMode === 'cols' || clusterMode === 'both')) {
            // Build index mapping: colLabels[i] -> desired position
            const labelToIdx = {};
            colLabels.forEach((label, i) => { labelToIdx[label] = i; });
            const ordered = [];
            // First add columns in manual order that exist
            manualColOrder.forEach(label => {
                if (labelToIdx[label] !== undefined) ordered.push(labelToIdx[label]);
            });
            // Then add any new columns not in manual order
            colLabels.forEach((label, i) => {
                if (!manualColOrder.includes(label)) ordered.push(i);
            });
            colOrder = ordered;
        }

        // Update stored export data with final ordering
        this._lastExport.rowOrder = rowOrder;
        this._lastExport.colOrder = colOrder;

        // Get all numeric values for color scale (from winsorized display data)
        const allValues = [];
        for (const row of displayMatrix) {
            for (const v of row) {
                if (!isNaN(v)) allValues.push(v);
            }
        }
        if (allValues.length === 0) {
            this.container.innerHTML = '<div class="empty-state"><h3>No numeric data found</h3></div>';
            return;
        }

        const colorScale = this._buildColorScale(allValues, this.settings.colorScheme);

        // Outlier detection (on raw matrix before normalization)
        this._outliers = this._detectOutliers(matrix, this.settings.outlierMode || 'none');

        // Group detection
        const groups = this.settings.showGroupBar ? this._detectGroups(filteredRowLabels, filteredGroupAssignments) : null;

        // Auto-generate legend title
        const legendTitle = this._getAutoLegendTitle();

        // Cell area dimensions (user controls cell area, not total SVG)
        const cellAreaWidth = parseInt(document.getElementById('heatmapWidth')?.value) || 300;
        const cellAreaHeight = parseInt(document.getElementById('heatmapHeight')?.value) || 300;

        const rowDendroWidth = rowTree ? 60 : 0;
        const colDendroHeight = colTree ? 60 : 0;
        const titleHeight = 30;
        const groupBarWidth = (groups && groups.uniqueGroups.length > 1) ? 14 : 0;
        const groupLegendHeight = (groups && groups.uniqueGroups.length > 1) ? 20 : 0;

        // Measure label sizes
        const maxRowLabel = Math.max(...filteredRowLabels.map(l => l.length)) * 7;
        const rowLabelWidth = Math.min(Math.max(maxRowLabel, 40), 120);
        const colAngle = this.settings.colLabelAngle ?? 45;
        const maxColLabelLen = Math.max(...colLabels.map(l => l.length));
        const colLabelHeight = colAngle === 0
            ? Math.min(maxColLabelLen * 7, 120) + 10  // horizontal: need width for longest label
            : colAngle === 90
                ? Math.min(maxColLabelLen * 7, 120)  // vertical: full text length
                : Math.min(maxColLabelLen * 5, 80);   // angled: diagonal projection
        const legendWidth = 50;
        const legendTitleExtra = legendTitle ? 16 : 0;

        const marginTop = titleHeight + colDendroHeight + groupLegendHeight + 5;
        const marginLeft = rowDendroWidth + groupBarWidth + 5;
        const marginRight = rowLabelWidth + legendWidth + 15;
        const marginBottom = colLabelHeight + legendTitleExtra + 10;

        // Total SVG = cell area + margins
        const width = cellAreaWidth + marginLeft + marginRight;
        const height = cellAreaHeight + marginTop + marginBottom;

        const svg = d3.select(this.container).append('svg')
            .attr('class', 'graph-svg heatmap-svg')
            .attr('width', width)
            .attr('height', height)
            .style('background', 'white');

        // Hatched pattern for excluded cells
        const defs = svg.append('defs');
        const pat = defs.append('pattern')
            .attr('id', 'excluded-pattern')
            .attr('patternUnits', 'userSpaceOnUse')
            .attr('width', 6).attr('height', 6);
        pat.append('rect').attr('width', 6).attr('height', 6).attr('fill', '#ddd');
        pat.append('line').attr('x1', 0).attr('y1', 6).attr('x2', 6).attr('y2', 0)
            .attr('stroke', '#999').attr('stroke-width', 1);

        const xScale = d3.scaleBand()
            .domain(colOrder)
            .range([0, cellAreaWidth])
            .padding(0.02);

        const yScale = d3.scaleBand()
            .domain(rowOrder)
            .range([0, cellAreaHeight])
            .padding(0.02);

        // Title
        this._drawTitle(svg, width, this.settings.title);

        // Cell area group
        const cellGroup = svg.append('g')
            .attr('transform', `translate(${marginLeft}, ${marginTop})`);

        // Tooltip element
        let tooltip = document.getElementById('heatmap-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'heatmap-tooltip';
            tooltip.className = 'heatmap-tooltip';
            document.body.appendChild(tooltip);
        }
        this._tooltip = tooltip;

        // Draw cells (use displayMatrix for colors)
        this._drawCells(cellGroup, displayMatrix, normMatrix, rowOrder, colOrder, xScale, yScale, colorScale, colLabels, filteredRowLabels, matrix, this._outliers);

        // Row labels (right of matrix)
        this._drawRowLabels(cellGroup, filteredRowLabels, rowOrder, yScale, cellAreaWidth);

        // Column labels (bottom, angled 45deg)
        this._drawColLabels(cellGroup, colLabels, colOrder, xScale, cellAreaHeight);

        // Dendrograms
        if (rowTree) {
            const dendroGroup = svg.append('g')
                .attr('transform', `translate(${5}, ${marginTop})`);
            this._drawDendrogram(dendroGroup, rowTree, yScale, 'left', rowDendroWidth - 5, cellAreaHeight);
        }
        if (colTree) {
            const dendroGroup = svg.append('g')
                .attr('transform', `translate(${marginLeft}, ${titleHeight + groupLegendHeight + 5})`);
            this._drawDendrogram(dendroGroup, colTree, xScale, 'top', cellAreaWidth, colDendroHeight - 5);
        }

        // Group color bar
        if (groups && groups.uniqueGroups.length > 1) {
            this._drawGroupBar(svg, groups, rowOrder, yScale, rowDendroWidth + 2, marginTop, groupBarWidth - 2, cellAreaHeight);
            this._drawGroupLegend(svg, groups, marginLeft, titleHeight + 2, cellAreaWidth);
        }

        // Color legend
        const isWinsorized = this.settings.winsorize !== 'none';
        this._drawColorLegend(svg, colorScale, width - legendWidth - 5, marginTop, legendWidth - 10, cellAreaHeight, isWinsorized, legendTitle);

    }

    _getAutoLegendTitle() {
        if (this.settings.legendTitle === '') return null; // explicitly removed
        if (this.settings.legendTitle && this.settings.legendTitle !== null) return this.settings.legendTitle;
        // Auto-generate based on normalization
        const norm = this.settings.normalize;
        const method = this.settings.normMethod;
        if (norm === 'none') return 'Value';
        return method === 'robust' ? 'Robust Z' : 'Z-score';
    }

    // --- Normalization ---

    _normalize(matrix, mode, method) {
        const m = matrix.map(r => [...r]);
        if (mode === 'none') return m;

        const rows = m.length;
        const cols = m[0].length;
        const useRobust = method === 'robust';

        if (mode === 'all') {
            const vals = [];
            for (const row of m) for (const v of row) if (!isNaN(v)) vals.push(v);
            const { center, spread } = useRobust ? this._robustStats(vals) : this._standardStats(vals);
            for (let r = 0; r < rows; r++)
                for (let c = 0; c < cols; c++)
                    if (!isNaN(m[r][c])) m[r][c] = (m[r][c] - center) / spread;
        } else if (mode === 'row') {
            for (let r = 0; r < rows; r++) {
                const vals = m[r].filter(v => !isNaN(v));
                if (vals.length === 0) continue;
                const { center, spread } = useRobust ? this._robustStats(vals) : this._standardStats(vals);
                for (let c = 0; c < cols; c++)
                    if (!isNaN(m[r][c])) m[r][c] = (m[r][c] - center) / spread;
            }
        } else if (mode === 'col') {
            for (let c = 0; c < cols; c++) {
                const vals = [];
                for (let r = 0; r < rows; r++) if (!isNaN(m[r][c])) vals.push(m[r][c]);
                if (vals.length === 0) continue;
                const { center, spread } = useRobust ? this._robustStats(vals) : this._standardStats(vals);
                for (let r = 0; r < rows; r++)
                    if (!isNaN(m[r][c])) m[r][c] = (m[r][c] - center) / spread;
            }
        }

        return m;
    }

    _standardStats(vals) {
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const std = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length) || 1;
        return { center: mean, spread: std };
    }

    _robustStats(vals) {
        const sorted = [...vals].sort((a, b) => a - b);
        const n = sorted.length;
        const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
        const absDevs = vals.map(v => Math.abs(v - median)).sort((a, b) => a - b);
        const madRaw = absDevs.length % 2 === 0
            ? (absDevs[absDevs.length / 2 - 1] + absDevs[absDevs.length / 2]) / 2
            : absDevs[Math.floor(absDevs.length / 2)];
        const mad = madRaw * 1.4826 || 1; // consistency factor for normal distribution
        return { center: median, spread: mad };
    }

    // --- Winsorization ---

    _winsorize(matrix, level) {
        if (level === 'none') return matrix;
        const pct = parseFloat(level) / 100;
        const m = matrix.map(r => [...r]);

        const allVals = [];
        for (const row of m) for (const v of row) if (!isNaN(v)) allVals.push(v);
        allVals.sort((a, b) => a - b);
        const n = allVals.length;
        if (n === 0) return m;

        const lo = allVals[Math.floor(n * pct)];
        const hi = allVals[Math.ceil(n * (1 - pct)) - 1];

        for (let r = 0; r < m.length; r++)
            for (let c = 0; c < m[r].length; c++)
                if (!isNaN(m[r][c])) m[r][c] = Math.max(lo, Math.min(hi, m[r][c]));

        return m;
    }

    // --- Group Detection ---

    _detectGroups(rowLabels, groupAssignments) {
        const groupMap = [];
        const groupNames = {};
        rowLabels.forEach((label, i) => {
            let group;
            if (groupAssignments && groupAssignments[i] && groupAssignments[i].trim()) {
                group = groupAssignments[i].trim();
            } else {
                // Fallback: split on the last underscore
                const lastUnderscore = label.lastIndexOf('_');
                group = lastUnderscore > 0 ? label.substring(0, lastUnderscore).trim() : label;
            }
            groupMap.push(group);
            if (!groupNames[group]) groupNames[group] = [];
            groupNames[group].push(i);
        });

        const uniqueGroups = Object.keys(groupNames);
        const themes = {
            default: ['#5B8DB8', '#E8927C', '#7EBF7E', '#C490D1', '#F2CC8F', '#81D4DB', '#FF9F9F', '#A8D5A2'],
            pastel: ['#B5D6E8', '#F5C6B8', '#C8E6C8', '#DFC8E8', '#FBE6C8', '#C0EAF0', '#FFCFCF', '#D4EAD0'],
            vivid: ['#2171B5', '#E6550D', '#31A354', '#756BB1', '#D6A016', '#17BECF', '#E7298A', '#66C2A5'],
            grayscale: ['#636363', '#969696', '#bdbdbd', '#252525', '#AAAAAA', '#777777', '#444444', '#C0C0C0'],
            colorblind: ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#F0E442', '#56B4E9', '#E69F00', '#000000'],
            earth: ['#8B4513', '#A0522D', '#D2B48C', '#6B8E23', '#556B2F', '#BDB76B', '#CD853F', '#DEB887'],
            ocean: ['#006994', '#0077B6', '#00B4D8', '#48CAE4', '#0096C7', '#023E8A', '#03045E', '#90E0EF'],
            neon: ['#FF00FF', '#00FFFF', '#FF6600', '#39FF14', '#FF3131', '#BF00FF', '#FFFF00', '#FF1493']
        };
        const palette = themes[this.settings.groupColorTheme] || themes.default;
        const defaultColors = (name) => palette[uniqueGroups.indexOf(name) % palette.length];
        const overrides = this.settings.groupColorOverrides || {};
        const groupColors = (name) => overrides[name] || defaultColors(name);

        return { groupMap, uniqueGroups, groupNames, groupColors };
    }

    // --- Outlier Detection ---

    _detectOutliers(matrix, mode) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const outliers = Array.from({ length: rows }, () => new Array(cols).fill(false));
        if (mode === 'none') return outliers;

        const iqrBounds = (vals) => {
            const sorted = vals.filter(v => !isNaN(v)).sort((a, b) => a - b);
            if (sorted.length < 4) return { lo: -Infinity, hi: Infinity };
            const q1 = sorted[Math.floor(sorted.length * 0.25)];
            const q3 = sorted[Math.floor(sorted.length * 0.75)];
            const iqr = q3 - q1;
            return { lo: q1 - 1.5 * iqr, hi: q3 + 1.5 * iqr };
        };

        if (mode === 'col') {
            for (let c = 0; c < cols; c++) {
                const vals = [];
                for (let r = 0; r < rows; r++) vals.push(matrix[r][c]);
                const { lo, hi } = iqrBounds(vals);
                for (let r = 0; r < rows; r++) {
                    if (!isNaN(matrix[r][c]) && (matrix[r][c] < lo || matrix[r][c] > hi)) outliers[r][c] = true;
                }
            }
        } else if (mode === 'row') {
            for (let r = 0; r < rows; r++) {
                const { lo, hi } = iqrBounds(matrix[r]);
                for (let c = 0; c < cols; c++) {
                    if (!isNaN(matrix[r][c]) && (matrix[r][c] < lo || matrix[r][c] > hi)) outliers[r][c] = true;
                }
            }
        }
        return outliers;
    }

    // --- Color Scale ---

    _buildColorScale(values, scheme) {
        const min = d3.min(values);
        const max = d3.max(values);

        const interpolators = {
            'RdBu': t => d3.interpolateRdBu(1 - t),
            'RdYlGn': t => d3.interpolateRdYlGn(1 - t),
            'Viridis': d3.interpolateViridis,
            'YlOrRd': d3.interpolateYlOrRd,
            'BuPu': d3.interpolateBuPu,
            'Inferno': d3.interpolateInferno,
            'Plasma': d3.interpolatePlasma,
            'Cividis': d3.interpolateCividis,
            'PuOr': t => d3.interpolatePuOr(1 - t),
            'BrBG': t => d3.interpolateBrBG(1 - t),
            'PiYG': t => d3.interpolatePiYG(1 - t),
            'Cool': d3.interpolateCool,
            'Warm': d3.interpolateWarm
        };

        const interpolator = interpolators[scheme] || interpolators['RdBu'];
        return d3.scaleSequential(interpolator).domain([min, max]);
    }

    // --- Drawing ---

    _drawCells(g, displayMatrix, normMatrix, rowOrder, colOrder, xScale, yScale, colorScale, colLabels, rowLabels, rawMatrix, outliers) {
        const cellWidth = xScale.bandwidth();
        const cellHeight = yScale.bandwidth();
        const showValues = this.settings.showValues;
        const fontSize = Math.min(cellWidth, cellHeight, 12) * 0.7;
        const tooltip = this._tooltip;
        const hasNorm = this.settings.normalize !== 'none';
        const excludedCells = this.settings.excludedCells || new Set();

        for (const ri of rowOrder) {
            for (const ci of colOrder) {
                const displayVal = displayMatrix[ri][ci];
                const cellKey = `${ri}_${ci}`;
                const isExcluded = excludedCells.has(cellKey);

                if (isNaN(displayVal) && !isExcluded) continue;

                const x = xScale(ci);
                const y = yScale(ri);
                const isOutlier = outliers && outliers[ri] && outliers[ri][ci];

                const rect = g.append('rect')
                    .attr('x', x)
                    .attr('y', y)
                    .attr('width', cellWidth)
                    .attr('height', cellHeight)
                    .attr('fill', isExcluded ? 'url(#excluded-pattern)' : colorScale(displayVal))
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 0.5)
                    .style('cursor', 'pointer');

                if (isExcluded) rect.attr('opacity', 0.3);

                // Double-click to toggle exclusion
                ((key) => {
                    rect.on('dblclick', () => {
                        if (excludedCells.has(key)) {
                            excludedCells.delete(key);
                        } else {
                            excludedCells.add(key);
                        }
                        if (window.app) window.app.updateGraph();
                    });
                })(cellKey);

                // Tooltip events
                if (tooltip && colLabels && rowLabels) {
                    rect.on('mouseover', () => {
                            const rawVal = rawMatrix ? rawMatrix[ri][ci] : NaN;
                            const normVal = normMatrix[ri][ci];
                            let html = `<b>${rowLabels[ri]}</b><br>${colLabels[ci]}`;
                            if (isExcluded) {
                                html += `<br><span style="color:#c0392b;font-weight:bold">Excluded</span>`;
                            } else {
                                if (!isNaN(rawVal)) html += `<br>Raw: ${rawVal}`;
                                if (hasNorm && !isNaN(normVal)) html += `<br>Norm: ${normVal.toFixed(3)}`;
                            }
                            if (isOutlier) html += `<br><span style="color:#c0392b;font-weight:bold">Outlier</span>`;
                            tooltip.innerHTML = html;
                            tooltip.style.display = 'block';
                        })
                        .on('mousemove', (event) => {
                            tooltip.style.left = (event.pageX + 12) + 'px';
                            tooltip.style.top = (event.pageY - 10) + 'px';
                        })
                        .on('mouseout', () => {
                            tooltip.style.display = 'none';
                        });
                }

                // Outlier indicator circle
                if (isOutlier && !isExcluded) {
                    g.append('circle')
                        .attr('cx', x + cellWidth - 4)
                        .attr('cy', y + 4)
                        .attr('r', Math.min(cellWidth, cellHeight, 8) * 0.2)
                        .attr('fill', '#000')
                        .attr('pointer-events', 'none');
                }

                if (showValues && fontSize >= 5) {
                    const rgb = d3.rgb(colorScale(displayVal));
                    const lum = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
                    const textColor = lum > 128 ? '#000' : '#fff';
                    // Show the actual normalized value, not winsorized
                    const actual = normMatrix[ri][ci];

                    g.append('text')
                        .attr('x', x + cellWidth / 2)
                        .attr('y', y + cellHeight / 2)
                        .attr('text-anchor', 'middle')
                        .attr('dominant-baseline', 'central')
                        .attr('font-size', fontSize + 'px')
                        .attr('fill', textColor)
                        .attr('pointer-events', 'none')
                        .text(isNaN(actual) ? '' : actual.toFixed(1));
                }
            }
        }
    }

    _drawRowLabels(g, labels, order, yScale, xOffset) {
        const bandHeight = yScale.bandwidth();
        const fontSize = Math.min(bandHeight * 0.8, 12);
        const overrides = this.settings.rowLabelOverrides || {};
        const self = this;

        for (const i of order) {
            const originalLabel = labels[i];
            const displayName = overrides[originalLabel] || originalLabel;
            const el = g.append('text')
                .attr('x', xOffset + 4)
                .attr('y', yScale(i) + bandHeight / 2)
                .attr('text-anchor', 'start')
                .attr('dominant-baseline', 'central')
                .attr('font-size', fontSize + 'px')
                .attr('fill', '#333')
                .style('cursor', 'pointer')
                .text(displayName);

            el.append('title').text('Double-click to edit');

            ((origLabel, textEl) => {
                textEl.on('dblclick', (event) => {
                    event.stopPropagation();
                    const existing = document.querySelector('.svg-edit-popup');
                    if (existing) existing.remove();
                    const bbox = textEl.node().getBoundingClientRect();
                    const popup = document.createElement('div');
                    popup.className = 'svg-edit-popup';
                    popup.style.left = (bbox.right + window.scrollX + 4) + 'px';
                    popup.style.top = (bbox.top + window.scrollY - 4) + 'px';
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'svg-inline-edit';
                    input.value = overrides[origLabel] || origLabel;
                    popup.appendChild(input);
                    document.body.appendChild(popup);
                    input.focus();
                    input.select();
                    const commit = () => {
                        const newText = input.value.trim();
                        if (!self.settings.rowLabelOverrides) self.settings.rowLabelOverrides = {};
                        if (newText && newText !== origLabel) {
                            self.settings.rowLabelOverrides[origLabel] = newText;
                        } else {
                            delete self.settings.rowLabelOverrides[origLabel];
                        }
                        popup.remove();
                        document.removeEventListener('mousedown', outsideClick);
                        if (window.app) window.app.updateGraph();
                    };
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') { popup.remove(); document.removeEventListener('mousedown', outsideClick); }
                    });
                    const outsideClick = (e) => { if (!popup.contains(e.target)) commit(); };
                    setTimeout(() => document.addEventListener('mousedown', outsideClick), 0);
                });
            })(originalLabel, el);
        }
    }

    _drawColLabels(g, labels, order, xScale, yOffset) {
        const bandWidth = xScale.bandwidth();
        const fontSize = Math.min(bandWidth * 0.8, 12);
        const angle = this.settings.colLabelAngle ?? 45;
        const overrides = this.settings.colLabelOverrides || {};
        const self = this;

        for (const i of order) {
            const originalLabel = labels[i];
            const displayName = overrides[originalLabel] || originalLabel;
            const cx = xScale(i) + bandWidth / 2;
            const cy = yOffset + 6;
            const el = g.append('text')
                .attr('font-size', fontSize + 'px')
                .attr('fill', '#333')
                .style('cursor', 'pointer')
                .text(displayName);

            el.append('title').text('Double-click to edit');

            if (angle === 0) {
                el.attr('x', cx).attr('y', cy)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'hanging');
            } else if (angle === 90) {
                el.attr('x', cx).attr('y', cy)
                    .attr('text-anchor', 'start')
                    .attr('dominant-baseline', 'middle')
                    .attr('transform', `rotate(90, ${cx}, ${cy})`);
            } else {
                el.attr('x', cx).attr('y', cy)
                    .attr('text-anchor', 'end')
                    .attr('dominant-baseline', 'hanging')
                    .attr('transform', `rotate(-${angle}, ${cx}, ${cy})`);
            }

            ((origLabel, textEl) => {
                textEl.on('dblclick', (event) => {
                    event.stopPropagation();
                    const existing = document.querySelector('.svg-edit-popup');
                    if (existing) existing.remove();
                    const bbox = textEl.node().getBoundingClientRect();
                    const popup = document.createElement('div');
                    popup.className = 'svg-edit-popup';
                    popup.style.left = (bbox.left + window.scrollX - 20) + 'px';
                    popup.style.top = (bbox.bottom + window.scrollY + 4) + 'px';
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'svg-inline-edit';
                    input.value = overrides[origLabel] || origLabel;
                    popup.appendChild(input);
                    document.body.appendChild(popup);
                    input.focus();
                    input.select();
                    const commit = () => {
                        const newText = input.value.trim();
                        if (!self.settings.colLabelOverrides) self.settings.colLabelOverrides = {};
                        if (newText && newText !== origLabel) {
                            self.settings.colLabelOverrides[origLabel] = newText;
                        } else {
                            delete self.settings.colLabelOverrides[origLabel];
                        }
                        popup.remove();
                        document.removeEventListener('mousedown', outsideClick);
                        if (window.app) window.app.updateGraph();
                    };
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') { popup.remove(); document.removeEventListener('mousedown', outsideClick); }
                    });
                    const outsideClick = (e) => { if (!popup.contains(e.target)) commit(); };
                    setTimeout(() => document.addEventListener('mousedown', outsideClick), 0);
                });
            })(originalLabel, el);
        }
    }

    _drawGroupBar(svg, groups, rowOrder, yScale, x, yStart, barWidth, areaHeight) {
        const g = svg.append('g').attr('transform', `translate(${x}, ${yStart})`);

        for (const ri of rowOrder) {
            const groupName = groups.groupMap[ri];
            const color = groups.groupColors(groupName);
            const y = yScale(ri);
            const h = yScale.bandwidth();

            g.append('rect')
                .attr('x', 0)
                .attr('y', y)
                .attr('width', barWidth)
                .attr('height', h)
                .attr('fill', color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 0.5);
        }
    }

    _drawGroupLegend(svg, groups, x, y, maxWidth) {
        const ox = this._groupLegendOffset.x;
        const oy = this._groupLegendOffset.y;
        const g = svg.append('g')
            .attr('class', 'heatmap-group-legend')
            .attr('transform', `translate(${x + ox}, ${y + oy})`);

        const self = this;
        const itemOffsets = this.settings.groupLabelItemOffsets || {};
        let baseXOff = 0;
        const glf = this.settings.groupLabelFont;

        for (const name of groups.uniqueGroups) {
            const color = groups.groupColors(name);
            const displayName = (this.settings.groupLabelOverrides && this.settings.groupLabelOverrides[name]) || name;
            const io = itemOffsets[name] || { x: 0, y: 0 };

            const itemG = g.append('g')
                .attr('transform', `translate(${baseXOff + io.x}, ${io.y})`)
                .style('cursor', 'grab');

            itemG.append('title').text('Drag to move. Double-click text to edit.');

            // Per-item drag (same smooth pattern as title)
            ((gName, itemEl, origX) => {
                let wasDragged = false;
                itemEl.call(d3.drag()
                    .filter(event => !event.ctrlKey && !event.button && event.detail < 2)
                    .on('start', function() { wasDragged = false; d3.select(this).style('cursor', 'grabbing'); })
                    .on('drag', function(event) {
                        wasDragged = true;
                        if (!itemOffsets[gName]) itemOffsets[gName] = { x: 0, y: 0 };
                        itemOffsets[gName].x += event.dx;
                        itemOffsets[gName].y += event.dy;
                        self.settings.groupLabelItemOffsets = itemOffsets;
                        d3.select(this).attr('transform',
                            `translate(${origX + itemOffsets[gName].x}, ${itemOffsets[gName].y})`);
                    })
                    .on('end', function() {
                        d3.select(this).style('cursor', 'grab');
                        if (!wasDragged) {
                            // Create an offset object for this item for nudging
                            if (!itemOffsets[gName]) itemOffsets[gName] = { x: 0, y: 0 };
                            self.settings.groupLabelItemOffsets = itemOffsets;
                            self._selectForNudge(itemOffsets[gName], svg);
                        }
                    })
                );
            })(name, itemG, baseXOff);

            const colorRect = itemG.append('rect')
                .attr('x', 0).attr('y', 0)
                .attr('width', 10).attr('height', 10)
                .attr('fill', color).attr('rx', 2)
                .attr('cursor', 'pointer');

            // Click to change group color
            ((gName, rect, col) => {
                rect.append('title').text('Click to change color');
                rect.on('click', (event) => {
                    event.stopPropagation();
                    const picker = document.createElement('input');
                    picker.type = 'color';
                    const c = d3.color(col);
                    picker.value = c ? c.formatHex() : '#000000';
                    picker.style.position = 'absolute';
                    picker.style.opacity = '0';
                    document.body.appendChild(picker);
                    picker.addEventListener('input', (e) => {
                        if (!self.settings.groupColorOverrides) self.settings.groupColorOverrides = {};
                        self.settings.groupColorOverrides[gName] = e.target.value;
                        if (window.app) window.app.updateGraph();
                    });
                    picker.addEventListener('change', () => picker.remove());
                    picker.addEventListener('blur', () => setTimeout(() => picker.remove(), 200));
                    picker.click();
                });
            })(name, colorRect, color);

            const labelEl = itemG.append('text')
                .attr('x', 13).attr('y', 9)
                .attr('font-size', glf.size + 'px')
                .attr('font-family', glf.family)
                .attr('font-weight', glf.bold ? 'bold' : 'normal')
                .attr('font-style', glf.italic ? 'italic' : 'normal')
                .attr('fill', '#555')
                .attr('cursor', 'pointer')
                .text(displayName);

            labelEl.append('title').text('Double-click to edit label');

            // Double-click to edit group label with font controls
            ((groupName, el) => {
                el.on('dblclick', (event) => {
                    event.stopPropagation();
                    const existing = document.querySelector('.svg-edit-popup');
                    if (existing) existing.remove();

                    const bbox = el.node().getBoundingClientRect();
                    const fontObj = self.settings.groupLabelFont;

                    const popup = document.createElement('div');
                    popup.className = 'svg-edit-popup';
                    popup.style.left = (bbox.left + window.scrollX - 20) + 'px';
                    popup.style.top = (bbox.bottom + window.scrollY + 4) + 'px';

                    const { toolbar, familySelect, sizeInput, boldBtn, italicBtn } = self._createFontToolbar(fontObj);
                    popup.appendChild(toolbar);

                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'svg-inline-edit';
                    const currentOverride = (self.settings.groupLabelOverrides && self.settings.groupLabelOverrides[groupName]) || groupName;
                    input.value = currentOverride;
                    popup.appendChild(input);

                    document.body.appendChild(popup);
                    input.focus();
                    input.select();

                    const commit = () => {
                        const newText = input.value.trim();
                        if (!self.settings.groupLabelOverrides) self.settings.groupLabelOverrides = {};
                        if (newText && newText !== groupName) {
                            self.settings.groupLabelOverrides[groupName] = newText;
                        } else {
                            delete self.settings.groupLabelOverrides[groupName];
                        }
                        self.settings.groupLabelFont = {
                            family: familySelect.value,
                            size: parseInt(sizeInput.value) || 15,
                            bold: boldBtn.classList.contains('active'),
                            italic: italicBtn.classList.contains('active')
                        };
                        popup.remove();
                        document.removeEventListener('mousedown', outsideClick);
                        if (window.app) window.app.updateGraph();
                    };

                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') {
                            popup.remove();
                            document.removeEventListener('mousedown', outsideClick);
                        }
                    });

                    const outsideClick = (e) => {
                        if (!popup.contains(e.target)) commit();
                    };
                    setTimeout(() => document.addEventListener('mousedown', outsideClick), 0);
                });
            })(name, labelEl);

            baseXOff += 13 + displayName.length * (glf.size * 0.6) + 12;
            if (baseXOff > maxWidth) break;
        }
    }

    _drawDendrogram(g, tree, scale, orientation, span, depth) {
        if (!tree || tree.index !== undefined) return;

        const maxHeight = tree.height || 1;
        const leafPositions = {};

        const order = HierarchicalClustering.leafOrder(tree);
        for (const idx of order) {
            const bandStart = scale(idx);
            const bandSize = scale.bandwidth();
            leafPositions[idx] = bandStart + bandSize / 2;
        }

        const drawNode = (node) => {
            if (node.index !== undefined) {
                return leafPositions[node.index];
            }

            const leftPos = drawNode(node.left);
            const rightPos = drawNode(node.right);
            const centerPos = (leftPos + rightPos) / 2;

            const leftH = (node.left.height || 0) / maxHeight;
            const nodeH = node.height / maxHeight;
            const rightH = (node.right.height || 0) / maxHeight;

            if (orientation === 'left') {
                const x1 = span * (1 - leftH);
                const x2 = span * (1 - rightH);
                const xMerge = span * (1 - nodeH);

                g.append('line')
                    .attr('x1', xMerge).attr('y1', leftPos)
                    .attr('x2', xMerge).attr('y2', rightPos)
                    .attr('stroke', '#666').attr('stroke-width', 1);
                g.append('line')
                    .attr('x1', xMerge).attr('y1', leftPos)
                    .attr('x2', x1).attr('y2', leftPos)
                    .attr('stroke', '#666').attr('stroke-width', 1);
                g.append('line')
                    .attr('x1', xMerge).attr('y1', rightPos)
                    .attr('x2', x2).attr('y2', rightPos)
                    .attr('stroke', '#666').attr('stroke-width', 1);
            } else {
                const y1 = depth * (1 - leftH);
                const y2 = depth * (1 - rightH);
                const yMerge = depth * (1 - nodeH);

                g.append('line')
                    .attr('x1', leftPos).attr('y1', yMerge)
                    .attr('x2', rightPos).attr('y2', yMerge)
                    .attr('stroke', '#666').attr('stroke-width', 1);
                g.append('line')
                    .attr('x1', leftPos).attr('y1', yMerge)
                    .attr('x2', leftPos).attr('y2', y1)
                    .attr('stroke', '#666').attr('stroke-width', 1);
                g.append('line')
                    .attr('x1', rightPos).attr('y1', yMerge)
                    .attr('x2', rightPos).attr('y2', y2)
                    .attr('stroke', '#666').attr('stroke-width', 1);
            }

            return centerPos;
        };

        drawNode(tree);
    }

    _drawColorLegend(svg, colorScale, x, y, w, h, isWinsorized, legendTitle) {
        const defs = svg.append('defs');
        const gradientId = 'heatmap-legend-grad';
        const gradient = defs.append('linearGradient')
            .attr('id', gradientId)
            .attr('x1', '0%').attr('y1', '100%')
            .attr('x2', '0%').attr('y2', '0%');

        const domain = colorScale.domain();
        const nStops = 10;
        for (let i = 0; i <= nStops; i++) {
            const t = i / nStops;
            const val = domain[0] + t * (domain[domain.length - 1] - domain[0]);
            gradient.append('stop')
                .attr('offset', `${t * 100}%`)
                .attr('stop-color', colorScale(val));
        }

        const ox = this._legendOffset.x;
        const oy = this._legendOffset.y;
        const lg = svg.append('g')
            .attr('class', 'heatmap-color-legend')
            .attr('transform', `translate(${x + ox}, ${y + oy})`)
            .style('cursor', 'grab');

        // Drag behavior
        const self = this;
        let legendDragged = false;
        lg.call(d3.drag()
            .filter(function(event) { return !event.ctrlKey && !event.button && event.detail < 2; })
            .on('start', function() { legendDragged = false; d3.select(this).style('cursor', 'grabbing'); })
            .on('drag', function(event) {
                legendDragged = true;
                self._legendOffset.x += event.dx;
                self._legendOffset.y += event.dy;
                const nx = x + self._legendOffset.x;
                const ny = y + self._legendOffset.y;
                d3.select(this).attr('transform', `translate(${nx}, ${ny})`);
            })
            .on('end', function() {
                d3.select(this).style('cursor', 'grab');
                if (!legendDragged) {
                    self._selectForNudge(self._legendOffset, svg);
                }
            })
        );

        // Show selection highlight if color legend is selected for nudging
        if (this._selectedNudgeOffset === this._legendOffset) {
            this._drawSelectionHighlight(svg, lg);
        }

        lg.append('rect')
            .attr('x', 0).attr('y', 0)
            .attr('width', w).attr('height', h)
            .attr('fill', `url(#${gradientId})`)
            .attr('stroke', '#ccc')
            .attr('stroke-width', 0.5);

        const minVal = domain[0];
        const maxVal = domain[domain.length - 1];
        const fmt = v => Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);

        lg.append('text')
            .attr('x', w / 2).attr('y', h + 12)
            .attr('text-anchor', 'middle')
            .attr('font-size', '9px')
            .attr('fill', '#666')
            .text(fmt(minVal));

        lg.append('text')
            .attr('x', w / 2).attr('y', -4)
            .attr('text-anchor', 'middle')
            .attr('font-size', '9px')
            .attr('fill', '#666')
            .text(fmt(maxVal));

        // Winsorize annotation
        if (isWinsorized) {
            lg.append('text')
                .attr('x', w / 2).attr('y', -14)
                .attr('text-anchor', 'middle')
                .attr('font-size', '7px')
                .attr('fill', '#999')
                .text('(clipped)');
        }

        // Legend title (editable, removable)
        if (legendTitle) {
            const ltOx = this._legendTitleOffset.x;
            const ltOy = this._legendTitleOffset.y;
            const ltf = this.settings.legendTitleFont;
            const ltEl = lg.append('text')
                .attr('x', w / 2 + ltOx).attr('y', h + 24 + ltOy)
                .attr('text-anchor', 'middle')
                .attr('font-size', ltf.size + 'px')
                .attr('font-family', ltf.family)
                .attr('font-weight', ltf.bold ? 'bold' : '600')
                .attr('font-style', ltf.italic ? 'italic' : 'normal')
                .attr('fill', '#555')
                .attr('cursor', 'grab')
                .text(legendTitle);

            ltEl.append('title').text('Drag to move. Double-click to edit. Right-click to remove.');

            // Drag
            let ltDragged = false;
            const ltSelf = this;
            ltEl.call(d3.drag()
                .filter(function(event) { return !event.ctrlKey && !event.button && event.detail < 2; })
                .on('start', function() { ltDragged = false; })
                .on('drag', (event) => {
                    ltDragged = true;
                    this._legendTitleOffset.x += event.dx;
                    this._legendTitleOffset.y += event.dy;
                    ltEl.attr('x', w / 2 + this._legendTitleOffset.x)
                        .attr('y', h + 24 + this._legendTitleOffset.y);
                })
                .on('end', () => {
                    if (!ltDragged) {
                        ltSelf._selectForNudge(ltSelf._legendTitleOffset, svg);
                    }
                })
            );

            // Show selection highlight if legend title is selected for nudging
            if (this._selectedNudgeOffset === this._legendTitleOffset) {
                this._drawSelectionHighlight(svg, ltEl);
            }

            // Double-click to edit with font toolbar
            ltEl.on('dblclick', () => {
                const existing = document.querySelector('.svg-edit-popup');
                if (existing) existing.remove();

                const bbox = ltEl.node().getBoundingClientRect();
                const fontObj = this.settings.legendTitleFont;

                const popup = document.createElement('div');
                popup.className = 'svg-edit-popup';
                popup.style.left = (bbox.left + window.scrollX - 20) + 'px';
                popup.style.top = (bbox.bottom + window.scrollY + 4) + 'px';

                const { toolbar, familySelect, sizeInput, boldBtn, italicBtn } = this._createFontToolbar(fontObj);
                popup.appendChild(toolbar);

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'svg-inline-edit';
                input.value = legendTitle;
                popup.appendChild(input);

                document.body.appendChild(popup);
                input.focus();
                input.select();

                const commit = () => {
                    this.settings.legendTitle = input.value.trim() || null;
                    this.settings.legendTitleFont = {
                        family: familySelect.value,
                        size: parseInt(sizeInput.value) || 10,
                        bold: boldBtn.classList.contains('active'),
                        italic: italicBtn.classList.contains('active')
                    };
                    popup.remove();
                    document.removeEventListener('mousedown', outsideClick);
                    if (window.app) window.app.updateGraph();
                };

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') {
                        popup.remove();
                        document.removeEventListener('mousedown', outsideClick);
                    }
                });

                const outsideClick = (e) => {
                    if (!popup.contains(e.target)) commit();
                };
                setTimeout(() => document.addEventListener('mousedown', outsideClick), 0);
            });

            // Right-click to remove
            ltEl.on('contextmenu', (event) => {
                event.preventDefault();
                this.settings.legendTitle = '';
                if (window.app) window.app.updateGraph();
            });
        }
    }

    _selectForNudge(offsetObj, svg) {
        this._selectedNudgeOffset = offsetObj;

        if (this._nudgeHandler) {
            document.removeEventListener('keydown', this._nudgeHandler);
        }
        this._nudgeHandler = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            if (!this._selectedNudgeOffset) return;
            e.preventDefault();
            const step = e.shiftKey ? 10 : 2;
            if (e.key === 'ArrowUp') this._selectedNudgeOffset.y -= step;
            else if (e.key === 'ArrowDown') this._selectedNudgeOffset.y += step;
            else if (e.key === 'ArrowLeft') this._selectedNudgeOffset.x -= step;
            else if (e.key === 'ArrowRight') this._selectedNudgeOffset.x += step;
            if (window.app) window.app.updateGraph();
        };
        document.addEventListener('keydown', this._nudgeHandler);

        if (this._nudgeDeselect) {
            document.removeEventListener('mousedown', this._nudgeDeselect);
        }
        this._nudgeDeselect = (e) => {
            if (e.target.closest && e.target.closest('text, rect')) return;
            this._selectedNudgeOffset = null;
            document.removeEventListener('keydown', this._nudgeHandler);
            document.removeEventListener('mousedown', this._nudgeDeselect);
            this._nudgeHandler = null;
            this._nudgeDeselect = null;
            if (window.app) window.app.updateGraph();
        };
        setTimeout(() => document.addEventListener('mousedown', this._nudgeDeselect), 0);

        if (window.app) window.app.updateGraph();
    }

    _drawSelectionHighlight(svg, el) {
        if (!el || !el.node()) return;
        const bbox = el.node().getBBox();
        const ctm = el.node().getCTM();
        const svgEl = svg.node();
        const svgCTM = svgEl.getCTM() || svgEl.getScreenCTM();
        const pt1 = svgEl.createSVGPoint();
        pt1.x = bbox.x; pt1.y = bbox.y;
        const pt2 = svgEl.createSVGPoint();
        pt2.x = bbox.x + bbox.width; pt2.y = bbox.y + bbox.height;
        const inv = svgCTM.inverse();
        const t1 = pt1.matrixTransform(ctm).matrixTransform(inv);
        const t2 = pt2.matrixTransform(ctm).matrixTransform(inv);
        svg.append('rect')
            .attr('class', 'selection-highlight')
            .attr('x', t1.x - 3).attr('y', t1.y - 3)
            .attr('width', t2.x - t1.x + 6).attr('height', t2.y - t1.y + 6)
            .attr('fill', 'none')
            .attr('stroke', '#5E8C31')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '4,3')
            .attr('pointer-events', 'none');
    }

    _createFontToolbar(fontObj) {
        const toolbar = document.createElement('div');
        toolbar.className = 'svg-edit-toolbar';

        const familySelect = document.createElement('select');
        familySelect.className = 'svg-edit-font-family';
        ['Aptos Display', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New'].forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f;
            if (f === fontObj.family) opt.selected = true;
            familySelect.appendChild(opt);
        });
        toolbar.appendChild(familySelect);

        const sizeInput = document.createElement('input');
        sizeInput.type = 'number';
        sizeInput.className = 'svg-edit-font-size';
        sizeInput.min = 8;
        sizeInput.max = 36;
        sizeInput.value = fontObj.size;
        toolbar.appendChild(sizeInput);

        const boldBtn = document.createElement('button');
        boldBtn.className = 'svg-edit-btn' + (fontObj.bold ? ' active' : '');
        boldBtn.innerHTML = '<b>B</b>';
        boldBtn.title = 'Bold';
        boldBtn.addEventListener('mousedown', (e) => e.preventDefault());
        boldBtn.addEventListener('click', (e) => {
            e.preventDefault();
            boldBtn.classList.toggle('active');
        });
        toolbar.appendChild(boldBtn);

        const italicBtn = document.createElement('button');
        italicBtn.className = 'svg-edit-btn' + (fontObj.italic ? ' active' : '');
        italicBtn.innerHTML = '<i>I</i>';
        italicBtn.title = 'Italic';
        italicBtn.addEventListener('mousedown', (e) => e.preventDefault());
        italicBtn.addEventListener('click', (e) => {
            e.preventDefault();
            italicBtn.classList.toggle('active');
        });
        toolbar.appendChild(italicBtn);

        familySelect.addEventListener('mousedown', (e) => e.stopPropagation());
        sizeInput.addEventListener('mousedown', (e) => e.stopPropagation());

        return { toolbar, familySelect, sizeInput, boldBtn, italicBtn };
    }

    _drawTitle(svg, width, title) {
        const ox = this._titleOffset.x;
        const oy = this._titleOffset.y;
        const tf = this.settings.titleFont;
        const titleEl = svg.append('text')
            .attr('x', width / 2 + ox)
            .attr('y', 18 + oy)
            .attr('text-anchor', 'middle')
            .attr('font-size', tf.size + 'px')
            .attr('font-family', tf.family)
            .attr('font-weight', tf.bold ? 'bold' : 'normal')
            .attr('font-style', tf.italic ? 'italic' : 'normal')
            .attr('fill', '#333')
            .attr('cursor', 'grab')
            .text(title);

        // Drag behavior
        const self = this;
        let wasDragged = false;
        titleEl.call(d3.drag()
            .filter(function(event) { return !event.ctrlKey && !event.button && event.detail < 2; })
            .on('start', function() { wasDragged = false; d3.select(this).style('cursor', 'grabbing'); })
            .on('drag', function(event) {
                wasDragged = true;
                self._titleOffset.x += event.dx;
                self._titleOffset.y += event.dy;
                d3.select(this)
                    .attr('x', width / 2 + self._titleOffset.x)
                    .attr('y', 18 + self._titleOffset.y);
            })
            .on('end', function() {
                d3.select(this).style('cursor', 'grab');
                if (!wasDragged) {
                    self._selectForNudge(self._titleOffset, svg);
                }
            })
        );

        // Show selection highlight if title is selected for nudging
        if (this._selectedNudgeOffset === this._titleOffset) {
            this._drawSelectionHighlight(svg, titleEl);
        }

        titleEl.on('dblclick', () => {
            const existing = document.querySelector('.svg-edit-popup');
            if (existing) existing.remove();

            const bbox = titleEl.node().getBoundingClientRect();
            const fontObj = this.settings.titleFont;

            const popup = document.createElement('div');
            popup.className = 'svg-edit-popup';
            popup.style.left = (bbox.left + window.scrollX - 20) + 'px';
            popup.style.top = (bbox.bottom + window.scrollY + 4) + 'px';

            const { toolbar, familySelect, sizeInput, boldBtn, italicBtn } = this._createFontToolbar(fontObj);
            popup.appendChild(toolbar);

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'svg-inline-edit';
            input.value = this.settings.title;
            popup.appendChild(input);

            document.body.appendChild(popup);
            input.focus();
            input.select();

            const commit = () => {
                this.settings.title = input.value.trim() || 'Heatmap';
                this.settings.titleFont = {
                    family: familySelect.value,
                    size: parseInt(sizeInput.value) || 16,
                    bold: boldBtn.classList.contains('active'),
                    italic: italicBtn.classList.contains('active')
                };
                popup.remove();
                document.removeEventListener('mousedown', outsideClick);
                if (window.app) window.app.updateGraph();
            };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') {
                    popup.remove();
                    document.removeEventListener('mousedown', outsideClick);
                }
            });

            const outsideClick = (e) => {
                if (!popup.contains(e.target)) commit();
            };
            setTimeout(() => document.addEventListener('mousedown', outsideClick), 0);
        });

        titleEl.append('title').text('Drag to move. Double-click to edit.');
    }

    // --- CSV Export ---

    exportGroupedCSV(matrixData) {
        const { colLabels, rowLabels, matrix, groupAssignments } = matrixData;
        const groups = this._detectGroups(rowLabels, groupAssignments);

        // Build: for each column (marker), sub-columns per group
        // Header row 1: marker names spanning groups
        // Header row 2: group names
        // Data rows: values per replicate

        const markers = colLabels;
        const uniqueGroups = groups.uniqueGroups;

        // Find max replicates per group
        const maxReps = Math.max(...uniqueGroups.map(g => groups.groupNames[g].length));

        // Build header rows
        let header1 = [];
        let header2 = [];
        for (const marker of markers) {
            for (const group of uniqueGroups) {
                header1.push(marker);
                header2.push(group);
            }
        }

        // Build data rows (one per replicate index)
        const dataRows = [];
        for (let rep = 0; rep < maxReps; rep++) {
            const row = [];
            for (let mi = 0; mi < markers.length; mi++) {
                for (const group of uniqueGroups) {
                    const indices = groups.groupNames[group];
                    if (rep < indices.length) {
                        const ri = indices[rep];
                        row.push(matrix[ri][mi]);
                    } else {
                        row.push('');
                    }
                }
            }
            dataRows.push(row);
        }

        // Assemble CSV
        const lines = [];
        lines.push(header1.join(','));
        lines.push(header2.join(','));
        for (const row of dataRows) {
            lines.push(row.join(','));
        }

        const csv = lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'heatmap_grouped.csv';
        a.click();
        URL.revokeObjectURL(url);
    }


    exportHeatmapCSV() {
        if (!this._lastExport) return;
        const { colLabels, rowLabels, normMatrix, rowOrder, colOrder } = this._lastExport;
        const lines = [];
        // Header: empty cell + column labels in display order
        lines.push([''].concat(colOrder.map(ci => colLabels[ci])).join(','));
        // Data rows in display order
        for (const ri of rowOrder) {
            const row = [rowLabels[ri]];
            for (const ci of colOrder) {
                const v = normMatrix[ri][ci];
                row.push(isNaN(v) ? '' : v);
            }
            lines.push(row.join(','));
        }
        const csv = lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'heatmap_processed.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    _transpose(matrix) {
        if (matrix.length === 0) return [];
        const rows = matrix.length;
        const cols = matrix[0].length;
        const result = [];
        for (let c = 0; c < cols; c++) {
            result[c] = [];
            for (let r = 0; r < rows; r++) {
                result[c][r] = matrix[r][c];
            }
        }
        return result;
    }
}
