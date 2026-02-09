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
            graphType: 'column-points-mean',
            yAxisMin: null,
            yAxisMax: null,
            yAxisTickStep: null,
            yAxisScaleType: 'linear',
            // Per-label font settings
            titleFont:  { family: 'Arial', size: 18, bold: true,  italic: false },
            xLabelFont: { family: 'Arial', size: 14, bold: false, italic: false },
            yLabelFont: { family: 'Arial', size: 14, bold: false, italic: false },
            // Tick font
            tickFont: { family: 'Arial', size: 12, bold: false, italic: false },
            // Color
            colorTheme: 'default',
            colorOverrides: {},
            // Error bars
            errorBarDirection: 'both',
            errorBarWidth: 1.5,
            // Orientation
            orientation: 'vertical',
            // Significance
            significanceFontSize: null,
            // Stats legend
            showStatsLegend: false,
            statsTestName: '',
            // Group color legend
            showGroupLegend: false,
            groupLegendLabels: {},
            GROUP_LEGEND_WIDTH: 130,
            groupLegendOffset: { x: 0, y: 0 },     // drag offset for whole legend
            groupLegendItemOffsets: {},               // { index: {x, y} } per-item offsets
            groupLegendFont: { family: 'Arial', size: 12 },
            // Group label display
            showAxisGroupLabels: true
        };

        // Color themes
        this.colorThemes = {
            default: [
                '#5B8DB8', '#E8927C', '#7EBF7E', '#C490D1',
                '#F2CC8F', '#81D4DB', '#FF9F9F', '#A8D5A2',
                '#C2A0D5', '#F4B183'
            ],
            pastel: [
                '#AEC6CF', '#FFB7B2', '#B5EAD7', '#C7CEEA',
                '#FFDAC1', '#E2F0CB', '#F0E6EF', '#D4F0F0',
                '#FCE1E4', '#DAEAF6'
            ],
            vivid: [
                '#E63946', '#457B9D', '#2A9D8F', '#E9C46A',
                '#F4A261', '#264653', '#A8DADC', '#F77F00',
                '#D62828', '#023E8A'
            ],
            grayscale: [
                '#333333', '#666666', '#999999', '#BBBBBB',
                '#555555', '#888888', '#AAAAAA', '#CCCCCC',
                '#444444', '#777777'
            ],
            colorblind: [
                '#0072B2', '#E69F00', '#009E73', '#CC79A7',
                '#56B4E9', '#D55E00', '#F0E442', '#000000',
                '#0072B2', '#E69F00'
            ]
        };

        // Keep legacy reference
        this.colors = this.colorThemes.default;

        // Significance results to draw brackets
        this.significanceResults = [];
        // Bracket layout cache (computed during render)
        this._bracketLayout = [];
    }

    get innerWidth() {
        return this.width - this.margin.left - this.margin.right;
    }

    get innerHeight() {
        return this.height - this.margin.top - this.margin.bottom;
    }

    _getColor(index) {
        if (this.settings.colorOverrides[index]) {
            return this.settings.colorOverrides[index];
        }
        const palette = this.colorThemes[this.settings.colorTheme] || this.colorThemes.default;
        return palette[index % palette.length];
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

        const isHorizontal = this.settings.orientation === 'horizontal';

        // Adjust margins for horizontal
        const savedMargin = { ...this.margin };
        if (isHorizontal) {
            this.margin = { top: 60, right: 40, bottom: 50, left: 100 };
        } else {
            this.margin = { top: 60, right: 30, bottom: 80, left: 70 };
        }

        // Extra bottom margin for stats legend below graph
        if (this.settings.showStatsLegend && this.significanceResults.length > 0) {
            this.margin.bottom += 30;
        }

        // Extra right margin for group color legend
        if (this.settings.showGroupLegend) {
            this.margin.right += this.settings.GROUP_LEGEND_WIDTH;
        }

        // Create SVG
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('class', 'graph-svg');

        const g = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        const allValues = filteredData.flatMap(d => d.values);
        const autoMin = 0;
        const yMaxRaw = d3.max(allValues);
        const headroom = this.significanceResults.length > 0 ? 0.25 : 0.15;
        const autoMax = yMaxRaw * (1 + headroom);

        const hasManualMin = this.settings.yAxisMin !== null;
        const hasManualMax = this.settings.yAxisMax !== null;
        let yMin = hasManualMin ? this.settings.yAxisMin : autoMin;
        let yMax = hasManualMax ? this.settings.yAxisMax : autoMax;

        if (yMin >= yMax) {
            yMin = autoMin;
            yMax = autoMax;
        }

        let groupScale, valueScale;

        // For log scales, ensure domain minimum > 0
        const scaleType = this.settings.yAxisScaleType;
        if (scaleType === 'log10' || scaleType === 'log2') {
            if (yMin <= 0) yMin = 0.1;
            if (yMax <= yMin) yMax = yMin * 10;
        }

        const createValueScale = (range) => {
            if (scaleType === 'log10') {
                return d3.scaleLog().base(10).domain([yMin, yMax]).range(range);
            } else if (scaleType === 'log2') {
                return d3.scaleLog().base(2).domain([yMin, yMax]).range(range);
            } else {
                return d3.scaleLinear().domain([yMin, yMax]).range(range);
            }
        };

        if (isHorizontal) {
            groupScale = d3.scaleBand()
                .domain(filteredData.map(d => d.label))
                .range([0, this.innerHeight])
                .padding(0.4);

            valueScale = createValueScale([0, this.innerWidth]);

            if (!hasManualMin && !hasManualMax) {
                valueScale.nice();
            }
        } else {
            groupScale = d3.scaleBand()
                .domain(filteredData.map(d => d.label))
                .range([0, this.innerWidth])
                .padding(0.4);

            valueScale = createValueScale([this.innerHeight, 0]);

            if (!hasManualMin && !hasManualMax) {
                valueScale.nice();
            }
        }

        // Store scales for use by other methods
        this._currentScales = { groupScale, valueScale, isHorizontal };

        // Draw axes
        this._drawAxes(g, groupScale, valueScale, isHorizontal);

        // Draw axis break
        this._drawAxisBreak(g, valueScale, isHorizontal);

        // Draw graph based on type
        switch (this.settings.graphType) {
            case 'scatter-only':
                this._drawScatterOnly(g, filteredData, groupScale, valueScale, isHorizontal);
                break;
            case 'column-points-mean':
                this._drawScatterWithLine(g, filteredData, groupScale, valueScale, 'mean', isHorizontal);
                break;
            case 'column-points-median':
                this._drawScatterWithLine(g, filteredData, groupScale, valueScale, 'median', isHorizontal);
                break;
            case 'column-bar-mean':
                this._drawBarWithError(g, filteredData, groupScale, valueScale, 'sd', isHorizontal);
                break;
            case 'column-bar-sem':
                this._drawBarWithError(g, filteredData, groupScale, valueScale, 'sem', isHorizontal);
                break;
            case 'column-bar-median':
                this._drawBarMedianIQR(g, filteredData, groupScale, valueScale, isHorizontal);
                break;
            case 'scatter-bar-mean-sd':
                this._drawScatterBar(g, filteredData, groupScale, valueScale, 'sd', isHorizontal);
                break;
            case 'scatter-bar-mean-sem':
                this._drawScatterBar(g, filteredData, groupScale, valueScale, 'sem', isHorizontal);
                break;
            case 'box-plot':
                this._drawBoxPlot(g, filteredData, groupScale, valueScale, isHorizontal);
                break;
            case 'violin-plot':
                this._drawViolinPlot(g, filteredData, groupScale, valueScale, isHorizontal);
                break;
            case 'violin-box':
                this._drawViolinBox(g, filteredData, groupScale, valueScale, isHorizontal);
                break;
            case 'before-after':
                this._drawBeforeAfter(g, filteredData, groupScale, valueScale, isHorizontal);
                break;
            default:
                this._drawBarWithError(g, filteredData, groupScale, valueScale, 'sd', isHorizontal);
        }

        // Draw title and axis labels
        this._drawLabels(isHorizontal);

        // Draw significance brackets with auto-layout
        if (this.significanceResults.length > 0) {
            this._bracketLayout = this._computeBracketLayout(filteredData, groupScale, valueScale, isHorizontal);

            // Check if brackets intrude into title area (vertical only, no manual Y-max)
            if (!isHorizontal && !hasManualMax && this._bracketLayout.length > 0) {
                const topBracketY = Math.min(...this._bracketLayout.filter(Boolean).map(b => b.bracketY - 14));
                if (topBracketY < 0) {
                    // Need more headroom — increase yMax and re-render once
                    const extraNeeded = -topBracketY + 10;
                    const pixelsPerUnit = this.innerHeight / (yMax - yMin);
                    const extraUnits = extraNeeded / pixelsPerUnit;
                    yMax = yMax + extraUnits;

                    valueScale.domain([yMin, yMax]);
                    // Redraw: clear and redo from axes
                    g.selectAll('*').remove();
                    this._drawAxes(g, groupScale, valueScale, isHorizontal);
                    this._drawAxisBreak(g, valueScale, isHorizontal);
                    this._currentScales = { groupScale, valueScale, isHorizontal };

                    // Redraw the chart
                    switch (this.settings.graphType) {
                        case 'scatter-only': this._drawScatterOnly(g, filteredData, groupScale, valueScale, isHorizontal); break;
                        case 'column-points-mean': this._drawScatterWithLine(g, filteredData, groupScale, valueScale, 'mean', isHorizontal); break;
                        case 'column-points-median': this._drawScatterWithLine(g, filteredData, groupScale, valueScale, 'median', isHorizontal); break;
                        case 'column-bar-mean': this._drawBarWithError(g, filteredData, groupScale, valueScale, 'sd', isHorizontal); break;
                        case 'column-bar-sem': this._drawBarWithError(g, filteredData, groupScale, valueScale, 'sem', isHorizontal); break;
                        case 'column-bar-median': this._drawBarMedianIQR(g, filteredData, groupScale, valueScale, isHorizontal); break;
                        case 'scatter-bar-mean-sd': this._drawScatterBar(g, filteredData, groupScale, valueScale, 'sd', isHorizontal); break;
                        case 'scatter-bar-mean-sem': this._drawScatterBar(g, filteredData, groupScale, valueScale, 'sem', isHorizontal); break;
                        case 'box-plot': this._drawBoxPlot(g, filteredData, groupScale, valueScale, isHorizontal); break;
                        case 'violin-plot': this._drawViolinPlot(g, filteredData, groupScale, valueScale, isHorizontal); break;
                        case 'violin-box': this._drawViolinBox(g, filteredData, groupScale, valueScale, isHorizontal); break;
                        case 'before-after': this._drawBeforeAfter(g, filteredData, groupScale, valueScale, isHorizontal); break;
                        default: this._drawBarWithError(g, filteredData, groupScale, valueScale, 'sd', isHorizontal);
                    }

                    // Remove old labels and redraw
                    this.svg.selectAll('.graph-title, .axis-label').remove();
                    this._drawLabels(isHorizontal);

                    // Recompute bracket layout with new scale
                    this._bracketLayout = this._computeBracketLayout(filteredData, groupScale, valueScale, isHorizontal);
                }
            }

            this._drawSignificanceBrackets(g, filteredData, groupScale, valueScale, isHorizontal);
        }

        // Draw stats legend
        if (this.settings.showStatsLegend && this.significanceResults.length > 0) {
            this._drawStatsLegend(g);
        }

        // Draw group color legend
        if (this.settings.showGroupLegend) {
            this._drawGroupLegend(g, filteredData);
        }

        // Draw annotations (from drawing tools)
        if (this.annotationManager) {
            this.annotationManager.drawAnnotations(this.svg, this.margin);
        }
    }

    _drawAxes(g, groupScale, valueScale, isHorizontal) {
        const tf = this.settings.tickFont;
        const self = this;

        // Helper: configure tick values on a value-axis generator
        const configureValueAxis = (axisGen) => {
            const step = self.settings.yAxisTickStep;
            if (step && step > 0) {
                const [min, max] = valueScale.domain();
                const tickVals = d3.range(min, max + step * 0.5, step);
                axisGen.tickValues(tickVals);
            }
            return axisGen;
        };

        if (isHorizontal) {
            // X axis = value axis (bottom)
            const xAxis = g.append('g')
                .attr('class', 'x-axis')
                .attr('transform', `translate(0,${this.innerHeight})`)
                .call(configureValueAxis(d3.axisBottom(valueScale)));

            xAxis.selectAll('text')
                .style('font-family', tf.family)
                .style('font-size', `${tf.size}px`)
                .style('font-weight', tf.bold ? 'bold' : 'normal')
                .style('font-style', tf.italic ? 'italic' : 'normal')
                .on('click', (event) => this._openTickFontPopup(event));

            // Y axis = group axis (left)
            const yAxis = g.append('g')
                .attr('class', 'y-axis')
                .call(d3.axisLeft(groupScale));

            if (!this.settings.showAxisGroupLabels) {
                yAxis.selectAll('.tick text').remove();
            } else {
                yAxis.selectAll('text')
                    .style('font-family', tf.family)
                    .style('font-size', `${tf.size}px`)
                    .style('font-weight', tf.bold ? 'bold' : 'normal')
                    .style('font-style', tf.italic ? 'italic' : 'normal')
                    .on('click', (event) => this._openTickFontPopup(event));
            }
        } else {
            // X axis = group axis (bottom)
            const xAxis = g.append('g')
                .attr('class', 'x-axis')
                .attr('transform', `translate(0,${this.innerHeight})`)
                .call(d3.axisBottom(groupScale));

            if (!this.settings.showAxisGroupLabels) {
                xAxis.selectAll('.tick text').remove();
            } else {
                xAxis.selectAll('text')
                    .style('font-family', tf.family)
                    .style('font-size', `${tf.size}px`)
                    .style('font-weight', tf.bold ? 'bold' : 'normal')
                    .style('font-style', tf.italic ? 'italic' : 'normal')
                    .on('click', (event) => this._openTickFontPopup(event));
            }

            // Y axis = value axis (left)
            const yAxis = g.append('g')
                .attr('class', 'y-axis')
                .call(configureValueAxis(d3.axisLeft(valueScale)));

            yAxis.selectAll('text')
                .style('font-family', tf.family)
                .style('font-size', `${tf.size}px`)
                .style('font-weight', tf.bold ? 'bold' : 'normal')
                .style('font-style', tf.italic ? 'italic' : 'normal')
                .on('click', (event) => this._openTickFontPopup(event));
        }

        g.selectAll('.domain').attr('stroke', '#333');
        g.selectAll('.tick line').attr('stroke', '#ccc');
    }

    _drawAxisBreak(g, valueScale, isHorizontal) {
        if (this.settings.yAxisMin === null || this.settings.yAxisMin <= 0) return;

        if (isHorizontal) {
            // Break on X-axis (left side)
            const breakX = 0;
            const breakY = this.innerHeight;
            const size = 8;

            // White rect to mask axis
            g.append('rect')
                .attr('x', breakX - 2)
                .attr('y', breakY - size - 2)
                .attr('width', 4)
                .attr('height', size * 2 + 4)
                .attr('fill', 'white');

            // Zigzag
            const zigzag = `M ${breakX - 5},${breakY + size} L ${breakX + 5},${breakY + size - 4} L ${breakX - 5},${breakY - size + 4} L ${breakX + 5},${breakY - size}`;
            g.append('path')
                .attr('d', zigzag)
                .attr('stroke', '#333')
                .attr('stroke-width', 1.5)
                .attr('fill', 'none');
        } else {
            // Break on Y-axis (bottom)
            const breakX = 0;
            const breakY = this.innerHeight;
            const size = 8;

            // White rect to mask axis line
            g.append('rect')
                .attr('x', breakX - size - 2)
                .attr('y', breakY - 2)
                .attr('width', size * 2 + 4)
                .attr('height', 4)
                .attr('fill', 'white');

            // Zigzag
            const zigzag = `M ${breakX - size},${breakY + 5} L ${breakX - size + 4},${breakY - 5} L ${breakX + size - 4},${breakY + 5} L ${breakX + size},${breakY - 5}`;
            g.append('path')
                .attr('d', zigzag)
                .attr('stroke', '#333')
                .attr('stroke-width', 1.5)
                .attr('fill', 'none');
        }
    }

    _drawLabels(isHorizontal) {
        const tf = this.settings.titleFont;
        const xf = this.settings.xLabelFont;
        const yf = this.settings.yLabelFont;

        // Center on the plot area (not full SVG width)
        const plotCenterX = this.margin.left + this.innerWidth / 2;
        const plotCenterY = this.margin.top + this.innerHeight / 2;

        // Graph title
        this.svg.append('text')
            .attr('class', 'graph-title')
            .attr('x', plotCenterX)
            .attr('y', this.margin.top / 2)
            .attr('text-anchor', 'middle')
            .style('font-family', tf.family)
            .style('font-size', `${tf.size}px`)
            .style('font-weight', tf.bold ? 'bold' : 'normal')
            .style('font-style', tf.italic ? 'italic' : 'normal')
            .text(this.settings.title)
            .on('click', (event) => this._startInlineEdit(event, 'title'));

        if (isHorizontal) {
            // X label goes below (value axis)
            this.svg.append('text')
                .attr('class', 'axis-label x-label')
                .attr('x', plotCenterX)
                .attr('y', this.height - 10)
                .attr('text-anchor', 'middle')
                .style('font-family', yf.family)
                .style('font-size', `${yf.size}px`)
                .style('font-weight', yf.bold ? 'bold' : 'normal')
                .style('font-style', yf.italic ? 'italic' : 'normal')
                .text(this.settings.yLabel)
                .on('click', (event) => this._startInlineEdit(event, 'yLabel'));

            // Y label goes to the left (group axis)
            this.svg.append('text')
                .attr('class', 'axis-label y-label')
                .attr('x', -plotCenterY)
                .attr('y', 18)
                .attr('text-anchor', 'middle')
                .attr('transform', 'rotate(-90)')
                .style('font-family', xf.family)
                .style('font-size', `${xf.size}px`)
                .style('font-weight', xf.bold ? 'bold' : 'normal')
                .style('font-style', xf.italic ? 'italic' : 'normal')
                .text(this.settings.xLabel)
                .on('click', (event) => this._startInlineEdit(event, 'xLabel'));
        } else {
            // X axis label
            this.svg.append('text')
                .attr('class', 'axis-label x-label')
                .attr('x', plotCenterX)
                .attr('y', this.height - 10)
                .attr('text-anchor', 'middle')
                .style('font-family', xf.family)
                .style('font-size', `${xf.size}px`)
                .style('font-weight', xf.bold ? 'bold' : 'normal')
                .style('font-style', xf.italic ? 'italic' : 'normal')
                .text(this.settings.xLabel)
                .on('click', (event) => this._startInlineEdit(event, 'xLabel'));

            // Y axis label
            this.svg.append('text')
                .attr('class', 'axis-label y-label')
                .attr('x', -plotCenterY)
                .attr('y', 18)
                .attr('text-anchor', 'middle')
                .attr('transform', 'rotate(-90)')
                .style('font-family', yf.family)
                .style('font-size', `${yf.size}px`)
                .style('font-weight', yf.bold ? 'bold' : 'normal')
                .style('font-style', yf.italic ? 'italic' : 'normal')
                .text(this.settings.yLabel)
                .on('click', (event) => this._startInlineEdit(event, 'yLabel'));
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
        boldBtn.addEventListener('click', (e) => {
            e.preventDefault();
            boldBtn.classList.toggle('active');
        });
        toolbar.appendChild(boldBtn);

        const italicBtn = document.createElement('button');
        italicBtn.className = 'svg-edit-btn' + (fontObj.italic ? ' active' : '');
        italicBtn.innerHTML = '<i>I</i>';
        italicBtn.title = 'Italic';
        italicBtn.addEventListener('click', (e) => {
            e.preventDefault();
            italicBtn.classList.toggle('active');
        });
        toolbar.appendChild(italicBtn);

        return { toolbar, familySelect, sizeInput, boldBtn, italicBtn };
    }

    _openTickFontPopup(event) {
        const existing = document.querySelector('.svg-edit-popup');
        if (existing) existing.remove();

        const textEl = event.target;
        const rect = textEl.getBoundingClientRect();
        const fontObj = this.settings.tickFont;

        const popup = document.createElement('div');
        popup.className = 'svg-edit-popup';
        popup.style.left = `${rect.left + window.scrollX}px`;
        popup.style.top = `${rect.top + window.scrollY - 40}px`;

        const { toolbar, familySelect, sizeInput, boldBtn, italicBtn } = this._createFontToolbar(fontObj);
        popup.appendChild(toolbar);

        document.body.appendChild(popup);

        const commit = () => {
            if (!document.body.contains(popup)) return;
            fontObj.family = familySelect.value;
            fontObj.size = parseInt(sizeInput.value) || fontObj.size;
            fontObj.bold = boldBtn.classList.contains('active');
            fontObj.italic = italicBtn.classList.contains('active');
            popup.remove();
            if (window.app) window.app.updateGraph();
        };

        popup.addEventListener('focusout', () => {
            setTimeout(() => {
                if (document.body.contains(popup) && !popup.contains(document.activeElement)) {
                    commit();
                }
            }, 100);
        });

        // Focus the first element
        familySelect.focus();
    }

    _startInlineEdit(event, labelType) {
        const existing = document.querySelector('.svg-edit-popup');
        if (existing) existing.remove();

        const textEl = event.target;
        const rect = textEl.getBoundingClientRect();

        const map = {
            title:  { settingsKey: 'title',  inputId: 'graphTitle',  fontKey: 'titleFont' },
            xLabel: { settingsKey: 'xLabel', inputId: 'xAxisLabel', fontKey: 'xLabelFont' },
            yLabel: { settingsKey: 'yLabel', inputId: 'yAxisLabel', fontKey: 'yLabelFont' }
        };
        const { settingsKey, inputId, fontKey } = map[labelType];
        const fontObj = this.settings[fontKey];

        const popup = document.createElement('div');
        popup.className = 'svg-edit-popup';
        popup.style.left = `${rect.left + window.scrollX}px`;
        popup.style.top = `${rect.top + window.scrollY - 40}px`;

        const { toolbar, familySelect, sizeInput, boldBtn, italicBtn } = this._createFontToolbar(fontObj);
        popup.appendChild(toolbar);

        // Text input
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'svg-inline-edit';
        input.value = this.settings[settingsKey];
        input.style.fontSize = `${fontObj.size}px`;
        input.style.fontFamily = fontObj.family;
        input.style.width = `${Math.max(rect.width + 40, 160)}px`;
        popup.appendChild(input);

        document.body.appendChild(popup);
        input.focus();
        input.select();

        const commit = () => {
            if (!document.body.contains(popup)) return;
            const newValue = input.value;
            this.settings[settingsKey] = newValue;

            fontObj.family = familySelect.value;
            fontObj.size = parseInt(sizeInput.value) || fontObj.size;
            fontObj.bold = boldBtn.classList.contains('active');
            fontObj.italic = italicBtn.classList.contains('active');

            const sidebarInput = document.getElementById(inputId);
            if (sidebarInput) sidebarInput.value = newValue;
            popup.remove();
            if (window.app) window.app.updateGraph();
        };

        const cancel = () => { popup.remove(); };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        });

        popup.addEventListener('focusout', () => {
            setTimeout(() => {
                if (document.body.contains(popup) && !popup.contains(document.activeElement)) {
                    commit();
                }
            }, 100);
        });

        familySelect.addEventListener('change', () => { input.style.fontFamily = familySelect.value; });
        sizeInput.addEventListener('input', () => { input.style.fontSize = `${sizeInput.value}px`; });
    }

    // --- Color picker for bars ---
    _openBarColorPicker(event, barIndex) {
        const existing = document.querySelector('.bar-color-picker');
        if (existing) existing.remove();

        const rect = event.target.getBoundingClientRect();
        const popup = document.createElement('div');
        popup.className = 'svg-edit-popup bar-color-picker';
        popup.style.left = `${rect.left + window.scrollX}px`;
        popup.style.top = `${rect.bottom + window.scrollY + 4}px`;

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = this._getColor(barIndex);
        colorInput.style.width = '40px';
        colorInput.style.height = '30px';
        colorInput.style.border = 'none';
        colorInput.style.cursor = 'pointer';

        const resetBtn = document.createElement('button');
        resetBtn.className = 'svg-edit-btn';
        resetBtn.textContent = 'Reset';
        resetBtn.style.width = 'auto';
        resetBtn.style.padding = '2px 8px';

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '6px';
        row.appendChild(colorInput);
        row.appendChild(resetBtn);
        popup.appendChild(row);

        document.body.appendChild(popup);

        colorInput.addEventListener('input', () => {
            this.settings.colorOverrides[barIndex] = colorInput.value;
            if (window.app) window.app.updateGraph();
        });

        resetBtn.addEventListener('click', () => {
            delete this.settings.colorOverrides[barIndex];
            popup.remove();
            if (window.app) window.app.updateGraph();
        });

        popup.addEventListener('focusout', () => {
            setTimeout(() => {
                if (document.body.contains(popup) && !popup.contains(document.activeElement)) {
                    popup.remove();
                }
            }, 150);
        });

        colorInput.focus();
    }

    // --- Drawing methods ---

    _drawScatterWithLine(g, data, groupScale, valueScale, centerType, isH) {
        data.forEach((group, i) => {
            const color = this._getColor(i);
            const bw = groupScale.bandwidth();

            if (isH) {
                const cy = groupScale(group.label) + bw / 2;
                const jitterWidth = Math.min(bw * 0.3, 30);

                g.selectAll(`.point-${i}`)
                    .data(group.values)
                    .enter()
                    .append('circle')
                    .attr('class', `point point-${i}`)
                    .attr('cy', () => cy + (Math.random() - 0.5) * jitterWidth)
                    .attr('cx', d => valueScale(d))
                    .attr('r', 4)
                    .attr('fill', color)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 0.5)
                    .attr('opacity', 0.8);

                const centerValue = centerType === 'mean'
                    ? Statistics.mean(group.values) : Statistics.median(group.values);
                const lineWidth = bw * 0.5;
                g.append('line')
                    .attr('class', 'center-line')
                    .attr('y1', cy - lineWidth / 2).attr('y2', cy + lineWidth / 2)
                    .attr('x1', valueScale(centerValue)).attr('x2', valueScale(centerValue))
                    .attr('stroke', '#333').attr('stroke-width', 2);
            } else {
                const cx = groupScale(group.label) + bw / 2;
                const jitterWidth = Math.min(bw * 0.3, 30);

                g.selectAll(`.point-${i}`)
                    .data(group.values)
                    .enter()
                    .append('circle')
                    .attr('class', `point point-${i}`)
                    .attr('cx', () => cx + (Math.random() - 0.5) * jitterWidth)
                    .attr('cy', d => valueScale(d))
                    .attr('r', 4)
                    .attr('fill', color)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 0.5)
                    .attr('opacity', 0.8);

                const centerValue = centerType === 'mean'
                    ? Statistics.mean(group.values) : Statistics.median(group.values);
                const lineWidth = bw * 0.5;
                g.append('line')
                    .attr('class', 'center-line')
                    .attr('x1', cx - lineWidth / 2).attr('x2', cx + lineWidth / 2)
                    .attr('y1', valueScale(centerValue)).attr('y2', valueScale(centerValue))
                    .attr('stroke', '#333').attr('stroke-width', 2);
            }
        });
    }

    _drawBarWithError(g, data, groupScale, valueScale, errorType, isH) {
        const ebw = this.settings.errorBarWidth;
        const ebDir = this.settings.errorBarDirection;

        data.forEach((group, i) => {
            const color = this._getColor(i);
            const bw = groupScale.bandwidth();
            const meanVal = Statistics.mean(group.values);
            const errorVal = errorType === 'sd'
                ? Statistics.std(group.values) : Statistics.sem(group.values);

            if (isH) {
                const gy = groupScale(group.label);
                const cy = gy + bw / 2;

                // Bar
                g.append('rect')
                    .attr('class', 'bar')
                    .attr('x', 0).attr('y', gy)
                    .attr('width', valueScale(meanVal))
                    .attr('height', bw)
                    .attr('fill', color).attr('stroke', '#333')
                    .attr('stroke-width', 1).attr('opacity', 0.8)
                    .style('cursor', 'pointer')
                    .on('click', (event) => this._openBarColorPicker(event, i));

                // Error bars
                if (group.values.length > 1) {
                    const errorRight = meanVal + errorVal;
                    const errorLeft = ebDir === 'above' ? meanVal : Math.max(0, meanVal - errorVal);
                    const capWidth = bw * 0.2;

                    g.append('line')
                        .attr('y1', cy).attr('y2', cy)
                        .attr('x1', valueScale(errorLeft)).attr('x2', valueScale(errorRight))
                        .attr('stroke', '#333').attr('stroke-width', ebw);
                    g.append('line')
                        .attr('y1', cy - capWidth).attr('y2', cy + capWidth)
                        .attr('x1', valueScale(errorRight)).attr('x2', valueScale(errorRight))
                        .attr('stroke', '#333').attr('stroke-width', ebw);
                    if (ebDir === 'both' && (meanVal - errorVal) > 0) {
                        g.append('line')
                            .attr('y1', cy - capWidth).attr('y2', cy + capWidth)
                            .attr('x1', valueScale(errorLeft)).attr('x2', valueScale(errorLeft))
                            .attr('stroke', '#333').attr('stroke-width', ebw);
                    }
                }

                // Points
                const jitterWidth = Math.min(bw * 0.3, 20);
                g.selectAll(`.dot-${i}`)
                    .data(group.values)
                    .enter()
                    .append('circle')
                    .attr('class', `dot dot-${i}`)
                    .attr('cy', () => cy + (Math.random() - 0.5) * jitterWidth)
                    .attr('cx', d => valueScale(d))
                    .attr('r', 3.5).attr('fill', '#333').attr('opacity', 0.7);
            } else {
                const gx = groupScale(group.label);
                const cx = gx + bw / 2;

                // Bar
                g.append('rect')
                    .attr('class', 'bar')
                    .attr('x', gx).attr('y', valueScale(meanVal))
                    .attr('width', bw)
                    .attr('height', this.innerHeight - valueScale(meanVal))
                    .attr('fill', color).attr('stroke', '#333')
                    .attr('stroke-width', 1).attr('opacity', 0.8)
                    .style('cursor', 'pointer')
                    .on('click', (event) => this._openBarColorPicker(event, i));

                // Error bars
                if (group.values.length > 1) {
                    const errorTop = meanVal + errorVal;
                    const errorBottom = ebDir === 'above' ? meanVal : Math.max(0, meanVal - errorVal);
                    const capWidth = bw * 0.2;

                    g.append('line')
                        .attr('class', 'error-bar')
                        .attr('x1', cx).attr('x2', cx)
                        .attr('y1', valueScale(errorTop)).attr('y2', valueScale(errorBottom))
                        .attr('stroke', '#333').attr('stroke-width', ebw);
                    g.append('line')
                        .attr('class', 'error-cap')
                        .attr('x1', cx - capWidth).attr('x2', cx + capWidth)
                        .attr('y1', valueScale(errorTop)).attr('y2', valueScale(errorTop))
                        .attr('stroke', '#333').attr('stroke-width', ebw);
                    if (ebDir === 'both' && (meanVal - errorVal) > 0) {
                        g.append('line')
                            .attr('class', 'error-cap')
                            .attr('x1', cx - capWidth).attr('x2', cx + capWidth)
                            .attr('y1', valueScale(errorBottom)).attr('y2', valueScale(errorBottom))
                            .attr('stroke', '#333').attr('stroke-width', ebw);
                    }
                }

                // Points
                const jitterWidth = Math.min(bw * 0.3, 20);
                g.selectAll(`.dot-${i}`)
                    .data(group.values)
                    .enter()
                    .append('circle')
                    .attr('class', `dot dot-${i}`)
                    .attr('cx', () => cx + (Math.random() - 0.5) * jitterWidth)
                    .attr('cy', d => valueScale(d))
                    .attr('r', 3.5).attr('fill', '#333').attr('opacity', 0.7);
            }
        });
    }

    _drawBoxPlot(g, data, groupScale, valueScale, isH) {
        const ebw = this.settings.errorBarWidth;

        data.forEach((group, i) => {
            const color = this._getColor(i);
            const bw = groupScale.bandwidth();
            const sorted = [...group.values].sort((a, b) => a - b);
            const q = Statistics.quartiles(group.values);
            const iqr = q.q3 - q.q1;
            const min = Math.max(d3.min(sorted), q.q1 - 1.5 * iqr);
            const max = Math.min(d3.max(sorted), q.q3 + 1.5 * iqr);
            const boxWidth = bw * 0.6;

            if (isH) {
                const cy = groupScale(group.label) + bw / 2;

                // Box
                g.append('rect')
                    .attr('x', valueScale(q.q1)).attr('y', cy - boxWidth / 2)
                    .attr('width', valueScale(q.q3) - valueScale(q.q1))
                    .attr('height', boxWidth)
                    .attr('fill', color).attr('stroke', '#333')
                    .attr('stroke-width', ebw).attr('opacity', 0.8);

                // Median line
                g.append('line')
                    .attr('x1', valueScale(q.q2)).attr('x2', valueScale(q.q2))
                    .attr('y1', cy - boxWidth / 2).attr('y2', cy + boxWidth / 2)
                    .attr('stroke', '#333').attr('stroke-width', 2);

                const whiskerWidth = boxWidth * 0.5;

                // Lower whisker
                g.append('line')
                    .attr('x1', valueScale(min)).attr('x2', valueScale(q.q1))
                    .attr('y1', cy).attr('y2', cy)
                    .attr('stroke', '#333').attr('stroke-width', ebw);
                g.append('line')
                    .attr('x1', valueScale(min)).attr('x2', valueScale(min))
                    .attr('y1', cy - whiskerWidth / 2).attr('y2', cy + whiskerWidth / 2)
                    .attr('stroke', '#333').attr('stroke-width', ebw);

                // Upper whisker
                g.append('line')
                    .attr('x1', valueScale(q.q3)).attr('x2', valueScale(max))
                    .attr('y1', cy).attr('y2', cy)
                    .attr('stroke', '#333').attr('stroke-width', ebw);
                g.append('line')
                    .attr('x1', valueScale(max)).attr('x2', valueScale(max))
                    .attr('y1', cy - whiskerWidth / 2).attr('y2', cy + whiskerWidth / 2)
                    .attr('stroke', '#333').attr('stroke-width', ebw);

                // Outliers
                const outliers = sorted.filter(v => v < q.q1 - 1.5 * iqr || v > q.q3 + 1.5 * iqr);
                g.selectAll(`.outlier-${i}`)
                    .data(outliers)
                    .enter()
                    .append('circle')
                    .attr('cx', d => valueScale(d)).attr('cy', cy)
                    .attr('r', 3).attr('fill', 'none')
                    .attr('stroke', '#333').attr('stroke-width', ebw);
            } else {
                const cx = groupScale(group.label) + bw / 2;

                g.append('rect')
                    .attr('x', cx - boxWidth / 2).attr('y', valueScale(q.q3))
                    .attr('width', boxWidth)
                    .attr('height', valueScale(q.q1) - valueScale(q.q3))
                    .attr('fill', color).attr('stroke', '#333')
                    .attr('stroke-width', ebw).attr('opacity', 0.8);

                g.append('line')
                    .attr('x1', cx - boxWidth / 2).attr('x2', cx + boxWidth / 2)
                    .attr('y1', valueScale(q.q2)).attr('y2', valueScale(q.q2))
                    .attr('stroke', '#333').attr('stroke-width', 2);

                const whiskerWidth = boxWidth * 0.5;

                g.append('line')
                    .attr('x1', cx).attr('x2', cx)
                    .attr('y1', valueScale(q.q1)).attr('y2', valueScale(min))
                    .attr('stroke', '#333').attr('stroke-width', ebw);
                g.append('line')
                    .attr('x1', cx - whiskerWidth / 2).attr('x2', cx + whiskerWidth / 2)
                    .attr('y1', valueScale(min)).attr('y2', valueScale(min))
                    .attr('stroke', '#333').attr('stroke-width', ebw);

                g.append('line')
                    .attr('x1', cx).attr('x2', cx)
                    .attr('y1', valueScale(q.q3)).attr('y2', valueScale(max))
                    .attr('stroke', '#333').attr('stroke-width', ebw);
                g.append('line')
                    .attr('x1', cx - whiskerWidth / 2).attr('x2', cx + whiskerWidth / 2)
                    .attr('y1', valueScale(max)).attr('y2', valueScale(max))
                    .attr('stroke', '#333').attr('stroke-width', ebw);

                const outliers = sorted.filter(v => v < q.q1 - 1.5 * iqr || v > q.q3 + 1.5 * iqr);
                g.selectAll(`.outlier-${i}`)
                    .data(outliers)
                    .enter()
                    .append('circle')
                    .attr('cx', cx).attr('cy', d => valueScale(d))
                    .attr('r', 3).attr('fill', 'none')
                    .attr('stroke', '#333').attr('stroke-width', ebw);
            }
        });
    }

    _drawViolinPlot(g, data, groupScale, valueScale, isH) {
        data.forEach((group, i) => {
            const color = this._getColor(i);
            const bw = groupScale.bandwidth();

            if (group.values.length < 3) {
                this._drawBoxPlot(g, [group], groupScale, valueScale, isH);
                return;
            }

            const h = this._silvermanBandwidth(group.values);
            const pts = this._kdePoints(group.values);
            const kde = this._kernelDensityEstimator(this._epanechnikovKernel(h), pts);
            const density = kde(group.values);
            const maxDensity = d3.max(density, d => d[1]);
            const violinWidth = bw * 0.45;

            if (isH) {
                const cy = groupScale(group.label) + bw / 2;
                const yDensityScale = d3.scaleLinear().domain([0, maxDensity]).range([0, violinWidth]);

                const area = d3.area()
                    .y0(d => cy - yDensityScale(d[1]))
                    .y1(d => cy + yDensityScale(d[1]))
                    .x(d => valueScale(d[0]))
                    .curve(d3.curveCatmullRom);

                g.append('path').datum(density).attr('d', area)
                    .attr('fill', color).attr('stroke', '#333')
                    .attr('stroke-width', 1).attr('opacity', 0.7);

                const medianVal = Statistics.median(group.values);
                const medianDensity = this._interpolateDensity(density, medianVal);
                const medianHalfWidth = yDensityScale(medianDensity);

                g.append('line')
                    .attr('x1', valueScale(medianVal)).attr('x2', valueScale(medianVal))
                    .attr('y1', cy - medianHalfWidth).attr('y2', cy + medianHalfWidth)
                    .attr('stroke', '#fff').attr('stroke-width', 2);

                const jitterWidth = Math.min(violinWidth * 0.3, 10);
                g.selectAll(`.vdot-${i}`)
                    .data(group.values).enter().append('circle')
                    .attr('cy', () => cy + (Math.random() - 0.5) * jitterWidth)
                    .attr('cx', d => valueScale(d))
                    .attr('r', 2.5).attr('fill', '#333').attr('opacity', 0.5);
            } else {
                const cx = groupScale(group.label) + bw / 2;
                const xDensityScale = d3.scaleLinear().domain([0, maxDensity]).range([0, violinWidth]);

                const area = d3.area()
                    .x0(d => cx - xDensityScale(d[1]))
                    .x1(d => cx + xDensityScale(d[1]))
                    .y(d => valueScale(d[0]))
                    .curve(d3.curveCatmullRom);

                g.append('path').datum(density).attr('d', area)
                    .attr('fill', color).attr('stroke', '#333')
                    .attr('stroke-width', 1).attr('opacity', 0.7);

                const medianVal = Statistics.median(group.values);
                const medianDensity = this._interpolateDensity(density, medianVal);
                const medianHalfWidth = xDensityScale(medianDensity);

                g.append('line')
                    .attr('x1', cx - medianHalfWidth).attr('x2', cx + medianHalfWidth)
                    .attr('y1', valueScale(medianVal)).attr('y2', valueScale(medianVal))
                    .attr('stroke', '#fff').attr('stroke-width', 2);

                const jitterWidth = Math.min(violinWidth * 0.3, 10);
                g.selectAll(`.vdot-${i}`)
                    .data(group.values).enter().append('circle')
                    .attr('cx', () => cx + (Math.random() - 0.5) * jitterWidth)
                    .attr('cy', d => valueScale(d))
                    .attr('r', 2.5).attr('fill', '#333').attr('opacity', 0.5);
            }
        });
    }

    _drawScatterOnly(g, data, groupScale, valueScale, isH) {
        data.forEach((group, i) => {
            const color = this._getColor(i);
            const bw = groupScale.bandwidth();

            if (isH) {
                const cy = groupScale(group.label) + bw / 2;
                const jitterWidth = Math.min(bw * 0.35, 35);

                g.selectAll(`.spoint-${i}`)
                    .data(group.values).enter().append('circle')
                    .attr('class', `spoint spoint-${i}`)
                    .attr('cy', () => cy + (Math.random() - 0.5) * jitterWidth)
                    .attr('cx', d => valueScale(d))
                    .attr('r', 4.5).attr('fill', color)
                    .attr('stroke', '#333').attr('stroke-width', 0.5).attr('opacity', 0.8);
            } else {
                const cx = groupScale(group.label) + bw / 2;
                const jitterWidth = Math.min(bw * 0.35, 35);

                g.selectAll(`.spoint-${i}`)
                    .data(group.values).enter().append('circle')
                    .attr('class', `spoint spoint-${i}`)
                    .attr('cx', () => cx + (Math.random() - 0.5) * jitterWidth)
                    .attr('cy', d => valueScale(d))
                    .attr('r', 4.5).attr('fill', color)
                    .attr('stroke', '#333').attr('stroke-width', 0.5).attr('opacity', 0.8);
            }
        });
    }

    _drawBarMedianIQR(g, data, groupScale, valueScale, isH) {
        const ebw = this.settings.errorBarWidth;
        const ebDir = this.settings.errorBarDirection;

        data.forEach((group, i) => {
            const color = this._getColor(i);
            const bw = groupScale.bandwidth();
            const medianVal = Statistics.median(group.values);
            const q = Statistics.quartiles(group.values);

            if (isH) {
                const gy = groupScale(group.label);
                const cy = gy + bw / 2;

                g.append('rect').attr('class', 'bar')
                    .attr('x', 0).attr('y', gy)
                    .attr('width', valueScale(medianVal)).attr('height', bw)
                    .attr('fill', color).attr('stroke', '#333')
                    .attr('stroke-width', 1).attr('opacity', 0.8)
                    .style('cursor', 'pointer')
                    .on('click', (event) => this._openBarColorPicker(event, i));

                if (group.values.length > 1) {
                    const capWidth = bw * 0.2;
                    const errRight = q.q3;
                    const errLeft = ebDir === 'above' ? medianVal : q.q1;

                    g.append('line')
                        .attr('y1', cy).attr('y2', cy)
                        .attr('x1', valueScale(errLeft)).attr('x2', valueScale(errRight))
                        .attr('stroke', '#333').attr('stroke-width', ebw);
                    g.append('line')
                        .attr('y1', cy - capWidth).attr('y2', cy + capWidth)
                        .attr('x1', valueScale(errRight)).attr('x2', valueScale(errRight))
                        .attr('stroke', '#333').attr('stroke-width', ebw);
                    if (ebDir === 'both') {
                        g.append('line')
                            .attr('y1', cy - capWidth).attr('y2', cy + capWidth)
                            .attr('x1', valueScale(errLeft)).attr('x2', valueScale(errLeft))
                            .attr('stroke', '#333').attr('stroke-width', ebw);
                    }
                }

                const jitterWidth = Math.min(bw * 0.3, 20);
                g.selectAll(`.mdot-${i}`)
                    .data(group.values).enter().append('circle')
                    .attr('class', `mdot mdot-${i}`)
                    .attr('cy', () => cy + (Math.random() - 0.5) * jitterWidth)
                    .attr('cx', d => valueScale(d))
                    .attr('r', 3.5).attr('fill', '#333').attr('opacity', 0.7);
            } else {
                const gx = groupScale(group.label);
                const cx = gx + bw / 2;

                g.append('rect').attr('class', 'bar')
                    .attr('x', gx).attr('y', valueScale(medianVal))
                    .attr('width', bw)
                    .attr('height', this.innerHeight - valueScale(medianVal))
                    .attr('fill', color).attr('stroke', '#333')
                    .attr('stroke-width', 1).attr('opacity', 0.8)
                    .style('cursor', 'pointer')
                    .on('click', (event) => this._openBarColorPicker(event, i));

                if (group.values.length > 1) {
                    const capWidth = bw * 0.2;
                    const errTop = q.q3;
                    const errBottom = ebDir === 'above' ? medianVal : q.q1;

                    g.append('line')
                        .attr('x1', cx).attr('x2', cx)
                        .attr('y1', valueScale(errTop)).attr('y2', valueScale(errBottom))
                        .attr('stroke', '#333').attr('stroke-width', ebw);
                    g.append('line')
                        .attr('x1', cx - capWidth).attr('x2', cx + capWidth)
                        .attr('y1', valueScale(errTop)).attr('y2', valueScale(errTop))
                        .attr('stroke', '#333').attr('stroke-width', ebw);
                    if (ebDir === 'both') {
                        g.append('line')
                            .attr('x1', cx - capWidth).attr('x2', cx + capWidth)
                            .attr('y1', valueScale(errBottom)).attr('y2', valueScale(errBottom))
                            .attr('stroke', '#333').attr('stroke-width', ebw);
                    }
                }

                const jitterWidth = Math.min(bw * 0.3, 20);
                g.selectAll(`.mdot-${i}`)
                    .data(group.values).enter().append('circle')
                    .attr('class', `mdot mdot-${i}`)
                    .attr('cx', () => cx + (Math.random() - 0.5) * jitterWidth)
                    .attr('cy', d => valueScale(d))
                    .attr('r', 3.5).attr('fill', '#333').attr('opacity', 0.7);
            }
        });
    }

    _drawScatterBar(g, data, groupScale, valueScale, errorType, isH) {
        const ebw = this.settings.errorBarWidth;
        const ebDir = this.settings.errorBarDirection;

        data.forEach((group, i) => {
            const color = this._getColor(i);
            const bw = groupScale.bandwidth();
            const meanVal = Statistics.mean(group.values);
            const errorVal = errorType === 'sd'
                ? Statistics.std(group.values) : Statistics.sem(group.values);

            if (isH) {
                const gy = groupScale(group.label);
                const cy = gy + bw / 2;

                g.append('rect').attr('class', 'bar')
                    .attr('x', 0).attr('y', gy)
                    .attr('width', valueScale(meanVal)).attr('height', bw)
                    .attr('fill', color).attr('stroke', '#333')
                    .attr('stroke-width', 1).attr('opacity', 0.4)
                    .style('cursor', 'pointer')
                    .on('click', (event) => this._openBarColorPicker(event, i));

                if (group.values.length > 1) {
                    const errorRight = meanVal + errorVal;
                    const errorLeft = ebDir === 'above' ? meanVal : Math.max(0, meanVal - errorVal);
                    const capWidth = bw * 0.2;

                    g.append('line')
                        .attr('y1', cy).attr('y2', cy)
                        .attr('x1', valueScale(errorLeft)).attr('x2', valueScale(errorRight))
                        .attr('stroke', '#333').attr('stroke-width', ebw);
                    g.append('line')
                        .attr('y1', cy - capWidth).attr('y2', cy + capWidth)
                        .attr('x1', valueScale(errorRight)).attr('x2', valueScale(errorRight))
                        .attr('stroke', '#333').attr('stroke-width', ebw);
                    if (ebDir === 'both' && (meanVal - errorVal) > 0) {
                        g.append('line')
                            .attr('y1', cy - capWidth).attr('y2', cy + capWidth)
                            .attr('x1', valueScale(errorLeft)).attr('x2', valueScale(errorLeft))
                            .attr('stroke', '#333').attr('stroke-width', ebw);
                    }
                }

                const jitterWidth = Math.min(bw * 0.35, 25);
                g.selectAll(`.sbdot-${i}`)
                    .data(group.values).enter().append('circle')
                    .attr('class', `sbdot sbdot-${i}`)
                    .attr('cy', () => cy + (Math.random() - 0.5) * jitterWidth)
                    .attr('cx', d => valueScale(d))
                    .attr('r', 4.5).attr('fill', '#333').attr('opacity', 0.75);
            } else {
                const gx = groupScale(group.label);
                const cx = gx + bw / 2;

                g.append('rect').attr('class', 'bar')
                    .attr('x', gx).attr('y', valueScale(meanVal))
                    .attr('width', bw)
                    .attr('height', this.innerHeight - valueScale(meanVal))
                    .attr('fill', color).attr('stroke', '#333')
                    .attr('stroke-width', 1).attr('opacity', 0.4)
                    .style('cursor', 'pointer')
                    .on('click', (event) => this._openBarColorPicker(event, i));

                if (group.values.length > 1) {
                    const errorTop = meanVal + errorVal;
                    const errorBottom = ebDir === 'above' ? meanVal : Math.max(0, meanVal - errorVal);
                    const capWidth = bw * 0.2;

                    g.append('line')
                        .attr('x1', cx).attr('x2', cx)
                        .attr('y1', valueScale(errorTop)).attr('y2', valueScale(errorBottom))
                        .attr('stroke', '#333').attr('stroke-width', ebw);
                    g.append('line')
                        .attr('x1', cx - capWidth).attr('x2', cx + capWidth)
                        .attr('y1', valueScale(errorTop)).attr('y2', valueScale(errorTop))
                        .attr('stroke', '#333').attr('stroke-width', ebw);
                    if (ebDir === 'both' && (meanVal - errorVal) > 0) {
                        g.append('line')
                            .attr('x1', cx - capWidth).attr('x2', cx + capWidth)
                            .attr('y1', valueScale(errorBottom)).attr('y2', valueScale(errorBottom))
                            .attr('stroke', '#333').attr('stroke-width', ebw);
                    }
                }

                const jitterWidth = Math.min(bw * 0.35, 25);
                g.selectAll(`.sbdot-${i}`)
                    .data(group.values).enter().append('circle')
                    .attr('class', `sbdot sbdot-${i}`)
                    .attr('cx', () => cx + (Math.random() - 0.5) * jitterWidth)
                    .attr('cy', d => valueScale(d))
                    .attr('r', 4.5).attr('fill', '#333').attr('opacity', 0.75);
            }
        });
    }

    _drawViolinBox(g, data, groupScale, valueScale, isH) {
        const ebw = this.settings.errorBarWidth;

        data.forEach((group, i) => {
            const color = this._getColor(i);
            const bw = groupScale.bandwidth();

            if (group.values.length < 3) {
                this._drawBoxPlot(g, [group], groupScale, valueScale, isH);
                return;
            }

            const h = this._silvermanBandwidth(group.values);
            const pts = this._kdePoints(group.values);
            const kde = this._kernelDensityEstimator(this._epanechnikovKernel(h), pts);
            const density = kde(group.values);
            const maxDensity = d3.max(density, d => d[1]);
            const violinWidth = bw * 0.45;

            const q = Statistics.quartiles(group.values);
            const iqr = q.q3 - q.q1;
            const boxWidth = bw * 0.15;
            const sorted = [...group.values].sort((a, b) => a - b);
            const whiskerMin = Math.max(d3.min(sorted), q.q1 - 1.5 * iqr);
            const whiskerMax = Math.min(d3.max(sorted), q.q3 + 1.5 * iqr);

            if (isH) {
                const cy = groupScale(group.label) + bw / 2;
                const yDensityScale = d3.scaleLinear().domain([0, maxDensity]).range([0, violinWidth]);

                const area = d3.area()
                    .y0(d => cy - yDensityScale(d[1]))
                    .y1(d => cy + yDensityScale(d[1]))
                    .x(d => valueScale(d[0]))
                    .curve(d3.curveCatmullRom);

                g.append('path').datum(density).attr('d', area)
                    .attr('fill', color).attr('stroke', '#333')
                    .attr('stroke-width', 1).attr('opacity', 0.7);

                g.append('rect')
                    .attr('x', valueScale(q.q1)).attr('y', cy - boxWidth / 2)
                    .attr('width', valueScale(q.q3) - valueScale(q.q1)).attr('height', boxWidth)
                    .attr('fill', '#333').attr('stroke', '#333')
                    .attr('stroke-width', 1).attr('opacity', 0.5);

                g.append('line')
                    .attr('x1', valueScale(q.q2)).attr('x2', valueScale(q.q2))
                    .attr('y1', cy - boxWidth / 2).attr('y2', cy + boxWidth / 2)
                    .attr('stroke', '#fff').attr('stroke-width', 2);

                g.append('line')
                    .attr('x1', valueScale(whiskerMin)).attr('x2', valueScale(q.q1))
                    .attr('y1', cy).attr('y2', cy)
                    .attr('stroke', '#333').attr('stroke-width', ebw);
                g.append('line')
                    .attr('x1', valueScale(q.q3)).attr('x2', valueScale(whiskerMax))
                    .attr('y1', cy).attr('y2', cy)
                    .attr('stroke', '#333').attr('stroke-width', ebw);
            } else {
                const cx = groupScale(group.label) + bw / 2;
                const xDensityScale = d3.scaleLinear().domain([0, maxDensity]).range([0, violinWidth]);

                const area = d3.area()
                    .x0(d => cx - xDensityScale(d[1]))
                    .x1(d => cx + xDensityScale(d[1]))
                    .y(d => valueScale(d[0]))
                    .curve(d3.curveCatmullRom);

                g.append('path').datum(density).attr('d', area)
                    .attr('fill', color).attr('stroke', '#333')
                    .attr('stroke-width', 1).attr('opacity', 0.7);

                g.append('rect')
                    .attr('x', cx - boxWidth / 2).attr('y', valueScale(q.q3))
                    .attr('width', boxWidth)
                    .attr('height', valueScale(q.q1) - valueScale(q.q3))
                    .attr('fill', '#333').attr('stroke', '#333')
                    .attr('stroke-width', 1).attr('opacity', 0.5);

                g.append('line')
                    .attr('x1', cx - boxWidth / 2).attr('x2', cx + boxWidth / 2)
                    .attr('y1', valueScale(q.q2)).attr('y2', valueScale(q.q2))
                    .attr('stroke', '#fff').attr('stroke-width', 2);

                g.append('line')
                    .attr('x1', cx).attr('x2', cx)
                    .attr('y1', valueScale(q.q1)).attr('y2', valueScale(whiskerMin))
                    .attr('stroke', '#333').attr('stroke-width', ebw);
                g.append('line')
                    .attr('x1', cx).attr('x2', cx)
                    .attr('y1', valueScale(q.q3)).attr('y2', valueScale(whiskerMax))
                    .attr('stroke', '#333').attr('stroke-width', ebw);
            }
        });
    }

    _drawBeforeAfter(g, data, groupScale, valueScale, isH) {
        const numRows = d3.max(data, d => d.values.length);

        for (let row = 0; row < numRows; row++) {
            const points = [];
            data.forEach((group) => {
                if (row < group.values.length) {
                    const bw = groupScale.bandwidth();
                    if (isH) {
                        const cy = groupScale(group.label) + bw / 2;
                        points.push({ x: valueScale(group.values[row]), y: cy });
                    } else {
                        const cx = groupScale(group.label) + bw / 2;
                        points.push({ x: cx, y: valueScale(group.values[row]) });
                    }
                }
            });

            if (points.length > 1) {
                for (let j = 0; j < points.length - 1; j++) {
                    g.append('line')
                        .attr('x1', points[j].x).attr('y1', points[j].y)
                        .attr('x2', points[j + 1].x).attr('y2', points[j + 1].y)
                        .attr('stroke', '#999').attr('stroke-width', 1).attr('opacity', 0.5);
                }
            }
        }

        data.forEach((group, i) => {
            const color = this._getColor(i);
            const bw = groupScale.bandwidth();

            if (isH) {
                const cy = groupScale(group.label) + bw / 2;
                g.selectAll(`.ba-dot-${i}`)
                    .data(group.values).enter().append('circle')
                    .attr('class', `ba-dot ba-dot-${i}`)
                    .attr('cy', cy).attr('cx', d => valueScale(d))
                    .attr('r', 5).attr('fill', color)
                    .attr('stroke', '#333').attr('stroke-width', 1);
            } else {
                const cx = groupScale(group.label) + bw / 2;
                g.selectAll(`.ba-dot-${i}`)
                    .data(group.values).enter().append('circle')
                    .attr('class', `ba-dot ba-dot-${i}`)
                    .attr('cx', cx).attr('cy', d => valueScale(d))
                    .attr('r', 5).attr('fill', color)
                    .attr('stroke', '#333').attr('stroke-width', 1);
            }
        });
    }

    _getGroupCeilings(data, valueScale, groupScale, isH) {
        // Returns pixel ceiling per group — the highest visual element pixel
        // For vertical: smaller pixel Y = higher on screen
        // For horizontal: larger pixel X = further right
        const graphType = this.settings.graphType;
        const ebDir = this.settings.errorBarDirection;

        return data.map((group, i) => {
            const vals = group.values;
            if (vals.length === 0) return isH ? 0 : this.innerHeight;

            const maxVal = d3.max(vals);
            const meanVal = Statistics.mean(vals);
            const medianVal = Statistics.median(vals);

            let topValue = maxVal;

            // Account for error bars extending above data
            if (graphType.includes('bar-mean') || graphType === 'column-bar-mean' || graphType === 'column-bar-sem' || graphType === 'scatter-bar-mean-sd' || graphType === 'scatter-bar-mean-sem') {
                const errorType = (graphType.includes('sem') || graphType.includes('sem')) ? 'sem' : 'sd';
                const errorVal = errorType === 'sem' ? Statistics.sem(vals) : Statistics.std(vals);
                topValue = Math.max(topValue, meanVal + errorVal);
            } else if (graphType === 'column-bar-median') {
                const q = Statistics.quartiles(vals);
                topValue = Math.max(topValue, q.q3);
            } else if (graphType === 'box-plot' || graphType === 'violin-box') {
                const q = Statistics.quartiles(vals);
                const iqr = q.q3 - q.q1;
                const sorted = [...vals].sort((a, b) => a - b);
                const whiskerMax = Math.min(d3.max(sorted), q.q3 + 1.5 * iqr);
                topValue = Math.max(topValue, whiskerMax);
                // Include outliers above
                const outliers = sorted.filter(v => v > q.q3 + 1.5 * iqr);
                if (outliers.length > 0) topValue = Math.max(topValue, d3.max(outliers));
            }

            if (isH) {
                return valueScale(topValue); // pixel X
            } else {
                return valueScale(topValue); // pixel Y (smaller = higher)
            }
        });
    }

    _computeBracketLayout(data, groupScale, valueScale, isH) {
        if (this.significanceResults.length === 0) return [];

        const GAP = 12;
        const BRACKET_HEIGHT = 20; // vertical space a bracket occupies (line + text)
        const ceilings = this._getGroupCeilings(data, valueScale, groupScale, isH);

        // Build bracket objects with span info
        const brackets = this.significanceResults.map((result, idx) => {
            const g1 = result.group1Index;
            const g2 = result.group2Index;
            if (g1 >= data.length || g2 >= data.length) return null;

            const minIdx = Math.min(g1, g2);
            const maxIdx = Math.max(g1, g2);
            const span = maxIdx - minIdx;

            return { idx, g1, g2, minIdx, maxIdx, span, result };
        }).filter(Boolean);

        // Sort by span width (narrowest first, like GraphPad Prism)
        brackets.sort((a, b) => a.span - b.span);

        // Working ceilings array (updated as brackets are placed)
        const workCeilings = [...ceilings];
        const layout = new Array(this.significanceResults.length);

        if (isH) {
            // Horizontal: brackets go to the right of bars
            brackets.forEach(b => {
                // Find max ceiling (pixel X) across spanned groups
                let maxCeiling = 0;
                for (let i = b.minIdx; i <= b.maxIdx; i++) {
                    if (i < workCeilings.length) {
                        maxCeiling = Math.max(maxCeiling, workCeilings[i]);
                    }
                }

                const bracketX = maxCeiling + GAP + (b.result.yOffset || 0);
                const y1 = groupScale(data[b.g1].label) + groupScale.bandwidth() / 2;
                const y2 = groupScale(data[b.g2].label) + groupScale.bandwidth() / 2;

                layout[b.idx] = { bracketX, y1, y2, isH: true };

                // Update ceilings for spanned groups
                for (let i = b.minIdx; i <= b.maxIdx; i++) {
                    if (i < workCeilings.length) {
                        workCeilings[i] = bracketX + BRACKET_HEIGHT;
                    }
                }
            });
        } else {
            // Vertical: brackets go above bars (lower pixel Y = higher)
            brackets.forEach(b => {
                // Find min ceiling (pixel Y) across spanned groups — lowest pixel = highest on screen
                let minCeiling = this.innerHeight;
                for (let i = b.minIdx; i <= b.maxIdx; i++) {
                    if (i < workCeilings.length) {
                        minCeiling = Math.min(minCeiling, workCeilings[i]);
                    }
                }

                const bracketY = minCeiling - GAP + (b.result.yOffset || 0);
                const x1 = groupScale(data[b.g1].label) + groupScale.bandwidth() / 2;
                const x2 = groupScale(data[b.g2].label) + groupScale.bandwidth() / 2;

                layout[b.idx] = { bracketY, x1, x2, isH: false };

                // Update ceilings for spanned groups
                for (let i = b.minIdx; i <= b.maxIdx; i++) {
                    if (i < workCeilings.length) {
                        workCeilings[i] = bracketY - BRACKET_HEIGHT;
                    }
                }
            });
        }

        return layout;
    }

    _drawSignificanceBrackets(g, data, groupScale, valueScale, isH) {
        const starFontSize = this.settings.significanceFontSize || this.settings.fontSize;
        const selectedBracketIdx = this.annotationManager ? this.annotationManager._selectedBracketIdx : -1;

        this.significanceResults.forEach((result, idx) => {
            const group1Idx = result.group1Index;
            const group2Idx = result.group2Index;

            if (group1Idx >= data.length || group2Idx >= data.length) return;

            const pos = this._bracketLayout[idx];
            if (!pos) return;

            if (isH) {
                const { bracketX, y1, y2 } = pos;
                const tickWidth = 8;

                const bracketG = g.append('g')
                    .attr('class', 'bracket-group')
                    .attr('data-bracket-idx', idx)
                    .style('cursor', 'pointer')
                    .on('dblclick', (event) => this._openBracketNudge(event, idx));

                bracketG.append('line')
                    .attr('x1', bracketX - tickWidth).attr('x2', bracketX)
                    .attr('y1', y1).attr('y2', y1)
                    .attr('stroke', '#333').attr('stroke-width', 1.5);
                bracketG.append('line')
                    .attr('x1', bracketX).attr('x2', bracketX)
                    .attr('y1', y1).attr('y2', y2)
                    .attr('stroke', '#333').attr('stroke-width', 1.5);
                bracketG.append('line')
                    .attr('x1', bracketX - tickWidth).attr('x2', bracketX)
                    .attr('y1', y2).attr('y2', y2)
                    .attr('stroke', '#333').attr('stroke-width', 1.5);

                const label = result.significanceLabel || Statistics.getSignificanceLevel(result.pValue);
                bracketG.append('text')
                    .attr('x', bracketX + 4)
                    .attr('y', (y1 + y2) / 2)
                    .attr('text-anchor', 'start')
                    .attr('dominant-baseline', 'middle')
                    .style('font-family', this.settings.fontFamily)
                    .style('font-size', `${starFontSize}px`)
                    .style('font-weight', 'bold')
                    .text(label);

                // Selection highlight
                if (idx === selectedBracketIdx) {
                    const bbox = bracketG.node().getBBox();
                    bracketG.insert('rect', ':first-child')
                        .attr('x', bbox.x - 3).attr('y', bbox.y - 3)
                        .attr('width', bbox.width + 6).attr('height', bbox.height + 6)
                        .attr('fill', 'none')
                        .attr('stroke', '#5E8C31')
                        .attr('stroke-width', 1.5)
                        .attr('stroke-dasharray', '4,3');
                }
            } else {
                const { bracketY, x1, x2 } = pos;
                const tickHeight = 8;

                const bracketG = g.append('g')
                    .attr('class', 'bracket-group')
                    .attr('data-bracket-idx', idx)
                    .style('cursor', 'pointer')
                    .on('dblclick', (event) => this._openBracketNudge(event, idx));

                bracketG.append('line')
                    .attr('x1', x1).attr('x2', x1)
                    .attr('y1', bracketY + tickHeight).attr('y2', bracketY)
                    .attr('stroke', '#333').attr('stroke-width', 1.5);
                bracketG.append('line')
                    .attr('x1', x1).attr('x2', x2)
                    .attr('y1', bracketY).attr('y2', bracketY)
                    .attr('stroke', '#333').attr('stroke-width', 1.5);
                bracketG.append('line')
                    .attr('x1', x2).attr('x2', x2)
                    .attr('y1', bracketY + tickHeight).attr('y2', bracketY)
                    .attr('stroke', '#333').attr('stroke-width', 1.5);

                const label = result.significanceLabel || Statistics.getSignificanceLevel(result.pValue);
                bracketG.append('text')
                    .attr('x', (x1 + x2) / 2)
                    .attr('y', bracketY - 4)
                    .attr('text-anchor', 'middle')
                    .style('font-family', this.settings.fontFamily)
                    .style('font-size', `${starFontSize}px`)
                    .style('font-weight', 'bold')
                    .text(label);

                // Selection highlight
                if (idx === selectedBracketIdx) {
                    const bbox = bracketG.node().getBBox();
                    bracketG.insert('rect', ':first-child')
                        .attr('x', bbox.x - 3).attr('y', bbox.y - 3)
                        .attr('width', bbox.width + 6).attr('height', bbox.height + 6)
                        .attr('fill', 'none')
                        .attr('stroke', '#5E8C31')
                        .attr('stroke-width', 1.5)
                        .attr('stroke-dasharray', '4,3');
                }
            }
        });
    }

    _openBracketNudge(event, bracketIdx) {
        event.stopPropagation();
        const existing = document.querySelector('.bracket-nudge-popup');
        if (existing) existing.remove();

        const rect = event.target.getBoundingClientRect
            ? event.target.getBoundingClientRect()
            : event.currentTarget.getBoundingClientRect();

        const popup = document.createElement('div');
        popup.className = 'svg-edit-popup bracket-nudge-popup';
        popup.style.left = `${rect.left + window.scrollX}px`;
        popup.style.top = `${rect.top + window.scrollY - 36}px`;

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '4px';

        const STEP = 15;
        const isH = this.settings.orientation === 'horizontal';

        const nudge = (direction) => {
            if (!this.significanceResults[bracketIdx]) return;
            // direction: 1 = up (away from data), -1 = down (toward data)
            const delta = isH ? direction * STEP : -direction * STEP;
            this.significanceResults[bracketIdx].yOffset = (this.significanceResults[bracketIdx].yOffset || 0) + delta;
            if (window.app) window.app.updateGraph();
        };

        const makeHoldButton = (label, title, direction) => {
            const btn = document.createElement('button');
            btn.className = 'svg-edit-btn';
            btn.textContent = label;
            btn.title = title;
            let timer = null;
            let interval = null;

            const start = (e) => {
                e.preventDefault();
                nudge(direction);
                timer = setTimeout(() => {
                    interval = setInterval(() => nudge(direction), 80);
                }, 400);
            };
            const stop = () => {
                if (timer) { clearTimeout(timer); timer = null; }
                if (interval) { clearInterval(interval); interval = null; }
            };

            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', stop);
            btn.addEventListener('mouseleave', stop);
            btn.addEventListener('touchstart', start);
            btn.addEventListener('touchend', stop);
            return btn;
        };

        const resetBtn = document.createElement('button');
        resetBtn.className = 'svg-edit-btn';
        resetBtn.textContent = '\u21BA';
        resetBtn.title = 'Reset position';
        resetBtn.style.fontSize = '14px';
        resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!this.significanceResults[bracketIdx]) return;
            this.significanceResults[bracketIdx].yOffset = 0;
            if (window.app) window.app.updateGraph();
        });

        const downBtn = makeHoldButton('\u25BC', 'Move down (hold to repeat)', -1);
        const upBtn = makeHoldButton('\u25B2', 'Move up (hold to repeat)', 1);

        row.appendChild(resetBtn);
        row.appendChild(downBtn);
        row.appendChild(upBtn);
        popup.appendChild(row);

        document.body.appendChild(popup);

        popup.addEventListener('focusout', () => {
            setTimeout(() => {
                if (document.body.contains(popup) && !popup.contains(document.activeElement)) {
                    popup.remove();
                }
            }, 150);
        });

        upBtn.focus();
    }

    _drawStatsLegend(g) {
        // Draw as a centered single line below the x-axis label
        const plotCenterX = this.innerWidth / 2;
        let legendText = '* p < 0.05    ** p < 0.01    *** p < 0.001';
        if (this.settings.statsTestName) {
            legendText += '    |    ' + this.settings.statsTestName;
        }

        g.append('text')
            .attr('class', 'stats-legend')
            .attr('x', plotCenterX)
            .attr('y', this.innerHeight + 35)
            .attr('text-anchor', 'middle')
            .style('font-family', this.settings.fontFamily)
            .style('font-size', '10px')
            .style('fill', '#666')
            .text(legendText);
    }

    _drawGroupLegend(g, data) {
        const legendOff = this.settings.groupLegendOffset;
        const legendX = this.innerWidth + 15 + legendOff.x;
        const legendY = 10 + legendOff.y;
        const lf = this.settings.groupLegendFont;
        const swatchSize = Math.max(8, lf.size - 2);
        const lineHeight = swatchSize + 10;

        const legendG = g.append('g')
            .attr('class', 'group-legend')
            .attr('transform', `translate(${legendX}, ${legendY})`);

        // Invisible drag handle for entire legend
        const totalHeight = data.length * lineHeight;
        legendG.append('rect')
            .attr('x', -4).attr('y', -4)
            .attr('width', this.settings.GROUP_LEGEND_WIDTH).attr('height', totalHeight + 8)
            .attr('fill', 'transparent')
            .style('cursor', 'grab')
            .call(this._makeLegendDrag('whole'));

        data.forEach((group, i) => {
            const color = this._getColor(i);
            const label = this.settings.groupLegendLabels[i] || group.label;
            const itemOff = this.settings.groupLegendItemOffsets[i] || { x: 0, y: 0 };
            const y = i * lineHeight + itemOff.y;
            const x = itemOff.x;

            const itemG = legendG.append('g')
                .attr('class', 'legend-item')
                .attr('transform', `translate(${x}, ${y})`)
                .style('cursor', 'grab')
                .call(this._makeLegendDrag('item', i));

            // Color swatch
            itemG.append('rect')
                .attr('x', 0).attr('y', 0)
                .attr('width', swatchSize).attr('height', swatchSize)
                .attr('fill', color).attr('stroke', '#333')
                .attr('stroke-width', 0.5).attr('rx', 2);

            // Label text (click to edit)
            itemG.append('text')
                .attr('x', swatchSize + 6)
                .attr('y', swatchSize / 2)
                .attr('dominant-baseline', 'middle')
                .style('font-family', lf.family)
                .style('font-size', `${lf.size}px`)
                .style('fill', '#333')
                .style('cursor', 'pointer')
                .text(label)
                .on('click', (event) => { event.stopPropagation(); this._editLegendLabel(event, i, group.label); });
        });
    }

    _makeLegendDrag(mode, itemIndex) {
        const self = this;
        let startX, startY, origOffset, origLegendX, origLegendY, origItemTransform;

        return d3.drag()
            .on('start', function (event) {
                event.sourceEvent.stopPropagation();
                startX = event.x;
                startY = event.y;
                if (mode === 'whole') {
                    origOffset = { ...self.settings.groupLegendOffset };
                    origLegendX = self.innerWidth + 15 + origOffset.x;
                    origLegendY = 10 + origOffset.y;
                } else {
                    origOffset = { ...(self.settings.groupLegendItemOffsets[itemIndex] || { x: 0, y: 0 }) };
                    origItemTransform = { x: origOffset.x, y: origOffset.y };
                }
                d3.select(this).style('cursor', 'grabbing');
            })
            .on('drag', function (event) {
                const dx = event.x - startX;
                const dy = event.y - startY;
                if (mode === 'whole') {
                    // Move the parent legendG directly via transform — no re-render
                    const newX = origLegendX + dx;
                    const newY = origLegendY + dy;
                    d3.select(this.parentNode).attr('transform', `translate(${newX}, ${newY})`);
                } else {
                    // Move this item <g> directly via transform — no re-render
                    const lf = self.settings.groupLegendFont;
                    const swatchSize = Math.max(8, lf.size - 2);
                    const lineHeight = swatchSize + 10;
                    const baseY = itemIndex * lineHeight;
                    const newX = origItemTransform.x + dx;
                    const newY = baseY + origItemTransform.y + dy;
                    d3.select(this).attr('transform', `translate(${newX}, ${newY})`);
                }
            })
            .on('end', function (event) {
                const dx = event.x - startX;
                const dy = event.y - startY;
                if (mode === 'whole') {
                    self.settings.groupLegendOffset = { x: origOffset.x + dx, y: origOffset.y + dy };
                } else {
                    self.settings.groupLegendItemOffsets[itemIndex] = { x: origOffset.x + dx, y: origOffset.y + dy };
                }
                d3.select(this).style('cursor', 'grab');
                // Clean re-render to commit final position
                if (window.app) window.app.updateGraph();
            });
    }

    _editLegendLabel(event, groupIndex, defaultLabel) {
        const existing = document.querySelector('.svg-edit-popup');
        if (existing) existing.remove();

        const textEl = event.target;
        const rect = textEl.getBoundingClientRect();
        const lf = this.settings.groupLegendFont;

        const popup = document.createElement('div');
        popup.className = 'svg-edit-popup';
        popup.style.left = `${rect.left + window.scrollX}px`;
        popup.style.top = `${rect.top + window.scrollY - 4}px`;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'svg-inline-edit';
        input.value = this.settings.groupLegendLabels[groupIndex] || defaultLabel;
        input.style.width = '120px';
        input.style.fontSize = '12px';
        popup.appendChild(input);

        // Font controls row
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '4px';
        row.style.marginTop = '4px';

        const familySelect = document.createElement('select');
        familySelect.className = 'svg-edit-font-family';
        ['Arial', 'Helvetica', 'Times New Roman', 'Courier New'].forEach(f => {
            const opt = document.createElement('option');
            opt.value = f; opt.textContent = f;
            if (f === lf.family) opt.selected = true;
            familySelect.appendChild(opt);
        });

        const sizeInput = document.createElement('input');
        sizeInput.type = 'number';
        sizeInput.className = 'svg-edit-font-size';
        sizeInput.value = lf.size;
        sizeInput.min = 8; sizeInput.max = 28;
        sizeInput.style.width = '48px';

        row.appendChild(familySelect);
        row.appendChild(sizeInput);
        popup.appendChild(row);

        document.body.appendChild(popup);
        input.focus();
        input.select();

        const commit = () => {
            if (!document.body.contains(popup)) return;
            const val = input.value.trim();
            if (val && val !== defaultLabel) {
                this.settings.groupLegendLabels[groupIndex] = val;
            } else {
                delete this.settings.groupLegendLabels[groupIndex];
            }
            // Update legend font
            this.settings.groupLegendFont.family = familySelect.value;
            this.settings.groupLegendFont.size = parseInt(sizeInput.value) || lf.size;
            popup.remove();
            if (window.app) window.app.updateGraph();
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); popup.remove(); }
        });

        popup.addEventListener('focusout', () => {
            setTimeout(() => {
                if (document.body.contains(popup) && !popup.contains(document.activeElement)) {
                    commit();
                }
            }, 100);
        });
    }

    // --- Kernel Density helpers for violin plot ---

    _silvermanBandwidth(values) {
        const n = values.length;
        const std = Statistics.std(values, true);
        const q = Statistics.quartiles(values);
        const iqr = q.q3 - q.q1;
        const spread = Math.min(std, iqr / 1.34);
        return 1.06 * (spread || std || 1) * Math.pow(n, -0.2);
    }

    _kdePoints(values, nPoints = 60) {
        const min = d3.min(values);
        const max = d3.max(values);
        const pad = (max - min) * 0.15 || 1;
        const lo = min - pad;
        const hi = max + pad;
        const step = (hi - lo) / (nPoints - 1);
        return d3.range(nPoints).map(i => lo + i * step);
    }

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
