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
            titleFont: { family: 'Arial', size: 16, bold: true, italic: false },
            legendTitleFont: { family: 'Arial', size: 10, bold: false, italic: false },
            groupLabelFont: { family: 'Arial', size: 10, bold: false, italic: false },
            groupLabelOverrides: {},  // { groupName: 'overriddenText' }
            colOrder: [],       // manual column order (array of col label strings); empty = data order
            hiddenCols: []      // columns to hide from the heatmap (array of col label strings)
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

        const { colLabels: rawColLabels, rowLabels, matrix: rawMatrix } = matrixData;
        // Store raw column labels for the column manager UI
        this._rawColLabels = rawColLabels;
        if (!rawMatrix || rawMatrix.length === 0 || rawMatrix[0].length === 0) {
            this.container.innerHTML = '<div class="empty-state"><h3>Enter numeric data to generate heatmap</h3></div>';
            return;
        }

        // Filter out hidden columns
        const hiddenCols = this.settings.hiddenCols || [];
        let visibleColIndices = rawColLabels.map((_, i) => i);
        if (hiddenCols.length > 0) {
            visibleColIndices = visibleColIndices.filter(i => !hiddenCols.includes(rawColLabels[i]));
        }
        const colLabels = visibleColIndices.map(i => rawColLabels[i]);
        const matrix = rawMatrix.map(row => visibleColIndices.map(i => row[i]));

        if (matrix.length === 0 || matrix[0].length === 0) {
            this.container.innerHTML = '<div class="empty-state"><h3>All columns are hidden</h3></div>';
            return;
        }

        // Normalize
        const normMatrix = this._normalize(matrix, this.settings.normalize, this.settings.normMethod);

        // Winsorize for color mapping
        const displayMatrix = this._winsorize(normMatrix, this.settings.winsorize);

        // Clustering (on normalized, non-winsorized data)
        let rowOrder = Array.from({ length: normMatrix.length }, (_, i) => i);
        let colOrder = Array.from({ length: normMatrix[0].length }, (_, i) => i);
        let rowTree = null;
        let colTree = null;

        const clusterMode = this.settings.cluster;
        if (clusterMode === 'rows' || clusterMode === 'both') {
            rowTree = HierarchicalClustering.cluster(normMatrix, this.settings.linkage);
            if (rowTree) rowOrder = HierarchicalClustering.leafOrder(rowTree);
        }
        if (clusterMode === 'cols' || clusterMode === 'both') {
            const transposed = this._transpose(normMatrix);
            colTree = HierarchicalClustering.cluster(transposed, this.settings.linkage);
            if (colTree) colOrder = HierarchicalClustering.leafOrder(colTree);
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

        // Group detection
        const groups = this.settings.showGroupBar ? this._detectGroups(rowLabels) : null;

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
        const maxRowLabel = Math.max(...rowLabels.map(l => l.length)) * 7;
        const rowLabelWidth = Math.min(Math.max(maxRowLabel, 40), 120);
        const colLabelHeight = Math.min(Math.max(...colLabels.map(l => l.length)) * 5, 80);
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

        // Draw cells (use displayMatrix for colors)
        this._drawCells(cellGroup, displayMatrix, normMatrix, rowOrder, colOrder, xScale, yScale, colorScale);

        // Row labels (right of matrix)
        this._drawRowLabels(cellGroup, rowLabels, rowOrder, yScale, cellAreaWidth);

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
        const prefix = norm === 'row' ? 'Row ' : norm === 'col' ? 'Col ' : '';
        const suffix = method === 'robust' ? 'Robust Z' : 'Z-score';
        return prefix + suffix;
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

    _detectGroups(rowLabels) {
        const groupMap = [];
        const groupNames = {};
        rowLabels.forEach((label, i) => {
            // Strip trailing _N, _number, -N, -number, or space+number
            const group = label.replace(/[_\-\s]+\d+\s*$/, '').trim() || label;
            groupMap.push(group);
            if (!groupNames[group]) groupNames[group] = [];
            groupNames[group].push(i);
        });

        const uniqueGroups = Object.keys(groupNames);
        const defaultColors = d3.scaleOrdinal(d3.schemeSet2).domain(uniqueGroups);
        const overrides = this.settings.groupColorOverrides || {};
        const groupColors = (name) => overrides[name] || defaultColors(name);

        return { groupMap, uniqueGroups, groupNames, groupColors };
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
            'BuPu': d3.interpolateBuPu
        };

        const interpolator = interpolators[scheme] || interpolators['RdBu'];
        return d3.scaleSequential(interpolator).domain([min, max]);
    }

    // --- Drawing ---

    _drawCells(g, displayMatrix, normMatrix, rowOrder, colOrder, xScale, yScale, colorScale) {
        const cellWidth = xScale.bandwidth();
        const cellHeight = yScale.bandwidth();
        const showValues = this.settings.showValues;
        const fontSize = Math.min(cellWidth, cellHeight, 12) * 0.7;

        for (const ri of rowOrder) {
            for (const ci of colOrder) {
                const displayVal = displayMatrix[ri][ci];
                if (isNaN(displayVal)) continue;

                const x = xScale(ci);
                const y = yScale(ri);

                g.append('rect')
                    .attr('x', x)
                    .attr('y', y)
                    .attr('width', cellWidth)
                    .attr('height', cellHeight)
                    .attr('fill', colorScale(displayVal))
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 0.5);

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
                        .text(isNaN(actual) ? '' : actual.toFixed(1));
                }
            }
        }
    }

    _drawRowLabels(g, labels, order, yScale, xOffset) {
        const bandHeight = yScale.bandwidth();
        const fontSize = Math.min(bandHeight * 0.8, 12);

        for (const i of order) {
            g.append('text')
                .attr('x', xOffset + 4)
                .attr('y', yScale(i) + bandHeight / 2)
                .attr('text-anchor', 'start')
                .attr('dominant-baseline', 'central')
                .attr('font-size', fontSize + 'px')
                .attr('fill', '#333')
                .text(labels[i]);
        }
    }

    _drawColLabels(g, labels, order, xScale, yOffset) {
        const bandWidth = xScale.bandwidth();
        const fontSize = Math.min(bandWidth * 0.8, 12);

        for (const i of order) {
            g.append('text')
                .attr('x', xScale(i) + bandWidth / 2)
                .attr('y', yOffset + 4)
                .attr('text-anchor', 'start')
                .attr('dominant-baseline', 'hanging')
                .attr('font-size', fontSize + 'px')
                .attr('fill', '#333')
                .attr('transform', `rotate(45, ${xScale(i) + bandWidth / 2}, ${yOffset + 4})`)
                .text(labels[i]);
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
            .attr('transform', `translate(${x + ox}, ${y + oy})`)
            .style('cursor', 'grab');

        // Drag behavior
        const self = this;
        g.call(d3.drag()
            .on('start', function() { d3.select(this).style('cursor', 'grabbing'); })
            .on('drag', function(event) {
                self._groupLegendOffset.x += event.dx;
                self._groupLegendOffset.y += event.dy;
                const nx = x + self._groupLegendOffset.x;
                const ny = y + self._groupLegendOffset.y;
                d3.select(this).attr('transform', `translate(${nx}, ${ny})`);
            })
            .on('end', function() { d3.select(this).style('cursor', 'grab'); })
        );

        let xOff = 0;

        for (const name of groups.uniqueGroups) {
            const color = groups.groupColors(name);
            const curX = xOff;

            const colorRect = g.append('rect')
                .attr('x', xOff)
                .attr('y', 0)
                .attr('width', 10)
                .attr('height', 10)
                .attr('fill', color)
                .attr('rx', 2)
                .attr('cursor', 'pointer');

            // Prevent drag on parent from capturing clicks on color rect
            colorRect.on('mousedown', (event) => { event.stopPropagation(); });

            // Click to change group color
            colorRect.on('click', () => {
                const picker = document.createElement('input');
                picker.type = 'color';
                picker.value = color;
                picker.style.position = 'absolute';
                picker.style.opacity = '0';
                document.body.appendChild(picker);
                picker.addEventListener('input', (e) => {
                    if (!this.settings.groupColorOverrides) this.settings.groupColorOverrides = {};
                    this.settings.groupColorOverrides[name] = e.target.value;
                    if (window.app) window.app.updateGraph();
                });
                picker.addEventListener('change', () => picker.remove());
                picker.addEventListener('blur', () => setTimeout(() => picker.remove(), 200));
                picker.click();
            });
            colorRect.append('title').text('Click to change color');

            const glf = this.settings.groupLabelFont;
            const displayName = (this.settings.groupLabelOverrides && this.settings.groupLabelOverrides[name]) || name;
            const labelEl = g.append('text')
                .attr('x', xOff + 13)
                .attr('y', 9)
                .attr('font-size', glf.size + 'px')
                .attr('font-family', glf.family)
                .attr('font-weight', glf.bold ? 'bold' : 'normal')
                .attr('font-style', glf.italic ? 'italic' : 'normal')
                .attr('fill', '#555')
                .attr('cursor', 'pointer')
                .text(displayName);

            labelEl.append('title').text('Double-click to edit label');

            // Prevent drag on parent from capturing clicks on label
            labelEl.on('mousedown', (event) => { event.stopPropagation(); });

            // Double-click to edit group label with font controls
            ((groupName, el) => {
                el.on('dblclick', (event) => {
                    event.stopPropagation();
                    const existing = document.querySelector('.svg-edit-popup');
                    if (existing) existing.remove();

                    const bbox = el.node().getBoundingClientRect();
                    const fontObj = this.settings.groupLabelFont;

                    const popup = document.createElement('div');
                    popup.className = 'svg-edit-popup';
                    popup.style.left = (bbox.left + window.scrollX - 20) + 'px';
                    popup.style.top = (bbox.bottom + window.scrollY + 4) + 'px';

                    const { toolbar, familySelect, sizeInput, boldBtn, italicBtn } = this._createFontToolbar(fontObj);
                    popup.appendChild(toolbar);

                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'svg-inline-edit';
                    const currentOverride = (this.settings.groupLabelOverrides && this.settings.groupLabelOverrides[groupName]) || groupName;
                    input.value = currentOverride;
                    popup.appendChild(input);

                    document.body.appendChild(popup);
                    input.focus();
                    input.select();

                    const commit = () => {
                        const newText = input.value.trim();
                        if (!this.settings.groupLabelOverrides) this.settings.groupLabelOverrides = {};
                        if (newText && newText !== groupName) {
                            this.settings.groupLabelOverrides[groupName] = newText;
                        } else {
                            delete this.settings.groupLabelOverrides[groupName];
                        }
                        this.settings.groupLabelFont = {
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
            })(name, labelEl);

            xOff += 13 + displayName.length * 6 + 12;
            if (xOff > maxWidth) break;
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
        lg.call(d3.drag()
            .on('start', function() { d3.select(this).style('cursor', 'grabbing'); })
            .on('drag', function(event) {
                self._legendOffset.x += event.dx;
                self._legendOffset.y += event.dy;
                const nx = x + self._legendOffset.x;
                const ny = y + self._legendOffset.y;
                d3.select(this).attr('transform', `translate(${nx}, ${ny})`);
            })
            .on('end', function() { d3.select(this).style('cursor', 'grab'); })
        );

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
            ltEl.call(d3.drag()
                .on('start', function() { ltDragged = false; })
                .on('drag', (event) => {
                    ltDragged = true;
                    this._legendTitleOffset.x += event.dx;
                    this._legendTitleOffset.y += event.dy;
                    ltEl.attr('x', w / 2 + this._legendTitleOffset.x)
                        .attr('y', h + 24 + this._legendTitleOffset.y);
                })
            );

            // Double-click to edit with font toolbar
            ltEl.on('dblclick', () => {
                if (ltDragged) { ltDragged = false; return; }
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

    _createFontToolbar(fontObj) {
        const toolbar = document.createElement('div');
        toolbar.className = 'svg-edit-toolbar';

        const familySelect = document.createElement('select');
        familySelect.className = 'svg-edit-font-family';
        ['Arial', 'Helvetica', 'Times New Roman', 'Courier New'].forEach(f => {
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
            .on('start', function() { wasDragged = false; d3.select(this).style('cursor', 'grabbing'); })
            .on('drag', function(event) {
                wasDragged = true;
                self._titleOffset.x += event.dx;
                self._titleOffset.y += event.dy;
                d3.select(this)
                    .attr('x', width / 2 + self._titleOffset.x)
                    .attr('y', 18 + self._titleOffset.y);
            })
            .on('end', function() { d3.select(this).style('cursor', 'grab'); })
        );

        titleEl.on('dblclick', () => {
            if (wasDragged) { wasDragged = false; return; }
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
        const { colLabels, rowLabels, matrix } = matrixData;
        const groups = this._detectGroups(rowLabels);

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
