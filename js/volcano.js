// volcano.js - Volcano plot renderer

class VolcanoRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.settings = {
            title: 'Volcano Plot',
            xLabel: 'Log\u2082 Fold Change',
            yLabel: '-Log\u2081\u2080 P-value',
            width: 450,
            height: 400,
            pValueThreshold: 0.05,
            fcThreshold: 1.0,
            upColor: '#E63946',
            downColor: '#457B9D',
            nsColor: '#BBBBBB',
            pointSize: 4,
            pointOpacity: 0.7,
            // Fonts
            titleFont: { family: 'Arial', size: 18, bold: true, italic: false },
            xLabelFont: { family: 'Arial', size: 15, bold: false, italic: false },
            yLabelFont: { family: 'Arial', size: 15, bold: false, italic: false },
            xTickFont: { family: 'Arial', size: 12, bold: false, italic: false },
            yTickFont: { family: 'Arial', size: 12, bold: false, italic: false },
            labelFont: { family: 'Arial', size: 10, bold: false, italic: false },
            legendFont: { family: 'Arial', size: 11, bold: false, italic: false },
            // Visibility
            showTitle: true,
            showXLabel: true,
            showYLabel: true,
            showLegend: true,
            // Offsets
            titleOffset: { x: 0, y: 0 },
            xLabelOffset: { x: 0, y: 0 },
            yLabelOffset: { x: 0, y: 0 },
            legendOffset: { x: 0, y: 0 },
            // Legend text
            upLegendText: 'Up',
            downLegendText: 'Down',
            nsLegendText: 'NS',
            // Gene labels
            showLabels: true,
            showTopLabels: 10,
            highlightedGenes: [],  // manually added gene names
            excludedGenes: [],     // genes excluded from auto-labeling
            geneLabelOffsets: {}   // { geneName: {x, y} }
        };
        this._nudgeOffsetKey = null;
        this._nudgeGeneName = null;
    }

    render(volcanoData, settings) {
        if (settings) {
            Object.assign(this.settings, settings);
        }
        this.container.innerHTML = '';

        if (!volcanoData || !volcanoData.points || volcanoData.points.length === 0) {
            this.container.innerHTML = '<div class="empty-state"><h3>Enter volcano plot data</h3><p>Columns: Gene, Log2FC, P-value</p></div>';
            return;
        }

        const s = this.settings;
        const margin = { top: 50, right: 30, bottom: 65, left: 65 };
        const innerW = s.width;
        const innerH = s.height;
        const width = innerW + margin.left + margin.right;
        const height = innerH + margin.top + margin.bottom;
        this._lastPlotData = null;

        const svg = d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('font-family', 'Arial, sans-serif')
            .style('overflow', 'visible');

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const points = volcanoData.points;
        const pThreshY = -Math.log10(s.pValueThreshold);

        const plotData = points.map(p => ({
            name: p.name,
            fc: p.fc,
            pval: p.pval,
            logFC: p.fc,
            negLogP: p.pval > 0 ? -Math.log10(p.pval) : 0
        }));
        this._lastPlotData = plotData;

        // Scales
        const xExtent = d3.extent(plotData, d => d.logFC);
        const xPad = Math.max(Math.abs(xExtent[0] || 1), Math.abs(xExtent[1] || 1)) * 1.1;
        const xScale = d3.scaleLinear().domain([-xPad, xPad]).range([0, innerW]).nice();
        const yMax = d3.max(plotData, d => d.negLogP) * 1.1 || 1;
        const yScale = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]).nice();

        // Axes
        const xAxisG = g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(xScale));
        this._styleAxisTicks(xAxisG, s.xTickFont);
        const yAxisG = g.append('g').call(d3.axisLeft(yScale));
        this._styleAxisTicks(yAxisG, s.yTickFont);

        // Threshold lines
        g.append('line').attr('x1', 0).attr('x2', innerW)
            .attr('y1', yScale(pThreshY)).attr('y2', yScale(pThreshY))
            .attr('stroke', '#999').attr('stroke-dasharray', '4,3').attr('stroke-width', 1);
        if (s.fcThreshold > 0) {
            [s.fcThreshold, -s.fcThreshold].forEach(fc => {
                g.append('line').attr('x1', xScale(fc)).attr('x2', xScale(fc))
                    .attr('y1', 0).attr('y2', innerH)
                    .attr('stroke', '#999').attr('stroke-dasharray', '4,3').attr('stroke-width', 1);
            });
        }

        // Classify
        const classify = (d) => {
            if (d.negLogP >= pThreshY && d.logFC >= s.fcThreshold) return 'up';
            if (d.negLogP >= pThreshY && d.logFC <= -s.fcThreshold) return 'down';
            return 'ns';
        };
        const colorMap = { up: s.upColor, down: s.downColor, ns: s.nsColor };

        // Determine which genes to label
        const autoLabeled = plotData
            .filter(d => classify(d) !== 'ns')
            .sort((a, b) => b.negLogP - a.negLogP)
            .slice(0, s.showTopLabels)
            .map(d => d.name);
        const manual = s.highlightedGenes || [];
        const excluded = new Set(s.excludedGenes || []);
        const labeledSet = new Set([
            ...autoLabeled.filter(n => !excluded.has(n)),
            ...manual
        ]);

        // Draw points — click to toggle label
        const self = this;
        g.selectAll('circle.volcano-point')
            .data(plotData)
            .enter()
            .append('circle')
            .attr('class', 'volcano-point')
            .attr('cx', d => xScale(d.logFC))
            .attr('cy', d => yScale(d.negLogP))
            .attr('r', s.pointSize)
            .attr('fill', d => colorMap[classify(d)])
            .attr('opacity', s.pointOpacity)
            .attr('stroke', d => labeledSet.has(d.name) ? '#333' : 'none')
            .attr('stroke-width', d => labeledSet.has(d.name) ? 1 : 0)
            .attr('cursor', 'pointer')
            .on('click', function(event, d) {
                event.stopPropagation();
                const hl = self.settings.highlightedGenes;
                const ex = self.settings.excludedGenes;
                const isLabeled = labeledSet.has(d.name);
                if (isLabeled) {
                    // Remove: if manually added, remove from highlighted; if auto, add to excluded
                    const hlIdx = hl.indexOf(d.name);
                    if (hlIdx >= 0) hl.splice(hlIdx, 1);
                    if (autoLabeled.includes(d.name) && !ex.includes(d.name)) ex.push(d.name);
                } else {
                    // Add: remove from excluded if present, add to highlighted
                    const exIdx = ex.indexOf(d.name);
                    if (exIdx >= 0) ex.splice(exIdx, 1);
                    if (!hl.includes(d.name) && !autoLabeled.includes(d.name)) hl.push(d.name);
                    // If it was excluded from auto, just un-exclude
                    if (autoLabeled.includes(d.name)) { /* un-excluded above */ }
                }
                if (window.app) window.app.updateGraph();
            })
            .append('title')
            .text(d => `${d.name}\nLog\u2082FC: ${d.logFC.toFixed(2)}\nP: ${d.pval.toExponential(2)}\nClick to toggle label`);

        // Draw gene labels with auto-repulsion to avoid overlaps + leader lines
        if (s.showLabels === false) { /* skip labels entirely */ } else {
        const lf = s.labelFont;
        const labeledPoints = plotData.filter(d => labeledSet.has(d.name));

        // Build label positions — apply auto-repulsion first, then user offsets
        const labelPositions = labeledPoints.map(d => {
            const px = xScale(d.logFC);
            const py = yScale(d.negLogP);
            const userOff = s.geneLabelOffsets[d.name] || { x: 0, y: 0 };
            return {
                d,
                px, py,                          // point position
                x: px + userOff.x,               // label position (will be adjusted)
                y: py - s.pointSize - 3 + userOff.y,
                hasUserOffset: userOff.x !== 0 || userOff.y !== 0,
                w: d.name.length * lf.size * 0.6, // estimated text width
                h: lf.size                         // text height
            };
        });

        // Simple iterative repulsion for labels without user offsets
        for (let iter = 0; iter < 12; iter++) {
            for (let i = 0; i < labelPositions.length; i++) {
                if (labelPositions[i].hasUserOffset) continue;
                for (let j = i + 1; j < labelPositions.length; j++) {
                    if (labelPositions[j].hasUserOffset) continue;
                    const a = labelPositions[i], b = labelPositions[j];
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const minDx = (a.w + b.w) / 2 + 2;
                    const minDy = (a.h + b.h) / 2 + 1;
                    if (Math.abs(dx) < minDx && Math.abs(dy) < minDy) {
                        const pushX = (minDx - Math.abs(dx)) / 2 * (dx >= 0 ? 1 : -1) * 0.5;
                        const pushY = (minDy - Math.abs(dy)) / 2 * (dy >= 0 ? 1 : -1) * 0.8;
                        a.x += pushX; a.y += pushY;
                        b.x -= pushX; b.y -= pushY;
                    }
                }
            }
        }

        // Draw leader lines + labels
        labelPositions.forEach(lp => {
            const d = lp.d;
            const dist = Math.sqrt((lp.x - lp.px) ** 2 + (lp.y - lp.py) ** 2);
            // Draw thin leader line if label is displaced from point
            if (dist > s.pointSize + 4) {
                g.append('line')
                    .attr('class', 'gene-leader')
                    .attr('x1', lp.px).attr('y1', lp.py)
                    .attr('x2', lp.x).attr('y2', lp.y + lf.size * 0.35)
                    .attr('stroke', '#999')
                    .attr('stroke-width', 0.5)
                    .attr('stroke-dasharray', '2,2');
            }

            const label = g.append('text')
                .attr('class', 'gene-label')
                .attr('x', lp.x)
                .attr('y', lp.y)
                .attr('text-anchor', 'middle')
                .attr('font-size', lf.size + 'px')
                .attr('font-family', lf.family)
                .attr('font-weight', lf.bold ? 'bold' : 'normal')
                .attr('font-style', lf.italic ? 'italic' : 'normal')
                .attr('fill', '#333')
                .attr('cursor', 'grab')
                .text(d.name);

            // Drag gene label
            label.call(d3.drag()
                .filter(ev => !ev.ctrlKey && !ev.button && ev.detail < 2)
                .on('start', function() { d3.select(this).style('cursor', 'grabbing'); })
                .on('drag', function(event) {
                    if (!self.settings.geneLabelOffsets[d.name]) self.settings.geneLabelOffsets[d.name] = { x: 0, y: 0 };
                    self.settings.geneLabelOffsets[d.name].x += event.dx;
                    self.settings.geneLabelOffsets[d.name].y += event.dy;
                    d3.select(this)
                        .attr('x', parseFloat(d3.select(this).attr('x')) + event.dx)
                        .attr('y', parseFloat(d3.select(this).attr('y')) + event.dy);
                })
                .on('end', function() {
                    d3.select(this).style('cursor', 'grab');
                    self._selectGeneForNudge(d.name);
                })
            );
        });
        } // end showLabels check

        // Legend
        this._drawLegend(g, innerW, plotData, classify, colorMap);

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

        // Draw annotations
        if (this.annotationManager) {
            this.annotationManager.drawAnnotations(svg, margin);
        }
    }

    // Shared interactive text: drag + dblclick + nudge
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

    _drawLegend(g, innerW, plotData, classify, colorMap) {
        const s = this.settings;
        if (!s.showLegend) return;

        const upCount = plotData.filter(d => classify(d) === 'up').length;
        const downCount = plotData.filter(d => classify(d) === 'down').length;
        const nsCount = plotData.filter(d => classify(d) === 'ns').length;
        const loff = s.legendOffset;
        const lf = s.legendFont;

        const legendG = g.append('g')
            .attr('transform', `translate(${innerW - 120 + loff.x}, ${5 + loff.y})`)
            .attr('cursor', 'grab');

        const items = [
            { key: 'up', label: `${s.upLegendText} (${upCount})`, color: s.upColor },
            { key: 'down', label: `${s.downLegendText} (${downCount})`, color: s.downColor },
            { key: 'ns', label: `${s.nsLegendText} (${nsCount})`, color: s.nsColor }
        ];

        items.forEach((item, i) => {
            const ly = i * 18;
            legendG.append('circle').attr('cx', 0).attr('cy', ly).attr('r', 4).attr('fill', item.color);
            legendG.append('text').attr('x', 10).attr('y', ly + 4)
                .attr('font-size', lf.size + 'px')
                .attr('font-family', lf.family)
                .attr('font-weight', lf.bold ? 'bold' : 'normal')
                .attr('font-style', lf.italic ? 'italic' : 'normal')
                .attr('fill', '#333')
                .text(item.label);
        });

        // Drag the whole legend
        const self = this;
        legendG.call(d3.drag()
            .on('start', function() { d3.select(this).style('cursor', 'grabbing'); })
            .on('drag', function(event) {
                self.settings.legendOffset.x += event.dx;
                self.settings.legendOffset.y += event.dy;
                d3.select(this).attr('transform',
                    `translate(${innerW - 120 + self.settings.legendOffset.x}, ${5 + self.settings.legendOffset.y})`);
            })
            .on('end', function() {
                d3.select(this).style('cursor', 'grab');
                self._selectLabelForNudge('legendOffset');
            })
        );

        // Dblclick legend to edit text + font
        legendG.on('dblclick', () => this._startInlineEdit(null, 'legend'));
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
        this._nudgeGeneName = null;
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

    _selectGeneForNudge(geneName) {
        this._nudgeOffsetKey = null;
        this._nudgeGeneName = geneName;
        if (this._labelNudgeHandler) document.removeEventListener('keydown', this._labelNudgeHandler);
        this._labelNudgeHandler = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            if (!this._nudgeGeneName) return;
            e.preventDefault();
            const step = e.shiftKey ? 10 : 2;
            if (!this.settings.geneLabelOffsets[this._nudgeGeneName]) {
                this.settings.geneLabelOffsets[this._nudgeGeneName] = { x: 0, y: 0 };
            }
            const off = this.settings.geneLabelOffsets[this._nudgeGeneName];
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

        // Position near the graph
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

        if (labelType === 'legend') {
            // Legend: 3 text inputs
            ['upLegendText', 'downLegendText', 'nsLegendText'].forEach(key => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:4px;margin-top:4px;';
                const lbl = document.createElement('span');
                lbl.textContent = key.replace('LegendText', '') + ':';
                lbl.style.cssText = 'font-size:11px;width:40px;color:#666;';
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.className = 'svg-inline-edit';
                inp.value = s[key] || '';
                inp.style.cssText = 'flex:1;font-size:12px;';
                inp.addEventListener('input', () => { s[key] = inp.value; if (window.app) window.app.updateGraph(); });
                row.appendChild(lbl);
                row.appendChild(inp);
                popup.appendChild(row);
            });
        } else {
            // Standard text input
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

    getSvgElement() {
        return this.container.querySelector('svg');
    }
}
