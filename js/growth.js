// growth.js - Growth curve / time-series renderer

class GrowthCurveRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.settings = {
            title: 'Growth Curve',
            xLabel: 'Time',
            yLabel: 'Value',
            showIndividualLines: true,
            showGroupMeans: true,
            lineWidth: 1.5,
            individualLineOpacity: 0.3,
            meanLineWidth: 2.5,
            colorTheme: 'default',
            yAxisMin: null,
            yAxisMax: null,
            errorType: 'sem',
            width: 400,
            height: 300,
            titleFont: { family: 'Aptos Display', size: 18, bold: true, italic: false },
            xLabelFont: { family: 'Aptos Display', size: 15, bold: false, italic: false },
            yLabelFont: { family: 'Aptos Display', size: 15, bold: false, italic: false },
            xTickFont: { family: 'Aptos Display', size: 12, bold: false, italic: false },
            yTickFont: { family: 'Aptos Display', size: 12, bold: false, italic: false }
        };
        this._titleOffset = { x: 0, y: 0 };
        this._legendOffset = { x: 0, y: 0 };
        this.significanceMarkers = []; // [{timepoint, group1, group2, sigLabel}]

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
            colorblind: [
                '#0072B2', '#E69F00', '#009E73', '#CC79A7',
                '#56B4E9', '#D55E00', '#F0E442', '#000000',
                '#0072B2', '#E69F00'
            ],
            earth: [
                '#8B4513', '#A0522D', '#6B8E23', '#556B2F',
                '#B8860B', '#D2691E', '#CD853F', '#DEB887',
                '#808000', '#BDB76B'
            ],
            ocean: [
                '#003F5C', '#2F4B7C', '#665191', '#A05195',
                '#D45087', '#F95D6A', '#FF7C43', '#FFA600',
                '#488F31', '#00C9A7'
            ],
            neon: [
                '#FF006E', '#FB5607', '#FFBE0B', '#3A86FF',
                '#8338EC', '#06D6A0', '#EF476F', '#FFD166',
                '#118AB2', '#073B4C'
            ],
            black: [
                '#000000', '#000000', '#000000', '#000000',
                '#000000', '#000000', '#000000', '#000000',
                '#000000', '#000000'
            ]
        };

        // Per-group symbol cycle for "per-group" mode or "black" theme
        this.symbolCycle = ['circle', 'square', 'triangle', 'diamond', 'cross', 'star'];
    }

    setSignificance(markers) {
        this.significanceMarkers = markers || [];
    }

    _getSymbolForGroup(gi) {
        const s = this.settings;
        if (s.symbolShape === 'per-group' || s.colorTheme === 'black') {
            return this.symbolCycle[gi % this.symbolCycle.length];
        }
        return s.symbolShape || 'circle';
    }

    _d3Symbol(shape) {
        const map = {
            circle: d3.symbolCircle,
            square: d3.symbolSquare,
            triangle: d3.symbolTriangle,
            diamond: d3.symbolDiamond,
            cross: d3.symbolCross,
            star: d3.symbolStar
        };
        return map[shape] || d3.symbolCircle;
    }

    _getColor(index) {
        const theme = this.colorThemes[this.settings.colorTheme] || this.colorThemes.default;
        return theme[index % theme.length];
    }

    render(growthData, settings) {
        if (settings) Object.assign(this.settings, settings);
        this.container.innerHTML = '';

        if (!growthData || !growthData.timepoints || growthData.timepoints.length === 0) {
            this.container.innerHTML = '<div class="empty-state"><h3>Enter growth curve data to generate graph</h3><p>First column = time, remaining columns = Group_SubjectID</p></div>';
            return;
        }

        const { timepoints, groups, subjects, groupMap } = growthData;
        const s = this.settings;
        const margin = { top: 50, right: 20, bottom: 60, left: 65 };
        const width = s.width;
        const height = s.height;
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        const svg = d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('font-family', 'Aptos Display, sans-serif');

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // X scale (linear time)
        const xScale = d3.scaleLinear()
            .domain([d3.min(timepoints), d3.max(timepoints)])
            .range([0, innerW])
            .nice();

        // Y scale - compute from all values
        let allVals = [];
        Object.values(subjects).forEach(vals => {
            vals.forEach(v => { if (v !== null && !isNaN(v)) allVals.push(v); });
        });
        let yMin = s.yAxisMin !== null && s.yAxisMin !== undefined ? s.yAxisMin : d3.min(allVals);
        let yMax = s.yAxisMax !== null && s.yAxisMax !== undefined ? s.yAxisMax : d3.max(allVals);
        // Add padding — extra top space if significance markers are present
        const topPad = this.significanceMarkers.length > 0 ? 0.15 : 0.05;
        if (s.yAxisMin === null || s.yAxisMin === undefined) yMin = yMin - (yMax - yMin) * 0.05;
        if (s.yAxisMax === null || s.yAxisMax === undefined) yMax = yMax + (yMax - yMin) * topPad;

        const yScale = d3.scaleLinear()
            .domain([yMin, yMax])
            .range([innerH, 0])
            .nice();

        // Axes
        const xAxis = d3.axisBottom(xScale).ticks(Math.min(timepoints.length, 10));
        const yAxis = d3.axisLeft(yScale);

        g.append('g')
            .attr('transform', `translate(0,${innerH})`)
            .call(xAxis)
            .selectAll('text')
            .style('font-family', s.xTickFont.family)
            .style('font-size', s.xTickFont.size + 'px');

        g.append('g')
            .call(yAxis)
            .selectAll('text')
            .style('font-family', s.yTickFont.family)
            .style('font-size', s.yTickFont.size + 'px');

        // Draw per group
        groups.forEach((groupName, gi) => {
            const color = this._getColor(gi);
            const symbol = this._getSymbolForGroup(gi);
            const subjectIds = groupMap[groupName] || [];
            const groupStats = this._calcGroupStats(subjects, groupName, timepoints, subjectIds);

            // Individual subject lines
            if (s.showIndividualLines) {
                this._drawSubjectLines(g, timepoints, subjectIds, subjects, color, xScale, yScale);
            }

            // Group mean + error
            if (s.showGroupMeans) {
                this._drawGroupMean(g, timepoints, groupStats.means, groupStats.errors, color, xScale, yScale, symbol);
            }
        });

        // Legend
        this._drawLegend(svg, groups, width, margin);

        // X-axis label
        svg.append('text')
            .attr('x', margin.left + innerW / 2)
            .attr('y', height - 10)
            .attr('text-anchor', 'middle')
            .style('font-family', s.xLabelFont.family)
            .style('font-size', s.xLabelFont.size + 'px')
            .style('font-weight', s.xLabelFont.bold ? 'bold' : 'normal')
            .text(s.xLabel);

        // Y-axis label
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -(margin.top + innerH / 2))
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .style('font-family', s.yLabelFont.family)
            .style('font-size', s.yLabelFont.size + 'px')
            .style('font-weight', s.yLabelFont.bold ? 'bold' : 'normal')
            .text(s.yLabel);

        // Title (draggable)
        this._drawTitle(svg, width, margin);

        // Significance markers
        if (this.significanceMarkers.length > 0) {
            this._drawSignificanceMarkers(g, this.significanceMarkers, growthData, xScale, yScale, innerH);
        }

        // Info box
        if (s.infoBox) {
            this._drawInfoBox(svg, s.infoBox, margin, width, height);
        }

        // Tooltip
        this._setupTooltip(svg, g, growthData, xScale, yScale, innerW, innerH);
    }

    _drawSubjectLines(g, timepoints, subjectIds, subjects, color, xScale, yScale) {
        const s = this.settings;
        const line = d3.line()
            .defined(d => d[1] !== null && !isNaN(d[1]))
            .x(d => xScale(d[0]))
            .y(d => yScale(d[1]));

        subjectIds.forEach(sid => {
            const vals = subjects[sid];
            if (!vals) return;
            const points = timepoints.map((t, i) => [t, vals[i]]);

            g.append('path')
                .datum(points)
                .attr('fill', 'none')
                .attr('stroke', color)
                .attr('stroke-width', s.lineWidth)
                .attr('stroke-opacity', s.individualLineOpacity)
                .attr('d', line);
        });
    }

    _drawGroupMean(g, timepoints, means, errors, color, xScale, yScale, symbol) {
        const s = this.settings;
        const errStyle = s.errorStyle || 'ribbon';
        const errDir = s.errorDir || 'both';
        const capW = s.capWidth !== undefined ? s.capWidth : 6;
        const symSize = s.symbolSize || 4;

        const validData = timepoints.map((t, i) => ({
            t, mean: means[i], err: errors[i]
        })).filter(d => d.mean !== null && !isNaN(d.mean));

        // Ribbon
        if (errStyle === 'ribbon' || errStyle === 'both') {
            const area = d3.area()
                .x(d => xScale(d.t))
                .y0(d => {
                    const lo = errDir === 'above' ? d.mean : d.mean - d.err;
                    return yScale(lo);
                })
                .y1(d => {
                    const hi = errDir === 'below' ? d.mean : d.mean + d.err;
                    return yScale(hi);
                });

            g.append('path')
                .datum(validData)
                .attr('fill', color)
                .attr('fill-opacity', 0.15)
                .attr('stroke', 'none')
                .attr('class', 'sem-ribbon')
                .attr('d', area);
        }

        // Mean line
        const line = d3.line()
            .defined(d => d.mean !== null && !isNaN(d.mean))
            .x(d => xScale(d.t))
            .y(d => yScale(d.mean));

        g.append('path')
            .datum(validData)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', s.meanLineWidth || 2.5)
            .attr('d', line);

        // Error bars (line + cap)
        if (errStyle === 'bars' || errStyle === 'both') {
            validData.forEach(d => {
                const x = xScale(d.t);
                const yMean = yScale(d.mean);
                const yHi = yScale(d.mean + d.err);
                const yLo = yScale(d.mean - d.err);
                const halfCap = capW / 2;

                if (errDir !== 'below') {
                    // Upper bar
                    g.append('line').attr('x1', x).attr('y1', yMean).attr('x2', x).attr('y2', yHi)
                        .attr('stroke', color).attr('stroke-width', 1.2);
                    if (capW > 0) g.append('line').attr('x1', x - halfCap).attr('y1', yHi).attr('x2', x + halfCap).attr('y2', yHi)
                        .attr('stroke', color).attr('stroke-width', 1.2);
                }
                if (errDir !== 'above') {
                    // Lower bar
                    g.append('line').attr('x1', x).attr('y1', yMean).attr('x2', x).attr('y2', yLo)
                        .attr('stroke', color).attr('stroke-width', 1.2);
                    if (capW > 0) g.append('line').attr('x1', x - halfCap).attr('y1', yLo).attr('x2', x + halfCap).attr('y2', yLo)
                        .attr('stroke', color).attr('stroke-width', 1.2);
                }
            });
        }

        // Symbols at mean points
        const symType = this._d3Symbol(symbol);
        const symGen = d3.symbol().type(symType).size(symSize * symSize * Math.PI);

        g.selectAll(null)
            .data(validData)
            .enter()
            .append('path')
            .attr('transform', d => `translate(${xScale(d.t)},${yScale(d.mean)})`)
            .attr('d', symGen)
            .attr('fill', color)
            .attr('stroke', s.colorTheme === 'black' ? '#fff' : '#fff')
            .attr('stroke-width', 1);
    }

    _drawSignificanceMarkers(g, markers, growthData, xScale, yScale, innerH) {
        if (!markers || markers.length === 0) return;

        const { timepoints, groups, subjects, groupMap } = growthData;

        // Group markers by timepoint for stacking
        const byTimepoint = {};
        markers.forEach(m => {
            if (!byTimepoint[m.timepoint]) byTimepoint[m.timepoint] = [];
            byTimepoint[m.timepoint].push(m);
        });

        Object.entries(byTimepoint).forEach(([tp, mList]) => {
            const t = parseFloat(tp);
            const ti = timepoints.indexOf(t);
            if (ti < 0) return;
            const x = xScale(t);

            // Find max Y value at this timepoint across all visible groups
            let maxY = -Infinity;
            groups.forEach(gName => {
                const sids = groupMap[gName] || [];
                sids.forEach(sid => {
                    const v = subjects[sid]?.[ti];
                    if (v !== null && !isNaN(v) && v > maxY) maxY = v;
                });
            });

            // Stack markers above the highest point
            mList.forEach((m, si) => {
                const yPos = yScale(maxY) - 12 - si * 18;
                const label = `${m.sigLabel}`;
                const compLabel = `${m.group1} vs ${m.group2}`;

                // Bracket + star
                const sigG = g.append('g').attr('class', 'growth-sig-marker');

                sigG.append('text')
                    .attr('x', x)
                    .attr('y', yPos)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '16px')
                    .style('font-weight', 'bold')
                    .style('fill', '#c0392b')
                    .text(label);

                sigG.append('title').text(compLabel);
            });
        });
    }

    _calcGroupStats(subjects, groupName, timepoints, subjectIds) {
        const s = this.settings;
        const means = [];
        const sems = [];
        const sds = [];

        timepoints.forEach((t, ti) => {
            const vals = [];
            subjectIds.forEach(sid => {
                const v = subjects[sid]?.[ti];
                if (v !== null && v !== undefined && !isNaN(v)) vals.push(v);
            });

            if (vals.length === 0) {
                means.push(null);
                sems.push(0);
                sds.push(0);
            } else {
                const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
                means.push(mean);
                const variance = vals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (vals.length > 1 ? vals.length - 1 : 1);
                const sd = Math.sqrt(variance);
                sds.push(sd);
                sems.push(sd / Math.sqrt(vals.length));
            }
        });

        const errors = s.errorType === 'sd' ? sds : sems;
        return { means, sems, sds, errors };
    }

    _drawLegend(svg, groups, width, margin) {
        const ox = this._legendOffset.x;
        const oy = this._legendOffset.y;
        const legendX = width - margin.right - 10 + ox;
        const legendY = margin.top + 5 + oy;

        const legend = svg.append('g')
            .attr('class', 'growth-legend')
            .attr('transform', `translate(${legendX},${legendY})`);

        // Background
        const bgRect = legend.append('rect')
            .attr('fill', '#fff')
            .attr('fill-opacity', 0.9)
            .attr('stroke', '#ccc')
            .attr('stroke-width', 0.5)
            .attr('rx', 3);

        groups.forEach((groupName, i) => {
            const color = this._getColor(i);
            const symbol = this._getSymbolForGroup(i);
            const row = legend.append('g')
                .attr('transform', `translate(5, ${i * 18 + 5})`);

            row.append('line')
                .attr('x1', 0).attr('y1', 6)
                .attr('x2', 16).attr('y2', 6)
                .attr('stroke', color)
                .attr('stroke-width', 2);

            const symType = this._d3Symbol(symbol);
            const symGen = d3.symbol().type(symType).size(36);
            row.append('path')
                .attr('transform', 'translate(8,6)')
                .attr('d', symGen)
                .attr('fill', color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 0.5);

            row.append('text')
                .attr('x', 22)
                .attr('y', 10)
                .style('font-size', '11px')
                .style('font-family', 'Aptos Display, sans-serif')
                .text(groupName);
        });

        // Size background
        const bbox = legend.node().getBBox();
        bgRect
            .attr('x', bbox.x - 4)
            .attr('y', bbox.y - 3)
            .attr('width', bbox.width + 8)
            .attr('height', bbox.height + 6);

        // Make legend draggable
        const self = this;
        const drag = d3.drag()
            .on('drag', function(event) {
                self._legendOffset.x += event.dx;
                self._legendOffset.y += event.dy;
                const newX = width - margin.right - 10 + self._legendOffset.x;
                const newY = margin.top + 5 + self._legendOffset.y;
                d3.select(this).attr('transform', `translate(${newX},${newY})`);
            });
        legend.call(drag).style('cursor', 'move');
    }

    _drawTitle(svg, width, margin) {
        const s = this.settings;
        const ox = this._titleOffset.x;
        const oy = this._titleOffset.y;

        const title = svg.append('text')
            .attr('x', width / 2 + ox)
            .attr('y', margin.top / 2 + oy)
            .attr('text-anchor', 'middle')
            .style('font-family', s.titleFont.family)
            .style('font-size', s.titleFont.size + 'px')
            .style('font-weight', s.titleFont.bold ? 'bold' : 'normal')
            .style('cursor', 'move')
            .text(s.title);

        // Draggable title
        const self = this;
        const drag = d3.drag()
            .on('drag', function(event) {
                self._titleOffset.x += event.dx;
                self._titleOffset.y += event.dy;
                d3.select(this)
                    .attr('x', width / 2 + self._titleOffset.x)
                    .attr('y', margin.top / 2 + self._titleOffset.y);
            });
        title.call(drag);

        // Double-click to edit
        title.on('dblclick', function() {
            const el = d3.select(this);
            const current = el.text();
            const input = prompt('Edit title:', current);
            if (input !== null) {
                s.title = input;
                el.text(input);
                const hiddenTitle = document.getElementById('graphTitle');
                if (hiddenTitle) hiddenTitle.value = input;
            }
        });
    }

    _setupTooltip(svg, g, growthData, xScale, yScale, innerW, innerH) {
        let tooltip = document.getElementById('growth-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'growth-tooltip';
            tooltip.className = 'growth-tooltip';
            document.body.appendChild(tooltip);
        }

        const { timepoints, groups, subjects, groupMap } = growthData;
        const self = this;

        // Overlay rect for mouse events
        g.append('rect')
            .attr('width', innerW)
            .attr('height', innerH)
            .attr('fill', 'none')
            .attr('pointer-events', 'all')
            .on('mousemove', function(event) {
                const [mx] = d3.pointer(event);
                const xVal = xScale.invert(mx);

                // Find closest timepoint
                let closestIdx = 0;
                let minDist = Infinity;
                timepoints.forEach((t, i) => {
                    const dist = Math.abs(t - xVal);
                    if (dist < minDist) { minDist = dist; closestIdx = i; }
                });

                const t = timepoints[closestIdx];
                let html = `<b>Time: ${t}</b><br>`;
                groups.forEach((gName, gi) => {
                    const color = self._getColor(gi);
                    const sids = groupMap[gName] || [];
                    const vals = sids.map(sid => subjects[sid]?.[closestIdx]).filter(v => v !== null && !isNaN(v));
                    if (vals.length === 0) return;
                    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
                    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length > 1 ? vals.length - 1 : 1);
                    const sd = Math.sqrt(variance);
                    const sem = sd / Math.sqrt(vals.length);
                    const errVal = self.settings.errorType === 'sd' ? sd : sem;
                    const errLabel = self.settings.errorType === 'sd' ? 'SD' : 'SEM';
                    html += `<span style="color:${color}">\u25CF</span> ${gName}: ${mean.toFixed(2)} \u00B1 ${errVal.toFixed(2)} (${errLabel}, n=${vals.length})<br>`;
                });

                tooltip.innerHTML = html;
                tooltip.style.display = 'block';
                tooltip.style.left = (event.pageX + 12) + 'px';
                tooltip.style.top = (event.pageY - 10) + 'px';
            })
            .on('mouseleave', function() {
                tooltip.style.display = 'none';
            });
    }

    _drawInfoBox(svg, info, margin, width, height) {
        if (!info) return;

        const lines = [];
        if (info.test) lines.push(`Test: ${info.test}`);
        if (info.postHoc) lines.push(`Post-hoc: ${info.postHoc}`);
        if (info.sig) lines.push(info.sig);
        if (info.n) lines.push(info.n);
        if (info.factors) info.factors.forEach(f => lines.push(f));
        if (info.pkg) lines.push(`Analysis: ${info.pkg}`);

        if (!this._infoBoxOffset) this._infoBoxOffset = { x: 0, y: 0 };
        const ox = this._infoBoxOffset.x;
        const oy = this._infoBoxOffset.y;
        const boxX = margin.left + 5 + ox;
        const boxY = height - 10 + oy;

        const infoG = svg.append('g')
            .attr('class', 'stats-info-box')
            .attr('transform', `translate(${boxX},${boxY})`);

        const lineHeight = 12;
        const padding = 6;

        lines.forEach((line, i) => {
            infoG.append('text')
                .attr('x', padding)
                .attr('y', padding + i * lineHeight + 9)
                .style('font-family', 'Aptos Display, sans-serif')
                .style('font-size', '9px')
                .style('fill', '#555')
                .text(line);
        });

        // Background
        const bbox = infoG.node().getBBox();
        infoG.insert('rect', 'text')
            .attr('x', bbox.x - 3)
            .attr('y', bbox.y - 2)
            .attr('width', bbox.width + 6)
            .attr('height', bbox.height + 4)
            .attr('fill', '#fff')
            .attr('fill-opacity', 0.92)
            .attr('stroke', '#ddd')
            .attr('stroke-width', 0.5)
            .attr('rx', 3);

        // Draggable
        const self = this;
        infoG.call(d3.drag().on('drag', function(event) {
            if (!self._infoBoxOffset) self._infoBoxOffset = { x: 0, y: 0 };
            self._infoBoxOffset.x += event.dx;
            self._infoBoxOffset.y += event.dy;
            d3.select(this).attr('transform', `translate(${margin.left + 5 + self._infoBoxOffset.x},${height - 10 + self._infoBoxOffset.y})`);
        })).style('cursor', 'move');
    }
}
