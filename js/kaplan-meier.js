// kaplan-meier.js - Kaplan-Meier survival curve renderer

class KaplanMeierRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.settings = {
            title: 'Kaplan-Meier Survival Curve',
            xLabel: 'Time',
            yLabel: 'Survival Probability',
            width: 300,
            height: 300,
            colorTheme: 'default',
            showTitle: true,
            showXLabel: true,
            showYLabel: true,
            showLegend: true,
            // Fonts
            titleFont: { family: 'Arial', size: 18, bold: true, italic: false },
            xLabelFont: { family: 'Arial', size: 15, bold: false, italic: false },
            yLabelFont: { family: 'Arial', size: 15, bold: false, italic: false },
            xTickFont: { family: 'Arial', size: 12, bold: false, italic: false },
            yTickFont: { family: 'Arial', size: 12, bold: false, italic: false },
            legendFont: { family: 'Arial', size: 11, bold: false, italic: false },
            // Offsets
            titleOffset: { x: 0, y: 0 },
            xLabelOffset: { x: 0, y: 0 },
            yLabelOffset: { x: 0, y: 0 },
            legendOffset: { x: 0, y: 0 },
            // KM-specific
            showCI: false,
            showCensored: true,
            showMedian: false,
            showRiskTable: false,
            showLogRank: true,
            lineWidth: 2,
            pointSize: 4,
            // Group
            groupOverrides: {},
            hiddenGroups: [],
            groupOrder: [],
            // Axis overrides
            xMin: null,
            xMax: null,
            yMin: 0,
            yMax: 1,
            xTickStep: null,
            yTickStep: null,
            // Stats legend
            showStatsLegend: false,
            statsLegendOffset: { x: 0, y: 0 }
        };
        this._nudgeOffsetKey = null;

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
                '#56B4E9', '#D55E00', '#F0E442', '#000000'
            ],
            earth: [
                '#8B4513', '#2E7D32', '#DAA520', '#B71C1C',
                '#1565C0', '#558B2F', '#E65100', '#4E342E',
                '#F9A825', '#1B5E20'
            ],
            ocean: [
                '#01579B', '#FF6F00', '#00695C', '#D84315',
                '#1A237E', '#F57F17', '#004D40', '#BF360C',
                '#0277BD', '#00838F'
            ],
            neon: [
                '#FF006E', '#FB5607', '#FFBE0B', '#3A86FF',
                '#8338EC', '#06D6A0', '#EF476F', '#FFD166'
            ],
            contrast: [
                '#E41A1C', '#377EB8', '#4DAF4A', '#984EA3',
                '#FF7F00', '#A65628', '#F781BF', '#999999',
                '#66C2A5', '#FC8D62'
            ],
            black: [
                '#000000', '#000000', '#000000', '#000000',
                '#000000', '#000000', '#000000', '#000000',
                '#000000', '#000000'
            ]
        };

        this.lineDashCycle = ['solid', 'dashed', 'dotted', 'dashdot', 'longdash'];
    }

    // ===== COLOR / LABEL HELPERS =====

    _getColor(groupIndex, groupName) {
        const ov = groupName && this.settings.groupOverrides && this.settings.groupOverrides[groupName];
        if (ov && ov.color) return ov.color;
        const theme = this.colorThemes[this.settings.colorTheme] || this.colorThemes.default;
        return theme[groupIndex % theme.length];
    }

    _getGroupLabel(groupName) {
        const ov = this.settings.groupOverrides && this.settings.groupOverrides[groupName];
        return (ov && ov.label) || groupName;
    }

    _getLineDash(groupIndex, groupName) {
        const ov = groupName && this.settings.groupOverrides && this.settings.groupOverrides[groupName];
        if (ov && ov.lineDash) return ov.lineDash;
        // For black theme, cycle dash patterns
        if (this.settings.colorTheme === 'black') {
            return this.lineDashCycle[groupIndex % this.lineDashCycle.length];
        }
        return 'solid';
    }

    _dashArray(style) {
        const map = { solid: 'none', dashed: '8,4', dotted: '2,3', dashdot: '8,3,2,3', longdash: '14,4' };
        return map[style] || 'none';
    }

    // ===== KAPLAN-MEIER CALCULATION =====

    _computeKM(subjects) {
        // subjects: [{time, event}] — event=1 means event occurred, event=0 means censored
        // Returns array of steps: [{time, survival, nRisk, nEvent, nCensor, ciLow, ciHigh}]
        if (!subjects || subjects.length === 0) return [];

        // Sort by time
        const sorted = [...subjects].sort((a, b) => a.time - b.time);

        // Group events by unique times
        const timeMap = new Map();
        sorted.forEach(s => {
            if (!timeMap.has(s.time)) {
                timeMap.set(s.time, { events: 0, censored: 0 });
            }
            if (s.event === 1) {
                timeMap.get(s.time).events++;
            } else {
                timeMap.get(s.time).censored++;
            }
        });

        const times = [...timeMap.keys()].sort((a, b) => a - b);

        const result = [];
        let nRisk = subjects.length;
        let survival = 1.0;
        let greenwoodSum = 0; // Greenwood's formula cumulative sum

        // Add initial point at time 0 (or just before first event)
        result.push({
            time: 0,
            survival: 1.0,
            nRisk: nRisk,
            nEvent: 0,
            nCensor: 0,
            ciLow: 1.0,
            ciHigh: 1.0
        });

        times.forEach(t => {
            const info = timeMap.get(t);
            const di = info.events;     // number of events at this time
            const ci = info.censored;   // number of censored at this time

            if (di > 0 && nRisk > 0) {
                // Kaplan-Meier estimate: S(t) = S(t-1) * (1 - d_i / n_i)
                survival = survival * (1 - di / nRisk);

                // Greenwood's formula for variance:
                // Var(S(t)) = S(t)^2 * sum(d_i / (n_i * (n_i - d_i)))
                if (nRisk > di) {
                    greenwoodSum += di / (nRisk * (nRisk - di));
                }

                const se = survival * Math.sqrt(greenwoodSum);
                const z = 1.96; // 95% CI
                const ciLow = Math.max(0, survival - z * se);
                const ciHigh = Math.min(1, survival + z * se);

                result.push({
                    time: t,
                    survival: survival,
                    nRisk: nRisk,
                    nEvent: di,
                    nCensor: ci,
                    ciLow: ciLow,
                    ciHigh: ciHigh
                });
            } else if (ci > 0) {
                // Only censored observations at this time — no survival change, record for marks
                result.push({
                    time: t,
                    survival: survival,
                    nRisk: nRisk,
                    nEvent: 0,
                    nCensor: ci,
                    ciLow: result.length > 0 ? result[result.length - 1].ciLow : 1,
                    ciHigh: result.length > 0 ? result[result.length - 1].ciHigh : 1
                });
            }

            nRisk -= (di + ci);
        });

        return result;
    }

    // ===== LOG-RANK TEST =====

    _logRankTest(groupData) {
        // groupData: { groupName: [{time, event}], ... }
        // Returns: { chi2, pValue, df }
        const groupNames = Object.keys(groupData);
        const nGroups = groupNames.length;
        if (nGroups < 2) return { chi2: 0, pValue: 1, df: 0 };

        // Collect all unique event times across all groups
        const allSubjects = [];
        groupNames.forEach(name => {
            groupData[name].forEach(s => allSubjects.push({ ...s, group: name }));
        });

        // Get unique event times (where events occur)
        const eventTimes = [...new Set(allSubjects.filter(s => s.event === 1).map(s => s.time))].sort((a, b) => a - b);

        if (eventTimes.length === 0) return { chi2: 0, pValue: 1, df: nGroups - 1 };

        // For each group, compute observed and expected
        const O = {}; // observed events per group
        const E = {}; // expected events per group
        groupNames.forEach(name => { O[name] = 0; E[name] = 0; });

        eventTimes.forEach(t => {
            // At each event time, compute:
            // d_j = total events at time t across all groups
            // n_j = total at risk at time t across all groups
            // d_ij = events in group i at time t
            // n_ij = at risk in group i at time t
            const riskCounts = {};
            const eventCounts = {};
            let totalRisk = 0;
            let totalEvents = 0;

            groupNames.forEach(name => {
                const subjects = groupData[name];
                // At risk: subjects with time >= t
                const atRisk = subjects.filter(s => s.time >= t).length;
                // Events at this time
                const events = subjects.filter(s => s.time === t && s.event === 1).length;

                riskCounts[name] = atRisk;
                eventCounts[name] = events;
                totalRisk += atRisk;
                totalEvents += events;
            });

            if (totalRisk === 0) return;

            groupNames.forEach(name => {
                O[name] += eventCounts[name];
                E[name] += (riskCounts[name] / totalRisk) * totalEvents;
            });
        });

        // Chi-square statistic: sum((O_i - E_i)^2 / E_i) for each group
        let chi2 = 0;
        groupNames.forEach(name => {
            if (E[name] > 0) {
                chi2 += (O[name] - E[name]) ** 2 / E[name];
            }
        });

        const df = nGroups - 1;

        // p-value from chi-square distribution
        let pValue = 1;
        if (typeof jStat !== 'undefined' && jStat.chisquare && jStat.chisquare.cdf) {
            pValue = 1 - jStat.chisquare.cdf(chi2, df);
        } else {
            // Fallback: approximation using regularized incomplete gamma function
            pValue = this._chi2pValue(chi2, df);
        }

        return { chi2, pValue, df };
    }

    _chi2pValue(x, df) {
        // Fallback chi-square p-value (Wilson-Hilferty approximation)
        if (x <= 0 || df <= 0) return 1;
        const z = Math.pow(x / df, 1 / 3) - (1 - 2 / (9 * df));
        const se = Math.sqrt(2 / (9 * df));
        const zNorm = z / se;
        // Standard normal CDF approximation
        const t = 1 / (1 + 0.2316419 * Math.abs(zNorm));
        const d = 0.3989422804014327;
        const p = d * Math.exp(-zNorm * zNorm / 2) *
            (0.3193815 * t - 0.3565638 * t * t + 1.781478 * t * t * t -
             1.821256 * t * t * t * t + 1.330274 * t * t * t * t * t);
        return zNorm > 0 ? p : 1 - p;
    }

    // ===== MEDIAN SURVIVAL =====

    _computeMedian(kmCurve) {
        // Find the first time where survival drops to <= 0.5
        for (let i = 1; i < kmCurve.length; i++) {
            if (kmCurve[i].survival <= 0.5) {
                return kmCurve[i].time;
            }
        }
        return null; // median not reached
    }

    // ===== AT-RISK NUMBERS =====

    _computeRiskTable(kmCurve, subjects, timePoints) {
        // For each time point, compute number at risk
        return timePoints.map(t => {
            const atRisk = subjects.filter(s => s.time >= t).length;
            return { time: t, nRisk: atRisk };
        });
    }

    // ===== LEGEND WIDTH ESTIMATION =====

    _estimateLegendWidth(groupNames) {
        const s = this.settings;
        const lf = s.legendFont;
        const ov = s.groupOverrides || {};
        const charWidth = lf.size * 0.62;
        const textX = 24;
        const maxLabelWidth = Math.max(...groupNames.map(n => ((ov[n] && ov[n].label) || n).length * charWidth));
        return textX + maxLabelWidth + 12;
    }

    // ===== MAIN RENDER =====

    render(kmData, settings) {
        if (settings) Object.assign(this.settings, settings);
        this.container.innerHTML = '';

        if (!kmData || !kmData.subjects || kmData.subjects.length === 0) {
            this.container.innerHTML = '<div class="empty-state"><h3>Enter survival data</h3><p>Columns: Group, Time, Event (1=event, 0=censored)</p></div>';
            return;
        }

        const s = this.settings;
        const hiddenGroups = s.hiddenGroups || [];

        // Determine groups
        const allGroups = kmData.groups || [...new Set(kmData.subjects.map(s => s.group))];
        this._lastGroups = allGroups;

        // Group order for display
        let orderedGroups;
        if (s.groupOrder && s.groupOrder.length > 0) {
            orderedGroups = s.groupOrder.filter(g => allGroups.includes(g));
            allGroups.forEach(g => { if (!orderedGroups.includes(g)) orderedGroups.push(g); });
        } else {
            orderedGroups = [...allGroups];
        }

        const visibleGroups = orderedGroups.filter(g => !hiddenGroups.includes(g));

        // Separate subjects by group
        const groupSubjects = {};
        allGroups.forEach(g => {
            groupSubjects[g] = kmData.subjects.filter(subj => subj.group === g);
        });

        // Compute KM curves for visible groups
        const groupCurves = {};
        visibleGroups.forEach(g => {
            groupCurves[g] = this._computeKM(groupSubjects[g]);
        });

        // Log-rank test (on visible groups only)
        let logRankResult = null;
        if (visibleGroups.length >= 2) {
            const testData = {};
            visibleGroups.forEach(g => { testData[g] = groupSubjects[g]; });
            logRankResult = this._logRankTest(testData);
        }

        // Layout
        const lf = s.legendFont || { family: 'Arial', size: 11, bold: false, italic: false };
        let legendW = 0;
        if (s.showLegend !== false && visibleGroups.length > 0) {
            legendW = this._estimateLegendWidth(visibleGroups);
        }

        // Risk table adds extra bottom margin
        let riskTableH = 0;
        if (s.showRiskTable && visibleGroups.length > 0) {
            riskTableH = visibleGroups.length * 16 + 28;
        }

        const margin = {
            top: 50,
            right: legendW > 0 ? legendW + 10 : 20,
            bottom: 65 + riskTableH,
            left: 65
        };
        const innerW = s.width;
        const innerH = s.height;
        const totalW = innerW + margin.left + margin.right;
        const totalH = innerH + margin.top + margin.bottom;

        const svg = d3.select(this.container)
            .append('svg')
            .attr('width', totalW)
            .attr('height', totalH)
            .style('font-family', 'Arial, sans-serif')
            .style('overflow', 'visible');

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // X scale — find maximum time across visible groups
        let allTimes = [];
        visibleGroups.forEach(gName => {
            groupSubjects[gName].forEach(subj => allTimes.push(subj.time));
        });
        if (allTimes.length === 0) {
            svg.append('text').attr('x', totalW / 2).attr('y', totalH / 2)
                .attr('text-anchor', 'middle').attr('fill', '#999').text('No data to display');
            return;
        }

        const dataXMin = 0;
        const dataXMax = d3.max(allTimes);
        const xMin = s.xMin !== null && s.xMin !== undefined ? s.xMin : dataXMin;
        const xMax = s.xMax !== null && s.xMax !== undefined ? s.xMax : dataXMax * 1.05;

        const xScale = d3.scaleLinear()
            .domain([xMin, xMax])
            .range([0, innerW])
            .nice();

        // Y scale
        const yMin = s.yMin !== null && s.yMin !== undefined ? s.yMin : 0;
        const yMax = s.yMax !== null && s.yMax !== undefined ? s.yMax : 1;

        const yScale = d3.scaleLinear()
            .domain([yMin, yMax])
            .range([innerH, 0]);

        // Axes
        const xAxisGen = d3.axisBottom(xScale);
        if (s.xTickStep) {
            xAxisGen.tickValues(d3.range(xScale.domain()[0], xScale.domain()[1] + s.xTickStep * 0.5, s.xTickStep));
        } else {
            const maxXTicks = Math.max(2, Math.floor(innerW / ((s.xTickFont.size || 12) * 3)));
            xAxisGen.ticks(maxXTicks);
        }

        const yAxisGen = d3.axisLeft(yScale);
        if (s.yTickStep) {
            yAxisGen.tickValues(d3.range(yScale.domain()[0], yScale.domain()[1] + s.yTickStep * 0.5, s.yTickStep));
        } else {
            const maxYTicks = Math.max(2, Math.floor(innerH / ((s.yTickFont.size || 12) * 2)));
            yAxisGen.ticks(maxYTicks);
        }

        const xAxisG = g.append('g')
            .attr('transform', `translate(0,${innerH})`)
            .call(xAxisGen);
        this._styleAxisTicks(xAxisG, s.xTickFont);

        const yAxisG = g.append('g')
            .call(yAxisGen);
        this._styleAxisTicks(yAxisG, s.yTickFont);

        // Tick font dblclick editing
        xAxisG.selectAll('text').style('cursor', 'pointer')
            .on('dblclick', (event) => { event.stopPropagation(); this._openTickFontPopup(event, 'x'); });
        yAxisG.selectAll('text').style('cursor', 'pointer')
            .on('dblclick', (event) => { event.stopPropagation(); this._openTickFontPopup(event, 'y'); });

        // Step line generator
        const lineGen = d3.line()
            .x(d => xScale(d.time))
            .y(d => yScale(d.survival))
            .curve(d3.curveStepAfter);

        // Draw each group
        visibleGroups.forEach((groupName, vi) => {
            const gi = allGroups.indexOf(groupName);
            const color = this._getColor(gi, groupName);
            const lineDash = this._getLineDash(gi, groupName);
            const curve = groupCurves[groupName];
            if (!curve || curve.length === 0) return;

            // Extend curve to max X if last event doesn't reach it
            const extendedCurve = [...curve];
            const lastPoint = extendedCurve[extendedCurve.length - 1];
            if (lastPoint.time < xScale.domain()[1]) {
                extendedCurve.push({
                    time: xScale.domain()[1],
                    survival: lastPoint.survival,
                    nRisk: 0,
                    nEvent: 0,
                    nCensor: 0,
                    ciLow: lastPoint.ciLow,
                    ciHigh: lastPoint.ciHigh
                });
            }

            // Confidence interval bands
            if (s.showCI) {
                const ciArea = d3.area()
                    .x(d => xScale(d.time))
                    .y0(d => yScale(Math.max(yMin, d.ciLow)))
                    .y1(d => yScale(Math.min(yMax, d.ciHigh)))
                    .curve(d3.curveStepAfter);

                g.append('path')
                    .datum(extendedCurve)
                    .attr('fill', color)
                    .attr('fill-opacity', 0.15)
                    .attr('stroke', 'none')
                    .attr('class', 'km-ci-band')
                    .attr('d', ciArea);
            }

            // Step curve
            g.append('path')
                .datum(extendedCurve)
                .attr('fill', 'none')
                .attr('stroke', color)
                .attr('stroke-width', s.lineWidth)
                .attr('stroke-dasharray', this._dashArray(lineDash))
                .attr('class', 'km-curve')
                .attr('d', lineGen);

            // Censored marks (small + tick marks on the curve)
            if (s.showCensored) {
                const censoredPoints = curve.filter(d => d.nCensor > 0 && d.time > 0);
                censoredPoints.forEach(pt => {
                    const cx = xScale(pt.time);
                    const cy = yScale(pt.survival);
                    const halfSize = s.pointSize / 2;

                    // Vertical tick mark
                    g.append('line')
                        .attr('x1', cx)
                        .attr('y1', cy - halfSize - 1)
                        .attr('x2', cx)
                        .attr('y2', cy + halfSize + 1)
                        .attr('stroke', color)
                        .attr('stroke-width', 1.5)
                        .attr('class', 'km-censor-mark');

                    // Tooltip for censored mark
                    g.append('circle')
                        .attr('cx', cx)
                        .attr('cy', cy)
                        .attr('r', halfSize + 2)
                        .attr('fill', 'transparent')
                        .attr('cursor', 'default')
                        .append('title')
                        .text(`Censored at ${pt.time}\nSurvival: ${(pt.survival * 100).toFixed(1)}%\nAt risk: ${pt.nRisk}`);
                });
            }

            // Median survival dashed lines
            if (s.showMedian) {
                const median = this._computeMedian(curve);
                if (median !== null) {
                    // Horizontal line at y=0.5 from y-axis to median time
                    g.append('line')
                        .attr('x1', 0)
                        .attr('y1', yScale(0.5))
                        .attr('x2', xScale(median))
                        .attr('y2', yScale(0.5))
                        .attr('stroke', color)
                        .attr('stroke-width', 1)
                        .attr('stroke-dasharray', '4,3')
                        .attr('opacity', 0.6)
                        .attr('class', 'km-median-line');

                    // Vertical line from median time down to x-axis
                    g.append('line')
                        .attr('x1', xScale(median))
                        .attr('y1', yScale(0.5))
                        .attr('x2', xScale(median))
                        .attr('y2', innerH)
                        .attr('stroke', color)
                        .attr('stroke-width', 1)
                        .attr('stroke-dasharray', '4,3')
                        .attr('opacity', 0.6)
                        .attr('class', 'km-median-line');

                    // Small label
                    g.append('text')
                        .attr('x', xScale(median))
                        .attr('y', innerH + 12)
                        .attr('text-anchor', 'middle')
                        .attr('font-size', '9px')
                        .attr('fill', color)
                        .attr('opacity', 0.8)
                        .text(median.toFixed(1));
                }
            }
        });

        // Risk table below x-axis
        if (s.showRiskTable && visibleGroups.length > 0) {
            this._drawRiskTable(g, visibleGroups, allGroups, groupSubjects, xScale, innerW, innerH);
        }

        // Legend
        this._drawLegend(g, innerW, orderedGroups, allGroups, groupCurves);

        // Log-rank test display
        if (s.showLogRank && logRankResult && visibleGroups.length >= 2) {
            this._drawLogRankResult(g, innerW, innerH, logRankResult, visibleGroups);
        }

        // Stats legend
        if (s.showStatsLegend && logRankResult) {
            this._drawStatsLegend(g, innerW, innerH, logRankResult);
        }

        // Title
        if (s.showTitle) {
            this._drawInteractiveText(svg, 'title', margin.left + innerW / 2, 22, s.title, s.titleFont, s.titleOffset);
        }

        // X label
        if (s.showXLabel) {
            this._drawInteractiveText(svg, 'xLabel', margin.left + innerW / 2, totalH - riskTableH - 10, s.xLabel, s.xLabelFont, s.xLabelOffset);
        }

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

        // Tooltip overlay
        this._setupTooltip(svg, g, visibleGroups, allGroups, groupCurves, groupSubjects, xScale, yScale, innerW, innerH);

        // Annotations
        if (this.annotationManager) {
            this.annotationManager.drawAnnotations(svg, margin);
        }
    }

    // ===== RISK TABLE =====

    _drawRiskTable(g, visibleGroups, allGroups, groupSubjects, xScale, innerW, innerH) {
        const s = this.settings;
        const domain = xScale.domain();
        // Generate regular time points for the risk table
        const nTicks = Math.max(4, Math.min(10, Math.floor(innerW / 50)));
        const step = (domain[1] - domain[0]) / nTicks;
        const timePoints = [];
        for (let t = domain[0]; t <= domain[1] + step * 0.01; t += step) {
            timePoints.push(Math.round(t * 100) / 100);
        }

        const tableG = g.append('g')
            .attr('class', 'km-risk-table')
            .attr('transform', `translate(0, ${innerH + 40})`);

        // Header
        tableG.append('text')
            .attr('x', -8)
            .attr('y', -4)
            .attr('text-anchor', 'end')
            .attr('font-size', '10px')
            .attr('font-weight', 'bold')
            .attr('fill', '#333')
            .text('At risk');

        visibleGroups.forEach((groupName, vi) => {
            const gi = allGroups.indexOf(groupName);
            const color = this._getColor(gi, groupName);
            const subjects = groupSubjects[groupName];
            const riskData = this._computeRiskTable(null, subjects, timePoints);
            const rowY = vi * 16 + 10;

            // Group name label
            const displayLabel = this._getGroupLabel(groupName);
            tableG.append('text')
                .attr('x', -8)
                .attr('y', rowY)
                .attr('text-anchor', 'end')
                .attr('font-size', '9px')
                .attr('fill', color)
                .attr('font-weight', '600')
                .text(displayLabel.length > 12 ? displayLabel.substring(0, 12) + '...' : displayLabel);

            // At-risk numbers at each time point
            riskData.forEach(rd => {
                tableG.append('text')
                    .attr('x', xScale(rd.time))
                    .attr('y', rowY)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '9px')
                    .attr('fill', '#555')
                    .text(rd.nRisk);
            });
        });
    }

    // ===== LOG-RANK RESULT DISPLAY =====

    _drawLogRankResult(g, innerW, innerH, result, visibleGroups) {
        const s = this.settings;
        const pStr = result.pValue < 0.001 ? result.pValue.toExponential(2) : result.pValue.toFixed(4);
        const chi2Str = result.chi2.toFixed(2);
        const text = `Log-rank: \u03C7\u00B2=${chi2Str}, p=${pStr}`;

        const off = s.statsLegendOffset;
        const lf = s.legendFont || { size: 11 };
        const rowH = Math.max(14, lf.size + 6);
        const groups = this._lastGroups || [];
        const vGroups = groups.filter(gn => !(s.hiddenGroups || []).includes(gn));
        const baseY = vGroups.length * rowH + 24;

        const lrG = g.append('g')
            .attr('class', 'km-logrank')
            .attr('transform', `translate(${innerW + 12 + off.x}, ${baseY + off.y})`);

        const textEl = lrG.append('text')
            .attr('x', 0)
            .attr('y', 0)
            .attr('font-size', '11px')
            .attr('font-family', 'Arial, sans-serif')
            .attr('fill', '#333')
            .text(text);

        const bbox = textEl.node().getBBox();
        lrG.insert('rect', 'text')
            .attr('x', bbox.x - 4)
            .attr('y', bbox.y - 2)
            .attr('width', bbox.width + 8)
            .attr('height', bbox.height + 4)
            .attr('fill', '#fff')
            .attr('fill-opacity', 0.9)
            .attr('stroke', '#ddd')
            .attr('stroke-width', 0.5)
            .attr('rx', 3);

        const self = this;
        lrG.call(d3.drag()
            .on('drag', function(event) {
                self.settings.statsLegendOffset.x += event.dx;
                self.settings.statsLegendOffset.y += event.dy;
                d3.select(this).attr('transform',
                    `translate(${innerW + 12 + self.settings.statsLegendOffset.x}, ${baseY + self.settings.statsLegendOffset.y})`);
            })
        ).style('cursor', 'move');
    }

    // ===== STATS LEGEND =====

    _drawStatsLegend(g, innerW, innerH, logRankResult) {
        const s = this.settings;
        const off = s.statsLegendOffset;
        const groups = this._lastGroups || [];
        const lf = s.legendFont || { size: 11 };
        const rowH = Math.max(14, lf.size + 6);
        const legendBaseX = innerW + 12;
        const visibleGroups = groups.filter(gn => !(s.hiddenGroups || []).includes(gn));
        const legendBaseY = visibleGroups.length * rowH + 30;

        const lines = [];
        if (logRankResult) {
            const pStr = logRankResult.pValue < 0.001 ? logRankResult.pValue.toExponential(2) : logRankResult.pValue.toFixed(4);
            lines.push(`Log-rank test: p = ${pStr}`);
            lines.push(`\u03C7\u00B2 = ${logRankResult.chi2.toFixed(2)}, df = ${logRankResult.df}`);
        }
        lines.push('* p < 0.05  ** p < 0.01  *** p < 0.001');

        const legendG = g.append('g').attr('class', 'stats-legend').style('cursor', 'grab');
        lines.forEach((text, i) => {
            legendG.append('text')
                .attr('x', legendBaseX + off.x)
                .attr('y', legendBaseY + off.y + i * 14)
                .attr('text-anchor', 'start')
                .style('font-family', 'Arial, sans-serif')
                .style('font-size', '10px')
                .style('fill', '#666')
                .text(text);
        });

        const self = this;
        legendG.call(d3.drag()
            .filter(event => !event.ctrlKey && !event.button && event.detail < 2)
            .on('start', function() { d3.select(this).style('cursor', 'grabbing'); })
            .on('drag', function(event) {
                self.settings.statsLegendOffset.x += event.dx;
                self.settings.statsLegendOffset.y += event.dy;
                d3.select(this).selectAll('text')
                    .attr('x', legendBaseX + self.settings.statsLegendOffset.x);
                d3.select(this).selectAll('text').each(function(d, i) {
                    d3.select(this).attr('y', legendBaseY + self.settings.statsLegendOffset.y + i * 14);
                });
            })
            .on('end', function() { d3.select(this).style('cursor', 'grab'); })
        );
    }

    // ===== LEGEND =====

    _drawLegend(g, innerW, orderedGroups, allGroups, groupCurves) {
        const s = this.settings;
        if (s.showLegend === false) return;

        const hiddenGroups = s.hiddenGroups || [];
        const visibleGroups = orderedGroups.filter(gn => !hiddenGroups.includes(gn));
        if (visibleGroups.length === 0) return;

        const lf = s.legendFont;
        const loff = s.legendOffset;
        const baseX = innerW + 12;
        const baseY = 0;

        const legendG = g.append('g')
            .attr('transform', `translate(${baseX + loff.x}, ${baseY + loff.y})`)
            .attr('cursor', 'grab');

        // Font-size-aware spacing
        const rowH = Math.max(18, lf.size * 1.6);
        const legendW = this._estimateLegendWidth(visibleGroups);
        const legendH = visibleGroups.length * rowH + lf.size * 0.5;

        // Background
        legendG.append('rect')
            .attr('x', -4)
            .attr('y', -lf.size * 0.8)
            .attr('width', legendW)
            .attr('height', legendH)
            .attr('fill', 'white')
            .attr('stroke', '#ddd')
            .attr('stroke-width', 1)
            .attr('rx', 3);

        visibleGroups.forEach((groupName, i) => {
            const gi = allGroups.indexOf(groupName);
            const ly = i * rowH;
            const color = this._getColor(gi >= 0 ? gi : 0, groupName);
            const lineDash = this._getLineDash(gi >= 0 ? gi : 0, groupName);
            const displayLabel = this._getGroupLabel(groupName);

            // Line swatch
            legendG.append('line')
                .attr('x1', 0)
                .attr('y1', ly)
                .attr('x2', 18)
                .attr('y2', ly)
                .attr('stroke', color)
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', this._dashArray(lineDash));

            // Median survival in legend if available and showMedian is on
            let extraText = '';
            if (s.showMedian && groupCurves[groupName]) {
                const median = this._computeMedian(groupCurves[groupName]);
                if (median !== null) {
                    extraText = ` (med: ${median.toFixed(1)})`;
                }
            }

            // Label text
            legendG.append('text')
                .attr('x', 24)
                .attr('y', ly + lf.size * 0.35)
                .attr('font-size', lf.size + 'px')
                .attr('font-family', lf.family)
                .attr('font-weight', lf.bold ? 'bold' : 'normal')
                .attr('font-style', lf.italic ? 'italic' : 'normal')
                .attr('fill', '#333')
                .text(displayLabel + extraText);
        });

        // Draggable legend using native events (same pattern as growth.js)
        const self = this;
        const legendNode = legendG.node();
        let dragState = null;

        legendNode.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            dragState = { x: e.clientX, y: e.clientY, moved: false };

            const onMove = (me) => {
                if (!dragState) return;
                const dx = me.clientX - dragState.x;
                const dy = me.clientY - dragState.y;
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragState.moved = true;
                dragState.x = me.clientX;
                dragState.y = me.clientY;
                self.settings.legendOffset.x += dx;
                self.settings.legendOffset.y += dy;
                legendG.attr('transform',
                    `translate(${baseX + self.settings.legendOffset.x}, ${baseY + self.settings.legendOffset.y})`);
            };
            const onUp = () => {
                dragState = null;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        legendNode.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.preventDefault();
            self._openLegendEditPopup(e, allGroups);
        });

        legendG.style('cursor', 'move');
        legendG.attr('pointer-events', 'all');
    }

    // ===== LEGEND EDIT POPUP =====

    _openLegendEditPopup(event, groups) {
        document.querySelectorAll('.svg-edit-popup').forEach(p => p.remove());

        const s = this.settings;
        if (!s.groupOverrides) s.groupOverrides = {};

        const popup = document.createElement('div');
        popup.className = 'svg-edit-popup';
        popup.style.cssText = `position:fixed;left:${event.clientX + 10}px;top:${Math.max(10, event.clientY - 20)}px;z-index:10000;max-height:80vh;overflow-y:auto`;

        const heading = document.createElement('div');
        heading.textContent = 'Legend Settings';
        heading.style.cssText = 'font-weight:600;font-size:12px;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px';
        popup.appendChild(heading);

        // Font toolbar
        const lf = s.legendFont || { family: 'Arial', size: 11, bold: false, italic: false };
        const { toolbar } = this._createFontToolbar(lf);
        popup.appendChild(toolbar);

        const sep = document.createElement('hr');
        sep.style.cssText = 'border:none;border-top:1px solid #e5e7eb;margin:8px 0';
        popup.appendChild(sep);

        // Per-group rows
        const groupInputs = [];
        groups.forEach((groupName, i) => {
            const ov = s.groupOverrides[groupName] || {};

            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:5px;margin-bottom:6px';

            // Color
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = ov.color || this._getColor(i);
            colorInput.style.cssText = 'width:24px;height:20px;border:1px solid #ccc;border-radius:3px;cursor:pointer;padding:0;flex:0 0 24px';
            row.appendChild(colorInput);

            // Line dash
            const dashSelect = document.createElement('select');
            dashSelect.style.cssText = 'font-size:10px;padding:1px 2px;border:1px solid #ccc;border-radius:3px;flex:0 0 auto;width:68px';
            const currentDash = ov.lineDash || this._getLineDash(i, groupName);
            [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'], ['dashdot', 'Dash-dot'], ['longdash', 'Long dash']].forEach(([val, label]) => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = label;
                if (val === currentDash) opt.selected = true;
                dashSelect.appendChild(opt);
            });
            row.appendChild(dashSelect);

            // Label
            const labelInput = document.createElement('input');
            labelInput.type = 'text';
            labelInput.className = 'svg-inline-edit';
            labelInput.value = ov.label || groupName;
            labelInput.placeholder = groupName;
            labelInput.style.cssText = 'flex:1;min-width:60px;padding:2px 4px;font-size:11px';
            row.appendChild(labelInput);

            popup.appendChild(row);
            groupInputs.push({ groupName, colorInput, dashSelect, labelInput });
        });

        // Buttons
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:4px;margin-top:8px';

        const applyBtn = document.createElement('button');
        applyBtn.className = 'svg-edit-btn';
        applyBtn.textContent = 'Apply';
        applyBtn.addEventListener('click', () => {
            groupInputs.forEach(({ groupName, colorInput, dashSelect, labelInput }) => {
                if (!s.groupOverrides[groupName]) s.groupOverrides[groupName] = {};
                s.groupOverrides[groupName].color = colorInput.value;
                s.groupOverrides[groupName].lineDash = dashSelect.value;
                const val = labelInput.value.trim();
                if (val && val !== groupName) s.groupOverrides[groupName].label = val;
                else delete s.groupOverrides[groupName].label;
            });
            popup.remove();
            if (window.app) window.app.updateGraph();
        });
        btnRow.appendChild(applyBtn);

        const resetBtn = document.createElement('button');
        resetBtn.className = 'svg-edit-btn';
        resetBtn.textContent = 'Reset All';
        resetBtn.addEventListener('click', () => {
            s.groupOverrides = {};
            popup.remove();
            if (window.app) window.app.updateGraph();
        });
        btnRow.appendChild(resetBtn);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'svg-edit-btn';
        closeBtn.textContent = '\u00D7';
        closeBtn.addEventListener('click', () => popup.remove());
        btnRow.appendChild(closeBtn);

        popup.appendChild(btnRow);
        document.body.appendChild(popup);

        setTimeout(() => {
            const handler = (e) => {
                if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('mousedown', handler); }
            };
            document.addEventListener('mousedown', handler);
        }, 100);
    }

    // ===== TOOLTIP =====

    _setupTooltip(svg, g, visibleGroups, allGroups, groupCurves, groupSubjects, xScale, yScale, innerW, innerH) {
        let tooltip = document.getElementById('km-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'km-tooltip';
            tooltip.className = 'growth-tooltip';
            document.body.appendChild(tooltip);
        }

        const self = this;

        g.append('rect')
            .attr('width', innerW)
            .attr('height', innerH)
            .attr('fill', 'none')
            .attr('pointer-events', 'all')
            .on('mousemove', function(event) {
                const [mx] = d3.pointer(event);
                const xVal = xScale.invert(mx);

                let html = `<b>Time: ${xVal.toFixed(1)}</b><br>`;

                visibleGroups.forEach((gName) => {
                    const gi = allGroups.indexOf(gName);
                    const color = self._getColor(gi, gName);
                    const curve = groupCurves[gName];
                    if (!curve || curve.length === 0) return;

                    // Find survival at this time (step function — last step before or at xVal)
                    let survivalAtTime = 1;
                    let nRiskAtTime = groupSubjects[gName].length;
                    for (let i = curve.length - 1; i >= 0; i--) {
                        if (curve[i].time <= xVal) {
                            survivalAtTime = curve[i].survival;
                            nRiskAtTime = curve[i].nRisk;
                            break;
                        }
                    }

                    const displayLabel = self._getGroupLabel(gName);
                    html += `<span style="color:${color}">\u25CF</span> ${displayLabel}: ${(survivalAtTime * 100).toFixed(1)}% (n=${nRiskAtTime})<br>`;
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

    // ===== SHARED INTERACTIVE TEXT METHODS =====

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

    // ===== INLINE EDIT =====

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

        // Hide button
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

    // ===== TICK FONT POPUP =====

    _openTickFontPopup(event, axis) {
        const existing = document.querySelector('.svg-edit-popup');
        if (existing) existing.remove();

        if (window.app) window.app.saveUndoState();

        const textEl = event.target;
        const rect = textEl.getBoundingClientRect();
        const fontObj = axis === 'y' ? this.settings.yTickFont : this.settings.xTickFont;

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
                if (document.body.contains(popup) && !popup.contains(document.activeElement)) commit();
            }, 100);
        });
        familySelect.focus();
    }

    // ===== FONT TOOLBAR =====

    _createFontToolbar(fontObj) {
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display:flex;align-items:center;gap:4px;flex-wrap:wrap;';
        const families = ['Aptos Display', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New'];
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
        boldBtn.textContent = 'B'; boldBtn.style.fontWeight = 'bold';
        boldBtn.addEventListener('mousedown', e => e.preventDefault());
        boldBtn.addEventListener('click', () => { fontObj.bold = !fontObj.bold; boldBtn.classList.toggle('active', fontObj.bold); if (window.app) window.app.updateGraph(); });
        toolbar.appendChild(boldBtn);

        const italicBtn = document.createElement('button');
        italicBtn.className = 'svg-edit-btn' + (fontObj.italic ? ' active' : '');
        italicBtn.textContent = 'I'; italicBtn.style.fontStyle = 'italic';
        italicBtn.addEventListener('mousedown', e => e.preventDefault());
        italicBtn.addEventListener('click', () => { fontObj.italic = !fontObj.italic; italicBtn.classList.toggle('active', fontObj.italic); if (window.app) window.app.updateGraph(); });
        toolbar.appendChild(italicBtn);

        return { toolbar, familySelect, sizeInput, boldBtn, italicBtn };
    }

    // ===== STYLE AXIS TICKS =====

    _styleAxisTicks(axisG, tickFont) {
        axisG.selectAll('text')
            .style('font-size', tickFont.size + 'px')
            .style('font-family', tickFont.family)
            .style('font-weight', tickFont.bold ? 'bold' : 'normal')
            .style('font-style', tickFont.italic ? 'italic' : 'normal');
    }

    // ===== SVG ELEMENT ACCESS =====

    getSvgElement() {
        return this.container.querySelector('svg');
    }
}
