// correlation.js - X/Y Correlation scatter plot renderer

class CorrelationRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.settings = {
            title: 'Correlation',
            xLabel: 'X',
            yLabel: 'Y',
            width: 400,
            height: 400,
            xMin: null, xMax: null, yMin: null, yMax: null,
            xTickStep: null, yTickStep: null,
            pointSize: 6,
            pointOpacity: 0.8,
            colorTheme: 'default',
            errorType: 'sem', // sem | sd | none
            capWidth: 5,
            showRegression: true,
            showConfidenceInterval: true,
            confidenceLevel: 0.95,
            regressionLineWidth: 2,
            regressionLineColor: '#333',
            regressionLineDash: '',
            statsContent: 'simple', // none | simple | extended
            showSampleLabels: false,
            // Fonts
            titleFont: { family: 'Arial', size: 18, bold: true, italic: false },
            xLabelFont: { family: 'Arial', size: 15, bold: false, italic: false },
            yLabelFont: { family: 'Arial', size: 15, bold: false, italic: false },
            xTickFont: { family: 'Arial', size: 12, bold: false, italic: false },
            yTickFont: { family: 'Arial', size: 12, bold: false, italic: false },
            legendFont: { family: 'Arial', size: 11, bold: false, italic: false },
            statsFont: { family: 'Arial', size: 11, bold: false, italic: false },
            labelFont: { family: 'Arial', size: 10, bold: false, italic: false },
            // Visibility
            showTitle: true,
            showXLabel: true,
            showYLabel: true,
            showLegend: true,
            showZeroLines: false,
            // Offsets
            titleOffset: { x: 0, y: 0 },
            xLabelOffset: { x: 0, y: 0 },
            yLabelOffset: { x: 0, y: 0 },
            legendOffset: { x: 0, y: 0 },
            statsOffset: { x: 0, y: 0 },
            // Per-group
            groupOverrides: {},
            hiddenGroups: [],
            sampleLabelOffsets: {}
        };
        this._nudgeOffsetKey = null;

        this.colorThemes = {
            default: ['#5B8DB8','#E8927C','#7EBF7E','#C490D1','#F2CC8F','#81D4DB','#FF9F9F','#A8D5A2','#C2A0D5','#F4B183'],
            pastel: ['#AEC6CF','#FFB7B2','#B5EAD7','#C7CEEA','#FFDAC1','#E2F0CB','#F0E6EF','#D4F0F0','#FCE1E4','#DAEAF6'],
            vivid: ['#E63946','#457B9D','#2A9D8F','#E9C46A','#F4A261','#264653','#A8DADC','#F77F00','#D62828','#023E8A'],
            colorblind: ['#0072B2','#E69F00','#009E73','#CC79A7','#56B4E9','#D55E00','#F0E442','#000000'],
            earth: ['#8B4513','#A0522D','#6B8E23','#556B2F','#B8860B','#D2691E','#CD853F','#DEB887'],
            ocean: ['#003F5C','#2F4B7C','#665191','#A05195','#D45087','#F95D6A','#FF7C43','#FFA600'],
            neon: ['#FF006E','#FB5607','#FFBE0B','#3A86FF','#8338EC','#06D6A0','#EF476F','#FFD166']
        };
        this.symbolCycle = ['circle','square','triangle','diamond','cross','star'];
    }

    render(correlationData, settings) {
        if (settings) Object.assign(this.settings, settings);
        this.container.innerHTML = '';

        if (!correlationData || !correlationData.allPoints || correlationData.allPoints.length === 0) {
            this.container.innerHTML = '<div class="empty-state"><h3>Enter correlation data</h3><p>Assign columns as X or Y using the axis row, then add data with Group/Sample IDs</p></div>';
            return;
        }

        const s = this.settings;
        const margin = { top: 50, right: 30, bottom: 65, left: 65 };
        const width = s.width;
        const height = s.height;
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        const svg = d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('font-family', 'Arial, sans-serif')
            .style('overflow', 'visible');

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Filter hidden groups
        const visibleGroups = correlationData.groups.filter(gr => !s.hiddenGroups.includes(gr.group));
        const visiblePoints = visibleGroups.flatMap(gr => gr.points);

        if (visiblePoints.length === 0) {
            svg.append('text').attr('x', width / 2).attr('y', height / 2)
                .attr('text-anchor', 'middle').attr('fill', '#999').text('All groups hidden');
            if (this.annotationManager) this.annotationManager.drawAnnotations(svg, margin);
            return;
        }

        // Scales
        const allX = visiblePoints.map(p => p.xMean);
        const allY = visiblePoints.map(p => p.yMean);
        let [xMin, xMax] = d3.extent(allX);
        let [yMin, yMax] = d3.extent(allY);
        // Add padding
        const xPad = (xMax - xMin) * 0.08 || 1;
        const yPad = (yMax - yMin) * 0.08 || 1;
        xMin -= xPad; xMax += xPad;
        yMin -= yPad; yMax += yPad;
        // Apply manual ranges
        if (s.xMin != null) xMin = s.xMin;
        if (s.xMax != null) xMax = s.xMax;
        if (s.yMin != null) yMin = s.yMin;
        if (s.yMax != null) yMax = s.yMax;

        const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, innerW]).nice();
        const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]).nice();

        // Axes
        const xAxisGen = d3.axisBottom(xScale);
        const yAxisGen = d3.axisLeft(yScale);
        if (s.xTickStep) xAxisGen.tickValues(d3.range(xScale.domain()[0], xScale.domain()[1] + s.xTickStep * 0.5, s.xTickStep));
        if (s.yTickStep) yAxisGen.tickValues(d3.range(yScale.domain()[0], yScale.domain()[1] + s.yTickStep * 0.5, s.yTickStep));

        const xAxisG = g.append('g').attr('transform', `translate(0,${innerH})`).call(xAxisGen);
        this._styleAxisTicks(xAxisG, s.xTickFont);
        const yAxisG = g.append('g').call(yAxisGen);
        this._styleAxisTicks(yAxisG, s.yTickFont);

        // Zero lines
        if (s.showZeroLines) {
            const zeroX = xScale(0);
            const zeroY = yScale(0);
            if (zeroX >= 0 && zeroX <= innerW) {
                g.append('line').attr('x1', zeroX).attr('x2', zeroX).attr('y1', 0).attr('y2', innerH)
                    .attr('stroke', '#999').attr('stroke-dasharray', '4,3').attr('stroke-width', 1);
            }
            if (zeroY >= 0 && zeroY <= innerH) {
                g.append('line').attr('x1', 0).attr('x2', innerW).attr('y1', zeroY).attr('y2', zeroY)
                    .attr('stroke', '#999').attr('stroke-dasharray', '4,3').attr('stroke-width', 1);
            }
        }

        // Regression and CI on all visible points
        const regX = visiblePoints.map(p => p.xMean);
        const regY = visiblePoints.map(p => p.yMean);
        const regression = Statistics.linearRegression(regX, regY);

        // Confidence interval band
        if (s.showConfidenceInterval && regression && regression.n >= 3) {
            const alpha = 1 - s.confidenceLevel;
            const tCrit = jStat.studentt.inv(1 - alpha / 2, regression.df);
            const nSteps = 100;
            const xDom = xScale.domain();
            const step = (xDom[1] - xDom[0]) / nSteps;

            const upper = [];
            const lower = [];
            for (let i = 0; i <= nSteps; i++) {
                const xi = xDom[0] + i * step;
                const yHat = regression.slope * xi + regression.intercept;
                const se = regression.residualSE * Math.sqrt(1 / regression.n + (xi - regression.meanX) ** 2 / regression.ssXX);
                const margin = tCrit * se;
                upper.push({ x: xi, y: yHat + margin });
                lower.push({ x: xi, y: yHat - margin });
            }

            const areaData = [...upper, ...lower.reverse()];
            const area = d3.area()
                .x(d => xScale(d.x))
                .y0(d => yScale(d.y))
                .y1((d, i) => i < upper.length ? yScale(lower[lower.length - 1 - i]?.y ?? d.y) : yScale(d.y));

            // Use path with clip
            const clipId = 'ci-clip-' + Math.random().toString(36).slice(2, 8);
            g.append('defs').append('clipPath').attr('id', clipId)
                .append('rect').attr('x', 0).attr('y', 0).attr('width', innerW).attr('height', innerH);

            g.append('path')
                .datum(areaData)
                .attr('clip-path', `url(#${clipId})`)
                .attr('d', d3.area()
                    .x(d => xScale(d.x))
                    .y0((d, i) => {
                        if (i < upper.length) return yScale(lower[upper.length - 1 - i].y);
                        return yScale(d.y);
                    })
                    .y1(d => yScale(d.y))
                    (upper.concat(lower.reverse()))
                )
                .attr('fill', 'none');

            // Simpler approach: draw as polygon
            const polyPoints = [];
            for (let i = 0; i <= nSteps; i++) {
                const xi = xDom[0] + i * step;
                const yHat = regression.slope * xi + regression.intercept;
                const se = regression.residualSE * Math.sqrt(1 / regression.n + (xi - regression.meanX) ** 2 / regression.ssXX);
                const m = tCrit * se;
                polyPoints.push([xScale(xi), yScale(yHat + m)]);
            }
            for (let i = nSteps; i >= 0; i--) {
                const xi = xDom[0] + i * step;
                const yHat = regression.slope * xi + regression.intercept;
                const se = regression.residualSE * Math.sqrt(1 / regression.n + (xi - regression.meanX) ** 2 / regression.ssXX);
                const m = tCrit * se;
                polyPoints.push([xScale(xi), yScale(yHat - m)]);
            }

            // Remove previous failed path
            g.select('path[d]').filter(function() {
                return d3.select(this).attr('fill') === 'none' && d3.select(this).attr('clip-path');
            }).remove();

            const ciClipId = 'ci-clip2-' + Math.random().toString(36).slice(2, 8);
            g.select('defs').append('clipPath').attr('id', ciClipId)
                .append('rect').attr('x', 0).attr('y', 0).attr('width', innerW).attr('height', innerH);

            g.append('polygon')
                .attr('clip-path', `url(#${ciClipId})`)
                .attr('points', polyPoints.map(p => p.join(',')).join(' '))
                .attr('fill', s.regressionLineColor)
                .attr('fill-opacity', 0.1)
                .attr('stroke', 'none');
        }

        // Regression line
        if (s.showRegression && regression) {
            const xDom = xScale.domain();
            const x1 = xDom[0], x2 = xDom[1];
            const y1 = regression.slope * x1 + regression.intercept;
            const y2 = regression.slope * x2 + regression.intercept;

            const clipId = 'reg-clip-' + Math.random().toString(36).slice(2, 8);
            if (!g.select('defs').node()) g.append('defs');
            g.select('defs').append('clipPath').attr('id', clipId)
                .append('rect').attr('x', 0).attr('y', 0).attr('width', innerW).attr('height', innerH);

            g.append('line')
                .attr('clip-path', `url(#${clipId})`)
                .attr('x1', xScale(x1)).attr('y1', yScale(y1))
                .attr('x2', xScale(x2)).attr('y2', yScale(y2))
                .attr('stroke', s.regressionLineColor)
                .attr('stroke-width', s.regressionLineWidth)
                .attr('stroke-dasharray', s.regressionLineDash || '');
        }

        // Error bars
        const self = this;
        visiblePoints.forEach(pt => {
            const cx = xScale(pt.xMean);
            const cy = yScale(pt.yMean);
            const errType = s.errorType;
            if (errType !== 'none') {
                const xErr = errType === 'sd' ? pt.xSD : pt.xSEM;
                const yErr = errType === 'sd' ? pt.ySD : pt.ySEM;
                // Horizontal error bar
                if (xErr > 0 && pt.xValues.length > 1) {
                    const x1 = xScale(pt.xMean - xErr);
                    const x2 = xScale(pt.xMean + xErr);
                    g.append('line').attr('x1', x1).attr('x2', x2).attr('y1', cy).attr('y2', cy)
                        .attr('stroke', '#666').attr('stroke-width', 1);
                    // Caps
                    if (s.capWidth > 0) {
                        g.append('line').attr('x1', x1).attr('x2', x1).attr('y1', cy - s.capWidth / 2).attr('y2', cy + s.capWidth / 2)
                            .attr('stroke', '#666').attr('stroke-width', 1);
                        g.append('line').attr('x1', x2).attr('x2', x2).attr('y1', cy - s.capWidth / 2).attr('y2', cy + s.capWidth / 2)
                            .attr('stroke', '#666').attr('stroke-width', 1);
                    }
                }
                // Vertical error bar
                if (yErr > 0 && pt.yValues.length > 1) {
                    const y1 = yScale(pt.yMean + yErr);
                    const y2 = yScale(pt.yMean - yErr);
                    g.append('line').attr('x1', cx).attr('x2', cx).attr('y1', y1).attr('y2', y2)
                        .attr('stroke', '#666').attr('stroke-width', 1);
                    if (s.capWidth > 0) {
                        g.append('line').attr('x1', cx - s.capWidth / 2).attr('x2', cx + s.capWidth / 2).attr('y1', y1).attr('y2', y1)
                            .attr('stroke', '#666').attr('stroke-width', 1);
                        g.append('line').attr('x1', cx - s.capWidth / 2).attr('x2', cx + s.capWidth / 2).attr('y1', y2).attr('y2', y2)
                            .attr('stroke', '#666').attr('stroke-width', 1);
                    }
                }
            }
        });

        // Get unique group names from visible groups
        const groupNames = visibleGroups.map(gr => gr.group);

        // Scatter points
        visiblePoints.forEach(pt => {
            const gi = groupNames.indexOf(pt.group || visibleGroups[0]?.group);
            const color = this._getColor(gi >= 0 ? gi : 0);
            const symbolGen = this._d3Symbol(this._getSymbolForGroup(gi >= 0 ? gi : 0));

            g.append('path')
                .attr('d', symbolGen.size(s.pointSize * s.pointSize * Math.PI)())
                .attr('transform', `translate(${xScale(pt.xMean)},${yScale(pt.yMean)})`)
                .attr('fill', color)
                .attr('fill-opacity', s.pointOpacity)
                .attr('stroke', d3.color(color).darker(0.5))
                .attr('stroke-width', 1)
                .attr('cursor', 'pointer')
                .append('title')
                .text(`${pt.group ? pt.group + ': ' : ''}${pt.sample}\nX: ${pt.xMean.toFixed(3)}\nY: ${pt.yMean.toFixed(3)}`);
        });

        // Sample labels
        if (s.showSampleLabels) {
            const lf = s.labelFont;
            visiblePoints.forEach(pt => {
                const label = pt.sample || '';
                if (!label) return;
                const userOff = s.sampleLabelOffsets[label] || { x: 0, y: 0 };
                const lx = xScale(pt.xMean) + 8 + userOff.x;
                const ly = yScale(pt.yMean) - 4 + userOff.y;

                // Leader line if offset
                const dist = Math.sqrt(userOff.x ** 2 + userOff.y ** 2);
                if (dist > 5) {
                    g.append('line')
                        .attr('x1', xScale(pt.xMean)).attr('y1', yScale(pt.yMean))
                        .attr('x2', lx).attr('y2', ly + lf.size * 0.35)
                        .attr('stroke', '#999').attr('stroke-width', 0.5).attr('stroke-dasharray', '2,2');
                }

                const txtEl = g.append('text')
                    .attr('x', lx).attr('y', ly)
                    .attr('font-size', lf.size + 'px')
                    .attr('font-family', lf.family)
                    .attr('font-weight', lf.bold ? 'bold' : 'normal')
                    .attr('font-style', lf.italic ? 'italic' : 'normal')
                    .attr('fill', '#333')
                    .attr('cursor', 'grab')
                    .text(label);

                txtEl.call(d3.drag()
                    .filter(ev => !ev.ctrlKey && !ev.button && ev.detail < 2)
                    .on('start', function() { d3.select(this).style('cursor', 'grabbing'); })
                    .on('drag', function(event) {
                        if (!self.settings.sampleLabelOffsets[label]) self.settings.sampleLabelOffsets[label] = { x: 0, y: 0 };
                        self.settings.sampleLabelOffsets[label].x += event.dx;
                        self.settings.sampleLabelOffsets[label].y += event.dy;
                        d3.select(this)
                            .attr('x', parseFloat(d3.select(this).attr('x')) + event.dx)
                            .attr('y', parseFloat(d3.select(this).attr('y')) + event.dy);
                    })
                    .on('end', function() {
                        d3.select(this).style('cursor', 'grab');
                        if (window.app) window.app.updateGraph();
                    })
                );
            });
        }

        // Legend
        this._drawLegend(g, innerW, groupNames);

        // Stats annotation box
        this._drawStatsBox(g, innerW, innerH, regX, regY, regression);

        // Title
        if (s.showTitle) this._drawInteractiveText(svg, 'title', margin.left + innerW / 2, 22, s.title, s.titleFont, s.titleOffset);

        // X label
        if (s.showXLabel) this._drawInteractiveText(svg, 'xLabel', margin.left + innerW / 2, height - 10, s.xLabel, s.xLabelFont, s.xLabelOffset);

        // Y label
        if (s.showYLabel) {
            const ylf = s.yLabelFont;
            const yOff = s.yLabelOffset;
            const yLabelEl = svg.append('text')
                .attr('transform', `translate(${15 + yOff.x},${margin.top + innerH / 2 + yOff.y}) rotate(-90)`)
                .attr('text-anchor', 'middle')
                .attr('font-size', ylf.size + 'px')
                .attr('font-family', ylf.family)
                .attr('font-weight', ylf.bold ? 'bold' : 'normal')
                .attr('font-style', ylf.italic ? 'italic' : 'normal')
                .attr('fill', '#333')
                .attr('cursor', 'grab')
                .text(s.yLabel);
            this._makeLabelDrag(yLabelEl, 'yLabelOffset');
            yLabelEl.on('dblclick', () => this._startInlineEdit(null, 'yLabel'));
        }

        // Annotations
        if (this.annotationManager) {
            this.annotationManager.drawAnnotations(svg, margin);
        }
    }

    _drawStatsBox(g, innerW, innerH, x, y, regression) {
        const s = this.settings;
        if (s.statsContent === 'none') return;

        const pearson = Statistics.pearsonCorrelation(x, y);
        const sf = s.statsFont;
        const off = s.statsOffset;

        const lines = [];
        if (regression) {
            const sign = regression.intercept >= 0 ? '+' : '';
            lines.push(`y = ${regression.slope.toFixed(3)}x ${sign}${regression.intercept.toFixed(3)}`);
            lines.push(`R\u00B2 = ${regression.rSquared.toFixed(4)}`);
        }
        if (!isNaN(pearson.r)) {
            lines.push(`Pearson r = ${pearson.r.toFixed(4)}, ${Statistics.formatPValue(pearson.p)}`);
        }
        if (s.statsContent === 'extended') {
            const spearman = Statistics.spearmanCorrelation(x, y);
            if (!isNaN(spearman.rho)) {
                lines.push(`Spearman \u03C1 = ${spearman.rho.toFixed(4)}, ${Statistics.formatPValue(spearman.p)}`);
            }
            lines.push(`n = ${pearson.n}`);
        }

        if (lines.length === 0) return;

        const boxX = innerW - 10 + off.x;
        const boxY = 10 + off.y;
        const lineH = sf.size + 4;
        const boxH = lines.length * lineH + 8;
        const boxW = Math.max(...lines.map(l => l.length)) * sf.size * 0.55 + 16;

        const statsG = g.append('g')
            .attr('transform', `translate(${boxX - boxW}, ${boxY})`)
            .attr('cursor', 'grab');

        statsG.append('rect')
            .attr('width', boxW).attr('height', boxH)
            .attr('fill', 'white').attr('fill-opacity', 0.9)
            .attr('stroke', '#ccc').attr('stroke-width', 0.5)
            .attr('rx', 3);

        lines.forEach((line, i) => {
            statsG.append('text')
                .attr('x', 8).attr('y', 4 + (i + 1) * lineH - 2)
                .attr('font-size', sf.size + 'px')
                .attr('font-family', sf.family)
                .attr('font-weight', sf.bold ? 'bold' : 'normal')
                .attr('font-style', sf.italic ? 'italic' : 'normal')
                .attr('fill', '#333')
                .text(line);
        });

        // Drag stats box
        const self = this;
        statsG.call(d3.drag()
            .on('start', function() { d3.select(this).style('cursor', 'grabbing'); })
            .on('drag', function(event) {
                self.settings.statsOffset.x += event.dx;
                self.settings.statsOffset.y += event.dy;
                if (window.app) window.app.updateGraph();
            })
            .on('end', function() {
                d3.select(this).style('cursor', 'grab');
                self._selectLabelForNudge('statsOffset');
            })
        );
    }

    _drawLegend(g, innerW, groupNames) {
        const s = this.settings;
        if (!s.showLegend || groupNames.length <= 1) return;

        const lf = s.legendFont;
        const loff = s.legendOffset;

        const legendG = g.append('g')
            .attr('transform', `translate(${10 + loff.x}, ${5 + loff.y})`)
            .attr('cursor', 'grab');

        groupNames.forEach((name, i) => {
            const ly = i * 20;
            const color = this._getColor(i);
            const symbolGen = this._d3Symbol(this._getSymbolForGroup(i));

            legendG.append('path')
                .attr('d', symbolGen.size(50)())
                .attr('transform', `translate(6,${ly})`)
                .attr('fill', color);

            legendG.append('text')
                .attr('x', 16).attr('y', ly + 4)
                .attr('font-size', lf.size + 'px')
                .attr('font-family', lf.family)
                .attr('font-weight', lf.bold ? 'bold' : 'normal')
                .attr('font-style', lf.italic ? 'italic' : 'normal')
                .attr('fill', '#333')
                .text(name);
        });

        const self = this;
        legendG.call(d3.drag()
            .on('start', function() { d3.select(this).style('cursor', 'grabbing'); })
            .on('drag', function(event) {
                self.settings.legendOffset.x += event.dx;
                self.settings.legendOffset.y += event.dy;
                d3.select(this).attr('transform',
                    `translate(${10 + self.settings.legendOffset.x}, ${5 + self.settings.legendOffset.y})`);
            })
            .on('end', function() {
                d3.select(this).style('cursor', 'grab');
                self._selectLabelForNudge('legendOffset');
            })
        );

        legendG.on('dblclick', () => this._startInlineEdit(null, 'legend'));
    }

    // --- Shared helper methods (adapted from volcano.js) ---

    _drawInteractiveText(svg, labelType, baseX, baseY, text, font, offset) {
        const el = svg.append('text')
            .attr('x', baseX + offset.x)
            .attr('y', baseY + offset.y)
            .attr('text-anchor', 'middle')
            .attr('font-size', font.size + 'px')
            .attr('font-family', font.family)
            .attr('font-weight', font.bold ? 'bold' : 'normal')
            .attr('font-style', font.italic ? 'italic' : 'normal')
            .attr('fill', '#333')
            .attr('cursor', 'grab')
            .text(text);

        const offsetKey = labelType + 'Offset';
        this._makeLabelDrag(el, offsetKey);
        el.on('dblclick', () => this._startInlineEdit(null, labelType));
        return el;
    }

    _makeLabelDrag(selection, offsetKey) {
        const self = this;
        let startX, startY, origOff, didDrag;
        selection.call(d3.drag()
            .filter(ev => !ev.ctrlKey && !ev.button && ev.detail < 2)
            .on('start', function(event) {
                event.sourceEvent.stopPropagation();
                startX = event.x; startY = event.y;
                origOff = { ...self.settings[offsetKey] };
                didDrag = false;
                d3.select(this).style('cursor', 'grabbing');
            })
            .on('drag', function(event) {
                const dx = event.x - startX, dy = event.y - startY;
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag = true;
                self.settings[offsetKey] = { x: origOff.x + dx, y: origOff.y + dy };
                d3.select(this)
                    .attr('x', parseFloat(d3.select(this).attr('x')) + (event.dx || 0))
                    .attr('y', parseFloat(d3.select(this).attr('y')) + (event.dy || 0));
            })
            .on('end', function() {
                d3.select(this).style('cursor', 'grab');
                if (didDrag) {
                    if (window.app) window.app.updateGraph();
                } else {
                    self._selectLabelForNudge(offsetKey);
                }
            })
        );
    }

    _selectLabelForNudge(offsetKey) {
        this._nudgeOffsetKey = offsetKey;
        if (this._labelNudgeHandler) document.removeEventListener('keydown', this._labelNudgeHandler);
        this._labelNudgeHandler = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            if (!this._nudgeOffsetKey) return;
            e.preventDefault();
            const step = e.shiftKey ? 10 : 2;
            const off = this.settings[this._nudgeOffsetKey];
            if (!off) return;
            if (e.key === 'ArrowUp') off.y -= step;
            else if (e.key === 'ArrowDown') off.y += step;
            else if (e.key === 'ArrowLeft') off.x -= step;
            else if (e.key === 'ArrowRight') off.x += step;
            if (window.app) window.app.updateGraph();
        };
        document.addEventListener('keydown', this._labelNudgeHandler);
    }

    _startInlineEdit(event, labelType) {
        const s = this.settings;
        const existing = document.querySelector('.svg-edit-popup');
        if (existing) existing.remove();

        const map = {
            title:  { textKey: 'title',  fontKey: 'titleFont',  visKey: 'showTitle' },
            xLabel: { textKey: 'xLabel', fontKey: 'xLabelFont', visKey: 'showXLabel' },
            yLabel: { textKey: 'yLabel', fontKey: 'yLabelFont', visKey: 'showYLabel' },
            legend: { fontKey: 'legendFont', visKey: 'showLegend' }
        };
        const info = map[labelType];
        if (!info) return;

        if (window.app) window.app.saveUndoState();

        const popup = document.createElement('div');
        popup.className = 'svg-edit-popup';

        const containerRect = this.container.getBoundingClientRect();
        popup.style.left = `${containerRect.left + containerRect.width / 2 - 100 + window.scrollX}px`;
        popup.style.top = `${containerRect.top + 30 + window.scrollY}px`;

        const fontObj = s[info.fontKey];
        const { toolbar, familySelect, sizeInput } = this._createFontToolbar(fontObj);

        if (info.visKey) {
            const hideBtn = document.createElement('button');
            hideBtn.className = 'svg-edit-btn';
            hideBtn.textContent = '\u{1F6AB}';
            hideBtn.title = 'Hide this element';
            hideBtn.style.marginLeft = '4px';
            hideBtn.addEventListener('mousedown', e => e.preventDefault());
            hideBtn.addEventListener('click', e => {
                e.preventDefault();
                s[info.visKey] = false;
                popup.remove();
                if (window.app) window.app.updateGraph();
            });
            toolbar.appendChild(hideBtn);
        }

        popup.appendChild(toolbar);

        if (info.textKey) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'svg-inline-edit';
            input.value = s[info.textKey] || '';
            input.style.fontSize = `${fontObj.size}px`;
            input.style.fontFamily = fontObj.family;
            input.style.width = '200px';
            popup.appendChild(input);

            const commit = () => {
                if (!document.body.contains(popup)) return;
                s[info.textKey] = input.value;
                popup.remove();
                if (window.app) window.app.updateGraph();
            };

            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                else if (e.key === 'Escape') { e.preventDefault(); popup.remove(); }
            });

            input.addEventListener('input', () => {
                s[info.textKey] = input.value;
                if (window.app) window.app.updateGraph();
            });

            familySelect.addEventListener('change', () => { input.style.fontFamily = familySelect.value; });
            sizeInput.addEventListener('input', () => { input.style.fontSize = `${sizeInput.value}px`; });

            setTimeout(() => { input.focus(); input.select(); }, 0);
        }

        document.body.appendChild(popup);

        popup.addEventListener('focusout', () => {
            setTimeout(() => {
                if (document.body.contains(popup) && !popup.contains(document.activeElement)) {
                    popup.remove();
                    if (window.app) window.app.updateGraph();
                }
            }, 100);
        });
    }

    _createFontToolbar(fontObj) {
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display:flex;align-items:center;gap:4px;flex-wrap:wrap;';
        const families = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New'];
        const familySelect = document.createElement('select');
        familySelect.style.cssText = 'font-size:11px;padding:2px;max-width:100px;';
        families.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f; opt.textContent = f;
            if (f === fontObj.family) opt.selected = true;
            familySelect.appendChild(opt);
        });
        familySelect.addEventListener('change', () => { fontObj.family = familySelect.value; if (window.app) window.app.updateGraph(); });
        toolbar.appendChild(familySelect);

        const sizeInput = document.createElement('input');
        sizeInput.type = 'number'; sizeInput.min = 6; sizeInput.max = 72; sizeInput.step = 1;
        sizeInput.value = fontObj.size;
        sizeInput.style.cssText = 'width:48px;font-size:11px;padding:2px;';
        sizeInput.addEventListener('input', () => { fontObj.size = parseInt(sizeInput.value) || 12; if (window.app) window.app.updateGraph(); });
        toolbar.appendChild(sizeInput);

        const boldBtn = document.createElement('button');
        boldBtn.className = 'svg-edit-btn' + (fontObj.bold ? ' active' : '');
        boldBtn.textContent = 'B';
        boldBtn.style.fontWeight = 'bold';
        boldBtn.addEventListener('mousedown', e => e.preventDefault());
        boldBtn.addEventListener('click', () => {
            fontObj.bold = !fontObj.bold;
            boldBtn.classList.toggle('active', fontObj.bold);
            if (window.app) window.app.updateGraph();
        });
        toolbar.appendChild(boldBtn);

        const italicBtn = document.createElement('button');
        italicBtn.className = 'svg-edit-btn' + (fontObj.italic ? ' active' : '');
        italicBtn.textContent = 'I';
        italicBtn.style.fontStyle = 'italic';
        italicBtn.addEventListener('mousedown', e => e.preventDefault());
        italicBtn.addEventListener('click', () => {
            fontObj.italic = !fontObj.italic;
            italicBtn.classList.toggle('active', fontObj.italic);
            if (window.app) window.app.updateGraph();
        });
        toolbar.appendChild(italicBtn);

        return { toolbar, familySelect, sizeInput, boldBtn, italicBtn };
    }

    _styleAxisTicks(axisG, tickFont) {
        axisG.selectAll('text')
            .attr('font-size', tickFont.size + 'px')
            .attr('font-family', tickFont.family)
            .attr('font-weight', tickFont.bold ? 'bold' : 'normal')
            .attr('font-style', tickFont.italic ? 'italic' : 'normal');
    }

    _getColor(groupIndex) {
        const theme = this.colorThemes[this.settings.colorTheme] || this.colorThemes.default;
        return theme[groupIndex % theme.length];
    }

    _getSymbolForGroup(groupIndex) {
        return this.symbolCycle[groupIndex % this.symbolCycle.length];
    }

    _d3Symbol(shapeName) {
        const map = {
            circle: d3.symbolCircle,
            square: d3.symbolSquare,
            triangle: d3.symbolTriangle,
            diamond: d3.symbolDiamond,
            cross: d3.symbolCross,
            star: d3.symbolStar
        };
        return d3.symbol().type(map[shapeName] || d3.symbolCircle);
    }

    getSvgElement() {
        return this.container.querySelector('svg');
    }
}
