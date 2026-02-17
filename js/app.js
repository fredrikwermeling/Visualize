// app.js - Main application controller

class App {
    constructor() {
        // Initialize components
        this.dataTable = new DataTable('dataTable', 'tableBody', 'headerRow');
        this.graphRenderer = new GraphRenderer('graphContainer');
        this.heatmapRenderer = new HeatmapRenderer('graphContainer');
        this.growthRenderer = new GrowthCurveRenderer('graphContainer');
        this.volcanoRenderer = new VolcanoRenderer('graphContainer');
        this.exportManager = new ExportManager(this.graphRenderer);
        this.columnAnnotationManager = new AnnotationManager();
        this.heatmapAnnotationManager = new AnnotationManager();
        this.graphRenderer.annotationManager = this.columnAnnotationManager;
        this._undoStack = [];
        this.mode = 'heatmap';

        // Separate data storage per mode
        this._columnTableData = null;
        this._heatmapTableData = null;
        this._growthTableData = null;
        this._volcanoTableData = null;

        // Bind event listeners
        this._bindTableControls();
        this._bindGraphControls();
        this._bindDimensionControls();
        this._bindAppearanceControls();
        this._bindStatisticsControls();
        this._bindExportControls();
        this._bindDrawingTools();
        this._bindModeSelector();
        this._bindHeatmapControls();
        this._bindGrowthControls();
        this._bindVolcanoControls();

        this._bindGroupToggleButtons();
        this._bindTextSettingsPanel();
        this._wrapNumberInputs();

        // Load sample data and draw initial graph
        this._applyMode();
        this.dataTable.loadHeatmapSampleData();
        this.updateGraph();
    }

    _wrapNumberInputs() {
        // Wrap all number inputs inside control grids with +/- stepper buttons
        document.querySelectorAll('.control-grid-2col .control-group input[type="number"], .heatmap-grid .hm-ctrl input[type="number"]').forEach(input => {
            const parent = input.parentElement;
            if (parent.classList.contains('num-stepper')) return; // already wrapped

            const wrapper = document.createElement('div');
            wrapper.className = 'num-stepper';

            const minus = document.createElement('button');
            minus.className = 'step-btn step-minus';
            minus.textContent = '\u2212';
            minus.type = 'button';
            minus.tabIndex = -1;
            minus.addEventListener('mousedown', e => e.preventDefault());
            minus.addEventListener('click', () => {
                input.stepDown();
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });

            const plus = document.createElement('button');
            plus.className = 'step-btn step-plus';
            plus.textContent = '+';
            plus.type = 'button';
            plus.tabIndex = -1;
            plus.addEventListener('mousedown', e => e.preventDefault());
            plus.addEventListener('click', () => {
                input.stepUp();
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });

            input.parentNode.insertBefore(wrapper, input);
            wrapper.appendChild(minus);
            wrapper.appendChild(input);
            wrapper.appendChild(plus);
        });
    }

    // --- Event binding ---

    _bindTableControls() {
        document.getElementById('addColumn').addEventListener('click', () => {
            this.dataTable.addColumn();
        });
        document.getElementById('addRow').addEventListener('click', () => {
            this.dataTable.addRow();
        });
        document.getElementById('clearData').addEventListener('click', () => {
            this.dataTable.clearData();
            this._clearStats();
        });
        this._sampleIndex = { column: 0, heatmap: 0, growth: 0, volcano: 0 };
        document.getElementById('addTestData').addEventListener('click', () => {
            const idx = this._sampleIndex[this.mode] || 0;
            if (this.mode === 'heatmap') {
                this.dataTable.loadHeatmapSampleData(idx);
            } else if (this.mode === 'growth') {
                this.dataTable.loadGrowthSampleData(idx);
            } else if (this.mode === 'volcano') {
                this.dataTable.loadVolcanoSampleData(idx);
            } else {
                this.dataTable.loadSampleData(idx);
            }
            this._sampleIndex[this.mode] = idx + 1;
        });

        // Expand table toggle
        const expandBtn = document.getElementById('expandTable');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => {
                const mc = document.querySelector('.main-content');
                const expanding = !mc.classList.contains('table-expanded');
                mc.classList.toggle('table-expanded');
                if (expanding) {
                    // Add columns/rows to fill the wider table
                    const targetCols = Math.max(this.dataTable._dataColCount(), 12);
                    const targetRows = Math.max(this.dataTable.tbody.querySelectorAll('tr').length, 20);
                    while (this.dataTable._dataColCount() < targetCols) this.dataTable.addColumn();
                    while (this.dataTable.tbody.querySelectorAll('tr').length < targetRows) this.dataTable.addRow();
                }
            });
        }
    }

    _bindGraphControls() {
        document.getElementById('graphType').addEventListener('change', (e) => {
            this.graphRenderer.updateSettings({ graphType: e.target.value });
            this.updateGraph();
        });
    }

    _bindDimensionControls() {
        document.getElementById('graphWidth').addEventListener('input', (e) => {
            const width = parseInt(e.target.value) || 300;
            this.graphRenderer.setDimensions(width, this.graphRenderer.height);
            // Reset title position on dimension change
            this.graphRenderer.settings.titleOffset = { x: 0, y: 0 };
            this.updateGraph();
        });

        document.getElementById('graphHeight').addEventListener('input', (e) => {
            const height = parseInt(e.target.value) || 300;
            this.graphRenderer.setDimensions(this.graphRenderer.width, height);
            this.updateGraph();
        });

        // Heatmap dimension controls
        ['heatmapWidth', 'heatmapHeight', 'heatmapLegendWidth'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => {
                this.heatmapRenderer._titleOffset = { x: 0, y: 0 };
                this.updateGraph();
            });
        });

        document.getElementById('yAxisMin').addEventListener('input', (e) => {
            const val = e.target.value.trim();
            this.graphRenderer.updateSettings({ yAxisMin: val === '' ? null : parseFloat(val) });
            this.updateGraph();
        });

        document.getElementById('yAxisMax').addEventListener('input', (e) => {
            const val = e.target.value.trim();
            this.graphRenderer.updateSettings({ yAxisMax: val === '' ? null : parseFloat(val) });
            this.updateGraph();
        });

        document.getElementById('yAxisTickStep').addEventListener('input', (e) => {
            const val = e.target.value.trim();
            this.graphRenderer.updateSettings({ yAxisTickStep: val === '' ? null : parseFloat(val) });
            this.updateGraph();
        });

        document.getElementById('yAxisScaleType').addEventListener('change', (e) => {
            this.graphRenderer.updateSettings({ yAxisScaleType: e.target.value });
            this.updateGraph();
        });
    }

    _bindAppearanceControls() {
        document.getElementById('errorBarWidth').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 1.5;
            this.graphRenderer.updateSettings({ errorBarWidth: val });
            this.updateGraph();
        });

        document.getElementById('errorBarDirection').addEventListener('change', (e) => {
            this.graphRenderer.updateSettings({ errorBarDirection: e.target.value });
            this.updateGraph();
        });

        document.getElementById('colorTheme').addEventListener('change', (e) => {
            this.graphRenderer.updateSettings({ colorTheme: e.target.value, colorOverrides: {} });
            this.updateGraph();
        });

        document.getElementById('orientation').addEventListener('change', (e) => {
            this.graphRenderer.updateSettings({ orientation: e.target.value });
            this.updateGraph();
        });

        document.getElementById('showGroupLegend').addEventListener('change', (e) => {
            this.graphRenderer.updateSettings({ showGroupLegend: e.target.checked });
            this.updateGraph();
        });

        document.getElementById('groupLabelDisplay').addEventListener('change', (e) => {
            const val = e.target.value;
            const legendCheckbox = document.getElementById('showGroupLegend');
            if (val === 'axis') {
                this.graphRenderer.updateSettings({ showAxisGroupLabels: true, showGroupLegend: false });
                legendCheckbox.checked = false;
            } else if (val === 'legend') {
                this.graphRenderer.updateSettings({ showAxisGroupLabels: false, showGroupLegend: true });
                legendCheckbox.checked = true;
            } else { // both
                this.graphRenderer.updateSettings({ showAxisGroupLabels: true, showGroupLegend: true });
                legendCheckbox.checked = true;
            }
            this.updateGraph();
        });

        // Title / axis label visibility + zero line
        ['showTitle', 'showXLabel', 'showYLabel', 'showZeroLine'].forEach(id => {
            document.getElementById(id).addEventListener('change', (e) => {
                this.graphRenderer.updateSettings({ [id]: e.target.checked });
                this.updateGraph();
            });
        });

        // X-axis tick angle
        document.getElementById('xTickAngle').addEventListener('change', (e) => {
            this.graphRenderer.updateSettings({ xTickAngle: parseInt(e.target.value) || 0 });
            this.updateGraph();
        });

        // Point size
        document.getElementById('pointSize').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 4;
            this.graphRenderer.updateSettings({ pointSize: val });
            this.updateGraph();
        });

        // Point shape
        document.getElementById('pointShape').addEventListener('change', (e) => {
            this.graphRenderer.updateSettings({ pointShape: e.target.value });
            this.updateGraph();
        });

        // Point spread mode
        document.getElementById('pointSpread').addEventListener('change', (e) => {
            this.graphRenderer.updateSettings({ pointSpread: e.target.value });
            this.updateGraph();
        });

        // Center line (mean/median bar) width
        document.getElementById('centerLineWidth').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0.5;
            this.graphRenderer.updateSettings({ centerLineWidth: val });
            this.updateGraph();
        });
    }

    _bindStatisticsControls() {
        document.getElementById('runStats').addEventListener('click', () => {
            this._runStatisticalTest();
        });

        document.getElementById('clearStats').addEventListener('click', () => {
            this._clearStats();
            this.graphRenderer.setSignificance([]);
            this.updateGraph();
        });

        document.getElementById('significanceFontSize').addEventListener('input', (e) => {
            const val = e.target.value.trim();
            this.graphRenderer.updateSettings({ significanceFontSize: val === '' ? null : parseInt(val) });
            this.updateGraph();
        });

        document.getElementById('statsLegendMode').addEventListener('change', (e) => {
            const mode = e.target.value;
            const updates = { showStatsLegend: mode !== 'none', statsLegendExtended: mode === 'extended' };
            this.graphRenderer.updateSettings(updates);
            Object.assign(this.growthRenderer.settings, updates);
            this.updateGraph();
        });

        // Show/hide post-hoc controls based on test type
        document.getElementById('testType').addEventListener('change', (e) => {
            const isMultiGroup = this._isMultiGroupTest(e.target.value);
            const isGrowth = this._isGrowthTest(e.target.value);
            const isFriedman = e.target.value === 'friedman';
            document.getElementById('postHocGroup').style.display = (isMultiGroup && !isFriedman) ? '' : 'none';
            this._updatePostHocAdvice();
            this._updateDunnettVisibility();
            this._updateTwoGroupSelectors();
            this._updateTestDescription();
            this._updateGrowthStatsVisibility(isGrowth);
        });

        document.getElementById('postHocMethod').addEventListener('change', () => {
            this._updatePostHocAdvice();
            this._updateDunnettVisibility();
        });

        // Growth compare mode toggle
        document.getElementById('growthCompareMode').addEventListener('change', (e) => {
            document.getElementById('growthControlGroup').style.display = e.target.value === 'control' ? '' : 'none';
        });

        // Info box removed — stats info shown in results panel only

        // Initialize post-hoc visibility
        const testType = document.getElementById('testType').value;
        const isMulti = this._isMultiGroupTest(testType);
        document.getElementById('postHocGroup').style.display = (isMulti && testType !== 'friedman') ? '' : 'none';
        this._updatePostHocAdvice();
        this._updateTwoGroupSelectors();
        this._updateTestDescription();
        this._statsInfoBoxVisible = false;
        this._statsInfoText = null;
    }

    _isMultiGroupTest(testType) {
        return testType === 'one-way-anova' || testType === 'kruskal-wallis' || testType === 'friedman';
    }

    _isGrowthTest(testType) {
        return testType === 'two-way-rm-anova';
    }

    _updateGrowthStatsVisibility(isGrowth) {
        document.getElementById('growthCorrectionGroup').style.display = isGrowth ? '' : 'none';
        document.getElementById('growthCompareGroup').style.display = isGrowth ? '' : 'none';
        const compareMode = document.getElementById('growthCompareMode').value;
        document.getElementById('growthControlGroup').style.display = (isGrowth && compareMode === 'control') ? '' : 'none';
        if (isGrowth) this._populateGrowthControlSelect();
    }

    _populateGrowthControlSelect() {
        const sel = document.getElementById('growthControlSelect');
        const growthData = this.dataTable.getGrowthData();
        if (!sel || !growthData) return;
        const prev = sel.value;
        sel.innerHTML = '';
        growthData.groups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            sel.appendChild(opt);
        });
        if (prev && growthData.groups.includes(prev)) sel.value = prev;
    }

    _updateTestDescription() {
        const descEl = document.getElementById('testDescription');
        if (!descEl) return;
        const testType = document.getElementById('testType').value;

        const descriptions = {
            'none': null,
            'one-way-anova': '<b>One-way ANOVA</b> — Parametric, unpaired, compares 3+ groups. Tests whether group means differ. Assumes normal distribution and equal variances.',
            'kruskal-wallis': '<b>Kruskal-Wallis</b> — Non-parametric, unpaired, compares 3+ groups. Rank-based alternative to ANOVA. No normality assumption.',
            'friedman': '<b>Friedman test</b> — Non-parametric, paired, compares 3+ groups. Rank-based alternative to repeated-measures ANOVA. Requires equal sample sizes (matched subjects).',
            't-test-unpaired': '<b>Unpaired t-test</b> (Welch\'s) — Parametric, unpaired, compares 2 groups. Tests whether two independent group means differ. Assumes normality.',
            't-test-paired': '<b>Paired t-test</b> — Parametric, paired, compares 2 groups. Tests whether the mean difference between matched pairs is zero. Requires equal sample sizes.',
            'mann-whitney': '<b>Mann-Whitney U</b> — Non-parametric, unpaired, compares 2 groups. Rank-based alternative to unpaired t-test. No normality assumption.',
            'wilcoxon': '<b>Wilcoxon signed-rank</b> — Non-parametric, paired, compares 2 groups. Rank-based alternative to paired t-test. Requires equal sample sizes.',
            'two-way-rm-anova': '<b>Two-way RM ANOVA</b> — Parametric, repeated measures. Tests Group (between-subjects), Time (within-subjects), and Group\u00d7Time interaction. Use with Growth mode data.'
        };

        const desc = descriptions[testType];
        if (desc) {
            descEl.innerHTML = desc;
            descEl.style.display = '';
        } else {
            descEl.style.display = 'none';
        }
    }

    _updatePostHocAdvice() {
        const adviceEl = document.getElementById('postHocAdvice');
        const postHocGroup = document.getElementById('postHocGroup');
        if (postHocGroup.style.display === 'none') {
            adviceEl.style.display = 'none';
            return;
        }

        const method = document.getElementById('postHocMethod').value;
        const advice = {
            tukey: 'Standard choice for all pairwise comparisons after ANOVA',
            bonferroni: 'Most conservative. Strict Type I error control',
            holm: 'Less conservative than Bonferroni, more powerful',
            dunnett: 'Compare each group to one control. More powerful for control-only comparisons'
        };
        adviceEl.textContent = advice[method] || '';
        adviceEl.style.display = advice[method] ? '' : 'none';
    }

    _updateDunnettVisibility() {
        const method = document.getElementById('postHocMethod').value;
        const dunnettGroup = document.getElementById('dunnettControlGroup');
        dunnettGroup.style.display = method === 'dunnett' ? '' : 'none';
    }

    _populateDunnettControl(data) {
        const sel = document.getElementById('dunnettControlIndex');
        sel.innerHTML = '';
        data.filter(d => d.values.length > 0).forEach((d, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = d.label;
            sel.appendChild(opt);
        });
    }

    _updateTwoGroupSelectors() {
        const testType = document.getElementById('testType').value;
        const isTwoGroup = ['t-test-unpaired', 't-test-paired', 'mann-whitney', 'wilcoxon'].includes(testType);
        const data = this.dataTable.getData();
        const filledGroups = data.filter(d => d.values.length > 0);
        const showSelectors = isTwoGroup && filledGroups.length > 2;

        document.getElementById('twoGroupWarning').style.display = showSelectors ? '' : 'none';
        document.getElementById('twoGroupSelectGroup').style.display = showSelectors ? '' : 'none';
        document.getElementById('twoGroupSelectGroup2').style.display = showSelectors ? '' : 'none';

        if (showSelectors) {
            this._populateTwoGroupSelectors(data);
        }
    }

    _populateTwoGroupSelectors(data) {
        const sel1 = document.getElementById('twoGroupSelect1');
        const sel2 = document.getElementById('twoGroupSelect2');
        const prev1 = sel1.value;
        const prev2 = sel2.value;
        sel1.innerHTML = '';
        sel2.innerHTML = '';
        const filled = data.filter(d => d.values.length > 0);
        filled.forEach((d, i) => {
            const opt1 = document.createElement('option');
            opt1.value = i; opt1.textContent = d.label;
            sel1.appendChild(opt1);
            const opt2 = document.createElement('option');
            opt2.value = i; opt2.textContent = d.label;
            sel2.appendChild(opt2);
        });
        // Restore or set defaults
        sel1.value = prev1 !== '' && parseInt(prev1) < filled.length ? prev1 : '0';
        sel2.value = prev2 !== '' && parseInt(prev2) < filled.length ? prev2 : (filled.length > 1 ? '1' : '0');
    }

    _bindExportControls() {
        document.getElementById('exportPNG').addEventListener('click', () => {
            const title = this._getActiveRenderer().settings.title || this.mode;
            const safeName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            this._exportWithInfo('png', `${safeName}.png`);
        });

        document.getElementById('exportSVG').addEventListener('click', () => {
            const title = this._getActiveRenderer().settings.title || this.mode;
            const safeName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            this._exportWithInfo('svg', `${safeName}.svg`);
        });

        document.getElementById('copyClipboard').addEventListener('click', (e) => {
            this.exportManager.copyToClipboard(e.target);
        });

        const rawCsvBtn = document.getElementById('exportRawCSV');
        if (rawCsvBtn) rawCsvBtn.addEventListener('click', () => {
            this.dataTable.exportRawCSV();
        });

        document.getElementById('exportStats').addEventListener('click', () => {
            this._exportStats();
        });

        document.getElementById('exportAll').addEventListener('click', () => {
            this._exportAll();
        });
    }

    _exportWithInfo(format, filename) {
        // For heatmap, temporarily render info into SVG if enabled
        const infoEl = document.getElementById('heatmapInfo');
        const showInfo = this.mode === 'heatmap' && infoEl && infoEl.style.display !== 'none';

        if (showInfo) {
            // Append info text to the SVG before export
            const svgEl = document.getElementById('graphContainer').querySelector('svg');
            if (svgEl) {
                const svgW = parseFloat(svgEl.getAttribute('width'));
                const svgH = parseFloat(svgEl.getAttribute('height'));
                const infoText = infoEl.innerText || '';
                const lines = infoText.split('\n').filter(l => l.trim());

                const infoG = d3.select(svgEl).append('g')
                    .attr('class', 'export-info')
                    .attr('transform', `translate(10, ${svgH + 5})`);

                lines.forEach((line, i) => {
                    infoG.append('text')
                        .attr('y', i * 14)
                        .attr('font-size', '9px')
                        .attr('fill', '#666')
                        .attr('font-family', 'Arial')
                        .text(line.trim());
                });

                const newH = svgH + lines.length * 14 + 10;
                svgEl.setAttribute('height', newH);
            }
        }

        // Use container SVG for all modes
        const svgEl = document.getElementById('graphContainer').querySelector('svg');
        if (svgEl) {
            this.exportManager._exportSvgEl(svgEl, format, filename);
        }

        // Restore SVG after a short delay
        if (showInfo) {
            setTimeout(() => this.updateGraph(), 500);
        }
    }

    _exportStats() {
        const resultsEl = document.getElementById('statsResults');
        if (!resultsEl || !resultsEl.textContent.trim()) {
            alert('No statistics results to export. Run a test first.');
            return;
        }
        const text = resultsEl.innerText || resultsEl.textContent;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stats_${this.mode}_${this._exportDateStr()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    _exportDateStr() {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
    }

    async _exportAll() {
        if (typeof JSZip === 'undefined') {
            // Load JSZip dynamically
            await this._loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        }
        const zip = new JSZip();
        const title = this._getActiveRenderer().settings.title || this.mode;
        const safeName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const dateStr = this._exportDateStr();
        const id = Math.random().toString(36).slice(2, 6);
        const folderName = `${safeName}_${dateStr}_${id}`;
        const folder = zip.folder(folderName);

        // PNG
        const pngBlob = await this._renderToBlob('png');
        if (pngBlob) folder.file(`${safeName}.png`, pngBlob);

        // SVG
        const svgBlob = await this._renderToBlob('svg');
        if (svgBlob) folder.file(`${safeName}.svg`, svgBlob);

        // Raw CSV
        const csvText = this.dataTable.getRawCSVText();
        if (csvText) folder.file(`${safeName}_data.csv`, csvText);

        // Stats
        const resultsEl = document.getElementById('statsResults');
        if (resultsEl && resultsEl.textContent.trim()) {
            folder.file(`${safeName}_stats.txt`, resultsEl.innerText || resultsEl.textContent);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${folderName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    _renderToBlob(format) {
        return new Promise(resolve => {
            const svgEl = document.getElementById('graphContainer').querySelector('svg');
            if (!svgEl) { resolve(null); return; }
            const cloned = svgEl.cloneNode(true);
            this.exportManager._inlineStyles(svgEl, cloned);
            const dims = this.exportManager._expandToFit(cloned);

            if (format === 'svg') {
                cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bg.setAttribute('width', '100%');
                bg.setAttribute('height', '100%');
                bg.setAttribute('fill', 'white');
                cloned.insertBefore(bg, cloned.firstChild);
                const data = new XMLSerializer().serializeToString(cloned);
                resolve(new Blob([data], { type: 'image/svg+xml;charset=utf-8' }));
            } else {
                cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bg.setAttribute('width', '100%');
                bg.setAttribute('height', '100%');
                bg.setAttribute('fill', 'white');
                cloned.insertBefore(bg, cloned.firstChild);
                const data = new XMLSerializer().serializeToString(cloned);
                const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const img = new Image();
                const scaleEl = document.getElementById('pngScale');
                const scale = scaleEl ? parseInt(scaleEl.value) || 2 : 2;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = dims.width * scale;
                    canvas.height = dims.height * scale;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.scale(scale, scale);
                    ctx.drawImage(img, 0, 0);
                    URL.revokeObjectURL(url);
                    canvas.toBlob(b => resolve(b), 'image/png');
                };
                img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
                img.src = url;
            }
        });
    }

    _bindDrawingTools() {
        const toolButtons = ['drawToolNone', 'drawToolText', 'drawToolLine', 'drawToolArrow', 'drawToolBracket'];
        const toolMap = { drawToolNone: 'none', drawToolText: 'text', drawToolLine: 'line', drawToolArrow: 'arrow', drawToolBracket: 'bracket' };

        toolButtons.forEach(id => {
            document.getElementById(id).addEventListener('click', () => {
                const mgr = this.mode === 'heatmap' ? this.heatmapAnnotationManager : this.columnAnnotationManager;
                mgr.setTool(toolMap[id]);
                this.updateGraph();
            });
        });

        document.getElementById('drawUndo').addEventListener('click', () => {
            this.undo();
        });

        document.getElementById('drawDeleteSelected').addEventListener('click', () => {
            const mgr = this.mode === 'heatmap' ? this.heatmapAnnotationManager : this.columnAnnotationManager;
            mgr.deleteSelected();
        });

        document.getElementById('drawClearAll').addEventListener('click', () => {
            const mgr = this.mode === 'heatmap' ? this.heatmapAnnotationManager : this.columnAnnotationManager;
            mgr.clearAll();
        });

        // Ctrl+Z / Cmd+Z for undo
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
                e.preventDefault();
                this.undo();
            }
        });
    }

    _bindModeSelector() {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const prevMode = this.mode;
                if (btn.dataset.mode === prevMode) return;
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Save current table data
                this._saveTableData(prevMode);

                this.mode = btn.dataset.mode;
                this._lastAutoSizeKey = null;
                this._clearStats();
                this._applyMode();

                // Restore saved data or load sample
                this._restoreTableData(this.mode);
                this.updateGraph();
                // Rebuild text settings panel if open
                const tsPanel = document.getElementById('textSettingsPanel');
                if (tsPanel && tsPanel.style.display !== 'none') this._buildTextSettingsRows();
            });
        });

        // Reset button
        const resetBtn = document.getElementById('resetMode');
        if (resetBtn) resetBtn.addEventListener('click', () => this._resetCurrentMode());
    }

    _resetCurrentMode() {
        this._clearStats();
        this._lastAutoSizeKey = null;
        this._statsInfoText = null;

        if (this.mode === 'growth') {
            this.growthRenderer.setSignificance([]);
            this.growthRenderer._titleOffset = { x: 0, y: 0 };
            this.growthRenderer._legendOffset = { x: 0, y: 0 };
            this.growthRenderer.settings.title = 'Time Series';
            this.growthRenderer.settings.xLabel = 'Time';
            this.growthRenderer.settings.yLabel = 'Value';
            this.growthRenderer.settings.showTitle = true;
            this.growthRenderer.settings.showXLabel = true;
            this.growthRenderer.settings.showYLabel = true;
            this.growthRenderer.settings.titleOffset = { x: 0, y: 0 };
            this.growthRenderer.settings.xLabelOffset = { x: 0, y: 0 };
            this.growthRenderer.settings.yLabelOffset = { x: 0, y: 0 };
            this.growthRenderer.settings.titleFont = { family: 'Arial', size: 18, bold: true, italic: false };
            this.growthRenderer.settings.xLabelFont = { family: 'Arial', size: 15, bold: false, italic: false };
            this.growthRenderer.settings.yLabelFont = { family: 'Arial', size: 15, bold: false, italic: false };
            this.growthRenderer.settings.xTickFont = { family: 'Arial', size: 12, bold: false, italic: false };
            this.growthRenderer.settings.yTickFont = { family: 'Arial', size: 12, bold: false, italic: false };
            this.growthRenderer.settings.xTickStep = null;
            this.growthRenderer.settings.yTickStep = null;
            this.growthRenderer.settings.legendFont = { family: 'Arial', size: 11, bold: false, italic: false };
            this.growthRenderer.settings.showLegend = true;
            this.growthRenderer.settings.groupOverrides = {};
            document.getElementById('growthWidth').value = 300;
            document.getElementById('growthHeight').value = 300;
            document.getElementById('growthXMin').value = '';
            document.getElementById('growthXMax').value = '';
            document.getElementById('growthYMin').value = '';
            document.getElementById('growthYMax').value = '';
            document.getElementById('growthXTickStep').value = '';
            document.getElementById('growthYTickStep').value = '';
            document.getElementById('growthColorTheme').value = 'default';
            document.getElementById('growthErrorType').value = 'sem';
            document.getElementById('growthErrorStyle').value = 'bars';
            document.getElementById('growthErrorDir').value = 'both';
            document.getElementById('growthSymbolSize').value = '4';
            document.getElementById('growthMeanLineWidth').value = '2.5';
            document.getElementById('growthCapWidth').value = '6';
            document.getElementById('growthShowIndividual').checked = false;
            document.getElementById('growthShowMean').checked = true;
            document.getElementById('growthShowZeroLine').checked = false;
            this.growthRenderer.settings.showZeroLine = false;
            this.growthRenderer.settings.zeroLineWidth = 1;
            this.growthRenderer.settings.zeroLineDash = 'dashed';
            this.growthRenderer.settings.zeroLineColor = '#333';
            this.growthRenderer._zeroLineAutoSet = false;
            this.growthRenderer.settings.showStatsLegend = false;
            this.growthRenderer.settings.statsLegendExtended = false;
            this.growthRenderer.settings.statsTestName = '';
            this.growthRenderer.settings.statsLegendOffset = { x: 0, y: 0 };
            this._growthTableData = null;
            this.dataTable.loadGrowthSampleData();
        } else if (this.mode === 'volcano') {
            const fresh = new VolcanoRenderer('graphContainer');
            this.volcanoRenderer.settings = fresh.settings;
            this.volcanoRenderer._nudgeOffsetKey = null;
            this.volcanoRenderer._nudgeGeneName = null;
            document.getElementById('volcanoWidth').value = 450;
            document.getElementById('volcanoHeight').value = 400;
            document.getElementById('volcanoPThresh').value = 0.05;
            document.getElementById('volcanoFCThresh').value = 1.0;
            document.getElementById('volcanoPointSize').value = 4;
            document.getElementById('volcanoTopLabels').value = 10;
            document.getElementById('volcanoLabelSize').value = 10;
            document.getElementById('volcanoUpColor').value = '#E63946';
            document.getElementById('volcanoDownColor').value = '#457B9D';
            this._volcanoTableData = null;
            this.dataTable.loadVolcanoSampleData();
        } else if (this.mode === 'column') {
            this.graphRenderer.settings = new GraphRenderer('graphContainer').settings;
            this.graphRenderer._titleOffset = { x: 0, y: 0 };
            this.graphRenderer._zeroLineAutoSet = false;
            document.getElementById('graphWidth').value = 150;
            document.getElementById('graphHeight').value = 200;
            document.getElementById('yAxisMin').value = '';
            document.getElementById('yAxisMax').value = '';
            document.getElementById('yAxisTickStep').value = '';
            document.getElementById('colorTheme').value = 'default';
            document.getElementById('showGroupLegend').checked = false;
            this._columnTableData = null;
            this.dataTable.loadSampleData();
        } else {
            this.heatmapRenderer._titleOffset = { x: 0, y: 0 };
            this.heatmapRenderer._legendOffset = { x: 0, y: 0 };
            document.getElementById('heatmapWidth').value = 300;
            document.getElementById('heatmapHeight').value = 300;
            document.getElementById('heatmapCluster').value = 'none';
            document.getElementById('heatmapNormalize').value = 'none';
            document.getElementById('heatmapColorScheme').value = 'Viridis';
            document.getElementById('heatmapShowValues').checked = false;
            document.getElementById('heatmapShowGroupBar').checked = false;
            document.getElementById('heatmapShowInfo').checked = false;
            this._heatmapTableData = null;
            this.dataTable.loadHeatmapSampleData();
        }
        this.updateGraph();
    }

    _saveTableData(mode) {
        // Snapshot current table state
        const headers = [];
        this.dataTable.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)').forEach(th => {
            const clone = th.cloneNode(true);
            const btn = clone.querySelector('.th-delete-btn');
            if (btn) btn.remove();
            headers.push(clone.textContent.trim());
        });
        const rows = [];
        const idData = [];
        const disabledRows = [];
        this.dataTable.tbody.querySelectorAll('tr').forEach(tr => {
            const row = [];
            tr.querySelectorAll('td:not(.row-delete-cell):not(.id-cell):not(.row-toggle-cell)').forEach(td => {
                row.push(td.textContent.trim());
            });
            rows.push(row);
            const idCells = tr.querySelectorAll('td.id-cell');
            idData.push([
                idCells[0] ? idCells[0].textContent.trim() : '',
                idCells[1] ? idCells[1].textContent.trim() : ''
            ]);
            disabledRows.push(tr.classList.contains('row-disabled'));
        });
        const key = mode === 'column' ? '_columnTableData' : mode === 'growth' ? '_growthTableData' : mode === 'volcano' ? '_volcanoTableData' : '_heatmapTableData';
        this[key] = { headers, rows, idData, disabledRows, numRows: rows.length };
    }

    _restoreTableData(mode) {
        const key = mode === 'column' ? '_columnTableData' : mode === 'growth' ? '_growthTableData' : mode === 'volcano' ? '_volcanoTableData' : '_heatmapTableData';
        const saved = this[key];
        if (saved) {
            this.dataTable.setupTable(saved.headers, saved.numRows, saved.rows, saved.idData);
            // Restore disabled rows
            if (saved.disabledRows) {
                const trs = this.dataTable.tbody.querySelectorAll('tr');
                saved.disabledRows.forEach((disabled, i) => {
                    if (disabled && trs[i]) {
                        trs[i].classList.add('row-disabled');
                        const cb = trs[i].querySelector('.row-toggle-cell input');
                        if (cb) cb.checked = false;
                    }
                });
            }
        } else {
            // Load defaults
            if (mode === 'heatmap') {
                this.dataTable.loadHeatmapSampleData();
            } else if (mode === 'growth') {
                this.dataTable.loadGrowthSampleData();
            } else if (mode === 'volcano') {
                this.dataTable.loadVolcanoSampleData();
            } else {
                this.dataTable.loadSampleData();
            }
        }
    }

    _applyMode() {
        const isHeatmap = this.mode === 'heatmap';
        const isGrowth = this.mode === 'growth';
        const isColumn = this.mode === 'column';
        const isVolcano = this.mode === 'volcano';

        // Show/hide ID columns and row toggles
        const table = document.getElementById('dataTable');
        if (table) {
            table.classList.toggle('hide-id-cols', !isHeatmap);
            table.classList.toggle('hide-row-toggles', !isHeatmap);
        }

        // Column-specific controls (top-level elements)
        const columnEls = [
            document.querySelector('.graph-type-selector'),
            document.getElementById('groupManager')
        ];
        columnEls.forEach(el => { if (el) el.style.display = isColumn ? '' : 'none'; });

        // Heatmap-specific: column/row order managers
        const heatmapColMgr = document.getElementById('heatmapColManager');
        if (heatmapColMgr) heatmapColMgr.style.display = isHeatmap ? '' : 'none';

        // Hide all .column-only elements except in column mode
        document.querySelectorAll('.column-only').forEach(el => {
            el.style.display = isColumn ? '' : 'none';
        });

        // Control sections inside .graph-controls
        const controlSections = document.querySelectorAll('.graph-controls .control-section');
        controlSections.forEach(section => {
            const h3 = section.querySelector('h3');
            if (!h3) return;
            const title = h3.textContent.trim();
            if (title === 'Dimensions & Style') {
                section.style.display = isColumn ? '' : 'none';
            }
            if (title === 'Statistics') {
                section.style.display = (isColumn || isGrowth) ? '' : 'none';
            }
        });

        // Heatmap controls
        const heatmapControls = document.getElementById('heatmapControls');
        if (heatmapControls) heatmapControls.style.display = isHeatmap ? '' : 'none';

        // Growth controls
        const growthControls = document.getElementById('growthControls');
        if (growthControls) growthControls.style.display = isGrowth ? '' : 'none';

        // Volcano controls
        const volcanoControls = document.getElementById('volcanoControls');
        if (volcanoControls) volcanoControls.style.display = isVolcano ? '' : 'none';

        // Hide graph-controls wrapper for modes that don't use it
        const graphControlsEl = document.querySelector('.graph-controls');
        if (graphControlsEl) graphControlsEl.style.display = (isVolcano || isHeatmap) ? 'none' : '';

        // Show/hide heatmap-only export buttons
        document.querySelectorAll('.heatmap-only').forEach(el => {
            el.style.display = isHeatmap ? 'inline-block' : 'none';
        });

        // Stats export only for column/growth
        const statsBtn = document.getElementById('exportStats');
        if (statsBtn) statsBtn.style.display = (isColumn || isGrowth) ? '' : 'none';

        // Filter test type options by mode
        const testSel = document.getElementById('testType');
        if (testSel) {
            testSel.querySelectorAll('optgroup').forEach(og => {
                const label = og.getAttribute('label') || '';
                if (label === 'Growth Curves') {
                    og.style.display = isGrowth ? '' : 'none';
                } else {
                    og.style.display = (isGrowth || isVolcano) ? 'none' : '';
                }
            });
            // Reset to appropriate default when switching modes
            if (isGrowth && testSel.value !== 'two-way-rm-anova' && testSel.value !== 'none') {
                testSel.value = 'two-way-rm-anova';
                testSel.dispatchEvent(new Event('change'));
            } else if (!isGrowth && testSel.value === 'two-way-rm-anova') {
                testSel.value = 'one-way-anova';
                testSel.dispatchEvent(new Event('change'));
            }
        }
    }

    _bindHeatmapControls() {
        const ids = ['heatmapCluster', 'heatmapLinkage', 'heatmapNormalize', 'heatmapNormMethod', 'heatmapWinsorize', 'heatmapColorScheme', 'heatmapColLabelAngle', 'heatmapGroupColorTheme', 'heatmapClusterFlipRows', 'heatmapClusterFlipCols', 'heatmapOutlierMode'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.updateGraph());
        });
        ['heatmapShowValues', 'heatmapShowGroupBar', 'heatmapShowInfo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.updateGraph());
        });

        // Show/hide outlier explanation
        const outlierSel = document.getElementById('heatmapOutlierMode');
        const outlierExpl = document.getElementById('outlierExplanation');
        if (outlierSel && outlierExpl) {
            outlierSel.addEventListener('change', () => {
                outlierExpl.style.display = outlierSel.value === 'none' ? 'none' : '';
            });
        }

        const csvBtn = document.getElementById('exportGroupedCSV');
        if (csvBtn) csvBtn.addEventListener('click', () => {
            const matrixData = this.dataTable.getMatrixData();
            this.heatmapRenderer.exportGroupedCSV(matrixData);
        });

        // View as Column button - converts grouped heatmap data to column format
        const viewColBtn = document.getElementById('viewAsColumn');
        if (viewColBtn) viewColBtn.addEventListener('click', () => {
            this._viewHeatmapAsColumn();
        });
    }

    _bindGrowthControls() {
        ['growthWidth', 'growthHeight', 'growthXMin', 'growthXMax', 'growthYMin', 'growthYMax', 'growthXTickStep', 'growthYTickStep', 'growthSymbolSize', 'growthMeanLineWidth', 'growthCapWidth'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => {
                this.growthRenderer._titleOffset = { x: 0, y: 0 };
                this.growthRenderer.settings.titleOffset = { x: 0, y: 0 };
                this.updateGraph();
            });
        });
        ['growthColorTheme', 'growthErrorType', 'growthErrorStyle', 'growthErrorDir'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.updateGraph());
        });
        ['growthShowIndividual', 'growthShowMean', 'growthShowZeroLine'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.updateGraph());
        });
    }

    _bindGroupToggleButtons() {
        // Column mode group toggles
        document.getElementById('groupShowAll').addEventListener('click', () => {
            this.graphRenderer.settings.hiddenGroups = [];
            this.updateGraph();
        });
        document.getElementById('groupHideAll').addEventListener('click', () => {
            const data = this.dataTable.getData();
            this.graphRenderer.settings.hiddenGroups = data.filter(d => d.values.length > 0).map(d => d.label);
            this.updateGraph();
        });
        // Heatmap column toggles
        document.getElementById('heatmapColShowAll').addEventListener('click', () => {
            this.heatmapRenderer.settings.hiddenCols = [];
            this.updateGraph();
        });
        document.getElementById('heatmapColHideAll').addEventListener('click', () => {
            const allCols = this.heatmapRenderer._rawColLabels || [];
            this.heatmapRenderer.settings.hiddenCols = [...allCols];
            this.updateGraph();
        });
    }

    _viewHeatmapAsColumn() {
        const matrixData = this.dataTable.getMatrixData();
        const { colLabels, rowLabels, matrix, groupAssignments } = matrixData;
        const groups = this.heatmapRenderer._detectGroups(rowLabels, groupAssignments);

        // Save current heatmap data
        this._saveTableData('heatmap');

        // Build column data: each column header = "Marker (Group)", data = values
        const headers = [];
        const maxReps = Math.max(...groups.uniqueGroups.map(g => groups.groupNames[g].length));
        const rowData = [];

        for (let rep = 0; rep < maxReps; rep++) {
            rowData.push([]);
        }

        for (let mi = 0; mi < colLabels.length; mi++) {
            for (const group of groups.uniqueGroups) {
                headers.push(`${colLabels[mi]} ${group}`);
                const indices = groups.groupNames[group];
                for (let rep = 0; rep < maxReps; rep++) {
                    if (rep < indices.length) {
                        const ri = indices[rep];
                        rowData[rep].push(matrix[ri][mi]);
                    } else {
                        rowData[rep].push('');
                    }
                }
            }
        }

        // Switch to column mode
        this._columnTableData = { headers, rows: rowData, numRows: Math.max(maxReps, 10) };
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.mode-btn[data-mode="column"]').classList.add('active');
        this.mode = 'column';
        this._lastAutoSizeKey = null;
        this._applyMode();
        this._restoreTableData('column');
        this.updateGraph();

        // Auto-run unpaired t-tests per marker when exactly 2 groups
        if (groups.uniqueGroups.length === 2) {
            const data = this.dataTable.getData();
            const numGroups = 2;
            const pairs = [];
            const testName = "Unpaired t-test (Welch's)";
            let html = `<div class="result-item"><span class="result-label">Test:</span> <span class="result-value">${testName} — per marker</span></div>`;
            html += `<div class="result-item"><span class="result-label">Groups:</span> <span class="result-value">${groups.uniqueGroups.join(' vs ')}</span></div>`;
            html += `<div style="margin:4px 0"><button class="btn btn-secondary marker-toggle-all" style="padding:1px 6px;font-size:10px">All</button> <button class="btn btn-secondary marker-toggle-none" style="padding:1px 6px;font-size:10px">None</button></div>`;
            html += `<hr style="margin:4px 0;border-color:#eee">`;

            for (let mi = 0; mi < colLabels.length; mi++) {
                const idx1 = mi * numGroups;
                const idx2 = mi * numGroups + 1;
                if (idx1 >= data.length || idx2 >= data.length) continue;
                const g1 = data[idx1];
                const g2 = data[idx2];
                if (g1.values.length < 2 || g2.values.length < 2) continue;

                try {
                    const result = Statistics.tTest(g1.values, g2.values, false);
                    const sigLevel = Statistics.getSignificanceLevel(result.p);
                    const pFormatted = Statistics.formatPValue(result.p);
                    const isSignificant = result.p < 0.05;

                    pairs.push({
                        group1Index: idx1,
                        group2Index: idx2,
                        pValue: result.p,
                        significanceLabel: sigLevel
                    });

                    html += `<div class="result-item marker-row" data-marker="${colLabels[mi]}" style="cursor:pointer;margin-top:6px" title="Click to toggle visibility"><span class="result-value"><b>${colLabels[mi]}:</b> ${pFormatted} <span class="${isSignificant ? 'significant' : 'not-significant'}">${sigLevel}</span></span></div>`;
                } catch (e) {
                    html += `<div class="result-item marker-row" data-marker="${colLabels[mi]}" style="cursor:pointer;margin-top:6px" title="Click to toggle visibility"><span class="result-value"><b>${colLabels[mi]}:</b> Error — ${e.message}</span></div>`;
                }
            }

            document.getElementById('testType').value = 't-test-unpaired';
            document.getElementById('postHocGroup').style.display = 'none';
            document.getElementById('postHocAdvice').style.display = 'none';
            this._updateTestDescription();
            this.graphRenderer.updateSettings({ statsTestName: testName, showStatsLegend: false, statsLegendExtended: false });
            Object.assign(this.growthRenderer.settings, { statsTestName: testName, showStatsLegend: false, statsLegendExtended: false });
            document.getElementById('statsLegendMode').value = 'none';
            this._showStatsResult(html);
            this._bindMarkerToggles(colLabels, numGroups);
            this.graphRenderer.setSignificance(pairs);
            this.updateGraph();
        } else if (groups.uniqueGroups.length > 2) {
            // Auto-run ANOVA per marker with Tukey post-hoc
            const data = this.dataTable.getData();
            const numGroups = groups.uniqueGroups.length;
            const allPairs = [];
            const testName = 'One-way ANOVA';
            let html = `<div class="result-item"><span class="result-label">Test:</span> <span class="result-value">${testName} + Tukey HSD — per marker</span></div>`;
            html += `<div class="result-item"><span class="result-label">Groups:</span> <span class="result-value">${groups.uniqueGroups.join(', ')}</span></div>`;
            html += `<div style="margin:4px 0"><button class="btn btn-secondary marker-toggle-all" style="padding:1px 6px;font-size:10px">All</button> <button class="btn btn-secondary marker-toggle-none" style="padding:1px 6px;font-size:10px">None</button></div>`;
            html += `<hr style="margin:4px 0;border-color:#eee">`;

            for (let mi = 0; mi < colLabels.length; mi++) {
                const groupValues = [];
                const groupLabelsArr = [];
                for (let gi = 0; gi < numGroups; gi++) {
                    const idx = mi * numGroups + gi;
                    if (idx >= data.length) continue;
                    const vals = data[idx].values;
                    if (vals.length < 2) continue;
                    groupValues.push(vals);
                    groupLabelsArr.push(groups.uniqueGroups[gi]);
                }
                if (groupValues.length < 3) continue;

                try {
                    const result = Statistics.oneWayAnova(groupValues);
                    const pFormatted = Statistics.formatPValue(result.p);
                    const sigLevel = Statistics.getSignificanceLevel(result.p);
                    const isSignificant = result.p < 0.05;

                    html += `<div class="result-item marker-row" data-marker="${colLabels[mi]}" style="cursor:pointer;margin-top:8px" title="Click to toggle visibility"><span class="result-value"><b>${colLabels[mi]}:</b> F=${result.F.toFixed(2)}, ${pFormatted} <span class="${isSignificant ? 'significant' : 'not-significant'}">${sigLevel}</span></span></div>`;

                    if (isSignificant) {
                        const postHoc = Statistics.tukeyHSDPostHoc(groupValues, groupLabelsArr);
                        postHoc.forEach(ph => {
                            if (ph.significant) {
                                const g1Idx = mi * numGroups + groups.uniqueGroups.indexOf(ph.group1Label);
                                const g2Idx = mi * numGroups + groups.uniqueGroups.indexOf(ph.group2Label);
                                allPairs.push({
                                    group1Index: g1Idx,
                                    group2Index: g2Idx,
                                    pValue: ph.correctedP,
                                    significanceLabel: ph.significanceLabel
                                });
                            }
                        });
                        const sigPairs = postHoc.filter(ph => ph.significant);
                        if (sigPairs.length > 0) {
                            html += `<div style="font-size:11px;color:#666;margin-left:16px;margin-bottom:4px">`;
                            sigPairs.forEach(ph => {
                                html += `${ph.group1Label} vs ${ph.group2Label}: ${Statistics.formatPValue(ph.correctedP)} ${ph.significanceLabel}<br>`;
                            });
                            html += `</div>`;
                        }
                    }
                } catch (e) {
                    html += `<div class="result-item marker-row" data-marker="${colLabels[mi]}" style="cursor:pointer;margin-top:8px" title="Click to toggle visibility"><span class="result-value"><b>${colLabels[mi]}:</b> Error — ${e.message}</span></div>`;
                }
            }

            document.getElementById('testType').value = 'one-way-anova';
            document.getElementById('postHocGroup').style.display = '';
            document.getElementById('postHocMethod').value = 'tukey';
            this._updateTestDescription();
            this.graphRenderer.updateSettings({ statsTestName: testName + ' + Tukey HSD', showStatsLegend: false, statsLegendExtended: false });
            this.growthRenderer.settings.statsTestName = testName + ' + Tukey HSD';
            document.getElementById('statsLegendMode').value = 'none';
            this._showStatsResult(html);
            this._bindMarkerToggles(colLabels, numGroups);
            this.graphRenderer.setSignificance(allPairs);
            this.updateGraph();
        }
    }

    _bindMarkerToggles(colLabels, numGroups) {
        const container = document.getElementById('statsResults');
        if (!container) return;
        const settings = this.graphRenderer.settings;
        const data = this.dataTable.getData();

        // Build map: marker name -> array of group labels
        const markerGroups = {};
        colLabels.forEach(marker => {
            markerGroups[marker] = [];
            for (let gi = 0; gi < numGroups; gi++) {
                const idx = colLabels.indexOf(marker) * numGroups + gi;
                if (idx < data.length) markerGroups[marker].push(data[idx].label);
            }
        });

        // Click individual marker rows to toggle
        container.querySelectorAll('.marker-row').forEach(row => {
            row.addEventListener('click', () => {
                const marker = row.dataset.marker;
                const labels = markerGroups[marker] || [];
                const allHidden = labels.every(l => settings.hiddenGroups.includes(l));
                if (allHidden) {
                    settings.hiddenGroups = settings.hiddenGroups.filter(l => !labels.includes(l));
                    row.style.opacity = '';
                } else {
                    labels.forEach(l => { if (!settings.hiddenGroups.includes(l)) settings.hiddenGroups.push(l); });
                    row.style.opacity = '0.4';
                }
                this.updateGraph();
            });
        });

        // All/None buttons
        const allBtn = container.querySelector('.marker-toggle-all');
        const noneBtn = container.querySelector('.marker-toggle-none');
        if (allBtn) allBtn.addEventListener('click', () => {
            settings.hiddenGroups = [];
            container.querySelectorAll('.marker-row').forEach(r => r.style.opacity = '');
            this.updateGraph();
        });
        if (noneBtn) noneBtn.addEventListener('click', () => {
            const allLabels = data.filter(d => d.values.length > 0).map(d => d.label);
            settings.hiddenGroups = allLabels;
            container.querySelectorAll('.marker-row').forEach(r => r.style.opacity = '0.4');
            this.updateGraph();
        });
    }

    // --- Text Settings Panel ---

    _bindTextSettingsPanel() {
        const btn = document.getElementById('textSettingsBtn');
        const closeBtn = document.getElementById('textSettingsClose');
        if (btn) btn.addEventListener('click', () => this._toggleTextSettingsPanel());
        if (closeBtn) closeBtn.addEventListener('click', () => this._closeTextSettingsPanel());
        this._makeTextSettingsDraggable();
    }

    _makeTextSettingsDraggable() {
        const panel = document.getElementById('textSettingsPanel');
        const handle = document.getElementById('textSettingsDragHandle');
        if (!panel || !handle) return;
        let offsetX, offsetY;
        handle.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            e.preventDefault();
            const rect = panel.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            const onMove = (ev) => {
                panel.style.left = (ev.clientX - offsetX) + 'px';
                panel.style.top = (ev.clientY - offsetY) + 'px';
                panel.style.right = 'auto';
            };
            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    _toggleTextSettingsPanel() {
        const panel = document.getElementById('textSettingsPanel');
        if (!panel) return;
        const btn = document.getElementById('textSettingsBtn');
        if (panel.style.display === 'none') {
            this._openTextSettingsPanel();
            if (btn) btn.classList.add('active');
        } else {
            this._closeTextSettingsPanel();
        }
    }

    _closeTextSettingsPanel() {
        const panel = document.getElementById('textSettingsPanel');
        if (panel) panel.style.display = 'none';
        const btn = document.getElementById('textSettingsBtn');
        if (btn) btn.classList.remove('active');
        if (this._textSettingsOutsideHandler) {
            document.removeEventListener('mousedown', this._textSettingsOutsideHandler);
            this._textSettingsOutsideHandler = null;
        }
    }

    _getActiveRenderer() {
        if (this.mode === 'column') return this.graphRenderer;
        if (this.mode === 'growth') return this.growthRenderer;
        if (this.mode === 'volcano') return this.volcanoRenderer;
        return this.heatmapRenderer;
    }

    _getTextSettingsRenderer() {
        return this._getActiveRenderer();
    }

    _openTextSettingsPanel() {
        const panel = document.getElementById('textSettingsPanel');
        const body = document.getElementById('textSettingsBody');
        if (!panel || !body) return;

        // Position near the toolbar, clamped to viewport
        if (!this._textSettingsPlaced || panel.style.display === 'none') {
            const toolbar = document.getElementById('drawingToolbar');
            if (toolbar) {
                const rect = toolbar.getBoundingClientRect();
                let top = rect.bottom + 4;
                let left = rect.left;
                // Clamp so panel fits in viewport
                const maxTop = window.innerHeight - Math.min(500, window.innerHeight * 0.8);
                if (top > maxTop) top = Math.max(10, maxTop);
                if (left + 360 > window.innerWidth) left = window.innerWidth - 370;
                panel.style.left = left + 'px';
                panel.style.top = top + 'px';
                panel.style.right = 'auto';
                this._textSettingsPlaced = true;
            }
        }
        panel.style.display = '';
        this._buildTextSettingsRows();

        // Close on outside click
        if (this._textSettingsOutsideHandler) {
            document.removeEventListener('mousedown', this._textSettingsOutsideHandler);
        }
        this._textSettingsOutsideHandler = (e) => {
            const btn = document.getElementById('textSettingsBtn');
            if (!panel.contains(e.target) && (!btn || !btn.contains(e.target))) {
                this._closeTextSettingsPanel();
                document.removeEventListener('mousedown', this._textSettingsOutsideHandler);
                this._textSettingsOutsideHandler = null;
            }
        };
        setTimeout(() => {
            document.addEventListener('mousedown', this._textSettingsOutsideHandler);
        }, 100);
    }

    _buildTextSettingsRows() {
        const body = document.getElementById('textSettingsBody');
        if (!body) return;
        body.innerHTML = '';

        const renderer = this._getTextSettingsRenderer();
        const s = renderer.settings;
        const families = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New'];

        // Define elements per mode
        let elements;
        if (this.mode === 'column') {
            elements = [
                { label: 'Title', textKey: 'title', fontKey: 'titleFont', visKey: 'showTitle' },
                { label: 'X Axis Label', textKey: 'xLabel', fontKey: 'xLabelFont', visKey: 'showXLabel' },
                { label: 'Y Axis Label', textKey: 'yLabel', fontKey: 'yLabelFont', visKey: 'showYLabel' },
                { label: 'X Tick Font (group names)', fontKey: 'xTickFont' },
                { label: 'Y Tick Font', fontKey: 'yTickFont', tickStep: 'yAxisTickStep' },
                { label: 'Group Legend', fontKey: 'groupLegendFont', visKey: 'showGroupLegend' },
                { label: 'Zero Line', visKey: 'showZeroLine' }
            ];
            this._columnGroupRows = true;
        } else if (this.mode === 'growth') {
            elements = [
                { label: 'Title', textKey: 'title', fontKey: 'titleFont', visKey: 'showTitle' },
                { label: 'X Axis Label', textKey: 'xLabel', fontKey: 'xLabelFont', visKey: 'showXLabel' },
                { label: 'Y Axis Label', textKey: 'yLabel', fontKey: 'yLabelFont', visKey: 'showYLabel' },
                { label: 'Legend', fontKey: 'legendFont', visKey: 'showLegend' },
                { label: 'X Tick Font', fontKey: 'xTickFont', tickStep: 'xTickStep' },
                { label: 'Y Tick Font', fontKey: 'yTickFont', tickStep: 'yTickStep' }
            ];
            // Add per-group rows for color/symbol
            this._growthGroupRows = true;
        } else if (this.mode === 'volcano') {
            elements = [
                { label: 'Title', textKey: 'title', fontKey: 'titleFont', visKey: 'showTitle' },
                { label: 'X Axis Label', textKey: 'xLabel', fontKey: 'xLabelFont', visKey: 'showXLabel' },
                { label: 'Y Axis Label', textKey: 'yLabel', fontKey: 'yLabelFont', visKey: 'showYLabel' },
                { label: 'Legend', fontKey: 'legendFont', visKey: 'showLegend' },
                { label: 'X Tick Font', fontKey: 'xTickFont' },
                { label: 'Y Tick Font', fontKey: 'yTickFont' },
                { label: 'Gene Labels', fontKey: 'labelFont' }
            ];
        } else {
            elements = [
                { label: 'Title', textKey: 'title', fontKey: 'titleFont', visKey: 'showTitle' },
                { label: 'Legend Title', textKey: 'legendTitle', fontKey: 'legendTitleFont', visKey: 'showLegendTitle' },
                { label: 'Row Labels', fontKey: 'rowLabelFont', visKey: 'showRowLabels' },
                { label: 'Column Labels', fontKey: 'colLabelFont', visKey: 'showColLabels' },
                { label: 'Group Labels', fontKey: 'groupLabelFont', visKey: 'showGroupLabels' },
                { label: 'Color Legend', visKey: 'showColorLegend' },
                { label: 'Dendrograms', visKey: 'showDendrograms' }
            ];
        }

        elements.forEach(el => {
            const row = document.createElement('div');
            row.className = 'text-settings-row';

            const sectionLabel = document.createElement('label');
            sectionLabel.className = 'ts-label';
            sectionLabel.textContent = el.label;
            row.appendChild(sectionLabel);

            // Get font directly from settings each time (not cached)
            const getFont = () => s[el.fontKey];
            const font = getFont();
            if (!font) { body.appendChild(row); return; }

            // Visibility + text row
            if (el.visKey !== undefined || el.textKey) {
                const inputRow = document.createElement('div');
                inputRow.style.cssText = 'display:flex;align-items:center;gap:4px;grid-column:1/-1';

                if (el.visKey) {
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.checked = s[el.visKey] !== false;
                    cb.title = 'Show/hide';
                    cb.addEventListener('change', () => { s[el.visKey] = cb.checked; this.updateGraph(); });
                    inputRow.appendChild(cb);
                }

                if (el.textKey) {
                    const inp = document.createElement('input');
                    inp.type = 'text';
                    inp.value = s[el.textKey] || '';
                    inp.style.cssText = 'flex:1;padding:3px 6px;border:1px solid #e5e7eb;border-radius:4px;font-size:12px';
                    inp.addEventListener('input', () => {
                        s[el.textKey] = inp.value;
                        const syncMap = { title: 'graphTitle', xLabel: 'xAxisLabel', yLabel: 'yAxisLabel' };
                        if (syncMap[el.textKey]) { const h = document.getElementById(syncMap[el.textKey]); if (h) h.value = inp.value; }
                        this.updateGraph();
                    });
                    inputRow.appendChild(inp);
                }
                row.appendChild(inputRow);
            }

            // Font controls
            const fc = document.createElement('div');
            fc.className = 'ts-font-controls';

            const famSel = document.createElement('select');
            families.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f; opt.textContent = f;
                if (f === font.family) opt.selected = true;
                famSel.appendChild(opt);
            });
            famSel.addEventListener('change', () => { getFont().family = famSel.value; this.updateGraph(); });
            fc.appendChild(famSel);

            const sizeInp = document.createElement('input');
            sizeInp.type = 'number'; sizeInp.min = 6; sizeInp.max = 48;
            sizeInp.value = font.size || '';
            sizeInp.placeholder = 'Auto';
            sizeInp.addEventListener('input', () => {
                const v = sizeInp.value.trim();
                getFont().size = v === '' ? null : (parseInt(v) || null);
                this.updateGraph();
            });
            fc.appendChild(sizeInp);

            const boldBtn = document.createElement('button');
            boldBtn.className = 'svg-edit-btn' + (font.bold ? ' active' : '');
            boldBtn.innerHTML = '<b>B</b>';
            boldBtn.addEventListener('click', () => {
                const f = getFont(); f.bold = !f.bold;
                boldBtn.classList.toggle('active'); this.updateGraph();
            });
            fc.appendChild(boldBtn);

            const italicBtn = document.createElement('button');
            italicBtn.className = 'svg-edit-btn' + (font.italic ? ' active' : '');
            italicBtn.innerHTML = '<i>I</i>';
            italicBtn.addEventListener('click', () => {
                const f = getFont(); f.italic = !f.italic;
                italicBtn.classList.toggle('active'); this.updateGraph();
            });
            fc.appendChild(italicBtn);

            // Tick step control
            if (el.tickStep) {
                const stepLabel = document.createElement('span');
                stepLabel.textContent = 'every';
                stepLabel.style.cssText = 'font-size:10px;color:#6b7280;margin-left:4px';
                fc.appendChild(stepLabel);
                const stepInp = document.createElement('input');
                stepInp.type = 'number'; stepInp.min = 0; stepInp.step = 'any';
                stepInp.placeholder = 'Auto';
                stepInp.style.cssText = 'width:50px;text-align:center';
                stepInp.value = s[el.tickStep] || '';
                stepInp.title = 'Tick interval (leave empty for auto)';
                stepInp.addEventListener('input', () => {
                    const v = stepInp.value.trim();
                    s[el.tickStep] = v === '' ? null : parseFloat(v);
                    this.updateGraph();
                });
                fc.appendChild(stepInp);
            }

            row.appendChild(fc);
            body.appendChild(row);
        });

        // Per-group color/symbol for column mode
        if (this._columnGroupRows) {
            this._columnGroupRows = false;
            const data = this.dataTable.getData();
            const filled = data.filter(d => d.values.length > 0);
            if (filled.length > 0) {
                const sep = document.createElement('div');
                sep.style.cssText = 'grid-column:1/-1;border-top:1px solid #e5e7eb;margin:6px 0 2px;font-size:11px;font-weight:600;color:#374151;padding-top:4px';
                sep.textContent = 'Group Colors & Symbols';
                body.appendChild(sep);

                const gr = this.graphRenderer;
                const symbols = ['circle','square','triangle','diamond','cross'];

                filled.forEach((group, gi) => {
                    const origIdx = data.indexOf(group);
                    const grow = document.createElement('div');
                    grow.className = 'text-settings-row';
                    grow.style.cssText = 'display:flex;align-items:center;gap:4px;padding:2px 0';

                    // Color picker
                    const colorInp = document.createElement('input');
                    colorInp.type = 'color';
                    colorInp.value = gr._getColor(origIdx);
                    colorInp.style.cssText = 'width:24px;height:20px;border:1px solid #ccc;border-radius:3px;cursor:pointer;padding:0;flex:0 0 24px';
                    colorInp.addEventListener('input', () => {
                        gr.settings.colorOverrides[origIdx] = colorInp.value;
                        this.updateGraph();
                    });
                    grow.appendChild(colorInp);

                    // Symbol select (per-group override)
                    const symSel = document.createElement('select');
                    symSel.style.cssText = 'font-size:10px;padding:1px 2px;border:1px solid #ccc;border-radius:3px;flex:0 0 auto;width:58px';
                    if (!gr.settings.symbolOverrides) gr.settings.symbolOverrides = {};
                    const curSym = gr.settings.symbolOverrides[origIdx] || gr.settings.pointShape || 'circle';
                    symbols.forEach(sym => {
                        const opt = document.createElement('option');
                        opt.value = sym;
                        opt.textContent = sym.charAt(0).toUpperCase() + sym.slice(1);
                        if (sym === curSym) opt.selected = true;
                        symSel.appendChild(opt);
                    });
                    symSel.addEventListener('change', () => {
                        if (!gr.settings.symbolOverrides) gr.settings.symbolOverrides = {};
                        gr.settings.symbolOverrides[origIdx] = symSel.value;
                        this.updateGraph();
                    });
                    grow.appendChild(symSel);

                    // Size input (per-group point size override)
                    const sizeInp = document.createElement('input');
                    sizeInp.type = 'number';
                    if (!gr.settings.sizeOverrides) gr.settings.sizeOverrides = {};
                    sizeInp.value = gr.settings.sizeOverrides[origIdx] || gr.settings.pointSize || 6;
                    sizeInp.min = 1; sizeInp.max = 30; sizeInp.step = 1;
                    sizeInp.style.cssText = 'width:38px;font-size:10px;padding:1px 2px;border:1px solid #ccc;border-radius:3px;text-align:center;flex:0 0 38px';
                    sizeInp.title = 'Point size';
                    sizeInp.addEventListener('input', () => {
                        if (!gr.settings.sizeOverrides) gr.settings.sizeOverrides = {};
                        gr.settings.sizeOverrides[origIdx] = parseFloat(sizeInp.value) || gr.settings.pointSize;
                        this.updateGraph();
                    });
                    grow.appendChild(sizeInp);

                    // Label input
                    const labelInp = document.createElement('input');
                    labelInp.type = 'text';
                    labelInp.value = gr.settings.groupLegendLabels[origIdx] || group.label;
                    labelInp.placeholder = group.label;
                    labelInp.style.cssText = 'flex:1;min-width:50px;padding:2px 4px;font-size:11px;border:1px solid #e5e7eb;border-radius:3px';
                    labelInp.addEventListener('input', () => {
                        const val = labelInp.value.trim();
                        if (val && val !== group.label) gr.settings.groupLegendLabels[origIdx] = val;
                        else delete gr.settings.groupLegendLabels[origIdx];
                        this.updateGraph();
                    });
                    grow.appendChild(labelInp);

                    body.appendChild(grow);
                });
            }
        }

        // Per-group color/symbol for growth mode
        if (this._growthGroupRows) {
            this._growthGroupRows = false;
            const growthData = this.dataTable.getGrowthData();
            if (growthData && growthData.groups && growthData.groups.length > 0) {
                const sep = document.createElement('div');
                sep.style.cssText = 'grid-column:1/-1;border-top:1px solid #e5e7eb;margin:6px 0 2px;font-size:11px;font-weight:600;color:#374151;padding-top:4px';
                sep.textContent = 'Group Colors & Symbols';
                body.appendChild(sep);

                const gr = this.growthRenderer;
                if (!gr.settings.groupOverrides) gr.settings.groupOverrides = {};
                const symbols = ['circle','square','triangle','diamond','cross','star'];

                growthData.groups.forEach((gName, gi) => {
                    const ov = gr.settings.groupOverrides[gName] || {};
                    const grow = document.createElement('div');
                    grow.className = 'text-settings-row';
                    grow.style.cssText = 'display:flex;align-items:center;gap:4px;padding:2px 0';

                    // Color picker
                    const colorInp = document.createElement('input');
                    colorInp.type = 'color';
                    colorInp.value = ov.color || gr._getColor(gi);
                    colorInp.style.cssText = 'width:24px;height:20px;border:1px solid #ccc;border-radius:3px;cursor:pointer;padding:0;flex:0 0 24px';
                    colorInp.addEventListener('input', () => {
                        if (!gr.settings.groupOverrides[gName]) gr.settings.groupOverrides[gName] = {};
                        gr.settings.groupOverrides[gName].color = colorInp.value;
                        this.updateGraph();
                    });
                    grow.appendChild(colorInp);

                    // Symbol select
                    const symSel = document.createElement('select');
                    symSel.style.cssText = 'font-size:10px;padding:1px 2px;border:1px solid #ccc;border-radius:3px;flex:0 0 auto;width:58px';
                    const curSym = ov.symbol || gr._getSymbolForGroup(gi, gName);
                    symbols.forEach(sym => {
                        const opt = document.createElement('option');
                        opt.value = sym;
                        opt.textContent = sym.charAt(0).toUpperCase() + sym.slice(1);
                        if (sym === curSym) opt.selected = true;
                        symSel.appendChild(opt);
                    });
                    symSel.addEventListener('change', () => {
                        if (!gr.settings.groupOverrides[gName]) gr.settings.groupOverrides[gName] = {};
                        gr.settings.groupOverrides[gName].symbol = symSel.value;
                        this.updateGraph();
                    });
                    grow.appendChild(symSel);

                    // Line dash select
                    const dashSel = document.createElement('select');
                    dashSel.style.cssText = 'font-size:10px;padding:1px 2px;border:1px solid #ccc;border-radius:3px;flex:0 0 auto;width:68px';
                    const curDash = ov.lineDash || 'solid';
                    [['solid','Solid'],['dashed','Dashed'],['dotted','Dotted'],['dashdot','Dash-dot'],['longdash','Long dash']].forEach(([val,txt]) => {
                        const opt = document.createElement('option');
                        opt.value = val; opt.textContent = txt;
                        if (val === curDash) opt.selected = true;
                        dashSel.appendChild(opt);
                    });
                    dashSel.addEventListener('change', () => {
                        if (!gr.settings.groupOverrides[gName]) gr.settings.groupOverrides[gName] = {};
                        gr.settings.groupOverrides[gName].lineDash = dashSel.value;
                        this.updateGraph();
                    });
                    grow.appendChild(dashSel);

                    // Label input
                    const labelInp = document.createElement('input');
                    labelInp.type = 'text';
                    labelInp.value = ov.label || gName;
                    labelInp.placeholder = gName;
                    labelInp.style.cssText = 'flex:1;min-width:50px;padding:2px 4px;font-size:11px;border:1px solid #e5e7eb;border-radius:3px';
                    labelInp.addEventListener('input', () => {
                        if (!gr.settings.groupOverrides[gName]) gr.settings.groupOverrides[gName] = {};
                        const val = labelInp.value.trim();
                        if (val && val !== gName) gr.settings.groupOverrides[gName].label = val;
                        else delete gr.settings.groupOverrides[gName].label;
                        this.updateGraph();
                    });
                    grow.appendChild(labelInp);

                    body.appendChild(grow);
                });
            }
        }
    }

    _getHeatmapSettings() {
        return {
            cluster: document.getElementById('heatmapCluster')?.value || 'none',
            linkage: document.getElementById('heatmapLinkage')?.value || 'average',
            normalize: document.getElementById('heatmapNormalize')?.value || 'none',
            normMethod: document.getElementById('heatmapNormMethod')?.value || 'zscore',
            winsorize: document.getElementById('heatmapWinsorize')?.value || 'none',
            colorScheme: document.getElementById('heatmapColorScheme')?.value || 'Viridis',
            showValues: document.getElementById('heatmapShowValues')?.checked || false,
            showGroupBar: document.getElementById('heatmapShowGroupBar')?.checked || false,
            showInfo: document.getElementById('heatmapShowInfo')?.checked ?? false,
            legendTitle: this.heatmapRenderer.settings.legendTitle,
            groupColorOverrides: this.heatmapRenderer.settings.groupColorOverrides || {},
            title: this.heatmapRenderer.settings.title || 'Heatmap',
            clusterFlipRows: document.getElementById('heatmapClusterFlipRows')?.value || 'none',
            clusterFlipCols: document.getElementById('heatmapClusterFlipCols')?.value || 'none',
            colLabelAngle: parseInt(document.getElementById('heatmapColLabelAngle')?.value ?? 45),
            groupColorTheme: document.getElementById('heatmapGroupColorTheme')?.value || 'default',
            groupLabelItemOffsets: this.heatmapRenderer.settings.groupLabelItemOffsets || {},
            colLabelOverrides: this.heatmapRenderer.settings.colLabelOverrides || {},
            rowLabelOverrides: this.heatmapRenderer.settings.rowLabelOverrides || {},
            outlierMode: document.getElementById('heatmapOutlierMode')?.value || 'none',
            legendBarWidth: parseInt(document.getElementById('heatmapLegendWidth')?.value) || null
        };
    }

    _getGrowthSettings() {
        const parseOpt = id => { const v = document.getElementById(id)?.value?.trim(); return v ? parseFloat(v) : null; };
        return {
            width: parseInt(document.getElementById('growthWidth')?.value) || 400,
            height: parseInt(document.getElementById('growthHeight')?.value) || 300,
            xAxisMin: parseOpt('growthXMin'),
            xAxisMax: parseOpt('growthXMax'),
            yAxisMin: parseOpt('growthYMin'),
            yAxisMax: parseOpt('growthYMax'),
            xTickStep: parseOpt('growthXTickStep'),
            yTickStep: parseOpt('growthYTickStep'),
            colorTheme: document.getElementById('growthColorTheme')?.value || 'default',
            errorType: document.getElementById('growthErrorType')?.value || 'sem',
            errorStyle: document.getElementById('growthErrorStyle')?.value || 'bars',
            errorDir: document.getElementById('growthErrorDir')?.value || 'both',
            symbolSize: parseFloat(document.getElementById('growthSymbolSize')?.value) || 4,
            meanLineWidth: parseFloat(document.getElementById('growthMeanLineWidth')?.value) || 2.5,
            capWidth: parseFloat(document.getElementById('growthCapWidth')?.value) || 6,
            showIndividualLines: document.getElementById('growthShowIndividual')?.checked ?? true,
            showGroupMeans: document.getElementById('growthShowMean')?.checked ?? true,
            showZeroLine: document.getElementById('growthShowZeroLine')?.checked ?? false
        };
    }

    _getVolcanoSettings() {
        return {
            width: parseInt(document.getElementById('volcanoWidth')?.value) || 450,
            height: parseInt(document.getElementById('volcanoHeight')?.value) || 400,
            pValueThreshold: parseFloat(document.getElementById('volcanoPThresh')?.value) || 0.05,
            fcThreshold: parseFloat(document.getElementById('volcanoFCThresh')?.value) || 1.0,
            pointSize: parseFloat(document.getElementById('volcanoPointSize')?.value) || 4,
            showTopLabels: parseInt(document.getElementById('volcanoTopLabels')?.value) ?? 10,
            labelSize: parseInt(document.getElementById('volcanoLabelSize')?.value) || 10,
            upColor: document.getElementById('volcanoUpColor')?.value || '#E63946',
            downColor: document.getElementById('volcanoDownColor')?.value || '#457B9D'
        };
    }

    _bindVolcanoControls() {
        const ids = ['volcanoWidth', 'volcanoHeight', 'volcanoPThresh', 'volcanoFCThresh', 'volcanoPointSize', 'volcanoTopLabels', 'volcanoLabelSize', 'volcanoUpColor', 'volcanoDownColor'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.updateGraph());
        });
    }

    _updateHeatmapInfo(settings, el) {
        if (!el) return;
        if (!settings.showInfo) {
            el.style.display = 'none';
            return;
        }
        el.style.display = '';

        const clusterLabels = { none: 'None', rows: 'Rows', cols: 'Columns', both: 'Both' };
        const linkageLabels = { average: 'Average (UPGMA)', complete: 'Complete', single: 'Single' };
        const normalizeLabels = { none: 'None', all: 'Whole dataset', row: 'Per row', col: 'Per column' };
        const methodLabels = { zscore: 'Mean / SD (z-score)', robust: 'Median / MAD (robust)' };
        const winsorizeLabels = { none: 'None', '5': '5th\u201395th percentile', '2.5': '2.5th\u201397.5th percentile', '1': '1st\u201399th percentile' };
        const colorLabels = { RdBu: 'Red\u2013Blue', RdYlGn: 'Red\u2013Yellow\u2013Green', Viridis: 'Viridis', YlOrRd: 'Yellow\u2013Red', BuPu: 'Blue\u2013Purple', Inferno: 'Inferno', Plasma: 'Plasma', Cividis: 'Cividis', PuOr: 'Purple\u2013Orange', BrBG: 'Brown\u2013Blue\u2013Green', PiYG: 'Pink\u2013Yellow\u2013Green', Cool: 'Cool', Warm: 'Warm', GnBu: 'Green\u2013Blue', YlGn: 'Yellow\u2013Green', Greens: 'Greens' };

        const isRobust = settings.normMethod === 'robust';
        const centerWord = isRobust ? 'median' : 'mean';
        const spreadWord = isRobust ? 'MAD (median absolute deviation \u00d7 1.4826)' : 'standard deviation';

        const normalizeExplanations = {
            none: 'Raw values are used directly. Colors reflect the original data scale from minimum to maximum. No transformation is applied.',
            all: `Normalized across the entire dataset: (value \u2212 global ${centerWord}) / global ${spreadWord}. A score of 0 = the overall ${centerWord}. This preserves relative differences between both rows and columns while putting everything on a standard scale.`,
            row: `Normalized per row: (value \u2212 row ${centerWord}) / row ${spreadWord}. Each row is independently scaled. This highlights which columns are relatively high or low within each row, but erases differences in overall row magnitude.`,
            col: `Normalized per column: (value \u2212 column ${centerWord}) / column ${spreadWord}. Each column is independently scaled. This highlights which rows are relatively high or low within each column, but erases differences in overall column magnitude.`
        };

        let html = '<h4>Heatmap Settings</h4>';
        html += `<div class="info-row"><span class="info-label">Clustering:</span><span>${clusterLabels[settings.cluster] || 'None'}`;
        if (settings.cluster !== 'none') {
            html += ` (${linkageLabels[settings.linkage] || settings.linkage} linkage, Euclidean distance)`;
        }
        html += '</span></div>';
        html += `<div class="info-row"><span class="info-label">Normalization:</span><span>${normalizeLabels[settings.normalize] || 'None'}</span></div>`;
        if (settings.normalize !== 'none') {
            html += `<div class="info-row"><span class="info-label">Method:</span><span>${methodLabels[settings.normMethod] || settings.normMethod}</span></div>`;
        }
        if (settings.winsorize !== 'none') {
            html += `<div class="info-row"><span class="info-label">Winsorization:</span><span>${winsorizeLabels[settings.winsorize]} \u2014 extreme values are capped at these percentiles to reduce outlier influence on the color scale</span></div>`;
        }
        html += `<div class="info-row"><span class="info-label">Color scheme:</span><span>${colorLabels[settings.colorScheme] || settings.colorScheme}</span></div>`;
        if (settings.outlierMode && settings.outlierMode !== 'none') {
            const modeLabel = settings.outlierMode === 'col' ? 'per column' : 'per row';
            html += `<div class="info-row"><span class="info-label">Outlier detection:</span><span>IQR method (${modeLabel}) \u2014 values below Q1 \u2212 1.5\u00d7IQR or above Q3 + 1.5\u00d7IQR are flagged. Based on Tukey\u2019s fences, a standard non-parametric approach that identifies values in the outer tails of the distribution without assuming normality.</span></div>`;
        }
        html += `<div class="info-explain">${normalizeExplanations[settings.normalize] || ''}</div>`;

        el.innerHTML = html;
    }

    // --- Undo ---

    get annotationManager() {
        return this.mode === 'heatmap' ? this.heatmapAnnotationManager : this.columnAnnotationManager;
    }

    saveUndoState() {
        const mgr = this.annotationManager;
        const snapshot = {
            mode: this.mode,
            annotations: JSON.parse(JSON.stringify(mgr.annotations)),
            settings: JSON.parse(JSON.stringify(this.graphRenderer.settings)),
            significance: JSON.parse(JSON.stringify(this.graphRenderer.significanceResults || []))
        };
        this._undoStack.push(snapshot);
        if (this._undoStack.length > 50) this._undoStack.shift();
    }

    undo() {
        if (this._undoStack.length === 0) return;
        const snapshot = this._undoStack.pop();
        const mgr = snapshot.mode === 'heatmap' ? this.heatmapAnnotationManager : this.columnAnnotationManager;
        mgr.annotations = snapshot.annotations;
        mgr.selectedIndex = -1;
        mgr._selectedBracketIdx = -1;
        // Restore settings (merge into existing object to keep references)
        Object.assign(this.graphRenderer.settings, snapshot.settings);
        this.graphRenderer.significanceResults = snapshot.significance;
        this.updateGraph();
    }

    // --- Core methods ---

    _autoSizeDimensions(data) {
        if (this.mode === 'heatmap') {
            const nCols = (data.colLabels || []).length;
            const nRows = (data.matrix || []).length;
            if (nCols === 0 || nRows === 0) return;
            const key = `hm_${nCols}_${nRows}`;
            if (this._lastAutoSizeKey === key) return;
            this._lastAutoSizeKey = key;
            const w = Math.max(200, Math.min(800, nCols * 30));
            const h = Math.max(200, Math.min(800, nRows * 25));
            const wEl = document.getElementById('heatmapWidth');
            const hEl = document.getElementById('heatmapHeight');
            if (wEl) wEl.value = w;
            if (hEl) hEl.value = h;
        } else {
            const filled = Array.isArray(data) ? data.filter(d => d.values && d.values.length > 0) : [];
            const nGroups = filled.length;
            if (nGroups === 0) return;
            const key = `col_${nGroups}`;
            if (this._lastAutoSizeKey === key) return;
            this._lastAutoSizeKey = key;
            const w = Math.max(150, Math.min(800, nGroups * 60));
            const h = 200;
            const wEl = document.getElementById('graphWidth');
            const hEl = document.getElementById('graphHeight');
            if (wEl) { wEl.value = w; this.graphRenderer.setDimensions(w, this.graphRenderer.height); }
            if (hEl) { hEl.value = h; this.graphRenderer.setDimensions(this.graphRenderer.width, h); }
        }
    }

    updateGraph() {
        const infoEl = document.getElementById('heatmapInfo');
        if (this.mode === 'heatmap') {
            const matrixData = this.dataTable.getMatrixData();
            this._autoSizeDimensions(matrixData);
            const settings = this._getHeatmapSettings();
            settings.showInfoBox = document.getElementById('heatmapShowInfo')?.checked || false;
            this.heatmapRenderer.render(matrixData, settings);
            this._updateHeatmapInfo(settings, infoEl);
            this._updateHeatmapColManager(matrixData);
            // Draw annotations from the heatmap annotation manager
            const heatSvg = d3.select(this.heatmapRenderer.container.querySelector('svg'));
            if (!heatSvg.empty()) {
                this.heatmapAnnotationManager.drawAnnotations(heatSvg, { top: 0, left: 0, right: 0, bottom: 0 });
            }
            return;
        }
        if (this.mode === 'growth') {
            if (infoEl) infoEl.style.display = 'none';
            const growthData = this.dataTable.getGrowthData();
            const growthSettings = this._getGrowthSettings();
            this.growthRenderer.render(growthData, growthSettings);
            return;
        }
        if (this.mode === 'volcano') {
            if (infoEl) infoEl.style.display = 'none';
            const volcanoData = this.dataTable.getVolcanoData();
            const volcanoSettings = this._getVolcanoSettings();
            this.volcanoRenderer.render(volcanoData, volcanoSettings);
            return;
        }
        if (infoEl) infoEl.style.display = 'none';

        const data = this.dataTable.getData();
        this._autoSizeDimensions(data);
        this.graphRenderer.render(data);

        // Sync X-angle dropdown to show effective angle when auto-forced
        const xAngleSel = document.getElementById('xTickAngle');
        if (xAngleSel) {
            const opt0 = xAngleSel.querySelector('option[value="0"]');
            if (opt0) opt0.textContent = this.graphRenderer._autoAngled ? '0° (auto→45°)' : '0°';
        }

        this._updateManualColorSwatches(data);
        this._updateGroupManager(data);
        // Sync label visibility checkboxes
        const s = this.graphRenderer.settings;
        const titleCb = document.getElementById('showTitle');
        const xCb = document.getElementById('showXLabel');
        const yCb = document.getElementById('showYLabel');
        if (titleCb) titleCb.checked = s.showTitle;
        if (xCb) xCb.checked = s.showXLabel;
        if (yCb) yCb.checked = s.showYLabel;
    }

    _updateManualColorSwatches(data) {
        const container = document.getElementById('manualColorSwatches');
        if (!container) return;
        const filled = data.filter(d => d.values.length > 0);
        // Rebuild only if count changed
        if (container.childElementCount !== filled.length) {
            container.innerHTML = '';
            filled.forEach((group, i) => {
                const swatch = document.createElement('input');
                swatch.type = 'color';
                swatch.value = this.graphRenderer._getColor(i);
                swatch.title = group.label;
                swatch.style.width = '28px';
                swatch.style.height = '24px';
                swatch.style.border = '1px solid #ccc';
                swatch.style.borderRadius = '3px';
                swatch.style.cursor = 'pointer';
                swatch.style.padding = '0';
                swatch.dataset.groupIndex = i;
                swatch.addEventListener('input', (e) => {
                    const idx = parseInt(e.target.dataset.groupIndex);
                    this.graphRenderer.settings.colorOverrides[idx] = e.target.value;
                    this.graphRenderer.render(this.dataTable.getData());
                });
                container.appendChild(swatch);
            });
        } else {
            // Update values
            filled.forEach((group, i) => {
                const swatch = container.children[i];
                if (swatch) {
                    swatch.value = this.graphRenderer._getColor(i);
                    swatch.title = group.label;
                }
            });
        }
    }

    _updateGroupManager(data) {
        const container = document.getElementById('groupManager');
        const listEl = document.getElementById('groupList');
        if (!container || !listEl) return;

        const allGroups = data;
        if (allGroups.length === 0) {
            container.style.display = 'none';
            return;
        }
        container.style.display = '';

        const settings = this.graphRenderer.settings;
        const hiddenGroups = settings.hiddenGroups;

        // Determine display order: use groupOrder if set, otherwise data order
        let orderedLabels;
        if (settings.groupOrder.length > 0) {
            const knownSet = new Set(settings.groupOrder);
            orderedLabels = [...settings.groupOrder.filter(l => allGroups.some(d => d.label === l))];
            allGroups.forEach(d => {
                if (!knownSet.has(d.label)) orderedLabels.push(d.label);
            });
        } else {
            orderedLabels = allGroups.map(d => d.label);
        }

        // Build color index map (same as graph.js)
        const colorIndexMap = {};
        allGroups.forEach((d, i) => { colorIndexMap[d.label] = i; });

        listEl.innerHTML = '';
        orderedLabels.forEach((label, idx) => {
            const isHidden = hiddenGroups.includes(label);
            const colorIdx = colorIndexMap[label] ?? 0;
            const color = this.graphRenderer._getColor(colorIdx);

            const item = document.createElement('div');
            item.className = 'group-item' + (isHidden ? ' hidden' : '');
            item.draggable = true;
            item.dataset.label = label;
            item.dataset.idx = idx;

            const handle = document.createElement('span');
            handle.className = 'drag-handle';
            handle.textContent = '\u2261';

            const dot = document.createElement('span');
            dot.className = 'color-dot';
            dot.style.background = color;

            const labelSpan = document.createElement('span');
            labelSpan.className = 'group-label';
            labelSpan.textContent = label;

            const eyeBtn = document.createElement('button');
            eyeBtn.className = 'visibility-btn';
            eyeBtn.textContent = isHidden ? '\u{1F6AB}' : '\u{1F441}';
            eyeBtn.title = isHidden ? 'Show group' : 'Hide group';
            eyeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isHidden) {
                    settings.hiddenGroups = hiddenGroups.filter(l => l !== label);
                } else {
                    settings.hiddenGroups = [...hiddenGroups, label];
                }
                this.updateGraph();
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-group-btn';
            delBtn.textContent = '\u00d7';
            delBtn.title = 'Delete column';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Find the column index in the original data by label
                const allData = this.dataTable.getData();
                const colIdx = allData.findIndex(d => d.label === label);
                if (colIdx >= 0) {
                    this.dataTable.deleteColumn(colIdx);
                }
            });

            item.appendChild(handle);
            item.appendChild(dot);
            item.appendChild(labelSpan);
            item.appendChild(eyeBtn);
            item.appendChild(delBtn);
            listEl.appendChild(item);

            // Drag events
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', idx.toString());
                item.style.opacity = '0.5';
            });
            item.addEventListener('dragend', () => {
                item.style.opacity = '';
                listEl.querySelectorAll('.group-item').forEach(el => el.classList.remove('drag-over'));
            });
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });
            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                const toIdx = idx;
                if (fromIdx === toIdx) return;

                // Reorder
                const newOrder = [...orderedLabels];
                const [moved] = newOrder.splice(fromIdx, 1);
                newOrder.splice(toIdx, 0, moved);
                settings.groupOrder = newOrder;
                this.updateGraph();
            });
        });
    }

    _updateHeatmapColManager(matrixData) {
        const container = document.getElementById('heatmapColManager');
        const listEl = document.getElementById('heatmapColList');
        if (!container || !listEl) return;

        const allColLabels = this.heatmapRenderer._rawColLabels || matrixData.colLabels || [];
        if (allColLabels.length === 0) {
            container.style.display = 'none';
            return;
        }
        container.style.display = '';

        const settings = this.heatmapRenderer.settings;
        const hiddenCols = settings.hiddenCols || [];
        const clusteringCols = (settings.cluster === 'cols' || settings.cluster === 'both');

        // Determine display order
        let orderedLabels;
        if (!clusteringCols && settings.colOrder && settings.colOrder.length > 0) {
            const knownSet = new Set(settings.colOrder);
            orderedLabels = [...settings.colOrder.filter(l => allColLabels.includes(l))];
            allColLabels.forEach(l => {
                if (!knownSet.has(l)) orderedLabels.push(l);
            });
        } else {
            orderedLabels = [...allColLabels];
        }

        listEl.innerHTML = '';
        orderedLabels.forEach((label, idx) => {
            const isHidden = hiddenCols.includes(label);

            const item = document.createElement('div');
            item.className = 'group-item' + (isHidden ? ' hidden' : '');
            item.draggable = !clusteringCols;
            item.dataset.label = label;
            item.dataset.idx = idx;

            const handle = document.createElement('span');
            handle.className = 'drag-handle';
            handle.textContent = clusteringCols ? '\u{1F512}' : '\u2261';
            if (clusteringCols) handle.title = 'Disable column clustering to reorder';

            const labelSpan = document.createElement('span');
            labelSpan.className = 'group-label';
            labelSpan.textContent = label;

            const eyeBtn = document.createElement('button');
            eyeBtn.className = 'visibility-btn';
            eyeBtn.textContent = isHidden ? '\u{1F6AB}' : '\u{1F441}';
            eyeBtn.title = isHidden ? 'Show column' : 'Hide column';
            eyeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isHidden) {
                    settings.hiddenCols = hiddenCols.filter(l => l !== label);
                } else {
                    settings.hiddenCols = [...hiddenCols, label];
                }
                this.updateGraph();
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-group-btn';
            delBtn.textContent = '\u00d7';
            delBtn.title = 'Delete column from table';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Find column index in table by matching header label
                const matrixData = this.dataTable.getMatrixData();
                const headerCells = this.dataTable.headerRow.querySelectorAll('th:not(.delete-col-header)');
                let colIdx = -1;
                headerCells.forEach((th, i) => {
                    const clone = th.cloneNode(true);
                    const btn = clone.querySelector('.th-delete-btn');
                    if (btn) btn.remove();
                    if (clone.textContent.trim() === label) colIdx = i;
                });
                if (colIdx >= 0) {
                    // Also remove from colOrder/hiddenCols
                    settings.colOrder = (settings.colOrder || []).filter(l => l !== label);
                    settings.hiddenCols = (settings.hiddenCols || []).filter(l => l !== label);
                    this.dataTable.deleteColumn(colIdx);
                }
            });

            item.appendChild(handle);
            item.appendChild(labelSpan);
            item.appendChild(eyeBtn);
            item.appendChild(delBtn);
            listEl.appendChild(item);

            // Drag events (only when not clustering columns)
            if (!clusteringCols) {
                item.addEventListener('dragstart', (e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', idx.toString());
                    item.style.opacity = '0.5';
                });
                item.addEventListener('dragend', () => {
                    item.style.opacity = '';
                    listEl.querySelectorAll('.group-item').forEach(el => el.classList.remove('drag-over'));
                });
                item.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    item.classList.add('drag-over');
                });
                item.addEventListener('dragleave', () => {
                    item.classList.remove('drag-over');
                });
                item.addEventListener('drop', (e) => {
                    e.preventDefault();
                    item.classList.remove('drag-over');
                    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                    const toIdx = idx;
                    if (fromIdx === toIdx) return;

                    const newOrder = [...orderedLabels];
                    const [moved] = newOrder.splice(fromIdx, 1);
                    newOrder.splice(toIdx, 0, moved);
                    settings.colOrder = newOrder;
                    this.updateGraph();
                });
            }
        });
    }

    _runStatisticalTest() {
        const testType = document.getElementById('testType').value;

        if (testType === 'none') {
            this._clearStats();
            this.graphRenderer.setSignificance([]);
            this.updateGraph();
            return;
        }

        // Two-way RM ANOVA (growth mode)
        if (this._isGrowthTest(testType)) {
            this._runGrowthAnova();
            return;
        }

        const data = this.dataTable.getData();
        const filledGroups = data.filter(d => d.values.length > 0);

        if (filledGroups.length < 2) {
            this._showStatsResult('Need at least 2 groups with data to run a test.');
            return;
        }

        // Multi-group tests (ANOVA / Kruskal-Wallis / Friedman)
        if (this._isMultiGroupTest(testType)) {
            this._runMultiGroupTest(testType, data, filledGroups);
            return;
        }

        // Two-group tests — use selected groups if >2, else first two
        let g1Sel = 0, g2Sel = 1;
        if (filledGroups.length > 2) {
            this._updateTwoGroupSelectors();
            g1Sel = parseInt(document.getElementById('twoGroupSelect1').value) || 0;
            g2Sel = parseInt(document.getElementById('twoGroupSelect2').value) || 1;
            if (g1Sel === g2Sel) {
                this._showStatsResult('Please select two different groups to compare.');
                return;
            }
        }
        const group1 = filledGroups[g1Sel];
        const group2 = filledGroups[g2Sel];
        const group1Index = data.indexOf(group1);
        const group2Index = data.indexOf(group2);

        let result;
        let testName;

        try {
            switch (testType) {
                case 't-test-unpaired':
                    result = Statistics.tTest(group1.values, group2.values, false);
                    testName = "Unpaired t-test (Welch's)";
                    break;
                case 't-test-paired':
                    result = Statistics.tTest(group1.values, group2.values, true);
                    testName = 'Paired t-test';
                    break;
                case 'mann-whitney':
                    result = Statistics.mannWhitneyU(group1.values, group2.values);
                    testName = 'Mann-Whitney U test';
                    break;
                case 'wilcoxon':
                    result = Statistics.wilcoxonSignedRank(group1.values, group2.values);
                    testName = 'Wilcoxon signed-rank test';
                    break;
                default:
                    this._showStatsResult('Select a test type.');
                    return;
            }
        } catch (e) {
            this._showStatsResult(`Error: ${e.message}`);
            return;
        }

        // Format and display results
        const pFormatted = Statistics.formatPValue(result.p);
        const sigLevel = Statistics.getSignificanceLevel(result.p);
        const isSignificant = result.p < 0.05;

        let html = `<div class="result-item"><span class="result-label">Test:</span> <span class="result-value">${testName}</span></div>`;
        html += `<div class="result-item"><span class="result-label">Comparing:</span> <span class="result-value">${group1.label} vs ${group2.label}</span></div>`;

        if (result.t !== undefined) {
            html += `<div class="result-item"><span class="result-label">t statistic:</span> <span class="result-value">${result.t.toFixed(4)}</span></div>`;
            html += `<div class="result-item"><span class="result-label">df:</span> <span class="result-value">${result.df.toFixed(2)}</span></div>`;
        }
        if (result.U !== undefined) {
            html += `<div class="result-item"><span class="result-label">U statistic:</span> <span class="result-value">${result.U.toFixed(4)}</span></div>`;
        }
        if (result.W !== undefined) {
            html += `<div class="result-item"><span class="result-label">W statistic:</span> <span class="result-value">${result.W.toFixed(4)}</span></div>`;
        }

        html += `<div class="result-item"><span class="result-label">P value:</span> <span class="result-value">${pFormatted}</span></div>`;
        html += `<div class="result-item"><span class="result-label">Significance:</span> <span class="${isSignificant ? 'significant' : 'not-significant'}">${sigLevel} (${isSignificant ? 'Significant' : 'Not significant'} at p &lt; 0.05)</span></div>`;

        // Summary stats
        html += `<hr style="margin:8px 0;border-color:#eee">`;
        html += `<div class="result-item"><span class="result-label">Mean ${group1.label}:</span> <span class="result-value">${Statistics.mean(group1.values).toFixed(4)}</span></div>`;
        html += `<div class="result-item"><span class="result-label">Mean ${group2.label}:</span> <span class="result-value">${Statistics.mean(group2.values).toFixed(4)}</span></div>`;
        html += `<div class="result-item"><span class="result-label">N (${group1.label}):</span> <span class="result-value">${group1.values.length}</span></div>`;
        html += `<div class="result-item"><span class="result-label">N (${group2.label}):</span> <span class="result-value">${group2.values.length}</span></div>`;

        this._showStatsResult(html);

        // Set test name for legend
        this.graphRenderer.updateSettings({ statsTestName: testName }); this.growthRenderer.settings.statsTestName = testName;

        // Info box text
        this._statsInfoText = {
            test: testName,
            postHoc: null,
            sig: '* p < 0.05, ** p < 0.01, *** p < 0.001',
            n: `${group1.label}: n=${group1.values.length}, ${group2.label}: n=${group2.values.length}`,
            pkg: 'jStat (JavaScript Statistical Library)'
        };

        // Add significance bracket to graph
        this.graphRenderer.setSignificance([{
            group1Index,
            group2Index,
            pValue: result.p,
            significanceLabel: sigLevel
        }]);
        this.updateGraph();
    }

    _runMultiGroupTest(testType, data, filledGroups) {
        const groupValues = filledGroups.map(g => g.values);
        const groupLabels = filledGroups.map(g => g.label);

        // Friedman requires equal sample sizes — validate early
        if (testType === 'friedman') {
            const sizes = groupValues.map(g => g.length);
            if (sizes.some(s => s !== sizes[0])) {
                this._showStatsResult('Error: Friedman test requires equal sample sizes (matched/paired data). All groups must have the same number of observations.');
                return;
            }
            if (sizes[0] < 2) {
                this._showStatsResult('Error: Friedman test requires at least 2 observations per group.');
                return;
            }
        }

        // For exactly 2 groups with Friedman selected, fall back to Wilcoxon
        if (filledGroups.length === 2 && testType === 'friedman') {
            const group1 = filledGroups[0];
            const group2 = filledGroups[1];
            let result;
            try {
                result = Statistics.wilcoxonSignedRank(group1.values, group2.values);
            } catch (e) {
                this._showStatsResult(`Error: ${e.message}`);
                return;
            }
            const pFormatted = Statistics.formatPValue(result.p);
            const sigLevel = Statistics.getSignificanceLevel(result.p);
            const isSignificant = result.p < 0.05;
            const testName = 'Wilcoxon signed-rank test';

            let html = `<div class="result-item"><span class="result-label">Test:</span> <span class="result-value">${testName}</span></div>`;
            html += `<div class="result-item" style="color:#888;font-size:12px"><em>Friedman with 2 groups falls back to Wilcoxon signed-rank</em></div>`;
            html += `<div class="result-item"><span class="result-label">Comparing:</span> <span class="result-value">${group1.label} vs ${group2.label}</span></div>`;
            html += `<div class="result-item"><span class="result-label">W statistic:</span> <span class="result-value">${result.W.toFixed(4)}</span></div>`;
            html += `<div class="result-item"><span class="result-label">P value:</span> <span class="result-value">${pFormatted}</span></div>`;
            html += `<div class="result-item"><span class="result-label">Significance:</span> <span class="${isSignificant ? 'significant' : 'not-significant'}">${sigLevel} (${isSignificant ? 'Significant' : 'Not significant'} at p &lt; 0.05)</span></div>`;

            html += `<hr style="margin:8px 0;border-color:#eee">`;
            filledGroups.forEach(g => {
                html += `<div class="result-item"><span class="result-label">Median ${g.label}:</span> <span class="result-value">${Statistics.median(g.values).toFixed(4)} (N=${g.values.length})</span></div>`;
            });

            this._showStatsResult(html);
            this.graphRenderer.updateSettings({ statsTestName: testName }); this.growthRenderer.settings.statsTestName = testName;

            const g1Idx = data.indexOf(group1);
            const g2Idx = data.indexOf(group2);
            this.graphRenderer.setSignificance([{
                group1Index: g1Idx,
                group2Index: g2Idx,
                pValue: result.p,
                significanceLabel: sigLevel
            }]);
            this.updateGraph();
            return;
        }

        // For exactly 2 groups with ANOVA selected, fall back to t-test
        if (filledGroups.length === 2 && testType === 'one-way-anova') {
            const group1 = filledGroups[0];
            const group2 = filledGroups[1];
            const result = Statistics.tTest(group1.values, group2.values, false);
            const pFormatted = Statistics.formatPValue(result.p);
            const sigLevel = Statistics.getSignificanceLevel(result.p);
            const isSignificant = result.p < 0.05;
            const testName = "Unpaired t-test (Welch's)";

            let html = `<div class="result-item"><span class="result-label">Test:</span> <span class="result-value">${testName}</span></div>`;
            html += `<div class="result-item" style="color:#888;font-size:12px"><em>ANOVA with 2 groups falls back to t-test</em></div>`;
            html += `<div class="result-item"><span class="result-label">Comparing:</span> <span class="result-value">${group1.label} vs ${group2.label}</span></div>`;
            html += `<div class="result-item"><span class="result-label">t statistic:</span> <span class="result-value">${result.t.toFixed(4)}</span></div>`;
            html += `<div class="result-item"><span class="result-label">df:</span> <span class="result-value">${result.df.toFixed(2)}</span></div>`;
            html += `<div class="result-item"><span class="result-label">P value:</span> <span class="result-value">${pFormatted}</span></div>`;
            html += `<div class="result-item"><span class="result-label">Significance:</span> <span class="${isSignificant ? 'significant' : 'not-significant'}">${sigLevel} (${isSignificant ? 'Significant' : 'Not significant'} at p &lt; 0.05)</span></div>`;

            html += `<hr style="margin:8px 0;border-color:#eee">`;
            filledGroups.forEach(g => {
                html += `<div class="result-item"><span class="result-label">Mean ${g.label}:</span> <span class="result-value">${Statistics.mean(g.values).toFixed(4)} (N=${g.values.length})</span></div>`;
            });

            this._showStatsResult(html);
            this.graphRenderer.updateSettings({ statsTestName: testName }); this.growthRenderer.settings.statsTestName = testName;

            const g1Idx = data.indexOf(group1);
            const g2Idx = data.indexOf(group2);
            this.graphRenderer.setSignificance([{
                group1Index: g1Idx,
                group2Index: g2Idx,
                pValue: result.p,
                significanceLabel: sigLevel
            }]);
            this.updateGraph();
            return;
        }

        let result, testName;
        try {
            if (testType === 'one-way-anova') {
                result = Statistics.oneWayAnova(groupValues);
                testName = 'One-way ANOVA';
            } else if (testType === 'friedman') {
                result = Statistics.friedmanTest(groupValues);
                testName = 'Friedman test';
            } else {
                result = Statistics.kruskalWallis(groupValues);
                testName = 'Kruskal-Wallis test';
            }
        } catch (e) {
            this._showStatsResult(`Error: ${e.message}`);
            return;
        }

        const pFormatted = Statistics.formatPValue(result.p);
        const sigLevel = Statistics.getSignificanceLevel(result.p);
        const isSignificant = result.p < 0.05;

        let html = `<div class="result-item"><span class="result-label">Test:</span> <span class="result-value">${testName}</span></div>`;
        html += `<div class="result-item"><span class="result-label">Groups:</span> <span class="result-value">${groupLabels.join(', ')}</span></div>`;

        if (result.F !== undefined) {
            html += `<div class="result-item"><span class="result-label">F statistic:</span> <span class="result-value">${result.F.toFixed(4)}</span></div>`;
            html += `<div class="result-item"><span class="result-label">df (between):</span> <span class="result-value">${result.dfBetween}</span></div>`;
            html += `<div class="result-item"><span class="result-label">df (within):</span> <span class="result-value">${result.dfWithin}</span></div>`;
        }
        if (result.H !== undefined) {
            html += `<div class="result-item"><span class="result-label">H statistic:</span> <span class="result-value">${result.H.toFixed(4)}</span></div>`;
            html += `<div class="result-item"><span class="result-label">df:</span> <span class="result-value">${result.df}</span></div>`;
        }
        if (result.Q !== undefined) {
            html += `<div class="result-item"><span class="result-label">\u03C7\u00B2 statistic:</span> <span class="result-value">${result.Q.toFixed(4)}</span></div>`;
            html += `<div class="result-item"><span class="result-label">df:</span> <span class="result-value">${result.df}</span></div>`;
            html += `<div class="result-item"><span class="result-label">N (subjects):</span> <span class="result-value">${result.n}</span></div>`;
        }

        html += `<div class="result-item"><span class="result-label">P value:</span> <span class="result-value">${pFormatted}</span></div>`;
        html += `<div class="result-item"><span class="result-label">Significance:</span> <span class="${isSignificant ? 'significant' : 'not-significant'}">${sigLevel} (${isSignificant ? 'Significant' : 'Not significant'} at p &lt; 0.05)</span></div>`;

        // Per-group summary
        html += `<hr style="margin:8px 0;border-color:#eee">`;
        filledGroups.forEach(g => {
            html += `<div class="result-item"><span class="result-label">Mean ${g.label}:</span> <span class="result-value">${Statistics.mean(g.values).toFixed(4)} (N=${g.values.length})</span></div>`;
        });

        // Post-hoc testing for significant omnibus tests
        const significantPairs = [];
        if (isSignificant) {
            const postHocMethod = document.getElementById('postHocMethod').value;
            let postHocResults;
            let postHocName;

            // Populate Dunnett control dropdown
            this._populateDunnettControl(data);

            if (testType === 'friedman') {
                // Friedman post-hoc: pairwise Wilcoxon signed-rank with Bonferroni correction
                postHocResults = Statistics.friedmanPostHoc(groupValues, groupLabels);
                postHocName = 'Pairwise Wilcoxon (Bonferroni)';
            } else {
                switch (postHocMethod) {
                    case 'tukey':
                        postHocResults = Statistics.tukeyHSDPostHoc(groupValues, groupLabels);
                        postHocName = 'Tukey HSD';
                        break;
                    case 'holm':
                        postHocResults = Statistics.holmBonferroniPostHoc(groupValues, groupLabels);
                        postHocName = 'Holm-Bonferroni';
                        break;
                    case 'dunnett': {
                        const controlIdx = parseInt(document.getElementById('dunnettControlIndex').value) || 0;
                        postHocResults = Statistics.dunnettPostHoc(groupValues, groupLabels, controlIdx);
                        postHocName = `Dunnett (control: ${groupLabels[controlIdx]})`;
                        break;
                    }
                    case 'bonferroni':
                    default:
                        postHocResults = Statistics.bonferroniPostHoc(groupValues, groupLabels);
                        postHocName = 'Bonferroni';
                        break;
                }
            }

            html += `<hr style="margin:8px 0;border-color:#eee">`;
            html += `<div class="result-item"><span class="result-label">Post-hoc:</span> <span class="result-value">${postHocName}</span></div>`;

            postHocResults.forEach(ph => {
                const phPFormatted = Statistics.formatPValue(ph.correctedP);
                const phClass = ph.significant ? 'significant' : 'not-significant';
                html += `<div class="result-item"><span class="result-value">${ph.group1Label} vs ${ph.group2Label}: ${phPFormatted} <span class="${phClass}">${ph.significanceLabel}</span></span></div>`;

                if (ph.significant) {
                    const g1Idx = data.indexOf(filledGroups[ph.group1Index]);
                    const g2Idx = data.indexOf(filledGroups[ph.group2Index]);
                    significantPairs.push({
                        group1Index: g1Idx,
                        group2Index: g2Idx,
                        pValue: ph.correctedP,
                        significanceLabel: ph.significanceLabel
                    });
                }
            });

            this.graphRenderer.updateSettings({ statsTestName: testName + ' + ' + postHocName });
            this.growthRenderer.settings.statsTestName = testName + ' + ' + postHocName;
        } else {
            html += `<div class="result-item" style="color:#888;font-size:12px"><em>No significant differences — post-hoc not needed</em></div>`;
            this.graphRenderer.updateSettings({ statsTestName: testName }); this.growthRenderer.settings.statsTestName = testName;
        }

        this._showStatsResult(html);

        // Info box text
        const postHocMethod = document.getElementById('postHocMethod')?.value || '';
        const postHocLabels = { tukey: 'Tukey HSD', bonferroni: 'Bonferroni', holm: 'Holm-Bonferroni', dunnett: 'Dunnett (vs control)' };
        const nStrs = filledGroups.map(g => `${g.label}: n=${g.values.length}`).join(', ');
        this._statsInfoText = {
            test: testName,
            postHoc: significantPairs.length > 0 ? (postHocLabels[postHocMethod] || postHocMethod) : null,
            sig: '* p < 0.05, ** p < 0.01, *** p < 0.001',
            n: nStrs,
            pkg: 'jStat (JavaScript Statistical Library)'
        };

        this.graphRenderer.setSignificance(significantPairs);
        this.updateGraph();
    }

    _runGrowthAnova() {
        const growthData = this.dataTable.getGrowthData();
        if (!growthData || growthData.groups.length < 2 || growthData.timepoints.length < 2) {
            this._showStatsResult('Need at least 2 groups and 2 timepoints for two-way RM ANOVA.');
            return;
        }

        // Populate and read options
        this._populateGrowthControlSelect();
        const correction = document.getElementById('growthCorrectionMethod')?.value || 'holm';
        const compareMode = document.getElementById('growthCompareMode')?.value || 'all';
        const controlGroup = document.getElementById('growthControlSelect')?.value || growthData.groups[0];

        const correctionLabels = {
            holm: 'Holm-Bonferroni', bonferroni: 'Bonferroni',
            sidak: '\u0160id\u00e1k', none: 'Uncorrected'
        };
        const corrLabel = correctionLabels[correction] || correction;
        const compareLabel = compareMode === 'control' ? `vs ${controlGroup}` : 'all pairwise';

        try {
            const result = Statistics.twoWayRepeatedMeasuresAnova(growthData);
            const testName = 'Two-way RM ANOVA (Group \u00d7 Time)';

            let html = `<div class="result-item"><span class="result-label">Test:</span> <span class="result-value">${testName}</span></div>`;
            html += `<div class="result-item"><span class="result-label">Groups:</span> <span class="result-value">${growthData.groups.join(', ')}</span></div>`;
            html += `<div class="result-item"><span class="result-label">Timepoints:</span> <span class="result-value">${growthData.timepoints.join(', ')}</span></div>`;
            html += `<hr style="margin:6px 0;border-color:#eee">`;

            const factors = [
                { label: 'Group', data: result.group },
                { label: 'Time', data: result.time },
                { label: 'Group \u00d7 Time', data: result.interaction }
            ];

            factors.forEach(f => {
                const pFormatted = Statistics.formatPValue(f.data.p);
                const sigLevel = Statistics.getSignificanceLevel(f.data.p);
                const isSig = f.data.p < 0.05;
                html += `<div class="result-item"><span class="result-label">${f.label}:</span> <span class="result-value">F(${f.data.df1},${f.data.df2}) = ${f.data.F.toFixed(3)}, ${pFormatted} <span class="${isSig ? 'significant' : 'not-significant'}">${sigLevel}</span></span></div>`;
            });

            // Post-hoc comparisons
            html += `<hr style="margin:6px 0;border-color:#eee">`;
            const nGroups = growthData.groups.length;
            const postHocMethod = nGroups > 2
                ? `one-way ANOVA per timepoint, then pairwise t-tests (${compareLabel}, ${corrLabel})`
                : `unpaired t-tests per timepoint (${corrLabel})`;
            html += `<div class="result-item" style="font-weight:600">Post-hoc: ${postHocMethod} — click to show</div>`;
            html += `<div style="margin:4px 0"><button class="btn btn-secondary growth-sig-all" style="padding:1px 6px;font-size:10px">Show sig.</button> <button class="btn btn-secondary growth-sig-none" style="padding:1px 6px;font-size:10px">Clear all</button></div>`;

            const postHoc = Statistics.growthPostHoc(growthData, { correction, compareMode, controlGroup });

            // Show per-timepoint ANOVA results if >2 groups
            if (nGroups > 2 && Statistics._lastGrowthAnovaPerTimepoint) {
                html += `<div style="margin:4px 0;font-size:11px;color:#555"><em>Per-timepoint ANOVA (gatekeeper):</em></div>`;
                Statistics._lastGrowthAnovaPerTimepoint.forEach(a => {
                    const cls = a.significant ? 'significant' : 'not-significant';
                    html += `<div class="result-item" style="font-size:11px;color:#666;padding:1px 8px">t=${a.timepoint}: F=${a.F.toFixed(2)}, ${Statistics.formatPValue(a.p)} <span class="${cls}">${a.significant ? '→ pairwise' : 'n.s.'}</span></div>`;
                });
                html += `<hr style="margin:4px 0;border-color:#eee">`;
            }

            postHoc.forEach((r, idx) => {
                const pFormatted = Statistics.formatPValue(r.correctedP);
                const isSig = r.significant;
                const cls = isSig ? 'significant' : 'not-significant';
                html += `<div class="result-item growth-posthoc-row" data-idx="${idx}" style="cursor:pointer;padding:2px 4px;border-radius:3px" title="Click to toggle on graph">`;
                html += `<span class="result-value" style="font-size:12px">t=${r.timepoint}: ${r.group1} vs ${r.group2} \u2014 ${pFormatted} <span class="${cls}">${r.sigLabel}</span></span>`;
                html += `</div>`;
            });

            this._showStatsResult(html);
            this._bindGrowthPostHocToggles(postHoc);
            const legendTestName = nGroups > 2
                ? 'RM ANOVA + ANOVA/t-tests (' + corrLabel + ')'
                : 'RM ANOVA + t-tests (' + corrLabel + ')';
            this.growthRenderer.settings.statsTestName = legendTestName;

            // Build info text for SVG info box
            const nPerGroup = growthData.groups.map(g => (growthData.groupMap[g] || []).length);
            const nStr = nPerGroup.every(n => n === nPerGroup[0]) ? `n = ${nPerGroup[0]}/group` : nPerGroup.map((n, i) => `${growthData.groups[i]}: n=${n}`).join(', ');
            this._statsInfoText = {
                test: testName,
                postHoc: `Per-timepoint t-tests (${compareLabel}), ${corrLabel} correction`,
                sig: '* p < 0.05, ** p < 0.01, *** p < 0.001',
                n: nStr,
                pkg: 'jStat (JavaScript Statistical Library)',
                factors: factors.map(f => `${f.label}: F(${f.data.df1},${f.data.df2})=${f.data.F.toFixed(2)}, ${Statistics.formatPValue(f.data.p)}`)
            };
            this.updateGraph();
        } catch (e) {
            this._showStatsResult(`Error: ${e.message}`);
        }
    }

    _bindGrowthPostHocToggles(postHocResults) {
        const container = document.getElementById('statsResults');
        if (!container) return;

        // Track which rows are active
        const activeSet = new Set();
        const self = this;

        const updateMarkers = () => {
            const markers = [];
            activeSet.forEach(idx => {
                const r = postHocResults[idx];
                markers.push({
                    timepoint: r.timepoint,
                    group1: r.group1,
                    group2: r.group2,
                    sigLabel: r.sigLabel
                });
            });
            self.growthRenderer.setSignificance(markers);
            self.updateGraph();
        };

        // Click individual rows
        container.querySelectorAll('.growth-posthoc-row').forEach(row => {
            row.addEventListener('click', () => {
                const idx = parseInt(row.dataset.idx);
                if (activeSet.has(idx)) {
                    activeSet.delete(idx);
                    row.style.background = '';
                } else {
                    activeSet.add(idx);
                    row.style.background = '#e8f5e9';
                }
                updateMarkers();
            });
        });

        // Show all significant
        const allBtn = container.querySelector('.growth-sig-all');
        if (allBtn) allBtn.addEventListener('click', () => {
            activeSet.clear();
            postHocResults.forEach((r, idx) => {
                if (r.significant) activeSet.add(idx);
            });
            container.querySelectorAll('.growth-posthoc-row').forEach(row => {
                const idx = parseInt(row.dataset.idx);
                row.style.background = activeSet.has(idx) ? '#e8f5e9' : '';
            });
            updateMarkers();
        });

        // Clear all
        const noneBtn = container.querySelector('.growth-sig-none');
        if (noneBtn) noneBtn.addEventListener('click', () => {
            activeSet.clear();
            container.querySelectorAll('.growth-posthoc-row').forEach(row => {
                row.style.background = '';
            });
            updateMarkers();
        });
    }

    _showStatsResult(html) {
        const container = document.getElementById('statsResults');
        container.innerHTML = html + '<div style="font-size:10px;color:#999;margin-top:8px;border-top:1px solid #eee;padding-top:4px">Analysis performed using jStat (JavaScript Statistical Library)</div>';
        container.classList.remove('empty');
    }

    _clearStats() {
        const container = document.getElementById('statsResults');
        container.innerHTML = '';
        container.classList.add('empty');
        this.graphRenderer.setSignificance([]);
        this.growthRenderer.setSignificance([]);
        this._statsInfoText = null;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
