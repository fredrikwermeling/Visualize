// oncoprint.js - OncoPrint renderer for categorical data visualization
// Displays a matrix of genes (rows) × samples (columns) with colored blocks per category

class OncoPrintRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.settings = {
            title: 'OncoPrint',
            width: 600,
            height: 400,
            cellWidth: 12,
            cellHeight: 20,
            cellGap: 1,
            colorTheme: 'default',
            showTitle: true,
            showLegend: true,
            showRowBarChart: true,
            showColBarChart: true,
            sortSamples: true,
            categoryOverrides: {},
            // Fonts
            titleFont: { family: 'Arial', size: 18, bold: true, italic: false },
            rowLabelFont: { family: 'Arial', size: 11, bold: false, italic: false },
            colLabelFont: { family: 'Arial', size: 10, bold: false, italic: false },
            legendFont: { family: 'Arial', size: 11, bold: false, italic: false },
            // Offsets
            titleOffset: { x: 0, y: 0 },
            legendOffset: { x: 0, y: 0 }
        };
        this._nudgeOffsetKey = null;

        // Category color palettes — maps category names to colors
        this.colorThemes = {
            default: ['#E63946','#457B9D','#2A9D8F','#E9C46A','#F4A261','#264653','#A8DADC','#F77F00','#9B5DE5','#00BBF9'],
            mutation: ['#26A65B','#333333','#E74C3C','#3498DB','#9B59B6','#F39C12','#1ABC9C','#E67E22','#95A5A6','#2C3E50'],
            pastel: ['#AEC6CF','#FFB7B2','#B5EAD7','#C7CEEA','#FFDAC1','#E2F0CB','#F0E6EF','#D4F0F0','#FCE4EC','#E8F5E9'],
            vivid: ['#E63946','#457B9D','#2A9D8F','#E9C46A','#F4A261','#264653','#A8DADC','#F77F00','#9B5DE5','#00BBF9'],
            grayscale: ['#333333','#666666','#999999','#BBBBBB','#555555','#888888','#AAAAAA','#CCCCCC','#444444','#777777'],
            tableau: ['#5778a4','#e49444','#d1615d','#85b6b2','#6a9f58','#e7ca60','#a87c9f','#f1a2a9','#967662','#b8b0ac'],
            'okabe-ito': ['#E69F00','#56B4E9','#009E73','#F0E442','#0072B2','#D55E00','#CC79A7','#000000'],
            'tol-bright': ['#4477AA','#EE6677','#228833','#CCBB44','#66CCEE','#AA3377','#BBBBBB'],
            'tol-muted': ['#CC6677','#332288','#DDCC77','#117733','#88CCEE','#882255','#44AA99','#999933','#AA4499'],
            nature: ['#E64B35','#4DBBD5','#00A087','#3C5488','#F39B7F','#8491B4','#91D1C2','#DC0000','#7E6148','#B09C85'],
            science: ['#3B4992','#EE0000','#008B45','#631879','#008280','#BB0021','#5F559B','#A20056','#808180','#1B1919'],
            lancet: ['#00468B','#ED0000','#42B540','#0099B4','#925E9F','#FDAF91','#AD002A','#ADB6B6','#1B1919'],
            nejm: ['#BC3C29','#0072B5','#E18727','#20854E','#7876B1','#6F99AD','#FFDC91','#EE4C97'],
            jama: ['#374E55','#DF8F44','#00A1D5','#B24745','#79AF97','#6A6599','#80796B'],
            jco: ['#0073C2','#EFC000','#868686','#CD534C','#7AA6DC','#003C67','#8F7700','#3B3B3B','#A73030','#4A6990'],
            set1: ['#E41A1C','#377EB8','#4DAF4A','#984EA3','#FF7F00','#FFFF33','#A65628','#F781BF','#999999'],
            set2: ['#66C2A5','#FC8D62','#8DA0CB','#E78AC3','#A6D854','#FFD92F','#E5C494','#B3B3B3'],
            dark2: ['#1B9E77','#D95F02','#7570B3','#E7298A','#66A61E','#E6AB02','#A6761D','#666666'],
            paired: ['#A6CEE3','#1F78B4','#B2DF8A','#33A02C','#FB9A99','#E31A1C','#FDBF6F','#FF7F00','#CAB2D6','#6A3D9A']
        };

        // Built-in category-to-color overrides for common genomic terms
        this._knownCategories = {
            'missense': '#26A65B',
            'nonsense': '#333333',
            'frameshift': '#9B59B6',
            'splice': '#F39C12',
            'amplification': '#E74C3C',
            'deletion': '#3498DB',
            'fusion': '#E67E22',
            'inframe': '#1ABC9C',
            'truncating': '#333333',
            'gain': '#E74C3C',
            'loss': '#3498DB',
            'up': '#E74C3C',
            'down': '#3498DB',
            'yes': '#26A65B',
            'no': '#CCCCCC',
            'positive': '#26A65B',
            'negative': '#E74C3C',
            'present': '#26A65B',
            'absent': '#CCCCCC'
        };
    }

    _getColor(i) {
        const theme = this.colorThemes[this.settings.colorTheme] || this.colorThemes.default;
        return theme[i % theme.length];
    }

    _getCategoryColor(category, idx) {
        const lower = category.toLowerCase().trim();
        if (this._knownCategories[lower]) return this._knownCategories[lower];
        return this._getColor(idx);
    }

    render(data, settings) {
        if (settings) Object.assign(this.settings, settings);
        this.container.innerHTML = '';

        if (!data || !data.matrix || data.matrix.length === 0 || !data.colLabels || data.colLabels.length === 0) {
            this.container.innerHTML = '<div class="empty-state"><h3>Enter categorical data</h3><p>Rows = features (genes), Columns = samples. Cell values are category names (e.g., missense, amplification, deletion).</p></div>';
            return;
        }

        const s = this.settings;
        const { matrix, rowLabels, colLabels } = data;
        const nRows = matrix.length;
        const nCols = colLabels.length;

        // Extract all unique categories
        const catSet = new Set();
        matrix.forEach(row => row.forEach(v => {
            if (v && v.trim()) v.trim().split(';').forEach(c => catSet.add(c.trim()));
        }));
        const categories = [...catSet].sort();
        const catColorMap = {};
        categories.forEach((cat, i) => {
            catColorMap[cat] = this._getCategoryColor(cat, i);
        });

        // Sort samples by mutation frequency if enabled
        let colOrder = colLabels.map((_, i) => i);
        if (s.sortSamples) {
            const colCounts = colOrder.map(ci => {
                let count = 0;
                matrix.forEach(row => { if (row[ci] && row[ci].trim()) count++; });
                return count;
            });
            colOrder.sort((a, b) => colCounts[b] - colCounts[a]);
        }

        // Layout
        const cw = s.cellWidth;
        const ch = s.cellHeight;
        const gap = s.cellGap;
        const rowLabelWidth = 100;
        const topBarH = s.showColBarChart ? 50 : 0;
        const rightBarW = s.showRowBarChart ? 60 : 0;
        const legendH = s.showLegend ? 30 + Math.ceil(categories.length / 4) * 18 : 0;
        const titleH = s.showTitle ? 30 : 0;
        const bottomLabelH = 0; // column labels rotated at bottom if needed

        const gridW = nCols * (cw + gap);
        const gridH = nRows * (ch + gap);
        const totalW = Math.max(s.width, rowLabelWidth + gridW + rightBarW + 20);
        const totalH = titleH + topBarH + gridH + bottomLabelH + legendH + 20;

        const svg = d3.select(this.container)
            .append('svg')
            .attr('width', totalW)
            .attr('height', totalH)
            .style('font-family', 'Arial, sans-serif')
            .style('overflow', 'visible');

        const gridX = rowLabelWidth;
        const gridY = titleH + topBarH;

        // Title
        if (s.showTitle) {
            this._drawInteractiveText(svg, 'title', totalW / 2, 18, s.title, s.titleFont, s.titleOffset);
        }

        // Column bar chart (sample alteration frequency)
        if (s.showColBarChart && topBarH > 0) {
            const maxCount = nRows;
            colOrder.forEach((ci, vi) => {
                let count = 0;
                matrix.forEach(row => { if (row[ci] && row[ci].trim()) count++; });
                const barH = maxCount > 0 ? (count / maxCount) * (topBarH - 5) : 0;
                const bx = gridX + vi * (cw + gap);
                svg.append('rect')
                    .attr('x', bx)
                    .attr('y', gridY - barH - 2)
                    .attr('width', cw)
                    .attr('height', barH)
                    .attr('fill', '#666')
                    .attr('rx', 1);
                // Show % above bar
                const pct = maxCount > 0 ? Math.round(count / maxCount * 100) : 0;
                if (cw >= 6) {
                    svg.append('text')
                        .attr('x', bx + cw / 2).attr('y', gridY - barH - 4)
                        .attr('text-anchor', 'middle').attr('font-size', Math.min(7, cw * 0.7) + 'px')
                        .attr('fill', '#666').text(pct + '%');
                }
            });
        }

        // Grid background
        svg.append('rect')
            .attr('x', gridX)
            .attr('y', gridY)
            .attr('width', gridW)
            .attr('height', gridH)
            .attr('fill', '#f0f0f0');

        // Draw cells
        matrix.forEach((row, ri) => {
            colOrder.forEach((ci, vi) => {
                const x = gridX + vi * (cw + gap);
                const y = gridY + ri * (ch + gap);
                const val = row[ci] ? row[ci].trim() : '';

                if (!val) {
                    // Empty cell — light gray
                    svg.append('rect')
                        .attr('x', x).attr('y', y)
                        .attr('width', cw).attr('height', ch)
                        .attr('fill', '#e8e8e8')
                        .attr('rx', 1);
                } else {
                    // May have multiple categories (semicolon-separated)
                    const cats = val.split(';').map(c => c.trim()).filter(c => c);
                    if (cats.length === 1) {
                        svg.append('rect')
                            .attr('x', x).attr('y', y)
                            .attr('width', cw).attr('height', ch)
                            .attr('fill', catColorMap[cats[0]] || '#999')
                            .attr('rx', 1);
                    } else {
                        // Stacked: divide cell height among categories
                        const segH = ch / cats.length;
                        cats.forEach((cat, si) => {
                            svg.append('rect')
                                .attr('x', x)
                                .attr('y', y + si * segH)
                                .attr('width', cw)
                                .attr('height', segH - (si < cats.length - 1 ? 0.5 : 0))
                                .attr('fill', catColorMap[cat] || '#999')
                                .attr('rx', si === 0 || si === cats.length - 1 ? 1 : 0);
                        });
                    }
                }
            });
        });

        // Row labels (gene names)
        matrix.forEach((_, ri) => {
            const y = gridY + ri * (ch + gap) + ch / 2 + 4;
            svg.append('text')
                .attr('x', gridX - 6)
                .attr('y', y)
                .attr('text-anchor', 'end')
                .attr('font-size', s.rowLabelFont.size + 'px')
                .attr('font-family', s.rowLabelFont.family)
                .attr('font-weight', s.rowLabelFont.bold ? 'bold' : 'normal')
                .attr('font-style', s.rowLabelFont.italic ? 'italic' : 'normal')
                .attr('fill', '#333')
                .text(rowLabels[ri] || ('Row ' + (ri + 1)));
        });

        // Row bar chart (per-gene alteration frequency)
        if (s.showRowBarChart) {
            const barX = gridX + gridW + 8;
            const maxBarW = rightBarW - 15;
            matrix.forEach((row, ri) => {
                let count = 0;
                row.forEach(v => { if (v && v.trim()) count++; });
                const barW = nCols > 0 ? (count / nCols) * maxBarW : 0;
                const y = gridY + ri * (ch + gap);
                svg.append('rect')
                    .attr('x', barX)
                    .attr('y', y)
                    .attr('width', barW)
                    .attr('height', ch)
                    .attr('fill', '#888')
                    .attr('rx', 2);
                // Percentage label
                const pct = nCols > 0 ? Math.round(count / nCols * 100) : 0;
                svg.append('text')
                    .attr('x', barX + barW + 3)
                    .attr('y', y + ch / 2 + 3)
                    .attr('font-size', '9px')
                    .attr('fill', '#666')
                    .text(pct + '%');
            });
        }

        // Legend
        if (s.showLegend && categories.length > 0) {
            const legendY = gridY + gridH + 15;
            const legendG = svg.append('g')
                .attr('transform', `translate(${gridX + s.legendOffset.x},${legendY + s.legendOffset.y})`);

            const cols = 4;
            const colW = Math.max(120, gridW / cols);
            categories.forEach((cat, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = col * colW;
                const y = row * 18;

                legendG.append('rect')
                    .attr('x', x).attr('y', y)
                    .attr('width', 12).attr('height', 12)
                    .attr('fill', catColorMap[cat])
                    .attr('rx', 2);

                const textEl = legendG.append('text')
                    .attr('x', x + 16).attr('y', y + 10)
                    .attr('font-size', s.legendFont.size + 'px')
                    .attr('font-family', s.legendFont.family)
                    .attr('fill', '#333')
                    .text((s.categoryOverrides[cat] && s.categoryOverrides[cat].label) || cat)
                    .style('cursor', 'pointer');

                textEl.on('dblclick', (event) => {
                    event.stopPropagation();
                    this._editLegendLabel(event, cat);
                });
            });

            // Make legend draggable
            this._makeLabelDrag(legendG, 'legendOffset');
        }

        // Annotations
        if (this.annotationManager) {
            this.annotationManager.drawAnnotations(svg, { top: 0, left: 0, right: 0, bottom: 0 });
        }
    }

    // --- Shared helper methods (same pattern as other renderers) ---

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
        const { toolbar } = this._createFontToolbar(fontObj);
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

    _editLegendLabel(event, category) {
        const s = this.settings;
        if (!s.categoryOverrides) s.categoryOverrides = {};

        const existing = document.querySelector('.svg-edit-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.className = 'svg-edit-popup';
        popup.style.left = `${event.clientX + 5}px`;
        popup.style.top = `${event.clientY - 10}px`;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'svg-inline-edit';
        input.value = (s.categoryOverrides[category] && s.categoryOverrides[category].label) || category;
        input.style.cssText = 'width:120px;padding:3px 6px;font-size:12px';
        popup.appendChild(input);

        const commit = () => {
            if (!document.body.contains(popup)) return;
            const val = input.value.trim();
            if (!s.categoryOverrides[category]) s.categoryOverrides[category] = {};
            if (val && val !== category) {
                s.categoryOverrides[category].label = val;
            } else {
                delete s.categoryOverrides[category].label;
            }
            popup.remove();
            if (window.app) window.app.updateGraph();
        };

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); popup.remove(); }
        });

        document.body.appendChild(popup);
        input.focus();
        input.select();

        popup.addEventListener('focusout', () => {
            setTimeout(() => {
                if (document.body.contains(popup) && !popup.contains(document.activeElement)) commit();
            }, 100);
        });
    }

    getSvgElement() {
        return this.container.querySelector('svg');
    }
}
