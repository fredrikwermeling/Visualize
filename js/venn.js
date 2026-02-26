// venn.js - Venn diagram and UpSet plot renderer
// Supports group-based sets and binary matrix input with auto-detection

class VennRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.settings = {
            title: 'Set Intersections',
            width: 450,
            height: 400,
            plotType: 'auto', // auto | venn | upset
            colorTheme: 'default',
            showCounts: true,
            showPercentages: false,
            showLabels: true,
            opacity: 0.35,
            // Fonts
            titleFont: { family: 'Arial', size: 18, bold: true, italic: false },
            labelFont: { family: 'Arial', size: 13, bold: true, italic: false },
            countFont: { family: 'Arial', size: 12, bold: false, italic: false },
            // Offsets
            titleOffset: { x: 0, y: 0 },
            legendOffset: { x: 0, y: 0 },
            showTitle: true,
            showLegend: true
        };
        this._nudgeOffsetKey = null;

        this.colorThemes = {
            default: ['#5B8DB8','#E8927C','#7EBF7E','#C490D1','#F2CC8F','#81D4DB','#FF9F9F','#A8D5A2'],
            pastel: ['#AEC6CF','#FFB7B2','#B5EAD7','#C7CEEA','#FFDAC1','#E2F0CB','#F0E6EF','#D4F0F0'],
            vivid: ['#E63946','#457B9D','#2A9D8F','#E9C46A','#F4A261','#264653','#A8DADC','#F77F00'],
            colorblind: ['#0072B2','#E69F00','#009E73','#CC79A7','#56B4E9','#D55E00','#F0E442','#000000'],
            earth: ['#A0522D','#2E8B57','#DAA520','#8B0000','#4682B4','#6B8E23','#CD853F','#556B2F','#B8860B','#704214'],
            ocean: ['#0077B6','#E76F51','#2A9D8F','#F4A261','#264653','#E9C46A','#023E8A','#D62828','#48CAE4','#006D77'],
            neon: ['#FF006E','#FB5607','#FFBE0B','#3A86FF','#8338EC','#06D6A0','#EF476F','#FFD166']
        };
    }

    _getColor(i) {
        const theme = this.colorThemes[this.settings.colorTheme] || this.colorThemes.default;
        return theme[i % theme.length];
    }

    // Parse data into sets: { setName: Set([items]) }
    _parseSets(vennData) {
        if (!vennData) return null;
        const { format, sets } = vennData;
        if (!sets || Object.keys(sets).length === 0) return null;
        // Convert arrays to Sets
        const result = {};
        for (const [name, items] of Object.entries(sets)) {
            result[name] = new Set(items);
        }
        return result;
    }

    // Compute all intersections for the sets
    _computeIntersections(sets) {
        const setNames = Object.keys(sets);
        const n = setNames.length;
        const intersections = [];

        // Generate all 2^n - 1 combinations
        for (let mask = 1; mask < (1 << n); mask++) {
            const includedSets = [];
            const excludedSets = [];
            for (let i = 0; i < n; i++) {
                if (mask & (1 << i)) includedSets.push(setNames[i]);
                else excludedSets.push(setNames[i]);
            }

            // Find items in ALL included sets
            let items = null;
            for (const name of includedSets) {
                if (items === null) items = new Set(sets[name]);
                else items = new Set([...items].filter(x => sets[name].has(x)));
            }

            // Remove items that are also in any excluded set (exclusive intersection)
            for (const name of excludedSets) {
                if (items) items = new Set([...items].filter(x => !sets[name].has(x)));
            }

            intersections.push({
                sets: includedSets,
                mask,
                count: items ? items.size : 0,
                items: items || new Set()
            });
        }

        return intersections;
    }

    render(vennData, settings) {
        if (settings) Object.assign(this.settings, settings);
        this.container.innerHTML = '';

        const sets = this._parseSets(vennData);
        if (!sets) {
            this.container.innerHTML = '<div class="empty-state"><h3>Enter set data</h3><p>Use binary matrix (columns = sets, 0/1 values) or group-based (Group column defines sets, items are row IDs)</p></div>';
            return;
        }

        const s = this.settings;
        const setNames = Object.keys(sets);
        const n = setNames.length;

        // Decide plot type
        let plotType = s.plotType;
        if (plotType === 'auto') {
            plotType = n <= 3 ? 'venn' : 'upset';
        }

        const svg = d3.select(this.container)
            .append('svg')
            .attr('width', s.width)
            .attr('height', s.height)
            .style('font-family', 'Arial, sans-serif')
            .style('overflow', 'visible');

        const intersections = this._computeIntersections(sets);

        if (plotType === 'venn' && n <= 3) {
            this._drawVenn(svg, sets, setNames, intersections);
        } else {
            this._drawUpSet(svg, sets, setNames, intersections);
        }

        // Title
        if (s.showTitle) {
            this._drawInteractiveText(svg, 'title', s.width / 2, 22, s.title, s.titleFont, s.titleOffset);
        }

        // Annotations
        if (this.annotationManager) {
            this.annotationManager.drawAnnotations(svg, { top: 0, left: 0, right: 0, bottom: 0 });
        }
    }

    _fmtCount(count, totalItems) {
        const s = this.settings;
        const parts = [];
        if (s.showCounts) parts.push(count.toString());
        if (s.showPercentages && totalItems > 0) {
            const pct = (count / totalItems * 100).toFixed(0) + '%';
            parts.push(s.showCounts ? `(${pct})` : pct);
        }
        return parts.join(' ');
    }

    _drawVenn(svg, sets, setNames, intersections) {
        const s = this.settings;
        const n = setNames.length;
        const cx = s.width / 2;
        const cy = s.height / 2 + 10;
        const baseR = Math.min(s.width, s.height) * 0.25;

        // Compute total items
        const allItems = new Set();
        for (const items of Object.values(sets)) {
            for (const item of items) allItems.add(item);
        }
        const totalItems = allItems.size;

        const g = svg.append('g');

        if (n === 1) {
            // Single circle
            const color = this._getColor(0);
            g.append('circle')
                .attr('cx', cx).attr('cy', cy).attr('r', baseR)
                .attr('fill', color).attr('fill-opacity', s.opacity)
                .attr('stroke', d3.color(color).darker(0.5)).attr('stroke-width', 2);

            if (s.showLabels) {
                g.append('text').attr('x', cx).attr('y', cy - baseR - 10)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', s.labelFont.size + 'px')
                    .attr('font-weight', s.labelFont.bold ? 'bold' : 'normal')
                    .attr('fill', '#333').text(setNames[0]);
            }
            if (s.showCounts || s.showPercentages) {
                g.append('text').attr('x', cx).attr('y', cy + 5)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', s.countFont.size + 'px')
                    .attr('fill', '#333')
                    .text(this._fmtCount(sets[setNames[0]].size, totalItems));
            }
        } else if (n === 2) {
            // Two overlapping circles
            const overlap = baseR * 0.6;
            const x1 = cx - overlap / 2;
            const x2 = cx + overlap / 2;

            [0, 1].forEach(i => {
                const color = this._getColor(i);
                const x = i === 0 ? x1 : x2;
                g.append('circle')
                    .attr('cx', x).attr('cy', cy).attr('r', baseR)
                    .attr('fill', color).attr('fill-opacity', s.opacity)
                    .attr('stroke', d3.color(color).darker(0.5)).attr('stroke-width', 2);
            });

            // Labels
            if (s.showLabels) {
                g.append('text').attr('x', x1 - baseR * 0.3).attr('y', cy - baseR - 10)
                    .attr('text-anchor', 'middle').attr('font-size', s.labelFont.size + 'px')
                    .attr('font-weight', s.labelFont.bold ? 'bold' : 'normal')
                    .attr('fill', '#333').text(setNames[0]);
                g.append('text').attr('x', x2 + baseR * 0.3).attr('y', cy - baseR - 10)
                    .attr('text-anchor', 'middle').attr('font-size', s.labelFont.size + 'px')
                    .attr('font-weight', s.labelFont.bold ? 'bold' : 'normal')
                    .attr('fill', '#333').text(setNames[1]);
            }

            // Counts: left-only, intersection, right-only
            if (s.showCounts || s.showPercentages) {
                const leftOnly = intersections.find(x => x.mask === 1);
                const rightOnly = intersections.find(x => x.mask === 2);
                const both = intersections.find(x => x.mask === 3);
                g.append('text').attr('x', x1 - overlap * 0.5).attr('y', cy + 5)
                    .attr('text-anchor', 'middle').attr('font-size', s.countFont.size + 'px')
                    .attr('fill', '#333').text(this._fmtCount(leftOnly ? leftOnly.count : 0, totalItems));
                g.append('text').attr('x', cx).attr('y', cy + 5)
                    .attr('text-anchor', 'middle').attr('font-size', s.countFont.size + 'px')
                    .attr('font-weight', 'bold').attr('fill', '#333').text(this._fmtCount(both ? both.count : 0, totalItems));
                g.append('text').attr('x', x2 + overlap * 0.5).attr('y', cy + 5)
                    .attr('text-anchor', 'middle').attr('font-size', s.countFont.size + 'px')
                    .attr('fill', '#333').text(this._fmtCount(rightOnly ? rightOnly.count : 0, totalItems));
            }
        } else if (n === 3) {
            // Three overlapping circles in triangle arrangement
            const r = baseR * 0.85;
            const d = r * 0.65; // distance from center to circle center
            const angles = [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6];
            const centers = angles.map(a => ({ x: cx + d * Math.cos(a), y: cy + d * Math.sin(a) }));

            centers.forEach((c, i) => {
                const color = this._getColor(i);
                g.append('circle')
                    .attr('cx', c.x).attr('cy', c.y).attr('r', r)
                    .attr('fill', color).attr('fill-opacity', s.opacity)
                    .attr('stroke', d3.color(color).darker(0.5)).attr('stroke-width', 2);
            });

            // Labels outside circles
            if (s.showLabels) {
                const labelOffsets = [
                    { x: 0, y: -r - 12 },
                    { x: r + 5, y: r * 0.5 },
                    { x: -r - 5, y: r * 0.5 }
                ];
                const anchors = ['middle', 'start', 'end'];
                centers.forEach((c, i) => {
                    g.append('text')
                        .attr('x', c.x + labelOffsets[i].x)
                        .attr('y', c.y + labelOffsets[i].y)
                        .attr('text-anchor', anchors[i])
                        .attr('font-size', s.labelFont.size + 'px')
                        .attr('font-weight', s.labelFont.bold ? 'bold' : 'normal')
                        .attr('fill', '#333').text(setNames[i]);
                });
            }

            // Counts in each region
            if (s.showCounts || s.showPercentages) {
                // Region positions (approximate geometric centers)
                const regionPositions = [
                    { mask: 1, x: centers[0].x, y: centers[0].y - d * 0.6 },           // A only
                    { mask: 2, x: centers[1].x + d * 0.5, y: centers[1].y + d * 0.2 }, // B only
                    { mask: 4, x: centers[2].x - d * 0.5, y: centers[2].y + d * 0.2 }, // C only
                    { mask: 3, x: (centers[0].x + centers[1].x) / 2 + d * 0.15, y: (centers[0].y + centers[1].y) / 2 }, // A&B
                    { mask: 5, x: (centers[0].x + centers[2].x) / 2 - d * 0.15, y: (centers[0].y + centers[2].y) / 2 }, // A&C
                    { mask: 6, x: (centers[1].x + centers[2].x) / 2, y: (centers[1].y + centers[2].y) / 2 + d * 0.15 }, // B&C
                    { mask: 7, x: cx, y: cy }  // A&B&C
                ];

                regionPositions.forEach(rp => {
                    const int = intersections.find(x => x.mask === rp.mask);
                    if (!int || int.count === 0) return;
                    g.append('text')
                        .attr('x', rp.x).attr('y', rp.y + 4)
                        .attr('text-anchor', 'middle')
                        .attr('font-size', (s.countFont.size - 1) + 'px')
                        .attr('font-weight', rp.mask === 7 ? 'bold' : 'normal')
                        .attr('fill', '#333')
                        .text(this._fmtCount(int.count, totalItems));
                });
            }
        }
    }

    _drawUpSet(svg, sets, setNames, intersections) {
        const s = this.settings;
        const n = setNames.length;
        const allItems = new Set();
        for (const items of Object.values(sets)) { for (const item of items) allItems.add(item); }
        const totalItems = allItems.size;

        // Sort intersections by count (descending), filter non-empty
        const sorted = intersections
            .filter(x => x.count > 0)
            .sort((a, b) => b.count - a.count);

        if (sorted.length === 0) {
            svg.append('text').attr('x', s.width / 2).attr('y', s.height / 2)
                .attr('text-anchor', 'middle').attr('fill', '#999').text('No intersections found');
            return;
        }

        // Layout
        const margin = { top: 45, right: 20, bottom: 20, left: 120 };
        const dotR = 5;
        const rowH = 18;
        const matrixW = Math.min(sorted.length * 22, s.width - margin.left - margin.right - 50);
        const barMaxH = s.height - margin.top - margin.bottom - n * rowH - 30;
        const colW = matrixW / sorted.length;

        const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

        // Bar chart on top
        const maxCount = d3.max(sorted, d => d.count);
        const barScale = d3.scaleLinear().domain([0, maxCount]).range([0, Math.max(barMaxH, 40)]);

        sorted.forEach((int, ci) => {
            const bx = ci * colW + colW / 2;
            const bh = barScale(int.count);
            const barY = barMaxH - bh;

            // Color based on number of sets in intersection
            const nSets = int.sets.length;
            const color = nSets === 1 ? '#999' : this._getColor(nSets - 2);

            g.append('rect')
                .attr('x', bx - colW * 0.35)
                .attr('y', barY)
                .attr('width', colW * 0.7)
                .attr('height', bh)
                .attr('fill', color)
                .attr('rx', 1);

            // Count label on top
            if (s.showCounts || s.showPercentages) {
                g.append('text')
                    .attr('x', bx)
                    .attr('y', barY - 3)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '9px')
                    .attr('fill', '#333')
                    .text(this._fmtCount(int.count, totalItems));
            }
        });

        // Dot matrix below bars
        const matrixTop = barMaxH + 15;

        // Set size bars on the left
        const maxSetSize = d3.max(setNames, name => sets[name].size);
        const setSizeScale = d3.scaleLinear().domain([0, maxSetSize]).range([0, margin.left - 15]);

        setNames.forEach((name, ri) => {
            const ry = matrixTop + ri * rowH + rowH / 2;
            const barW = setSizeScale(sets[name].size);

            // Set size bar
            g.append('rect')
                .attr('x', -barW - 5)
                .attr('y', ry - rowH * 0.3)
                .attr('width', barW)
                .attr('height', rowH * 0.6)
                .attr('fill', this._getColor(ri))
                .attr('rx', 2);

            // Set name
            g.append('text')
                .attr('x', -barW - 8)
                .attr('y', ry + 4)
                .attr('text-anchor', 'end')
                .attr('font-size', s.labelFont.size + 'px')
                .attr('font-weight', s.labelFont.bold ? 'bold' : 'normal')
                .attr('fill', '#333')
                .text(name);

            // Set size
            g.append('text')
                .attr('x', -3)
                .attr('y', ry + 3)
                .attr('text-anchor', 'end')
                .attr('font-size', '9px')
                .attr('fill', '#666')
                .text(sets[name].size);

            // Background row stripe
            if (ri % 2 === 0) {
                g.append('rect')
                    .attr('x', 0)
                    .attr('y', ry - rowH / 2)
                    .attr('width', matrixW)
                    .attr('height', rowH)
                    .attr('fill', '#f8f9fa');
            }
        });

        // Draw dots and connecting lines for each intersection
        sorted.forEach((int, ci) => {
            const bx = ci * colW + colW / 2;
            const activeRows = int.sets.map(name => setNames.indexOf(name));

            // Dots for all sets (empty = not in intersection, filled = in)
            setNames.forEach((name, ri) => {
                const ry = matrixTop + ri * rowH + rowH / 2;
                const isActive = int.sets.includes(name);

                g.append('circle')
                    .attr('cx', bx)
                    .attr('cy', ry)
                    .attr('r', dotR)
                    .attr('fill', isActive ? '#333' : '#ddd')
                    .attr('stroke', isActive ? '#333' : '#ccc')
                    .attr('stroke-width', 1);
            });

            // Connecting line between active dots
            if (activeRows.length > 1) {
                const minRow = Math.min(...activeRows);
                const maxRow = Math.max(...activeRows);
                g.append('line')
                    .attr('x1', bx)
                    .attr('y1', matrixTop + minRow * rowH + rowH / 2)
                    .attr('x2', bx)
                    .attr('y2', matrixTop + maxRow * rowH + rowH / 2)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 2);
            }
        });
    }

    // --- Shared helper methods ---

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
            title: { textKey: 'title', fontKey: 'titleFont', visKey: 'showTitle' }
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
        popup.appendChild(toolbar);

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

        document.body.appendChild(popup);
        popup.addEventListener('focusout', () => {
            setTimeout(() => {
                if (document.body.contains(popup) && !popup.contains(document.activeElement)) {
                    popup.remove();
                    if (window.app) window.app.updateGraph();
                }
            }, 100);
        });
        setTimeout(() => { input.focus(); input.select(); }, 0);
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

        return { toolbar, familySelect, sizeInput };
    }

    getSvgElement() {
        return this.container.querySelector('svg');
    }
}
