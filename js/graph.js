// graph.js - D3.js graph rendering engine

class GraphRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.svg = null;
        this.width = 600;
        this.height = 400;
        this.margin = { top: 60, right: 30, bottom: 80, left: 70 };

        // Default settings
        this.settings = {
            title: 'Graph Title',
            xLabel: 'Groups',
            yLabel: 'Values',
            fontFamily: 'Arial',
            fontSize: 12,
            fontBold: false,
            fontItalic: false,
            graphType: 'column-bar-mean',
            yAxisMin: null,
            yAxisMax: null
        };

        // Color palette (scientific)
        this.colors = [
            '#5B8DB8', '#E8927C', '#7EBF7E', '#C490D1',
            '#F2CC8F', '#81D4DB', '#FF9F9F', '#A8D5A2',
            '#C2A0D5', '#F4B183'
        ];

        // Significance results to draw brackets
        this.significanceResults = [];
    }

    get innerWidth() {
        return this.width - this.margin.left - this.margin.right;
    }

    get innerHeight() {
        return this.height - this.margin.top - this.margin.bottom;
    }

    updateSettings(settings) {
        Object.assign(this.settings, settings);
    }

    setDimensions(width, height) {
        this.width = width;
        this.height = height;
    }

    setSignificance(results) {
        this.significanceResults = results || [];
    }

    render(data) {
        // Clear previous graph
        this.container.innerHTML = '';

        // Filter out columns with no data
        const filteredData = data.filter(d => d.values.length > 0);
        if (filteredData.length === 0) {
            this.container.innerHTML = '<div class="empty-state"><h3>Enter data to see your graph</h3><p>Type numbers into the table on the left</p></div>';
            return;
        }

        // Create SVG
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('class', 'graph-svg');

        const g = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        // Create scales
        const xScale = d3.scaleBand()
            .domain(filteredData.map(d => d.label))
            .range([0, this.innerWidth])
            .padding(0.4);

        const allValues = filteredData.flatMap(d => d.values);
        const autoMin = 0;
        const yMaxRaw = d3.max(allValues);

        // Add some headroom for error bars and significance brackets
        const headroom = this.significanceResults.length > 0 ? 0.25 : 0.15;
        const autoMax = yMaxRaw * (1 + headroom);

        const hasManualMin = this.settings.yAxisMin !== null;
        const hasManualMax = this.settings.yAxisMax !== null;
        let yMin = hasManualMin ? this.settings.yAxisMin : autoMin;
        let yMax = hasManualMax ? this.settings.yAxisMax : autoMax;

        // Guard: if min >= max, ignore both and auto-scale
        if (yMin >= yMax) {
            yMin = autoMin;
            yMax = autoMax;
        }

        const yScale = d3.scaleLinear()
            .domain([yMin, yMax])
            .range([this.innerHeight, 0]);

        // Only apply .nice() when using auto bounds
        if (!hasManualMin && !hasManualMax) {
            yScale.nice();
        }

        // Draw axes
        this._drawAxes(g, xScale, yScale);

        // Draw graph based on type
        switch (this.settings.graphType) {
            case 'scatter-only':
                this._drawScatterOnly(g, filteredData, xScale, yScale);
                break;
            case 'column-points-mean':
                this._drawScatterWithLine(g, filteredData, xScale, yScale, 'mean');
                break;
            case 'column-points-median':
                this._drawScatterWithLine(g, filteredData, xScale, yScale, 'median');
                break;
            case 'column-bar-mean':
                this._drawBarWithError(g, filteredData, xScale, yScale, 'sd');
                break;
            case 'column-bar-sem':
                this._drawBarWithError(g, filteredData, xScale, yScale, 'sem');
                break;
            case 'column-bar-median':
                this._drawBarMedianIQR(g, filteredData, xScale, yScale);
                break;
            case 'scatter-bar-mean-sd':
                this._drawScatterBar(g, filteredData, xScale, yScale, 'sd');
                break;
            case 'scatter-bar-mean-sem':
                this._drawScatterBar(g, filteredData, xScale, yScale, 'sem');
                break;
            case 'box-plot':
                this._drawBoxPlot(g, filteredData, xScale, yScale);
                break;
            case 'violin-plot':
                this._drawViolinPlot(g, filteredData, xScale, yScale);
                break;
            case 'violin-box':
                this._drawViolinBox(g, filteredData, xScale, yScale);
                break;
            case 'before-after':
                this._drawBeforeAfter(g, filteredData, xScale, yScale);
                break;
            default:
                this._drawBarWithError(g, filteredData, xScale, yScale, 'sd');
        }

        // Draw title and axis labels
        this._drawLabels();

        // Draw significance brackets
        if (this.significanceResults.length > 0) {
            this._drawSignificanceBrackets(g, filteredData, xScale, yScale);
        }
    }

    _drawAxes(g, xScale, yScale) {
        const fontStyle = this._getFontStyle();

        // X axis
        const xAxis = g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${this.innerHeight})`)
            .call(d3.axisBottom(xScale));

        xAxis.selectAll('text')
            .style('font-family', fontStyle.fontFamily)
            .style('font-size', `${this.settings.fontSize}px`)
            .style('font-weight', fontStyle.fontWeight)
            .style('font-style', fontStyle.fontStyle);

        // Y axis
        const yAxis = g.append('g')
            .attr('class', 'y-axis')
            .call(d3.axisLeft(yScale));

        yAxis.selectAll('text')
            .style('font-family', fontStyle.fontFamily)
            .style('font-size', `${this.settings.fontSize}px`)
            .style('font-weight', fontStyle.fontWeight)
            .style('font-style', fontStyle.fontStyle);

        // Remove domain lines for cleaner look
        g.selectAll('.domain').attr('stroke', '#333');
        g.selectAll('.tick line').attr('stroke', '#ccc');
    }

    _drawLabels() {
        const fontStyle = this._getFontStyle();

        // Graph title
        this.svg.append('text')
            .attr('class', 'graph-title')
            .attr('x', this.width / 2)
            .attr('y', this.margin.top / 2)
            .attr('text-anchor', 'middle')
            .style('font-family', fontStyle.fontFamily)
            .style('font-size', `${this.settings.fontSize + 6}px`)
            .style('font-weight', 'bold')
            .style('font-style', fontStyle.fontStyle)
            .text(this.settings.title)
            .on('click', (event) => this._startInlineEdit(event, 'title'));

        // X axis label
        this.svg.append('text')
            .attr('class', 'axis-label x-label')
            .attr('x', this.width / 2)
            .attr('y', this.height - 10)
            .attr('text-anchor', 'middle')
            .style('font-family', fontStyle.fontFamily)
            .style('font-size', `${this.settings.fontSize + 2}px`)
            .style('font-weight', fontStyle.fontWeight)
            .style('font-style', fontStyle.fontStyle)
            .text(this.settings.xLabel)
            .on('click', (event) => this._startInlineEdit(event, 'xLabel'));

        // Y axis label
        this.svg.append('text')
            .attr('class', 'axis-label y-label')
            .attr('x', -(this.height / 2))
            .attr('y', 18)
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .style('font-family', fontStyle.fontFamily)
            .style('font-size', `${this.settings.fontSize + 2}px`)
            .style('font-weight', fontStyle.fontWeight)
            .style('font-style', fontStyle.fontStyle)
            .text(this.settings.yLabel)
            .on('click', (event) => this._startInlineEdit(event, 'yLabel'));
    }

    _startInlineEdit(event, labelType) {
        // Remove any existing inline edit
        const existing = document.querySelector('.svg-inline-edit');
        if (existing) existing.remove();

        const textEl = event.target;
        const rect = textEl.getBoundingClientRect();

        // Map label type to settings key and sidebar input ID
        const map = {
            title:  { settingsKey: 'title',  inputId: 'graphTitle' },
            xLabel: { settingsKey: 'xLabel', inputId: 'xAxisLabel' },
            yLabel: { settingsKey: 'yLabel', inputId: 'yAxisLabel' }
        };
        const { settingsKey, inputId } = map[labelType];

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'svg-inline-edit';
        input.value = this.settings[settingsKey];

        // Position overlay on top of the SVG text element
        input.style.left = `${rect.left + window.scrollX}px`;
        input.style.top = `${rect.top + window.scrollY - 2}px`;
        input.style.width = `${Math.max(rect.width + 20, 120)}px`;
        input.style.height = `${rect.height + 6}px`;
        input.style.fontSize = `${parseFloat(getComputedStyle(textEl).fontSize)}px`;
        input.style.fontFamily = this.settings.fontFamily;

        document.body.appendChild(input);
        input.focus();
        input.select();

        const commit = () => {
            const newValue = input.value;
            this.settings[settingsKey] = newValue;
            // Sync sidebar input
            const sidebarInput = document.getElementById(inputId);
            if (sidebarInput) sidebarInput.value = newValue;
            input.remove();
            // Re-render
            if (window.app) window.app.updateGraph();
        };

        const cancel = () => {
            input.remove();
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
            }
        });

        input.addEventListener('blur', () => {
            // Small delay to allow keydown to fire first
            setTimeout(() => {
                if (document.body.contains(input)) {
                    commit();
                }
            }, 0);
        });
    }

    _drawScatterWithLine(g, data, xScale, yScale, centerType) {
        data.forEach((group, i) => {
            const color = this.colors[i % this.colors.length];
            const cx = xScale(group.label) + xScale.bandwidth() / 2;

            // Draw individual points with jitter
            const jitterWidth = Math.min(xScale.bandwidth() * 0.3, 30);
            g.selectAll(`.point-${i}`)
                .data(group.values)
                .enter()
                .append('circle')
                .attr('class', `point point-${i}`)
                .attr('cx', () => cx + (Math.random() - 0.5) * jitterWidth)
                .attr('cy', d => yScale(d))
                .attr('r', 4)
                .attr('fill', '#333')
                .attr('opacity', 0.7);

            // Draw center line (mean or median)
            const centerValue = centerType === 'mean'
                ? Statistics.mean(group.values)
                : Statistics.median(group.values);

            const lineWidth = xScale.bandwidth() * 0.5;
            g.append('line')
                .attr('class', 'center-line')
                .attr('x1', cx - lineWidth / 2)
                .attr('x2', cx + lineWidth / 2)
                .attr('y1', yScale(centerValue))
                .attr('y2', yScale(centerValue))
                .attr('stroke', '#333')
                .attr('stroke-width', 2);
        });
    }

    _drawBarWithError(g, data, xScale, yScale, errorType) {
        data.forEach((group, i) => {
            const color = this.colors[i % this.colors.length];
            const cx = xScale(group.label) + xScale.bandwidth() / 2;
            const meanVal = Statistics.mean(group.values);
            const errorVal = errorType === 'sd'
                ? Statistics.std(group.values)
                : Statistics.sem(group.values);

            // Draw bar
            g.append('rect')
                .attr('class', 'bar')
                .attr('x', xScale(group.label))
                .attr('y', yScale(meanVal))
                .attr('width', xScale.bandwidth())
                .attr('height', this.innerHeight - yScale(meanVal))
                .attr('fill', color)
                .attr('stroke', '#333')
                .attr('stroke-width', 1)
                .attr('opacity', 0.8);

            // Draw error bar
            if (group.values.length > 1) {
                const errorTop = meanVal + errorVal;
                const errorBottom = meanVal - errorVal;
                const capWidth = xScale.bandwidth() * 0.2;

                // Vertical line
                g.append('line')
                    .attr('class', 'error-bar')
                    .attr('x1', cx)
                    .attr('x2', cx)
                    .attr('y1', yScale(errorTop))
                    .attr('y2', yScale(Math.max(0, errorBottom)))
                    .attr('stroke', '#333')
                    .attr('stroke-width', 1.5);

                // Top cap
                g.append('line')
                    .attr('class', 'error-cap')
                    .attr('x1', cx - capWidth)
                    .attr('x2', cx + capWidth)
                    .attr('y1', yScale(errorTop))
                    .attr('y2', yScale(errorTop))
                    .attr('stroke', '#333')
                    .attr('stroke-width', 1.5);

                // Bottom cap (only if above 0)
                if (errorBottom > 0) {
                    g.append('line')
                        .attr('class', 'error-cap')
                        .attr('x1', cx - capWidth)
                        .attr('x2', cx + capWidth)
                        .attr('y1', yScale(errorBottom))
                        .attr('y2', yScale(errorBottom))
                        .attr('stroke', '#333')
                        .attr('stroke-width', 1.5);
                }
            }

            // Overlay individual data points
            const jitterWidth = Math.min(xScale.bandwidth() * 0.3, 20);
            g.selectAll(`.dot-${i}`)
                .data(group.values)
                .enter()
                .append('circle')
                .attr('class', `dot dot-${i}`)
                .attr('cx', () => cx + (Math.random() - 0.5) * jitterWidth)
                .attr('cy', d => yScale(d))
                .attr('r', 3.5)
                .attr('fill', '#333')
                .attr('opacity', 0.7);
        });
    }

    _drawBoxPlot(g, data, xScale, yScale) {
        data.forEach((group, i) => {
            const color = this.colors[i % this.colors.length];
            const cx = xScale(group.label) + xScale.bandwidth() / 2;
            const sorted = [...group.values].sort((a, b) => a - b);
            const q = Statistics.quartiles(group.values);
            const iqr = q.q3 - q.q1;
            const min = Math.max(d3.min(sorted), q.q1 - 1.5 * iqr);
            const max = Math.min(d3.max(sorted), q.q3 + 1.5 * iqr);
            const boxWidth = xScale.bandwidth() * 0.6;

            // Box
            g.append('rect')
                .attr('x', cx - boxWidth / 2)
                .attr('y', yScale(q.q3))
                .attr('width', boxWidth)
                .attr('height', yScale(q.q1) - yScale(q.q3))
                .attr('fill', color)
                .attr('stroke', '#333')
                .attr('stroke-width', 1.5)
                .attr('opacity', 0.8);

            // Median line
            g.append('line')
                .attr('x1', cx - boxWidth / 2)
                .attr('x2', cx + boxWidth / 2)
                .attr('y1', yScale(q.q2))
                .attr('y2', yScale(q.q2))
                .attr('stroke', '#333')
                .attr('stroke-width', 2);

            // Whiskers
            const whiskerWidth = boxWidth * 0.5;

            // Lower whisker
            g.append('line')
                .attr('x1', cx).attr('x2', cx)
                .attr('y1', yScale(q.q1)).attr('y2', yScale(min))
                .attr('stroke', '#333').attr('stroke-width', 1.5);
            g.append('line')
                .attr('x1', cx - whiskerWidth / 2).attr('x2', cx + whiskerWidth / 2)
                .attr('y1', yScale(min)).attr('y2', yScale(min))
                .attr('stroke', '#333').attr('stroke-width', 1.5);

            // Upper whisker
            g.append('line')
                .attr('x1', cx).attr('x2', cx)
                .attr('y1', yScale(q.q3)).attr('y2', yScale(max))
                .attr('stroke', '#333').attr('stroke-width', 1.5);
            g.append('line')
                .attr('x1', cx - whiskerWidth / 2).attr('x2', cx + whiskerWidth / 2)
                .attr('y1', yScale(max)).attr('y2', yScale(max))
                .attr('stroke', '#333').attr('stroke-width', 1.5);

            // Outliers
            const outliers = sorted.filter(v => v < q.q1 - 1.5 * iqr || v > q.q3 + 1.5 * iqr);
            g.selectAll(`.outlier-${i}`)
                .data(outliers)
                .enter()
                .append('circle')
                .attr('cx', cx)
                .attr('cy', d => yScale(d))
                .attr('r', 3)
                .attr('fill', 'none')
                .attr('stroke', '#333')
                .attr('stroke-width', 1.5);
        });
    }

    _drawViolinPlot(g, data, xScale, yScale) {
        data.forEach((group, i) => {
            const color = this.colors[i % this.colors.length];
            const cx = xScale(group.label) + xScale.bandwidth() / 2;

            if (group.values.length < 3) {
                // Fall back to box plot for too few values
                this._drawBoxPlot(g, [group], xScale, yScale);
                return;
            }

            // Kernel density estimation
            const kde = this._kernelDensityEstimator(
                this._epanechnikovKernel(7),
                yScale.ticks(40)
            );
            const density = kde(group.values);

            // Scale density to fit within band
            const maxDensity = d3.max(density, d => d[1]);
            const violinWidth = xScale.bandwidth() * 0.45;

            const xDensityScale = d3.scaleLinear()
                .domain([0, maxDensity])
                .range([0, violinWidth]);

            // Draw violin shape
            const area = d3.area()
                .x0(d => cx - xDensityScale(d[1]))
                .x1(d => cx + xDensityScale(d[1]))
                .y(d => yScale(d[0]))
                .curve(d3.curveCatmullRom);

            g.append('path')
                .datum(density)
                .attr('d', area)
                .attr('fill', color)
                .attr('stroke', '#333')
                .attr('stroke-width', 1)
                .attr('opacity', 0.7);

            // Add median line
            const medianVal = Statistics.median(group.values);
            const medianDensity = this._interpolateDensity(density, medianVal);
            const medianHalfWidth = xDensityScale(medianDensity);

            g.append('line')
                .attr('x1', cx - medianHalfWidth)
                .attr('x2', cx + medianHalfWidth)
                .attr('y1', yScale(medianVal))
                .attr('y2', yScale(medianVal))
                .attr('stroke', '#fff')
                .attr('stroke-width', 2);

            // Add individual points (small, along center)
            const jitterWidth = Math.min(violinWidth * 0.3, 10);
            g.selectAll(`.vdot-${i}`)
                .data(group.values)
                .enter()
                .append('circle')
                .attr('cx', () => cx + (Math.random() - 0.5) * jitterWidth)
                .attr('cy', d => yScale(d))
                .attr('r', 2.5)
                .attr('fill', '#333')
                .attr('opacity', 0.5);
        });
    }

    _drawScatterOnly(g, data, xScale, yScale) {
        data.forEach((group, i) => {
            const color = this.colors[i % this.colors.length];
            const cx = xScale(group.label) + xScale.bandwidth() / 2;
            const jitterWidth = Math.min(xScale.bandwidth() * 0.35, 35);

            g.selectAll(`.spoint-${i}`)
                .data(group.values)
                .enter()
                .append('circle')
                .attr('class', `spoint spoint-${i}`)
                .attr('cx', () => cx + (Math.random() - 0.5) * jitterWidth)
                .attr('cy', d => yScale(d))
                .attr('r', 4.5)
                .attr('fill', color)
                .attr('stroke', '#333')
                .attr('stroke-width', 0.5)
                .attr('opacity', 0.8);
        });
    }

    _drawBarMedianIQR(g, data, xScale, yScale) {
        data.forEach((group, i) => {
            const color = this.colors[i % this.colors.length];
            const cx = xScale(group.label) + xScale.bandwidth() / 2;
            const medianVal = Statistics.median(group.values);
            const q = Statistics.quartiles(group.values);

            // Draw bar at median height
            g.append('rect')
                .attr('class', 'bar')
                .attr('x', xScale(group.label))
                .attr('y', yScale(medianVal))
                .attr('width', xScale.bandwidth())
                .attr('height', this.innerHeight - yScale(medianVal))
                .attr('fill', color)
                .attr('stroke', '#333')
                .attr('stroke-width', 1)
                .attr('opacity', 0.8);

            // Error bars from Q1 to Q3
            if (group.values.length > 1) {
                const capWidth = xScale.bandwidth() * 0.2;

                // Vertical line
                g.append('line')
                    .attr('x1', cx).attr('x2', cx)
                    .attr('y1', yScale(q.q3)).attr('y2', yScale(q.q1))
                    .attr('stroke', '#333').attr('stroke-width', 1.5);

                // Top cap (Q3)
                g.append('line')
                    .attr('x1', cx - capWidth).attr('x2', cx + capWidth)
                    .attr('y1', yScale(q.q3)).attr('y2', yScale(q.q3))
                    .attr('stroke', '#333').attr('stroke-width', 1.5);

                // Bottom cap (Q1)
                g.append('line')
                    .attr('x1', cx - capWidth).attr('x2', cx + capWidth)
                    .attr('y1', yScale(q.q1)).attr('y2', yScale(q.q1))
                    .attr('stroke', '#333').attr('stroke-width', 1.5);
            }

            // Overlay individual data points
            const jitterWidth = Math.min(xScale.bandwidth() * 0.3, 20);
            g.selectAll(`.mdot-${i}`)
                .data(group.values)
                .enter()
                .append('circle')
                .attr('class', `mdot mdot-${i}`)
                .attr('cx', () => cx + (Math.random() - 0.5) * jitterWidth)
                .attr('cy', d => yScale(d))
                .attr('r', 3.5)
                .attr('fill', '#333')
                .attr('opacity', 0.7);
        });
    }

    _drawScatterBar(g, data, xScale, yScale, errorType) {
        data.forEach((group, i) => {
            const color = this.colors[i % this.colors.length];
            const cx = xScale(group.label) + xScale.bandwidth() / 2;
            const meanVal = Statistics.mean(group.values);
            const errorVal = errorType === 'sd'
                ? Statistics.std(group.values)
                : Statistics.sem(group.values);

            // Draw transparent bar
            g.append('rect')
                .attr('class', 'bar')
                .attr('x', xScale(group.label))
                .attr('y', yScale(meanVal))
                .attr('width', xScale.bandwidth())
                .attr('height', this.innerHeight - yScale(meanVal))
                .attr('fill', color)
                .attr('stroke', '#333')
                .attr('stroke-width', 1)
                .attr('opacity', 0.4);

            // Error bars
            if (group.values.length > 1) {
                const errorTop = meanVal + errorVal;
                const errorBottom = meanVal - errorVal;
                const capWidth = xScale.bandwidth() * 0.2;

                g.append('line')
                    .attr('x1', cx).attr('x2', cx)
                    .attr('y1', yScale(errorTop)).attr('y2', yScale(Math.max(0, errorBottom)))
                    .attr('stroke', '#333').attr('stroke-width', 1.5);

                g.append('line')
                    .attr('x1', cx - capWidth).attr('x2', cx + capWidth)
                    .attr('y1', yScale(errorTop)).attr('y2', yScale(errorTop))
                    .attr('stroke', '#333').attr('stroke-width', 1.5);

                if (errorBottom > 0) {
                    g.append('line')
                        .attr('x1', cx - capWidth).attr('x2', cx + capWidth)
                        .attr('y1', yScale(errorBottom)).attr('y2', yScale(errorBottom))
                        .attr('stroke', '#333').attr('stroke-width', 1.5);
                }
            }

            // Larger scatter points (emphasis on data)
            const jitterWidth = Math.min(xScale.bandwidth() * 0.35, 25);
            g.selectAll(`.sbdot-${i}`)
                .data(group.values)
                .enter()
                .append('circle')
                .attr('class', `sbdot sbdot-${i}`)
                .attr('cx', () => cx + (Math.random() - 0.5) * jitterWidth)
                .attr('cy', d => yScale(d))
                .attr('r', 4.5)
                .attr('fill', '#333')
                .attr('opacity', 0.75);
        });
    }

    _drawViolinBox(g, data, xScale, yScale) {
        data.forEach((group, i) => {
            const color = this.colors[i % this.colors.length];
            const cx = xScale(group.label) + xScale.bandwidth() / 2;

            if (group.values.length < 3) {
                this._drawBoxPlot(g, [group], xScale, yScale);
                return;
            }

            // Kernel density estimation (same as violin plot)
            const kde = this._kernelDensityEstimator(
                this._epanechnikovKernel(7),
                yScale.ticks(40)
            );
            const density = kde(group.values);

            const maxDensity = d3.max(density, d => d[1]);
            const violinWidth = xScale.bandwidth() * 0.45;

            const xDensityScale = d3.scaleLinear()
                .domain([0, maxDensity])
                .range([0, violinWidth]);

            // Draw violin shape
            const area = d3.area()
                .x0(d => cx - xDensityScale(d[1]))
                .x1(d => cx + xDensityScale(d[1]))
                .y(d => yScale(d[0]))
                .curve(d3.curveCatmullRom);

            g.append('path')
                .datum(density)
                .attr('d', area)
                .attr('fill', color)
                .attr('stroke', '#333')
                .attr('stroke-width', 1)
                .attr('opacity', 0.7);

            // Draw narrow inner box plot (15% of bandwidth)
            const q = Statistics.quartiles(group.values);
            const iqr = q.q3 - q.q1;
            const boxWidth = xScale.bandwidth() * 0.15;
            const sorted = [...group.values].sort((a, b) => a - b);
            const whiskerMin = Math.max(d3.min(sorted), q.q1 - 1.5 * iqr);
            const whiskerMax = Math.min(d3.max(sorted), q.q3 + 1.5 * iqr);

            // Box
            g.append('rect')
                .attr('x', cx - boxWidth / 2)
                .attr('y', yScale(q.q3))
                .attr('width', boxWidth)
                .attr('height', yScale(q.q1) - yScale(q.q3))
                .attr('fill', '#333')
                .attr('stroke', '#333')
                .attr('stroke-width', 1)
                .attr('opacity', 0.5);

            // Median line (white)
            g.append('line')
                .attr('x1', cx - boxWidth / 2)
                .attr('x2', cx + boxWidth / 2)
                .attr('y1', yScale(q.q2))
                .attr('y2', yScale(q.q2))
                .attr('stroke', '#fff')
                .attr('stroke-width', 2);

            // Whiskers
            g.append('line')
                .attr('x1', cx).attr('x2', cx)
                .attr('y1', yScale(q.q1)).attr('y2', yScale(whiskerMin))
                .attr('stroke', '#333').attr('stroke-width', 1.5);

            g.append('line')
                .attr('x1', cx).attr('x2', cx)
                .attr('y1', yScale(q.q3)).attr('y2', yScale(whiskerMax))
                .attr('stroke', '#333').attr('stroke-width', 1.5);
        });
    }

    _drawBeforeAfter(g, data, xScale, yScale) {
        // Draw connecting lines between row-paired values across groups
        // First, gather row-level data
        const numRows = d3.max(data, d => d.values.length);

        // Draw connecting lines for each row
        for (let row = 0; row < numRows; row++) {
            const points = [];
            data.forEach((group) => {
                if (row < group.values.length) {
                    const cx = xScale(group.label) + xScale.bandwidth() / 2;
                    points.push({ x: cx, y: yScale(group.values[row]) });
                }
            });

            // Draw lines connecting this row's points across groups
            if (points.length > 1) {
                for (let j = 0; j < points.length - 1; j++) {
                    g.append('line')
                        .attr('x1', points[j].x)
                        .attr('y1', points[j].y)
                        .attr('x2', points[j + 1].x)
                        .attr('y2', points[j + 1].y)
                        .attr('stroke', '#999')
                        .attr('stroke-width', 1)
                        .attr('opacity', 0.5);
                }
            }
        }

        // Draw endpoint circles on top of lines
        data.forEach((group, i) => {
            const color = this.colors[i % this.colors.length];
            const cx = xScale(group.label) + xScale.bandwidth() / 2;

            g.selectAll(`.ba-dot-${i}`)
                .data(group.values)
                .enter()
                .append('circle')
                .attr('class', `ba-dot ba-dot-${i}`)
                .attr('cx', cx)
                .attr('cy', d => yScale(d))
                .attr('r', 5)
                .attr('fill', color)
                .attr('stroke', '#333')
                .attr('stroke-width', 1);
        });
    }

    _drawSignificanceBrackets(g, data, xScale, yScale) {
        this.significanceResults.forEach((result, idx) => {
            const group1Idx = result.group1Index;
            const group2Idx = result.group2Index;

            if (group1Idx >= data.length || group2Idx >= data.length) return;

            const x1 = xScale(data[group1Idx].label) + xScale.bandwidth() / 2;
            const x2 = xScale(data[group2Idx].label) + xScale.bandwidth() / 2;

            // Calculate bracket y position above the tallest point
            const allMax = Math.max(
                d3.max(data[group1Idx].values),
                d3.max(data[group2Idx].values)
            );
            const bracketY = yScale(allMax) - 15 - (idx * 25);
            const tickHeight = 8;

            // Left tick
            g.append('line')
                .attr('x1', x1).attr('x2', x1)
                .attr('y1', bracketY + tickHeight).attr('y2', bracketY)
                .attr('stroke', '#333').attr('stroke-width', 1.5);

            // Horizontal bar
            g.append('line')
                .attr('x1', x1).attr('x2', x2)
                .attr('y1', bracketY).attr('y2', bracketY)
                .attr('stroke', '#333').attr('stroke-width', 1.5);

            // Right tick
            g.append('line')
                .attr('x1', x2).attr('x2', x2)
                .attr('y1', bracketY + tickHeight).attr('y2', bracketY)
                .attr('stroke', '#333').attr('stroke-width', 1.5);

            // Significance label
            const label = result.significanceLabel || Statistics.getSignificanceLevel(result.pValue);
            const fontStyle = this._getFontStyle();

            g.append('text')
                .attr('x', (x1 + x2) / 2)
                .attr('y', bracketY - 4)
                .attr('text-anchor', 'middle')
                .style('font-family', fontStyle.fontFamily)
                .style('font-size', `${this.settings.fontSize}px`)
                .style('font-weight', 'bold')
                .text(label);
        });
    }

    // --- Kernel Density helpers for violin plot ---

    _kernelDensityEstimator(kernel, x) {
        return function (sample) {
            return x.map(xi => [xi, d3.mean(sample, v => kernel(xi - v))]);
        };
    }

    _epanechnikovKernel(bandwidth) {
        return function (v) {
            v = v / bandwidth;
            return Math.abs(v) <= 1 ? (0.75 * (1 - v * v)) / bandwidth : 0;
        };
    }

    _interpolateDensity(density, value) {
        for (let i = 1; i < density.length; i++) {
            if (density[i][0] >= value) {
                const t = (value - density[i - 1][0]) / (density[i][0] - density[i - 1][0]);
                return density[i - 1][1] + t * (density[i][1] - density[i - 1][1]);
            }
        }
        return 0;
    }

    _getFontStyle() {
        return {
            fontFamily: this.settings.fontFamily,
            fontWeight: this.settings.fontBold ? 'bold' : 'normal',
            fontStyle: this.settings.fontItalic ? 'italic' : 'normal'
        };
    }

    getSvgElement() {
        return this.container.querySelector('svg');
    }
}
