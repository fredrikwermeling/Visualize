// heatmap.js - D3.js heatmap renderer with optional clustering & dendrograms

class HeatmapRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.settings = {
            cluster: 'none',
            linkage: 'average',
            normalize: 'none',
            colorScheme: 'RdBu',
            showValues: false,
            title: 'Heatmap'
        };
    }

    render(matrixData, settings) {
        Object.assign(this.settings, settings);
        this.container.innerHTML = '';

        const { colLabels, rowLabels, matrix } = matrixData;
        if (!matrix || matrix.length === 0 || matrix[0].length === 0) {
            this.container.innerHTML = '<div class="empty-state"><h3>Enter numeric data to generate heatmap</h3></div>';
            return;
        }

        // Normalize
        const normMatrix = this._normalize(matrix, this.settings.normalize);

        // Clustering
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

        // Get all numeric values for color scale
        const allValues = [];
        for (const row of normMatrix) {
            for (const v of row) {
                if (!isNaN(v)) allValues.push(v);
            }
        }
        if (allValues.length === 0) {
            this.container.innerHTML = '<div class="empty-state"><h3>No numeric data found</h3></div>';
            return;
        }

        const colorScale = this._buildColorScale(allValues, this.settings.colorScheme);

        // Layout dimensions
        const width = parseInt(document.getElementById('graphWidth')?.value) || 600;
        const height = parseInt(document.getElementById('graphHeight')?.value) || 400;

        const rowDendroWidth = rowTree ? 60 : 0;
        const colDendroHeight = colTree ? 60 : 0;
        const titleHeight = 30;

        // Measure label sizes
        const maxRowLabel = Math.max(...rowLabels.map(l => l.length)) * 7;
        const rowLabelWidth = Math.min(Math.max(maxRowLabel, 40), 120);
        const colLabelHeight = Math.min(Math.max(...colLabels.map(l => l.length)) * 5, 80);
        const legendWidth = 50;

        const marginTop = titleHeight + colDendroHeight + 5;
        const marginLeft = rowDendroWidth + 5;
        const marginRight = rowLabelWidth + legendWidth + 15;
        const marginBottom = colLabelHeight + 10;

        const cellAreaWidth = width - marginLeft - marginRight;
        const cellAreaHeight = height - marginTop - marginBottom;

        if (cellAreaWidth <= 0 || cellAreaHeight <= 0) {
            this.container.innerHTML = '<div class="empty-state"><h3>Increase dimensions for heatmap</h3></div>';
            return;
        }

        const svg = d3.select(this.container).append('svg')
            .attr('class', 'graph-svg heatmap-svg')
            .attr('width', width)
            .attr('height', height)
            .style('background', 'white');

        const nRows = rowOrder.length;
        const nCols = colOrder.length;

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

        // Draw cells
        this._drawCells(cellGroup, normMatrix, rowOrder, colOrder, xScale, yScale, colorScale);

        // Row labels (right of matrix)
        this._drawRowLabels(cellGroup, rowLabels, rowOrder, yScale, cellAreaWidth);

        // Column labels (bottom, angled 45°)
        this._drawColLabels(cellGroup, colLabels, colOrder, xScale, cellAreaHeight);

        // Dendrograms
        if (rowTree) {
            const dendroGroup = svg.append('g')
                .attr('transform', `translate(${5}, ${marginTop})`);
            this._drawDendrogram(dendroGroup, rowTree, yScale, 'left', rowDendroWidth - 5, cellAreaHeight);
        }
        if (colTree) {
            const dendroGroup = svg.append('g')
                .attr('transform', `translate(${marginLeft}, ${titleHeight + 5})`);
            this._drawDendrogram(dendroGroup, colTree, xScale, 'top', cellAreaWidth, colDendroHeight - 5);
        }

        // Color legend
        this._drawColorLegend(svg, colorScale, width - legendWidth - 5, marginTop, legendWidth - 10, cellAreaHeight);
    }

    _normalize(matrix, mode) {
        // Deep copy
        const m = matrix.map(r => [...r]);
        if (mode === 'none') return m;

        const rows = m.length;
        const cols = m[0].length;

        if (mode === 'all') {
            const vals = [];
            for (const row of m) for (const v of row) if (!isNaN(v)) vals.push(v);
            const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
            const std = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length) || 1;
            for (let r = 0; r < rows; r++)
                for (let c = 0; c < cols; c++)
                    if (!isNaN(m[r][c])) m[r][c] = (m[r][c] - mean) / std;
        } else if (mode === 'row') {
            for (let r = 0; r < rows; r++) {
                const vals = m[r].filter(v => !isNaN(v));
                if (vals.length === 0) continue;
                const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
                const std = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length) || 1;
                for (let c = 0; c < cols; c++)
                    if (!isNaN(m[r][c])) m[r][c] = (m[r][c] - mean) / std;
            }
        } else if (mode === 'col') {
            for (let c = 0; c < cols; c++) {
                const vals = [];
                for (let r = 0; r < rows; r++) if (!isNaN(m[r][c])) vals.push(m[r][c]);
                if (vals.length === 0) continue;
                const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
                const std = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length) || 1;
                for (let r = 0; r < rows; r++)
                    if (!isNaN(m[r][c])) m[r][c] = (m[r][c] - mean) / std;
            }
        }

        return m;
    }

    _buildColorScale(values, scheme) {
        const min = d3.min(values);
        const max = d3.max(values);

        const interpolators = {
            'RdBu': t => d3.interpolateRdBu(1 - t),  // reversed: red=high, blue=low
            'RdYlGn': t => d3.interpolateRdYlGn(1 - t),
            'Viridis': d3.interpolateViridis,
            'YlOrRd': d3.interpolateYlOrRd,
            'BuPu': d3.interpolateBuPu
        };

        const interpolator = interpolators[scheme] || interpolators['RdBu'];

        return d3.scaleSequential(interpolator).domain([min, max]);
    }

    _drawCells(g, matrix, rowOrder, colOrder, xScale, yScale, colorScale) {
        const cellWidth = xScale.bandwidth();
        const cellHeight = yScale.bandwidth();
        const showValues = this.settings.showValues;
        const fontSize = Math.min(cellWidth, cellHeight, 12) * 0.7;

        for (const ri of rowOrder) {
            for (const ci of colOrder) {
                const val = matrix[ri][ci];
                if (isNaN(val)) continue;

                const x = xScale(ci);
                const y = yScale(ri);

                g.append('rect')
                    .attr('x', x)
                    .attr('y', y)
                    .attr('width', cellWidth)
                    .attr('height', cellHeight)
                    .attr('fill', colorScale(val))
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 0.5);

                if (showValues && fontSize >= 5) {
                    // Determine text color based on background luminance
                    const rgb = d3.rgb(colorScale(val));
                    const lum = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
                    const textColor = lum > 128 ? '#000' : '#fff';

                    g.append('text')
                        .attr('x', x + cellWidth / 2)
                        .attr('y', y + cellHeight / 2)
                        .attr('text-anchor', 'middle')
                        .attr('dominant-baseline', 'central')
                        .attr('font-size', fontSize + 'px')
                        .attr('fill', textColor)
                        .text(val.toFixed(1));
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

    _drawDendrogram(g, tree, scale, orientation, span, depth) {
        if (!tree || tree.index !== undefined) return;

        const maxHeight = tree.height || 1;
        const leafPositions = {};

        // Compute leaf center positions from scale
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
                // height goes left (0=right edge, 1=left edge)
                const x1 = span * (1 - leftH);
                const x2 = span * (1 - rightH);
                const xMerge = span * (1 - nodeH);

                // Vertical line connecting children
                g.append('line')
                    .attr('x1', xMerge).attr('y1', leftPos)
                    .attr('x2', xMerge).attr('y2', rightPos)
                    .attr('stroke', '#666').attr('stroke-width', 1);
                // Horizontal to left child
                g.append('line')
                    .attr('x1', xMerge).attr('y1', leftPos)
                    .attr('x2', x1).attr('y2', leftPos)
                    .attr('stroke', '#666').attr('stroke-width', 1);
                // Horizontal to right child
                g.append('line')
                    .attr('x1', xMerge).attr('y1', rightPos)
                    .attr('x2', x2).attr('y2', rightPos)
                    .attr('stroke', '#666').attr('stroke-width', 1);
            } else {
                // orientation === 'top': height goes up (0=bottom, 1=top)
                const y1 = depth * (1 - leftH);
                const y2 = depth * (1 - rightH);
                const yMerge = depth * (1 - nodeH);

                // Horizontal line connecting children
                g.append('line')
                    .attr('x1', leftPos).attr('y1', yMerge)
                    .attr('x2', rightPos).attr('y2', yMerge)
                    .attr('stroke', '#666').attr('stroke-width', 1);
                // Vertical to left child
                g.append('line')
                    .attr('x1', leftPos).attr('y1', yMerge)
                    .attr('x2', leftPos).attr('y2', y1)
                    .attr('stroke', '#666').attr('stroke-width', 1);
                // Vertical to right child
                g.append('line')
                    .attr('x1', rightPos).attr('y1', yMerge)
                    .attr('x2', rightPos).attr('y2', y2)
                    .attr('stroke', '#666').attr('stroke-width', 1);
            }

            return centerPos;
        };

        drawNode(tree);
    }

    _drawColorLegend(svg, colorScale, x, y, w, h) {
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

        const lg = svg.append('g').attr('transform', `translate(${x}, ${y})`);

        lg.append('rect')
            .attr('x', 0).attr('y', 0)
            .attr('width', w).attr('height', h)
            .attr('fill', `url(#${gradientId})`)
            .attr('stroke', '#ccc')
            .attr('stroke-width', 0.5);

        // Min/max labels
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
    }

    _drawTitle(svg, width, title) {
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 18)
            .attr('text-anchor', 'middle')
            .attr('font-size', '16px')
            .attr('font-weight', 'bold')
            .attr('fill', '#333')
            .text(title);
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
