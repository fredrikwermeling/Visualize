// app.js - Main application controller

class App {
    constructor() {
        // Initialize components
        this.dataTable = new DataTable('dataTable', 'tableBody', 'headerRow');
        this.graphRenderer = new GraphRenderer('graphContainer');
        this.heatmapRenderer = new HeatmapRenderer('graphContainer');
        this.growthRenderer = new GrowthCurveRenderer('graphContainer');
        this.volcanoRenderer = new VolcanoRenderer('graphContainer');
        this.correlationRenderer = new CorrelationRenderer('graphContainer');
        this.pcaRenderer = new PCARenderer('graphContainer');
        this.vennRenderer = new VennRenderer('graphContainer');
        this.oncoprintRenderer = new OncoPrintRenderer('graphContainer');
        this.kaplanMeierRenderer = new KaplanMeierRenderer('graphContainer');
        this.exportManager = new ExportManager(this.graphRenderer);
        this.columnAnnotationManager = new AnnotationManager();
        this.heatmapAnnotationManager = new AnnotationManager();
        this.growthAnnotationManager = new AnnotationManager();
        this.volcanoAnnotationManager = new AnnotationManager();
        this.correlationAnnotationManager = new AnnotationManager();
        this.pcaAnnotationManager = new AnnotationManager();
        this.vennAnnotationManager = new AnnotationManager();
        this.oncoprintAnnotationManager = new AnnotationManager();
        this.kaplanMeierAnnotationManager = new AnnotationManager();
        this.graphRenderer.annotationManager = this.columnAnnotationManager;
        this.growthRenderer.annotationManager = this.growthAnnotationManager;
        this.volcanoRenderer.annotationManager = this.volcanoAnnotationManager;
        this.correlationRenderer.annotationManager = this.correlationAnnotationManager;
        this.pcaRenderer.annotationManager = this.pcaAnnotationManager;
        this.vennRenderer.annotationManager = this.vennAnnotationManager;
        this.oncoprintRenderer.annotationManager = this.oncoprintAnnotationManager;
        this.kaplanMeierRenderer.annotationManager = this.kaplanMeierAnnotationManager;
        this._undoStack = [];
        this.mode = 'heatmap';

        // Separate data storage per mode
        this._columnTableData = null;
        this._heatmapTableData = null;
        this._growthTableData = null;
        this._volcanoTableData = null;
        this._correlationTableData = null;
        this._pcaTableData = null;
        this._vennTableData = null;
        this._oncoprintTableData = null;
        this._kaplanMeierTableData = null;

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
        this._bindCorrelationControls();
        this._bindPCAControls();
        this._bindVennControls();
        this._bindOncoPrintControls();
        this._bindKaplanMeierControls();

        this._bindGroupToggleButtons();
        this._bindTextSettingsPanel();
        this._bindGraphSettingsPanel();
        this._buildGraphTypePicker();
        this._wrapNumberInputs();

        // Load sample data and draw initial graph
        this._applyMode();
        this.dataTable.loadHeatmapSampleData();
        this.updateGraph();
        this._updateTestDataIndicator();

        // Mode selection popout (after initial render)
        this._initModePopout();
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

    _updateTestDataIndicator() {
        const indicator = document.getElementById('testDataIndicator');
        if (!indicator) return;
        const total = this._sampleCounts[this.mode] || 1;
        const idx = this._sampleIndex[this.mode] || 0;
        const shown = (idx % total) + 1;
        indicator.textContent = shown + '/' + total;
    }

    // --- Graph Type Picker ---

    _buildGraphTypePicker() {
        const container = document.getElementById('graphTypePicker');
        if (!container) return;
        container.innerHTML = '';

        const h4 = document.createElement('h4');
        h4.textContent = 'Graph Type';
        container.appendChild(h4);

        const categories = [
            { name: 'Scatter', items: [
                { value: 'scatter-only', label: 'Points only', icon: '<svg viewBox="0 0 20 16"><circle cx="5" cy="4" r="1.5" fill="#4a8f32"/><circle cx="10" cy="10" r="1.5" fill="#4a8f32"/><circle cx="15" cy="6" r="1.5" fill="#4a8f32"/><circle cx="8" cy="12" r="1.5" fill="#4a8f32"/><circle cx="14" cy="3" r="1.5" fill="#4a8f32"/></svg>' },
                { value: 'column-points-mean', label: 'Points + Mean', icon: '<svg viewBox="0 0 20 16"><circle cx="5" cy="5" r="1.3" fill="#4a8f32"/><circle cx="5" cy="9" r="1.3" fill="#4a8f32"/><circle cx="5" cy="12" r="1.3" fill="#4a8f32"/><line x1="3" y1="8.5" x2="7" y2="8.5" stroke="#333" stroke-width="1.5"/><circle cx="14" cy="4" r="1.3" fill="#e67e22"/><circle cx="14" cy="7" r="1.3" fill="#e67e22"/><circle cx="14" cy="11" r="1.3" fill="#e67e22"/><line x1="12" y1="7" x2="16" y2="7" stroke="#333" stroke-width="1.5"/></svg>' },
                { value: 'column-points-median', label: 'Points + Median', icon: '<svg viewBox="0 0 20 16"><circle cx="5" cy="5" r="1.3" fill="#4a8f32"/><circle cx="5" cy="9" r="1.3" fill="#4a8f32"/><circle cx="5" cy="13" r="1.3" fill="#4a8f32"/><line x1="3" y1="9" x2="7" y2="9" stroke="#333" stroke-width="1.5"/><circle cx="14" cy="3" r="1.3" fill="#e67e22"/><circle cx="14" cy="7" r="1.3" fill="#e67e22"/><circle cx="14" cy="10" r="1.3" fill="#e67e22"/><line x1="12" y1="7" x2="16" y2="7" stroke="#333" stroke-width="1.5"/></svg>' },
            ]},
            { name: 'Bar', items: [
                { value: 'scatter-bar', label: 'Scatter + Bar', icon: '<svg viewBox="0 0 20 16"><rect x="2" y="6" width="6" height="10" rx="1" fill="#4a8f32" opacity="0.4"/><circle cx="5" cy="5" r="1.2" fill="#4a8f32"/><circle cx="5" cy="9" r="1.2" fill="#4a8f32"/><rect x="12" y="4" width="6" height="12" rx="1" fill="#e67e22" opacity="0.4"/><circle cx="15" cy="3" r="1.2" fill="#e67e22"/><circle cx="15" cy="8" r="1.2" fill="#e67e22"/></svg>' },
                { value: 'column-bar-mean', label: 'Bar + SD', icon: '<svg viewBox="0 0 20 16"><rect x="2" y="5" width="6" height="11" rx="1" fill="#4a8f32"/><line x1="5" y1="2" x2="5" y2="5" stroke="#333" stroke-width="1"/><line x1="3.5" y1="2" x2="6.5" y2="2" stroke="#333" stroke-width="1"/><rect x="12" y="3" width="6" height="13" rx="1" fill="#e67e22"/><line x1="15" y1="0.5" x2="15" y2="3" stroke="#333" stroke-width="1"/><line x1="13.5" y1="0.5" x2="16.5" y2="0.5" stroke="#333" stroke-width="1"/></svg>' },
                { value: 'column-bar-sem', label: 'Bar + SEM', icon: '<svg viewBox="0 0 20 16"><rect x="2" y="5" width="6" height="11" rx="1" fill="#4a8f32"/><line x1="5" y1="3" x2="5" y2="5" stroke="#333" stroke-width="1"/><line x1="3.5" y1="3" x2="6.5" y2="3" stroke="#333" stroke-width="1"/><rect x="12" y="3" width="6" height="13" rx="1" fill="#e67e22"/><line x1="15" y1="1.5" x2="15" y2="3" stroke="#333" stroke-width="1"/><line x1="13.5" y1="1.5" x2="16.5" y2="1.5" stroke="#333" stroke-width="1"/></svg>' },
                { value: 'column-bar-median', label: 'Bar + IQR', icon: '<svg viewBox="0 0 20 16"><rect x="2" y="6" width="6" height="10" rx="1" fill="#4a8f32"/><line x1="5" y1="3" x2="5" y2="6" stroke="#333" stroke-width="1"/><line x1="5" y1="12" x2="5" y2="16" stroke="#333" stroke-width="1"/><rect x="12" y="4" width="6" height="12" rx="1" fill="#e67e22"/><line x1="15" y1="1" x2="15" y2="4" stroke="#333" stroke-width="1"/><line x1="15" y1="12" x2="15" y2="16" stroke="#333" stroke-width="1"/></svg>' },
                { value: 'scatter-bar-mean-sd', label: 'Scatter+Bar+SD', icon: '<svg viewBox="0 0 20 16"><rect x="2" y="6" width="6" height="10" rx="1" fill="#4a8f32" opacity="0.4"/><circle cx="4" cy="5" r="1" fill="#4a8f32"/><circle cx="6" cy="9" r="1" fill="#4a8f32"/><line x1="5" y1="3" x2="5" y2="6" stroke="#333" stroke-width="0.8"/><rect x="12" y="4" width="6" height="12" rx="1" fill="#e67e22" opacity="0.4"/><circle cx="14" cy="3" r="1" fill="#e67e22"/><circle cx="16" cy="7" r="1" fill="#e67e22"/><line x1="15" y1="1" x2="15" y2="4" stroke="#333" stroke-width="0.8"/></svg>' },
                { value: 'scatter-bar-mean-sem', label: 'Scatter+Bar+SEM', icon: '<svg viewBox="0 0 20 16"><rect x="2" y="6" width="6" height="10" rx="1" fill="#4a8f32" opacity="0.4"/><circle cx="4" cy="5" r="1" fill="#4a8f32"/><circle cx="6" cy="9" r="1" fill="#4a8f32"/><line x1="5" y1="4" x2="5" y2="6" stroke="#333" stroke-width="0.8"/><rect x="12" y="4" width="6" height="12" rx="1" fill="#e67e22" opacity="0.4"/><circle cx="14" cy="3" r="1" fill="#e67e22"/><circle cx="16" cy="7" r="1" fill="#e67e22"/><line x1="15" y1="2" x2="15" y2="4" stroke="#333" stroke-width="0.8"/></svg>' },
            ]},
            { name: 'Distribution', items: [
                { value: 'box-plot', label: 'Box Plot', icon: '<svg viewBox="0 0 20 16"><rect x="3" y="4" width="5" height="8" rx="0.5" fill="none" stroke="#4a8f32" stroke-width="1.2"/><line x1="5.5" y1="1" x2="5.5" y2="4" stroke="#4a8f32" stroke-width="1"/><line x1="5.5" y1="12" x2="5.5" y2="15" stroke="#4a8f32" stroke-width="1"/><line x1="3" y1="8" x2="8" y2="8" stroke="#4a8f32" stroke-width="1.5"/><rect x="12" y="3" width="5" height="9" rx="0.5" fill="none" stroke="#e67e22" stroke-width="1.2"/><line x1="14.5" y1="0.5" x2="14.5" y2="3" stroke="#e67e22" stroke-width="1"/><line x1="14.5" y1="12" x2="14.5" y2="15.5" stroke="#e67e22" stroke-width="1"/><line x1="12" y1="7" x2="17" y2="7" stroke="#e67e22" stroke-width="1.5"/></svg>' },
                { value: 'violin-plot', label: 'Violin Plot', icon: '<svg viewBox="0 0 20 16"><path d="M5.5 1 C3 4,2 6,2 8 C2 10,3 12,5.5 15 C8 12,9 10,9 8 C9 6,8 4,5.5 1Z" fill="#4a8f32" opacity="0.5" stroke="#4a8f32" stroke-width="0.8"/><path d="M14.5 1 C12 4,11 6,11 8 C11 10,12 12,14.5 15 C17 12,18 10,18 8 C18 6,17 4,14.5 1Z" fill="#e67e22" opacity="0.5" stroke="#e67e22" stroke-width="0.8"/></svg>' },
                { value: 'violin-box', label: 'Violin + Box', icon: '<svg viewBox="0 0 20 16"><path d="M5.5 1 C3 4,2 6,2 8 C2 10,3 12,5.5 15 C8 12,9 10,9 8 C9 6,8 4,5.5 1Z" fill="#4a8f32" opacity="0.35" stroke="#4a8f32" stroke-width="0.8"/><rect x="4" y="5" width="3" height="6" rx="0.3" fill="none" stroke="#333" stroke-width="0.8"/><line x1="4" y1="8" x2="7" y2="8" stroke="#333" stroke-width="1.2"/><path d="M14.5 1 C12 4,11 6,11 8 C11 10,12 12,14.5 15 C17 12,18 10,18 8 C18 6,17 4,14.5 1Z" fill="#e67e22" opacity="0.35" stroke="#e67e22" stroke-width="0.8"/><rect x="13" y="4" width="3" height="7" rx="0.3" fill="none" stroke="#333" stroke-width="0.8"/><line x1="13" y1="7" x2="16" y2="7" stroke="#333" stroke-width="1.2"/></svg>' },
            ]},
            { name: 'Paired', items: [
                { value: 'before-after', label: 'Before\u2013After', icon: '<svg viewBox="0 0 20 16"><circle cx="5" cy="4" r="1.5" fill="#4a8f32"/><circle cx="15" cy="8" r="1.5" fill="#4a8f32"/><line x1="5" y1="4" x2="15" y2="8" stroke="#4a8f32" stroke-width="1"/><circle cx="5" cy="10" r="1.5" fill="#e67e22"/><circle cx="15" cy="5" r="1.5" fill="#e67e22"/><line x1="5" y1="10" x2="15" y2="5" stroke="#e67e22" stroke-width="1"/><circle cx="5" cy="13" r="1.5" fill="#457b9d"/><circle cx="15" cy="12" r="1.5" fill="#457b9d"/><line x1="5" y1="13" x2="15" y2="12" stroke="#457b9d" stroke-width="1"/></svg>' },
            ]},
        ];

        const hiddenSel = document.getElementById('graphType');
        const currentVal = hiddenSel ? hiddenSel.value : 'column-points-mean';

        categories.forEach(cat => {
            const catDiv = document.createElement('div');
            catDiv.className = 'gtp-category';
            const catLabel = document.createElement('div');
            catLabel.className = 'gtp-cat-label';
            catLabel.textContent = cat.name;
            catDiv.appendChild(catLabel);

            cat.items.forEach(item => {
                const row = document.createElement('div');
                row.className = 'gtp-item' + (item.value === currentVal ? ' active' : '');
                row.dataset.value = item.value;

                const iconDiv = document.createElement('span');
                iconDiv.className = 'gtp-icon';
                iconDiv.innerHTML = item.icon;
                row.appendChild(iconDiv);

                const labelSpan = document.createElement('span');
                labelSpan.className = 'gtp-label';
                labelSpan.textContent = item.label;
                row.appendChild(labelSpan);

                row.addEventListener('click', () => {
                    container.querySelectorAll('.gtp-item').forEach(r => r.classList.remove('active'));
                    row.classList.add('active');
                    if (hiddenSel) {
                        hiddenSel.value = item.value;
                        hiddenSel.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });

                catDiv.appendChild(row);
            });

            container.appendChild(catDiv);
        });
    }

    _syncGraphTypePicker() {
        const hiddenSel = document.getElementById('graphType');
        const container = document.getElementById('graphTypePicker');
        if (!hiddenSel || !container) return;
        const val = hiddenSel.value;
        container.querySelectorAll('.gtp-item').forEach(r => {
            r.classList.toggle('active', r.dataset.value === val);
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
            const indicator = document.getElementById('testDataIndicator');
            if (indicator) indicator.textContent = '';
        });
        this._sampleIndex = { column: 0, heatmap: 0, growth: 0, volcano: 0, correlation: 0 };
        this._sampleCounts = { column: 6, heatmap: 4, growth: 6, volcano: 4, correlation: 5, pca: 4, venn: 4, oncoprint: 4, 'kaplan-meier': 1 };
        document.getElementById('addTestData').addEventListener('click', () => {
            const idx = this._sampleIndex[this.mode] || 0;
            if (this.mode === 'heatmap') {
                this.dataTable.loadHeatmapSampleData(idx);
            } else if (this.mode === 'growth') {
                this.dataTable.loadGrowthSampleData(idx);
            } else if (this.mode === 'volcano') {
                this.dataTable.loadVolcanoSampleData(idx);
            } else if (this.mode === 'correlation') {
                this.dataTable.loadCorrelationSampleData(idx);
            } else if (this.mode === 'pca') {
                this.dataTable.loadHeatmapSampleData(idx);
            } else if (this.mode === 'venn') {
                this.dataTable.loadVennSampleData(idx);
            } else if (this.mode === 'oncoprint') {
                this.dataTable.loadOncoPrintSampleData(idx);
            } else {
                this.dataTable.loadSampleData(idx);
            }
            this._sampleIndex[this.mode] = idx + 1;
            this._updateTestDataIndicator();
        });

        // Expand table toggle
        const expandBtn = document.getElementById('expandTable');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => {
                const mc = document.querySelector('.main-content');
                const expanding = !mc.classList.contains('table-expanded');
                mc.classList.toggle('table-expanded');
                expandBtn.classList.toggle('active', expanding);
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
            this._syncGraphTypePicker();
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
        // Auto-run correlation test if no results yet
        if (this.mode === 'correlation' && (!resultsEl || !resultsEl.textContent.trim())) {
            const testType = document.getElementById('testType')?.value || 'pearson';
            this._runCorrelationTest(testType);
        }
        if (!resultsEl || !resultsEl.textContent.trim()) {
            alert('No statistics results to export. Run a test first.');
            return;
        }
        // Use pre-formatted plain text for correlation, fall back to innerText
        const text = (this.mode === 'correlation' && this._lastCorrelationStatsText)
            ? this._lastCorrelationStatsText
            : (resultsEl.innerText || resultsEl.textContent);
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
                const mgr = this.annotationManager;
                mgr.setTool(toolMap[id]);
                this.updateGraph();
            });
        });

        document.getElementById('drawUndo').addEventListener('click', () => {
            this.undo();
        });

        document.getElementById('drawDeleteSelected').addEventListener('click', () => {
            const mgr = this.annotationManager;
            mgr.deleteSelected();
        });

        document.getElementById('drawClearAll').addEventListener('click', () => {
            const mgr = this.annotationManager;
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
                if (btn.disabled) return;
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
                this._updateTestDataIndicator();
                // Rebuild text settings panel if open
                const tsPanel = document.getElementById('textSettingsPanel');
                if (tsPanel && tsPanel.style.display !== 'none') this._buildTextSettingsRows();
            });
        });

        // Reset button — full page reload
        const resetBtn = document.getElementById('resetMode');
        if (resetBtn) resetBtn.addEventListener('click', () => location.reload());

        // Per-section "Defaults" buttons
        document.querySelectorAll('.settings-default-btn').forEach(btn => {
            btn.addEventListener('click', () => this._resetCurrentMode());
        });
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
            this.growthRenderer.settings.groupOrder = [];
            this.growthRenderer.settings.hiddenGroups = [];
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
        } else if (this.mode === 'correlation') {
            const fresh = new CorrelationRenderer('graphContainer');
            this.correlationRenderer.settings = fresh.settings;
            this.correlationRenderer._nudgeOffsetKey = null;
            document.getElementById('corrWidth').value = 400;
            document.getElementById('corrHeight').value = 400;
            document.getElementById('corrXMin').value = '';
            document.getElementById('corrXMax').value = '';
            document.getElementById('corrYMin').value = '';
            document.getElementById('corrYMax').value = '';
            document.getElementById('corrXTickStep').value = '';
            document.getElementById('corrYTickStep').value = '';
            document.getElementById('corrColorTheme').value = 'default';
            document.getElementById('corrErrorType').value = 'sem';
            document.getElementById('corrPointSize').value = 6;
            document.getElementById('corrCapWidth').value = 5;
            document.getElementById('corrRegressionType').value = 'linear';
            document.getElementById('corrRegressionScope').value = 'all';
            document.getElementById('corrShowCI').checked = true;
            document.getElementById('corrShowZeroLines').checked = false;
            document.getElementById('corrStatsContent').value = 'simple';
            this._correlationTableData = null;
            this.dataTable._axisAssignments = {};
            this.dataTable.loadCorrelationSampleData();
        } else if (this.mode === 'pca') {
            const fresh = new PCARenderer('graphContainer');
            this.pcaRenderer.settings = fresh.settings;
            this.pcaRenderer._cachedEmbedding = null;
            this.pcaRenderer._nudgeOffsetKey = null;
            document.getElementById('pcaMethod').value = 'pca';
            document.getElementById('pcaWidth').value = 200;
            document.getElementById('pcaHeight').value = 200;
            document.getElementById('pcaColorTheme').value = 'default';
            document.getElementById('pcaPointSize').value = 6;
            document.getElementById('pcaPCX').value = 1;
            document.getElementById('pcaPCY').value = 2;
            document.getElementById('pcaPerplexity').value = 10;
            document.getElementById('pcaNNeighbors').value = 10;
            document.getElementById('pcaMinDist').value = 0.1;
            document.getElementById('pcaShowLoadings').checked = false;
            document.getElementById('pcaXMin').value = '';
            document.getElementById('pcaXMax').value = '';
            document.getElementById('pcaYMin').value = '';
            document.getElementById('pcaYMax').value = '';
            document.getElementById('pcaXTickStep').value = '';
            document.getElementById('pcaYTickStep').value = '';
            // Show PCA-specific, hide others
            document.querySelectorAll('.pca-only').forEach(el => el.style.display = '');
            document.querySelectorAll('.tsne-only').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.umap-only').forEach(el => el.style.display = 'none');
            this._pcaTableData = null;
            this.dataTable.loadHeatmapSampleData(2);
        } else if (this.mode === 'venn') {
            const fresh = new VennRenderer('graphContainer');
            this.vennRenderer.settings = fresh.settings;
            this.vennRenderer._nudgeOffsetKey = null;
            document.getElementById('vennPlotType').value = 'auto';
            document.getElementById('vennWidth').value = 450;
            document.getElementById('vennHeight').value = 400;
            document.getElementById('vennColorTheme').value = 'default';
            document.getElementById('vennOpacity').value = 0.35;
            document.getElementById('vennShowCounts').checked = true;
            document.getElementById('vennShowPercentages').checked = false;
            document.getElementById('vennShowLabels').checked = true;
            this._vennTableData = null;
            this.dataTable.loadVennSampleData();
        } else if (this.mode === 'oncoprint') {
            const fresh = new OncoPrintRenderer('graphContainer');
            this.oncoprintRenderer.settings = fresh.settings;
            this.oncoprintRenderer._nudgeOffsetKey = null;
            document.getElementById('oncoprintWidth').value = 600;
            document.getElementById('oncoprintColorTheme').value = 'default';
            document.getElementById('oncoprintCellWidth').value = 12;
            document.getElementById('oncoprintCellHeight').value = 20;
            document.getElementById('oncoprintCellGap').value = 1;
            document.getElementById('oncoprintShowRowBar').checked = true;
            document.getElementById('oncoprintShowColBar').checked = true;
            document.getElementById('oncoprintSortSamples').checked = true;
            this._oncoprintTableData = null;
            this.dataTable.loadOncoPrintSampleData();
        } else if (this.mode === 'kaplan-meier') {
            const fresh = new KaplanMeierRenderer('graphContainer');
            this.kaplanMeierRenderer.settings = fresh.settings;
            this.kaplanMeierRenderer._nudgeOffsetKey = null;
            document.getElementById('kmWidth').value = 300;
            document.getElementById('kmHeight').value = 300;
            document.getElementById('kmColorTheme').value = 'default';
            document.getElementById('kmLineWidth').value = 2;
            document.getElementById('kmShowCensored').checked = true;
            document.getElementById('kmShowCI').checked = false;
            document.getElementById('kmShowMedian').checked = false;
            document.getElementById('kmShowRiskTable').checked = false;
            document.getElementById('kmShowLogRank').checked = true;
            this._kaplanMeierTableData = null;
            this.dataTable.loadKaplanMeierSampleData();
        } else if (this.mode === 'column') {
            this.graphRenderer.settings = new GraphRenderer('graphContainer').settings;
            this.graphRenderer._titleOffset = { x: 0, y: 0 };
            this.graphRenderer._zeroLineAutoSet = false;
            document.getElementById('graphWidth').value = 200;
            document.getElementById('graphHeight').value = 200;
            document.getElementById('yAxisMin').value = '';
            document.getElementById('yAxisMax').value = '';
            document.getElementById('yAxisTickStep').value = '';
            document.getElementById('colorTheme').value = 'default';
            document.getElementById('showGroupLegend').checked = false;
            const gtSel = document.getElementById('graphType');
            if (gtSel) { gtSel.value = 'column-points-mean'; gtSel.dispatchEvent(new Event('change')); }
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
        const key = mode === 'column' ? '_columnTableData' : mode === 'growth' ? '_growthTableData' : mode === 'volcano' ? '_volcanoTableData' : mode === 'correlation' ? '_correlationTableData' : mode === 'pca' ? '_pcaTableData' : mode === 'venn' ? '_vennTableData' : mode === 'oncoprint' ? '_oncoprintTableData' : mode === 'kaplan-meier' ? '_kaplanMeierTableData' : '_heatmapTableData';
        const saved = { headers, rows, idData, disabledRows, numRows: rows.length };
        if (mode === 'correlation' && this.dataTable._axisAssignments) {
            saved.axisAssignments = { ...this.dataTable._axisAssignments };
        }
        this[key] = saved;
    }

    _restoreTableData(mode) {
        const key = mode === 'column' ? '_columnTableData' : mode === 'growth' ? '_growthTableData' : mode === 'volcano' ? '_volcanoTableData' : mode === 'correlation' ? '_correlationTableData' : mode === 'pca' ? '_pcaTableData' : mode === 'venn' ? '_vennTableData' : mode === 'oncoprint' ? '_oncoprintTableData' : mode === 'kaplan-meier' ? '_kaplanMeierTableData' : '_heatmapTableData';
        const saved = this[key];
        if (saved) {
            this.dataTable.setupTable(saved.headers, saved.numRows, saved.rows, saved.idData);
            if (mode === 'correlation' && saved.axisAssignments) {
                this.dataTable._axisAssignments = { ...saved.axisAssignments };
                if (document.getElementById('axisAssignmentRow')?.style.display !== 'none') {
                    this.dataTable._rebuildAxisAssignmentCells();
                }
            }
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
            } else if (mode === 'pca') {
                this.dataTable.loadHeatmapSampleData(2); // immune profiling dataset
            } else if (mode === 'growth') {
                this.dataTable.loadGrowthSampleData();
            } else if (mode === 'volcano') {
                this.dataTable.loadVolcanoSampleData();
            } else if (mode === 'correlation') {
                this.dataTable.loadCorrelationSampleData();
            } else if (mode === 'venn') {
                this.dataTable.loadVennSampleData();
            } else if (mode === 'oncoprint') {
                this.dataTable.loadOncoPrintSampleData();
            } else if (mode === 'kaplan-meier') {
                this.dataTable.loadKaplanMeierSampleData();
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
        const isCorrelation = this.mode === 'correlation';
        const isPCA = this.mode === 'pca';
        const isVenn = this.mode === 'venn';
        const isOncoprint = this.mode === 'oncoprint';
        const isKaplanMeier = this.mode === 'kaplan-meier';

        // Clean up PCA column toggles when leaving PCA mode
        if (!isPCA) {
            this._cleanupPCAColumnToggles();
        }

        // Show/hide ID columns and row toggles
        const table = document.getElementById('dataTable');
        if (table) {
            table.classList.toggle('hide-id-cols', !(isHeatmap || isCorrelation || isPCA || isVenn || isOncoprint));
            table.classList.toggle('hide-row-toggles', !(isHeatmap || isCorrelation || isPCA || isVenn || isOncoprint));
        }

        // Axis assignment row
        if (isCorrelation) {
            this.dataTable.showAxisAssignmentRow();
        } else {
            this.dataTable.hideAxisAssignmentRow();
        }

        // Table hint — context-sensitive
        const tableHint = document.getElementById('tableHint');
        if (tableHint) {
            if (isHeatmap || isPCA || isVenn || isOncoprint) {
                tableHint.textContent = 'Click column headers to hide/show them in the graph. Double-click row checkboxes to toggle samples.';
                tableHint.style.display = '';
            } else if (isColumn) {
                tableHint.textContent = 'Each column is a group. Paste data from spreadsheets.';
                tableHint.style.display = '';
            } else if (isGrowth) {
                tableHint.textContent = 'First column = time points. Remaining columns = samples (name format: Group_Replicate).';
                tableHint.style.display = '';
            } else if (isCorrelation) {
                tableHint.textContent = 'Assign columns to X or Y axis using the row below headers.';
                tableHint.style.display = '';
            } else if (isVolcano) {
                tableHint.textContent = 'Columns: Gene/Feature, Log2 Fold Change, P-value.';
                tableHint.style.display = '';
            } else if (isKaplanMeier) {
                tableHint.textContent = 'Columns: Time, Status (1=event, 0=censored), Group.';
                tableHint.style.display = '';
            } else {
                tableHint.style.display = 'none';
            }
        }

        // Column-specific controls
        const groupMgr = document.getElementById('groupManager');
        if (groupMgr) groupMgr.style.display = isColumn ? '' : 'none';

        // Column bottom row (graph type picker + statistics side-by-side)
        const columnBottomRow = document.getElementById('columnBottomRow');
        const statsSection = document.getElementById('statisticsSection');
        const statsWrapper = document.getElementById('columnStatsWrapper');
        const graphControlsEl2 = document.querySelector('.graph-controls');
        if (columnBottomRow && statsSection && statsWrapper && graphControlsEl2) {
            if (isColumn) {
                columnBottomRow.style.display = '';
                statsWrapper.appendChild(statsSection);
                statsSection.style.display = '';
            } else {
                columnBottomRow.style.display = 'none';
                // Move stats back to graph-controls for growth mode
                graphControlsEl2.appendChild(statsSection);
                statsSection.style.display = (isGrowth) ? '' : 'none';
            }
        }

        // Growth-specific: group order manager
        const growthGrpMgr = document.getElementById('growthGroupManager');
        if (growthGrpMgr) growthGrpMgr.style.display = isGrowth ? '' : 'none';

        // Heatmap-specific: column/row order managers
        const heatmapColMgr = document.getElementById('heatmapColManager');
        if (heatmapColMgr) heatmapColMgr.style.display = isHeatmap ? '' : 'none';

        // Hide all .column-only elements except in column mode
        document.querySelectorAll('.column-only').forEach(el => {
            el.style.display = isColumn ? '' : 'none';
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

        // Correlation controls
        const correlationControls = document.getElementById('correlationControls');
        if (correlationControls) correlationControls.style.display = isCorrelation ? '' : 'none';

        // Correlation group manager
        const corrGrpMgr = document.getElementById('correlationGroupManager');
        if (corrGrpMgr) corrGrpMgr.style.display = isCorrelation ? '' : 'none';

        // PCA controls
        const pcaControls = document.getElementById('pcaControls');
        if (pcaControls) pcaControls.style.display = isPCA ? '' : 'none';

        // PCA group manager
        const pcaGrpMgr = document.getElementById('pcaGroupManager');
        if (pcaGrpMgr) pcaGrpMgr.style.display = isPCA ? '' : 'none';

        // Venn controls
        const vennControls = document.getElementById('vennControls');
        if (vennControls) vennControls.style.display = isVenn ? '' : 'none';

        // OncoPrint controls
        const oncoprintControls = document.getElementById('oncoprintControls');
        if (oncoprintControls) oncoprintControls.style.display = isOncoprint ? '' : 'none';

        // Kaplan-Meier controls
        const kmControls = document.getElementById('kaplanMeierControls');
        if (kmControls) kmControls.style.display = isKaplanMeier ? '' : 'none';

        // Hide graph-controls wrapper for modes that don't use it
        const graphControlsEl = document.querySelector('.graph-controls');
        if (graphControlsEl) graphControlsEl.style.display = (isVolcano || isHeatmap || isKaplanMeier || isPCA || isVenn || isOncoprint) ? 'none' : '';

        // Hide appearance controls that are now in the gear popout
        this._hideMovedControls();

        // Show dimensions section only in column mode
        const dimSection = document.getElementById('dimensionsSection');
        if (dimSection) dimSection.style.display = isColumn ? '' : 'none';

        // Show/hide heatmap-only export buttons
        document.querySelectorAll('.heatmap-only').forEach(el => {
            el.style.display = isHeatmap ? 'inline-block' : 'none';
        });

        // Stats export only for column/growth/correlation
        const statsBtn = document.getElementById('exportStats');
        if (statsBtn) statsBtn.style.display = (isColumn || isGrowth || isCorrelation) ? '' : 'none';

        // Filter test type options by mode
        const testSel = document.getElementById('testType');
        if (testSel) {
            testSel.querySelectorAll('optgroup').forEach(og => {
                const label = og.getAttribute('label') || '';
                if (label === 'Growth Curves') {
                    og.style.display = isGrowth ? '' : 'none';
                } else if (label === 'Correlation') {
                    og.style.display = isCorrelation ? '' : 'none';
                } else {
                    og.style.display = (isGrowth || isVolcano || isCorrelation) ? 'none' : '';
                }
            });
            // Reset to appropriate default when switching modes
            if (isCorrelation && !['pearson','spearman','linear-regression','none'].includes(testSel.value)) {
                testSel.value = 'pearson';
                testSel.dispatchEvent(new Event('change'));
            } else if (isGrowth && testSel.value !== 'two-way-rm-anova' && testSel.value !== 'none') {
                testSel.value = 'two-way-rm-anova';
                testSel.dispatchEvent(new Event('change'));
            } else if (!isGrowth && testSel.value === 'two-way-rm-anova') {
                testSel.value = 'one-way-anova';
                testSel.dispatchEvent(new Event('change'));
            } else if (!isCorrelation && ['pearson','spearman','linear-regression'].includes(testSel.value)) {
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

    _hideMovedControls() {
        // Hide controls from bottom panels that are now in the gear popout
        const hideMap = {
            column: ['graphWidth','graphHeight','pointSize','centerLineWidth','errorBarWidth',
                'colorTheme','orientation','pointSpread','xTickAngle','errorBarDirection',
                'yAxisMin','yAxisMax','yAxisTickStep','yAxisScaleType'],
            growth: ['growthWidth','growthHeight','growthSymbolSize','growthMeanLineWidth','growthCapWidth',
                'growthColorTheme','growthXMin','growthXMax','growthYMin','growthYMax','growthXTickStep','growthYTickStep'],
            volcano: ['volcanoWidth','volcanoHeight','volcanoPointSize'],
            correlation: ['corrWidth','corrHeight','corrPointSize','corrCapWidth','corrColorTheme',
                'corrXMin','corrXMax','corrYMin','corrYMax','corrXTickStep','corrYTickStep'],
            heatmap: ['heatmapWidth','heatmapHeight','heatmapColorScheme','heatmapGroupColorTheme','heatmapLegendWidth'],
            venn: ['vennWidth','vennHeight','vennColorTheme','vennOpacity'],
            oncoprint: ['oncoprintWidth','oncoprintCellWidth','oncoprintCellHeight','oncoprintCellGap','oncoprintColorTheme'],
            'kaplan-meier': ['kmWidth','kmHeight','kmLineWidth','kmColorTheme']
        };
        const ids = hideMap[this.mode] || [];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const cg = el.closest('.control-group, .hm-ctrl');
            if (cg) cg.style.display = 'none';
        });
    }

    // ===== Graph Settings Panel (gear button) =====
    _bindGraphSettingsPanel() {
        const btn = document.getElementById('graphSettingsBtn');
        const closeBtn = document.getElementById('graphSettingsClose');
        if (btn) btn.addEventListener('click', () => this._toggleGraphSettingsPanel());
        if (closeBtn) closeBtn.addEventListener('click', () => this._closeGraphSettingsPanel());
        this._makeGraphSettingsDraggable();
    }

    _makeGraphSettingsDraggable() {
        const panel = document.getElementById('graphSettingsPanel');
        const handle = document.getElementById('graphSettingsDragHandle');
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

    _toggleGraphSettingsPanel() {
        const panel = document.getElementById('graphSettingsPanel');
        if (!panel) return;
        const btn = document.getElementById('graphSettingsBtn');
        if (panel.style.display === 'none') {
            this._openGraphSettingsPanel();
            if (btn) btn.classList.add('active');
        } else {
            this._closeGraphSettingsPanel();
        }
    }

    _closeGraphSettingsPanel() {
        const panel = document.getElementById('graphSettingsPanel');
        if (panel) panel.style.display = 'none';
        const btn = document.getElementById('graphSettingsBtn');
        if (btn) btn.classList.remove('active');
        if (this._graphSettingsOutsideHandler) {
            document.removeEventListener('mousedown', this._graphSettingsOutsideHandler);
            this._graphSettingsOutsideHandler = null;
        }
    }

    _openGraphSettingsPanel() {
        const panel = document.getElementById('graphSettingsPanel');
        const body = document.getElementById('graphSettingsBody');
        if (!panel || !body) return;

        panel.style.display = '';
        this._buildGraphSettingsRows();

        // Position near toolbar
        const toolbar = document.getElementById('drawingToolbar');
        if (toolbar) {
            const rect = toolbar.getBoundingClientRect();
            let top = rect.bottom + 4;
            let left = rect.left;
            const panelRect = panel.getBoundingClientRect();
            if (top + panelRect.height > window.innerHeight - 10) top = Math.max(10, window.innerHeight - panelRect.height - 10);
            const pw = panelRect.width || 280;
            if (left + pw > window.innerWidth) left = Math.max(10, window.innerWidth - pw - 10);
            panel.style.left = left + 'px';
            panel.style.top = top + 'px';
            panel.style.right = 'auto';
        }

        // Close on outside click
        if (this._graphSettingsOutsideHandler) {
            document.removeEventListener('mousedown', this._graphSettingsOutsideHandler);
        }
        this._graphSettingsOutsideHandler = (e) => {
            const btn = document.getElementById('graphSettingsBtn');
            if (!panel.contains(e.target) && (!btn || !btn.contains(e.target))) {
                this._closeGraphSettingsPanel();
                document.removeEventListener('mousedown', this._graphSettingsOutsideHandler);
                this._graphSettingsOutsideHandler = null;
            }
        };
        setTimeout(() => {
            document.addEventListener('mousedown', this._graphSettingsOutsideHandler);
        }, 100);
    }

    _buildGraphSettingsRows() {
        const body = document.getElementById('graphSettingsBody');
        if (!body) return;
        body.innerHTML = '';

        // Define settings per mode: each entry maps to a hidden or visible HTML input by ID
        let rows = [];
        if (this.mode === 'column') {
            rows = [
                { label: 'Width', inputId: 'graphWidth', type: 'number', min: 50, step: 10 },
                { label: 'Height', inputId: 'graphHeight', type: 'number', min: 50, step: 10 },
                { label: 'Pt Size', inputId: 'pointSize', type: 'number', min: 1, max: 30, step: 1 },
                { label: 'Bar W', inputId: 'centerLineWidth', type: 'number', min: 0.1, step: 0.1 },
                { label: 'Err Cap', inputId: 'errorBarWidth', type: 'number', min: 0, step: 0.5 },
                { label: 'Colors', inputId: 'colorTheme' },
                { label: 'Orient', inputId: 'orientation' },
                { label: 'Spread', inputId: 'pointSpread' },
                { label: 'X-angle', inputId: 'xTickAngle' },
                { label: 'Err Dir', inputId: 'errorBarDirection' },
                { label: 'Y Min', inputId: 'yAxisMin', type: 'number', step: 'any', placeholder: 'Auto' },
                { label: 'Y Max', inputId: 'yAxisMax', type: 'number', step: 'any', placeholder: 'Auto' },
                { label: 'Y Step', inputId: 'yAxisTickStep', type: 'number', step: 'any', min: 0, placeholder: 'Auto' },
                { label: 'Y Scale', inputId: 'yAxisScaleType' }
            ];
        } else if (this.mode === 'growth') {
            rows = [
                { label: 'Width', inputId: 'growthWidth', type: 'number', min: 100, step: 10 },
                { label: 'Height', inputId: 'growthHeight', type: 'number', min: 100, step: 10 },
                { label: 'Sym Size', inputId: 'growthSymbolSize', type: 'number', min: 1, max: 20, step: 0.5 },
                { label: 'Line W', inputId: 'growthMeanLineWidth', type: 'number', min: 0.5, max: 10, step: 0.5 },
                { label: 'Cap W', inputId: 'growthCapWidth', type: 'number', min: 0, max: 20, step: 1 },
                { label: 'Colors', inputId: 'growthColorTheme' },
                { label: 'X Min', inputId: 'growthXMin', type: 'number', step: 'any', placeholder: 'Auto' },
                { label: 'X Max', inputId: 'growthXMax', type: 'number', step: 'any', placeholder: 'Auto' },
                { label: 'Y Min', inputId: 'growthYMin', type: 'number', step: 'any', placeholder: 'Auto' },
                { label: 'Y Max', inputId: 'growthYMax', type: 'number', step: 'any', placeholder: 'Auto' },
                { label: 'X Step', inputId: 'growthXTickStep', type: 'number', step: 'any', min: 0, placeholder: 'Auto' },
                { label: 'Y Step', inputId: 'growthYTickStep', type: 'number', step: 'any', min: 0, placeholder: 'Auto' }
            ];
        } else if (this.mode === 'volcano') {
            rows = [
                { label: 'Width', inputId: 'volcanoWidth', type: 'number', min: 100, step: 10 },
                { label: 'Height', inputId: 'volcanoHeight', type: 'number', min: 100, step: 10 },
                { label: 'Pt Size', inputId: 'volcanoPointSize', type: 'number', min: 1, max: 20, step: 0.5 },
                { label: 'Up', inputId: 'volcanoUpColor', type: 'color' },
                { label: 'Down', inputId: 'volcanoDownColor', type: 'color' }
            ];
        } else if (this.mode === 'correlation') {
            rows = [
                { label: 'Width', inputId: 'corrWidth', type: 'number', min: 100, step: 10 },
                { label: 'Height', inputId: 'corrHeight', type: 'number', min: 100, step: 10 },
                { label: 'Pt Size', inputId: 'corrPointSize', type: 'number', min: 1, max: 20, step: 0.5 },
                { label: 'Cap W', inputId: 'corrCapWidth', type: 'number', min: 0, max: 20, step: 1 },
                { label: 'Colors', inputId: 'corrColorTheme' },
                { label: '', inputId: null },
                { label: 'X Min', inputId: 'corrXMin', type: 'number', step: 'any', placeholder: 'Auto' },
                { label: 'X Max', inputId: 'corrXMax', type: 'number', step: 'any', placeholder: 'Auto' },
                { label: 'Y Min', inputId: 'corrYMin', type: 'number', step: 'any', placeholder: 'Auto' },
                { label: 'Y Max', inputId: 'corrYMax', type: 'number', step: 'any', placeholder: 'Auto' },
                { label: 'X Step', inputId: 'corrXTickStep', type: 'number', step: 'any', min: 0, placeholder: 'Auto' },
                { label: 'Y Step', inputId: 'corrYTickStep', type: 'number', step: 'any', min: 0, placeholder: 'Auto' }
            ];
        } else if (this.mode === 'pca') {
            rows = [
                { label: 'Width', inputId: 'pcaWidth', type: 'number', min: 200, step: 10 },
                { label: 'Height', inputId: 'pcaHeight', type: 'number', min: 200, step: 10 },
                { label: 'Pt Size', inputId: 'pcaPointSize', type: 'number', min: 1, max: 20, step: 0.5 },
                { label: 'Colors', inputId: 'pcaColorTheme' },
                { label: 'X Min', inputId: 'pcaXMin', type: 'number', step: 'any', placeholder: 'Auto' },
                { label: 'X Max', inputId: 'pcaXMax', type: 'number', step: 'any', placeholder: 'Auto' },
                { label: 'Y Min', inputId: 'pcaYMin', type: 'number', step: 'any', placeholder: 'Auto' },
                { label: 'Y Max', inputId: 'pcaYMax', type: 'number', step: 'any', placeholder: 'Auto' },
                { label: 'X Step', inputId: 'pcaXTickStep', type: 'number', step: 'any', min: 0, placeholder: 'Auto' },
                { label: 'Y Step', inputId: 'pcaYTickStep', type: 'number', step: 'any', min: 0, placeholder: 'Auto' }
            ];
        } else if (this.mode === 'heatmap') {
            rows = [
                { label: 'Width', inputId: 'heatmapWidth', type: 'number', min: 50, step: 10 },
                { label: 'Height', inputId: 'heatmapHeight', type: 'number', min: 50, step: 10 },
                { label: 'Colors', inputId: 'heatmapColorScheme' },
                { label: 'Grp Col', inputId: 'heatmapGroupColorTheme' },
                { label: 'Lgnd W', inputId: 'heatmapLegendWidth', type: 'number', min: 20, max: 150, step: 5, placeholder: 'Auto' }
            ];
        } else if (this.mode === 'venn') {
            rows = [
                { label: 'Width', inputId: 'vennWidth', type: 'number', min: 100, step: 10 },
                { label: 'Height', inputId: 'vennHeight', type: 'number', min: 100, step: 10 },
                { label: 'Colors', inputId: 'vennColorTheme' },
                { label: 'Opacity', inputId: 'vennOpacity', type: 'number', min: 0, max: 1, step: 0.05 }
            ];
        } else if (this.mode === 'oncoprint') {
            rows = [
                { label: 'Width', inputId: 'oncoprintWidth', type: 'number', min: 100, step: 10 },
                { label: 'Cell W', inputId: 'oncoprintCellWidth', type: 'number', min: 4, max: 40, step: 1 },
                { label: 'Cell H', inputId: 'oncoprintCellHeight', type: 'number', min: 8, max: 60, step: 1 },
                { label: 'Gap', inputId: 'oncoprintCellGap', type: 'number', min: 0, max: 5, step: 0.5 },
                { label: 'Colors', inputId: 'oncoprintColorTheme' }
            ];
        } else if (this.mode === 'kaplan-meier') {
            rows = [
                { label: 'Width', inputId: 'kmWidth', type: 'number', min: 200, step: 10 },
                { label: 'Height', inputId: 'kmHeight', type: 'number', min: 200, step: 10 },
                { label: 'Line W', inputId: 'kmLineWidth', type: 'number', min: 0.5, max: 6, step: 0.5 },
                { label: 'Colors', inputId: 'kmColorTheme' }
            ];
        }

        if (rows.length === 0) {
            body.innerHTML = '<div style="padding:8px;font-size:12px;color:#888">No appearance settings for this mode.</div>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'gs-grid';

        rows.forEach(row => {
            if (!row.inputId) {
                grid.appendChild(document.createElement('div'));
                return;
            }
            const sourceInput = document.getElementById(row.inputId);
            if (!sourceInput) return;

            const rowDiv = document.createElement('div');
            rowDiv.className = 'gs-row';

            const lbl = document.createElement('label');
            lbl.textContent = row.label;
            rowDiv.appendChild(lbl);

            if (sourceInput.tagName === 'SELECT') {
                // Mirror select element
                const select = document.createElement('select');
                Array.from(sourceInput.options).forEach(opt => {
                    const o = document.createElement('option');
                    o.value = opt.value; o.textContent = opt.textContent;
                    if (opt.value === sourceInput.value) o.selected = true;
                    select.appendChild(o);
                });
                select.addEventListener('change', () => {
                    sourceInput.value = select.value;
                    sourceInput.dispatchEvent(new Event('input', { bubbles: true }));
                    sourceInput.dispatchEvent(new Event('change', { bubbles: true }));
                });
                rowDiv.appendChild(select);
            } else if (row.type === 'color') {
                const colorInp = document.createElement('input');
                colorInp.type = 'color';
                colorInp.value = sourceInput.value;
                colorInp.style.cssText = 'width:40px;height:24px;padding:0;border:1px solid #ccc;border-radius:3px;cursor:pointer';
                colorInp.addEventListener('input', () => {
                    sourceInput.value = colorInp.value;
                    sourceInput.dispatchEvent(new Event('input', { bubbles: true }));
                });
                rowDiv.appendChild(colorInp);
            } else {
                const input = document.createElement('input');
                input.type = row.type || 'number';
                input.value = sourceInput.value;
                if (row.min !== undefined) input.min = row.min;
                if (row.max !== undefined) input.max = row.max;
                if (row.step !== undefined) input.step = row.step;
                if (row.placeholder) input.placeholder = row.placeholder;
                input.addEventListener('input', () => {
                    sourceInput.value = input.value;
                    sourceInput.dispatchEvent(new Event('input', { bubbles: true }));
                });
                rowDiv.appendChild(input);
            }

            // Hide the source control from bottom panel
            const cg = sourceInput.closest('.control-group, .hm-ctrl');
            if (cg && sourceInput.type !== 'hidden') cg.style.display = 'none';

            grid.appendChild(rowDiv);
        });

        body.appendChild(grid);
    }

    _getActiveRenderer() {
        if (this.mode === 'column') return this.graphRenderer;
        if (this.mode === 'growth') return this.growthRenderer;
        if (this.mode === 'volcano') return this.volcanoRenderer;
        if (this.mode === 'correlation') return this.correlationRenderer;
        if (this.mode === 'pca') return this.pcaRenderer;
        if (this.mode === 'venn') return this.vennRenderer;
        if (this.mode === 'oncoprint') return this.oncoprintRenderer;
        if (this.mode === 'kaplan-meier') return this.kaplanMeierRenderer;
        return this.heatmapRenderer;
    }

    _getTextSettingsRenderer() {
        return this._getActiveRenderer();
    }

    _openTextSettingsPanel() {
        const panel = document.getElementById('textSettingsPanel');
        const body = document.getElementById('textSettingsBody');
        if (!panel || !body) return;

        panel.style.display = '';
        this._buildTextSettingsRows();

        // Position near toolbar, clamped to viewport (after content built so height is known)
        const toolbar = document.getElementById('drawingToolbar');
        if (toolbar) {
            const rect = toolbar.getBoundingClientRect();
            let top = rect.bottom + 4;
            let left = rect.left;
            const panelRect = panel.getBoundingClientRect();
            if (top + panelRect.height > window.innerHeight - 10) top = Math.max(10, window.innerHeight - panelRect.height - 10);
            if (left + 360 > window.innerWidth) left = Math.max(10, window.innerWidth - 370);
            panel.style.left = left + 'px';
            panel.style.top = top + 'px';
            panel.style.right = 'auto';
        }

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
        const families = ['Aptos Display', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New'];

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
                { label: 'Gene Labels', fontKey: 'labelFont', visKey: 'showLabels' }
            ];
        } else if (this.mode === 'correlation') {
            elements = [
                { label: 'Title', textKey: 'title', fontKey: 'titleFont', visKey: 'showTitle' },
                { label: 'X Axis Label', textKey: 'xLabel', fontKey: 'xLabelFont', visKey: 'showXLabel' },
                { label: 'Y Axis Label', textKey: 'yLabel', fontKey: 'yLabelFont', visKey: 'showYLabel' },
                { label: 'Legend', fontKey: 'legendFont', visKey: 'showLegend' },
                { label: 'X Tick Font', fontKey: 'xTickFont', tickStep: 'xTickStep' },
                { label: 'Y Tick Font', fontKey: 'yTickFont', tickStep: 'yTickStep' },
                { label: 'Stats Box', fontKey: 'statsFont' }
            ];
            this._correlationGroupRows = true;
        } else if (this.mode === 'pca') {
            elements = [
                { label: 'Title', textKey: 'title', fontKey: 'titleFont', visKey: 'showTitle' },
                { label: 'X Axis Label', textKey: 'xLabel', fontKey: 'xLabelFont', visKey: 'showXLabel' },
                { label: 'Y Axis Label', textKey: 'yLabel', fontKey: 'yLabelFont', visKey: 'showYLabel' },
                { label: 'Legend', fontKey: 'legendFont', visKey: 'showLegend' },
                { label: 'X Tick Font', fontKey: 'xTickFont' },
                { label: 'Y Tick Font', fontKey: 'yTickFont' },
                { label: 'Loadings', fontKey: 'loadingsFont', colorKey: 'loadingsColor' }
            ];
            this._pcaGroupRows = true;
        } else if (this.mode === 'venn') {
            elements = [
                { label: 'Title', textKey: 'title', fontKey: 'titleFont', visKey: 'showTitle' },
                { label: 'Set Labels', fontKey: 'labelFont' },
                { label: 'Counts', fontKey: 'countFont' }
            ];
        } else if (this.mode === 'oncoprint') {
            elements = [
                { label: 'Title', textKey: 'title', fontKey: 'titleFont', visKey: 'showTitle' },
                { label: 'Row Labels', fontKey: 'rowLabelFont' },
                { label: 'Legend', fontKey: 'legendFont', visKey: 'showLegend' }
            ];
        } else if (this.mode === 'kaplan-meier') {
            elements = [
                { label: 'Title', textKey: 'title', fontKey: 'titleFont', visKey: 'showTitle' },
                { label: 'X Axis Label', textKey: 'xLabel', fontKey: 'xLabelFont', visKey: 'showXLabel' },
                { label: 'Y Axis Label', textKey: 'yLabel', fontKey: 'yLabelFont', visKey: 'showYLabel' },
                { label: 'Legend', fontKey: 'legendFont', visKey: 'showLegend' },
                { label: 'X Tick Font', fontKey: 'xTickFont' },
                { label: 'Y Tick Font', fontKey: 'yTickFont' }
            ];
            this._kmGroupRows = true;
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

            // Color picker for elements like loadings
            if (el.colorKey) {
                const colorInp = document.createElement('input');
                colorInp.type = 'color';
                colorInp.value = s[el.colorKey] || '#c0392b';
                colorInp.style.cssText = 'width:24px;height:24px;padding:0;border:1px solid #d1d5db;border-radius:3px;cursor:pointer;margin-left:4px';
                colorInp.addEventListener('input', () => {
                    s[el.colorKey] = colorInp.value;
                    this.updateGraph();
                });
                fc.appendChild(colorInp);
            }

            // Tick step control — make row full-width so it doesn't overflow
            if (el.tickStep) {
                row.classList.add('ts-full-width');
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
                    grow.className = 'text-settings-row ts-full-width';
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
                    grow.className = 'text-settings-row ts-full-width';
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

        // Per-group color/symbol for correlation mode
        if (this._correlationGroupRows) {
            this._correlationGroupRows = false;
            const corrData = this.dataTable.getCorrelationData();
            if (corrData && corrData.groups && corrData.groups.length > 0) {
                const sep = document.createElement('div');
                sep.style.cssText = 'grid-column:1/-1;border-top:1px solid #e5e7eb;margin:6px 0 2px;font-size:11px;font-weight:600;color:#374151;padding-top:4px';
                sep.textContent = 'Group Colors & Symbols';
                body.appendChild(sep);

                const gr = this.correlationRenderer;
                if (!gr.settings.groupOverrides) gr.settings.groupOverrides = {};
                const symbols = ['circle','square','triangle','diamond','cross','star'];

                corrData.groups.forEach((gObj, gi) => {
                    const gName = gObj.group;
                    const ov = gr.settings.groupOverrides[gName] || {};
                    const grow = document.createElement('div');
                    grow.className = 'text-settings-row ts-full-width';
                    grow.style.cssText = 'display:flex;align-items:center;gap:4px;padding:2px 0';

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

        // Per-group color/symbol for PCA mode
        if (this._pcaGroupRows) {
            this._pcaGroupRows = false;
            const matrixData = this.dataTable.getMatrixData();
            if (matrixData && matrixData.groupAssignments) {
                const groupNames = [...new Set(matrixData.groupAssignments)];
                if (groupNames.length > 0) {
                    const sep = document.createElement('div');
                    sep.className = 'ts-full-width';
                    sep.style.cssText = 'grid-column:1/-1;border-top:1px solid #e5e7eb;margin:6px 0 2px;font-size:11px;font-weight:600;color:#374151;padding-top:4px';
                    sep.textContent = 'Group Colors & Symbols';
                    body.appendChild(sep);

                    const gr = this.pcaRenderer;
                    if (!gr.settings.groupOverrides) gr.settings.groupOverrides = {};
                    const symbols = ['circle','square','triangle','diamond','cross','star'];

                    groupNames.forEach((gName, gi) => {
                        const ov = gr.settings.groupOverrides[gName] || {};
                        const grow = document.createElement('div');
                        grow.className = 'text-settings-row ts-full-width';
                        grow.style.cssText = 'display:flex;align-items:center;gap:4px;padding:2px 0';

                        const colorInp = document.createElement('input');
                        colorInp.type = 'color';
                        colorInp.value = ov.color || gr._getColor(gi, gName);
                        colorInp.style.cssText = 'width:24px;height:20px;border:1px solid #ccc;border-radius:3px;cursor:pointer;padding:0;flex:0 0 24px';
                        colorInp.addEventListener('input', () => {
                            if (!gr.settings.groupOverrides[gName]) gr.settings.groupOverrides[gName] = {};
                            gr.settings.groupOverrides[gName].color = colorInp.value;
                            this.updateGraph();
                        });
                        grow.appendChild(colorInp);

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

        if (this._kmGroupRows) {
            this._kmGroupRows = false;
            const kmData = this.dataTable.getKaplanMeierData ? this.dataTable.getKaplanMeierData() : null;
            if (kmData && kmData.groups) {
                const groupNames = Array.isArray(kmData.groups) ? kmData.groups : Object.keys(kmData.groups);
                if (groupNames.length > 0) {
                    const sep = document.createElement('div');
                    sep.className = 'ts-full-width';
                    sep.style.cssText = 'grid-column:1/-1;border-top:1px solid #e5e7eb;margin:6px 0 2px;font-size:11px;font-weight:600;color:#374151;padding-top:4px';
                    sep.textContent = 'Group Colors & Line Styles';
                    body.appendChild(sep);

                    const gr = this.kaplanMeierRenderer;
                    if (!gr.settings.groupOverrides) gr.settings.groupOverrides = {};
                    const dashes = [['solid','Solid'],['dashed','Dashed'],['dotted','Dotted'],['dashdot','Dash-dot'],['longdash','Long dash']];

                    groupNames.forEach((gName, gi) => {
                        const ov = gr.settings.groupOverrides[gName] || {};
                        const grow = document.createElement('div');
                        grow.className = 'text-settings-row ts-full-width';
                        grow.style.cssText = 'display:flex;align-items:center;gap:4px;padding:2px 0';

                        const colorInp = document.createElement('input');
                        colorInp.type = 'color';
                        colorInp.value = ov.color || gr._getColor(gi, gName);
                        colorInp.style.cssText = 'width:24px;height:20px;border:1px solid #ccc;border-radius:3px;cursor:pointer;padding:0;flex:0 0 24px';
                        colorInp.addEventListener('input', () => {
                            if (!gr.settings.groupOverrides[gName]) gr.settings.groupOverrides[gName] = {};
                            gr.settings.groupOverrides[gName].color = colorInp.value;
                            this.updateGraph();
                        });
                        grow.appendChild(colorInp);

                        const dashSel = document.createElement('select');
                        dashSel.style.cssText = 'font-size:10px;padding:1px 2px;border:1px solid #ccc;border-radius:3px;flex:0 0 auto;width:68px';
                        const curDash = ov.lineDash || gr._getLineDash(gi, gName);
                        dashes.forEach(([val, label]) => {
                            const opt = document.createElement('option');
                            opt.value = val; opt.textContent = label;
                            if (val === curDash) opt.selected = true;
                            dashSel.appendChild(opt);
                        });
                        dashSel.addEventListener('change', () => {
                            if (!gr.settings.groupOverrides[gName]) gr.settings.groupOverrides[gName] = {};
                            gr.settings.groupOverrides[gName].lineDash = dashSel.value;
                            this.updateGraph();
                        });
                        grow.appendChild(dashSel);

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
            showLabels: document.getElementById('volcanoShowLabels')?.checked !== false,
            upColor: document.getElementById('volcanoUpColor')?.value || '#E63946',
            downColor: document.getElementById('volcanoDownColor')?.value || '#457B9D'
        };
    }

    _bindVolcanoControls() {
        const ids = ['volcanoWidth', 'volcanoHeight', 'volcanoPThresh', 'volcanoFCThresh', 'volcanoPointSize', 'volcanoTopLabels', 'volcanoUpColor', 'volcanoDownColor', 'volcanoShowLabels'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.updateGraph());
        });
    }

    _getCorrelationSettings() {
        const parseOpt = id => { const v = document.getElementById(id)?.value?.trim(); return v ? parseFloat(v) : null; };
        return {
            width: parseInt(document.getElementById('corrWidth')?.value) || 400,
            height: parseInt(document.getElementById('corrHeight')?.value) || 400,
            xMin: parseOpt('corrXMin'),
            xMax: parseOpt('corrXMax'),
            yMin: parseOpt('corrYMin'),
            yMax: parseOpt('corrYMax'),
            xTickStep: parseOpt('corrXTickStep'),
            yTickStep: parseOpt('corrYTickStep'),
            colorTheme: document.getElementById('corrColorTheme')?.value || 'default',
            errorType: document.getElementById('corrErrorType')?.value || 'sem',
            pointSize: parseFloat(document.getElementById('corrPointSize')?.value) || 6,
            capWidth: parseFloat(document.getElementById('corrCapWidth')?.value) || 5,
            regressionType: document.getElementById('corrRegressionType')?.value || 'linear',
            regressionScope: document.getElementById('corrRegressionScope')?.value || 'all',
            showConfidenceInterval: document.getElementById('corrShowCI')?.checked ?? true,
            showZeroLines: document.getElementById('corrShowZeroLines')?.checked ?? false,
            statsContent: document.getElementById('corrStatsContent')?.value || 'simple'
        };
    }

    _bindCorrelationControls() {
        const ids = ['corrWidth', 'corrHeight', 'corrXMin', 'corrXMax', 'corrYMin', 'corrYMax',
            'corrXTickStep', 'corrYTickStep', 'corrColorTheme', 'corrErrorType',
            'corrPointSize', 'corrCapWidth', 'corrRegressionType', 'corrRegressionScope',
            'corrShowCI', 'corrShowZeroLines', 'corrStatsContent'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.updateGraph());
        });
    }

    _getPCASettings() {
        const pf = (id) => { const v = document.getElementById(id)?.value; return v === '' || v == null ? null : parseFloat(v); };
        return {
            method: document.getElementById('pcaMethod')?.value || 'pca',
            width: parseInt(document.getElementById('pcaWidth')?.value) || 200,
            height: parseInt(document.getElementById('pcaHeight')?.value) || 200,
            colorTheme: document.getElementById('pcaColorTheme')?.value || 'default',
            pointSize: parseFloat(document.getElementById('pcaPointSize')?.value) || 6,
            pcX: parseInt(document.getElementById('pcaPCX')?.value) || 1,
            pcY: parseInt(document.getElementById('pcaPCY')?.value) || 2,
            perplexity: parseInt(document.getElementById('pcaPerplexity')?.value) || 10,
            nNeighbors: parseInt(document.getElementById('pcaNNeighbors')?.value) || 10,
            minDist: parseFloat(document.getElementById('pcaMinDist')?.value) || 0.1,
            showLoadings: document.getElementById('pcaShowLoadings')?.checked ?? false,
            xMin: pf('pcaXMin'), xMax: pf('pcaXMax'),
            yMin: pf('pcaYMin'), yMax: pf('pcaYMax'),
            xTickStep: pf('pcaXTickStep'), yTickStep: pf('pcaYTickStep')
        };
    }

    _bindPCAControls() {
        const ids = ['pcaMethod', 'pcaWidth', 'pcaHeight', 'pcaColorTheme', 'pcaPointSize',
            'pcaPCX', 'pcaPCY', 'pcaPerplexity', 'pcaNNeighbors', 'pcaMinDist', 'pcaShowLoadings',
            'pcaXMin', 'pcaXMax', 'pcaYMin', 'pcaYMax', 'pcaXTickStep', 'pcaYTickStep'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const handler = () => {
                // Clear cached embedding when method or params change
                if (['pcaMethod', 'pcaPerplexity', 'pcaNNeighbors', 'pcaMinDist'].includes(id)) {
                    this.pcaRenderer._cachedEmbedding = null;
                }
                this.updateGraph();
            };
            el.addEventListener('input', handler);
            el.addEventListener('change', handler);
        });

        // Show/hide method-specific params
        const methodSel = document.getElementById('pcaMethod');
        if (methodSel) {
            methodSel.addEventListener('change', () => {
                const m = methodSel.value;
                document.querySelectorAll('.pca-only').forEach(el => el.style.display = m === 'pca' ? '' : 'none');
                document.querySelectorAll('.tsne-only').forEach(el => el.style.display = m === 'tsne' ? '' : 'none');
                document.querySelectorAll('.umap-only').forEach(el => el.style.display = m === 'umap' ? '' : 'none');
                // Update title
                const titles = { pca: 'PCA', tsne: 't-SNE', umap: 'UMAP' };
                this.pcaRenderer.settings.title = titles[m] || 'PCA';
                this.pcaRenderer._cachedEmbedding = null;
                this.updateGraph();
            });
        }

        // Info button toggle
        const infoBtn = document.getElementById('pcaInfoBtn');
        const infoPanel = document.getElementById('pcaInfoPanel');
        if (infoBtn && infoPanel) {
            infoBtn.addEventListener('click', () => {
                infoPanel.style.display = infoPanel.style.display === 'none' ? '' : 'none';
            });
        }
    }

    _getVennSettings() {
        return {
            plotType: document.getElementById('vennPlotType')?.value || 'auto',
            width: parseInt(document.getElementById('vennWidth')?.value) || 450,
            height: parseInt(document.getElementById('vennHeight')?.value) || 400,
            colorTheme: document.getElementById('vennColorTheme')?.value || 'default',
            opacity: parseFloat(document.getElementById('vennOpacity')?.value) || 0.35,
            showCounts: document.getElementById('vennShowCounts')?.checked ?? true,
            showPercentages: document.getElementById('vennShowPercentages')?.checked ?? false,
            showLabels: document.getElementById('vennShowLabels')?.checked ?? true,
            proportional: document.getElementById('vennProportional')?.checked || false,
            scaleBySize: document.getElementById('vennScaleBySize')?.checked || false
        };
    }

    _bindVennControls() {
        const ids = ['vennPlotType', 'vennWidth', 'vennHeight', 'vennColorTheme', 'vennOpacity',
            'vennShowCounts', 'vennShowPercentages', 'vennShowLabels', 'vennProportional', 'vennScaleBySize'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.updateGraph());
        });
    }

    _getOncoPrintSettings() {
        return {
            width: parseInt(document.getElementById('oncoprintWidth')?.value) || 600,
            colorTheme: document.getElementById('oncoprintColorTheme')?.value || 'default',
            cellWidth: parseInt(document.getElementById('oncoprintCellWidth')?.value) || 12,
            cellHeight: parseInt(document.getElementById('oncoprintCellHeight')?.value) || 20,
            cellGap: parseFloat(document.getElementById('oncoprintCellGap')?.value) ?? 1,
            showRowBarChart: document.getElementById('oncoprintShowRowBar')?.checked ?? true,
            showColBarChart: document.getElementById('oncoprintShowColBar')?.checked ?? true,
            sortSamples: document.getElementById('oncoprintSortSamples')?.checked ?? true
        };
    }

    _bindOncoPrintControls() {
        const ids = ['oncoprintWidth', 'oncoprintColorTheme', 'oncoprintCellWidth', 'oncoprintCellHeight',
            'oncoprintCellGap', 'oncoprintShowRowBar', 'oncoprintShowColBar', 'oncoprintSortSamples'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.updateGraph());
        });
    }

    _getKaplanMeierSettings() {
        return {
            width: parseInt(document.getElementById('kmWidth')?.value) || 300,
            height: parseInt(document.getElementById('kmHeight')?.value) || 300,
            colorTheme: document.getElementById('kmColorTheme')?.value || 'default',
            lineWidth: parseFloat(document.getElementById('kmLineWidth')?.value) || 2,
            showCensored: document.getElementById('kmShowCensored')?.checked ?? true,
            showCI: document.getElementById('kmShowCI')?.checked ?? false,
            showMedian: document.getElementById('kmShowMedian')?.checked ?? false,
            showRiskTable: document.getElementById('kmShowRiskTable')?.checked ?? false,
            showLogRank: document.getElementById('kmShowLogRank')?.checked ?? true
        };
    }

    _bindKaplanMeierControls() {
        const ids = ['kmWidth', 'kmHeight', 'kmColorTheme', 'kmLineWidth',
            'kmShowCensored', 'kmShowCI', 'kmShowMedian', 'kmShowRiskTable', 'kmShowLogRank'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.updateGraph());
                el.addEventListener('change', () => this.updateGraph());
            }
        });
    }

    _updatePCAGroupManager(matrixData) {
        const container = document.getElementById('pcaGroupManager');
        const listEl = document.getElementById('pcaGroupList');
        if (!container || !listEl || !matrixData || !matrixData.groupAssignments) return;

        const allGroupNames = [...new Set(matrixData.groupAssignments)];
        if (allGroupNames.length <= 1) { container.style.display = 'none'; return; }
        container.style.display = '';

        const settings = this.pcaRenderer.settings;
        if (!settings.hiddenGroups) settings.hiddenGroups = [];

        let orderedLabels;
        if (settings.groupOrder && settings.groupOrder.length > 0) {
            orderedLabels = settings.groupOrder.filter(g => allGroupNames.includes(g));
            allGroupNames.forEach(g => { if (!orderedLabels.includes(g)) orderedLabels.push(g); });
        } else {
            orderedLabels = [...allGroupNames];
        }

        listEl.innerHTML = '';
        orderedLabels.forEach((label, idx) => {
            const gi = allGroupNames.indexOf(label);
            const color = this.pcaRenderer._getColor(gi);
            const isHidden = settings.hiddenGroups.includes(label);

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
                const cur = settings.hiddenGroups;
                if (cur.includes(label)) {
                    settings.hiddenGroups = cur.filter(l => l !== label);
                } else {
                    settings.hiddenGroups = [...cur, label];
                }
                this.updateGraph();
            });

            item.appendChild(handle);
            item.appendChild(dot);
            item.appendChild(labelSpan);
            item.appendChild(eyeBtn);
            listEl.appendChild(item);

            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', idx.toString());
                item.style.opacity = '0.5';
            });
            item.addEventListener('dragend', () => {
                item.style.opacity = '';
                listEl.querySelectorAll('.group-item').forEach(el => el.classList.remove('drag-over'));
            });
            item.addEventListener('dragover', (e) => { e.preventDefault(); item.classList.add('drag-over'); });
            item.addEventListener('dragleave', () => { item.classList.remove('drag-over'); });
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                const toIdx = idx;
                if (fromIdx === toIdx) return;
                const newOrder = [...orderedLabels];
                const [moved] = newOrder.splice(fromIdx, 1);
                newOrder.splice(toIdx, 0, moved);
                settings.groupOrder = newOrder;
                this.updateGraph();
            });
        });
    }

    _setupPCAColumnToggles(matrixData) {
        if (!matrixData || !matrixData.colLabels) return;
        const headerRow = this.dataTable.headerRow;
        if (!headerRow) return;

        const settings = this.pcaRenderer.settings;
        if (!settings.hiddenColumns) settings.hiddenColumns = [];

        // Find data column headers (skip id-col and utility columns)
        const dataTHs = Array.from(headerRow.querySelectorAll('th:not(.id-col):not(.delete-col-header):not(.row-toggle-col)'));

        dataTHs.forEach(th => {
            // Remove old handler if present
            if (th._pcaColToggle) {
                th.removeEventListener('click', th._pcaColToggle);
            }

            const colName = th.textContent.trim();

            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const idx = settings.hiddenColumns.indexOf(colName);
                if (idx >= 0) {
                    settings.hiddenColumns.splice(idx, 1);
                } else {
                    settings.hiddenColumns.push(colName);
                }
                // Clear cached embedding so it recalculates
                this.pcaRenderer._cachedEmbedding = null;
                this._applyPCAColumnStyles();
                this.updateGraph();
            };

            th._pcaColToggle = handler;
            th.addEventListener('click', handler);
            th.style.cursor = 'pointer';
        });

        this._applyPCAColumnStyles();
    }

    _applyPCAColumnStyles() {
        const settings = this.pcaRenderer.settings;
        const hiddenColumns = settings.hiddenColumns || [];
        const headerRow = this.dataTable.headerRow;
        if (!headerRow) return;

        const dataTHs = Array.from(headerRow.querySelectorAll('th:not(.id-col):not(.delete-col-header):not(.row-toggle-col)'));

        dataTHs.forEach((th, colIdx) => {
            const colName = th.textContent.trim();
            const isHidden = hiddenColumns.includes(colName);
            th.classList.toggle('col-disabled', isHidden);

            // Also style matching td cells in body rows
            const rows = this.dataTable.tbody.querySelectorAll('tr');
            rows.forEach(row => {
                const dataTDs = Array.from(row.querySelectorAll('td:not(.row-delete-cell):not(.row-toggle-cell):not(.id-cell)'));
                if (dataTDs[colIdx]) {
                    dataTDs[colIdx].classList.toggle('col-disabled', isHidden);
                }
            });
        });
    }

    _cleanupPCAColumnToggles() {
        const headerRow = this.dataTable.headerRow;
        if (!headerRow) return;
        const dataTHs = Array.from(headerRow.querySelectorAll('th:not(.id-col):not(.delete-col-header):not(.row-toggle-col)'));
        dataTHs.forEach(th => {
            if (th._pcaColToggle) {
                th.removeEventListener('click', th._pcaColToggle);
                delete th._pcaColToggle;
                th.style.cursor = '';
            }
            th.classList.remove('col-disabled');
        });
        // Clean td cells too
        const rows = this.dataTable.tbody.querySelectorAll('tr');
        rows.forEach(row => {
            row.querySelectorAll('td.col-disabled').forEach(td => td.classList.remove('col-disabled'));
        });
    }

    _updateCorrelationGroupManager(corrData) {
        const container = document.getElementById('correlationGroupManager');
        const listEl = document.getElementById('correlationGroupList');
        if (!container || !listEl || !corrData || !corrData.groups) return;

        const groups = corrData.groups;
        if (groups.length === 0) { container.style.display = 'none'; return; }
        container.style.display = '';

        const settings = this.correlationRenderer.settings;
        if (!settings.hiddenGroups) settings.hiddenGroups = [];
        const hiddenGroups = settings.hiddenGroups;

        const allGroupNames = groups.map(g => g.group);
        let orderedLabels;
        if (settings.groupOrder && settings.groupOrder.length > 0) {
            orderedLabels = settings.groupOrder.filter(g => allGroupNames.includes(g));
            allGroupNames.forEach(g => { if (!orderedLabels.includes(g)) orderedLabels.push(g); });
        } else {
            orderedLabels = [...allGroupNames];
        }

        listEl.innerHTML = '';
        orderedLabels.forEach((label, idx) => {
            const gi = allGroupNames.indexOf(label);
            const color = this.correlationRenderer._getColor(gi);
            const isHidden = hiddenGroups.includes(label);

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
            const ov = settings.groupOverrides && settings.groupOverrides[label];
            labelSpan.textContent = (ov && ov.label) || label;

            const eyeBtn = document.createElement('button');
            eyeBtn.className = 'visibility-btn';
            eyeBtn.textContent = isHidden ? '\u{1F6AB}' : '\u{1F441}';
            eyeBtn.title = isHidden ? 'Show group' : 'Hide group';
            eyeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cur = settings.hiddenGroups;
                if (cur.includes(label)) {
                    settings.hiddenGroups = cur.filter(l => l !== label);
                } else {
                    settings.hiddenGroups = [...cur, label];
                }
                this.updateGraph();
            });

            item.appendChild(handle);
            item.appendChild(dot);
            item.appendChild(labelSpan);
            item.appendChild(eyeBtn);
            listEl.appendChild(item);

            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', idx.toString());
                item.style.opacity = '0.5';
            });
            item.addEventListener('dragend', () => {
                item.style.opacity = '';
                listEl.querySelectorAll('.group-item').forEach(el => el.classList.remove('drag-over'));
            });
            item.addEventListener('dragover', (e) => { e.preventDefault(); item.classList.add('drag-over'); });
            item.addEventListener('dragleave', () => { item.classList.remove('drag-over'); });
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                const toIdx = idx;
                if (fromIdx === toIdx) return;
                const newOrder = [...orderedLabels];
                const [moved] = newOrder.splice(fromIdx, 1);
                newOrder.splice(toIdx, 0, moved);
                settings.groupOrder = newOrder;
                this.updateGraph();
            });
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
        if (this.mode === 'heatmap') return this.heatmapAnnotationManager;
        if (this.mode === 'growth') return this.growthAnnotationManager;
        if (this.mode === 'volcano') return this.volcanoAnnotationManager;
        if (this.mode === 'correlation') return this.correlationAnnotationManager;
        if (this.mode === 'pca') return this.pcaAnnotationManager;
        if (this.mode === 'venn') return this.vennAnnotationManager;
        if (this.mode === 'oncoprint') return this.oncoprintAnnotationManager;
        if (this.mode === 'kaplan-meier') return this.kaplanMeierAnnotationManager;
        return this.columnAnnotationManager;
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
        const mgrMap = { heatmap: this.heatmapAnnotationManager, growth: this.growthAnnotationManager, volcano: this.volcanoAnnotationManager, correlation: this.correlationAnnotationManager, pca: this.pcaAnnotationManager, venn: this.vennAnnotationManager, oncoprint: this.oncoprintAnnotationManager };
        const mgr = mgrMap[snapshot.mode] || this.columnAnnotationManager;
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
        if (this.mode === 'kaplan-meier') {
            const kmData = this.dataTable.getKaplanMeierData ? this.dataTable.getKaplanMeierData() : null;
            const kmSettings = this._getKaplanMeierSettings();
            this.kaplanMeierRenderer.render(kmData, kmSettings);
            return;
        }
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
            this._updateGrowthGroupManager(growthData);
            this._autoSuggestTest();
            return;
        }
        if (this.mode === 'volcano') {
            if (infoEl) infoEl.style.display = 'none';
            const volcanoData = this.dataTable.getVolcanoData();
            const volcanoSettings = this._getVolcanoSettings();
            this.volcanoRenderer.render(volcanoData, volcanoSettings);
            return;
        }
        if (this.mode === 'correlation') {
            if (infoEl) infoEl.style.display = 'none';
            const corrData = this.dataTable.getCorrelationData();
            const corrSettings = this._getCorrelationSettings();
            this.correlationRenderer.render(corrData, corrSettings);
            this._updateCorrelationGroupManager(corrData);
            return;
        }
        if (this.mode === 'pca') {
            if (infoEl) infoEl.style.display = 'none';
            const matrixData = this.dataTable.getMatrixData();
            const pcaSettings = this._getPCASettings();
            this.pcaRenderer.render(matrixData, pcaSettings);
            this._updatePCAGroupManager(matrixData);
            this._setupPCAColumnToggles(matrixData);
            return;
        }
        if (this.mode === 'venn') {
            if (infoEl) infoEl.style.display = 'none';
            const vennData = this.dataTable.getVennData();
            const vennSettings = this._getVennSettings();
            this.vennRenderer.render(vennData, vennSettings);
            return;
        }
        if (this.mode === 'oncoprint') {
            if (infoEl) infoEl.style.display = 'none';
            const opData = this.dataTable.getOncoPrintData();
            const opSettings = this._getOncoPrintSettings();
            this.oncoprintRenderer.render(opData, opSettings);
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
        this._autoSuggestTest();
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

    _updateGrowthGroupManager(growthData) {
        const container = document.getElementById('growthGroupManager');
        const listEl = document.getElementById('growthGroupList');
        if (!container || !listEl || !growthData || !growthData.groups) return;

        const groups = growthData.groups;
        if (groups.length === 0) { container.style.display = 'none'; return; }
        container.style.display = '';

        const settings = this.growthRenderer.settings;
        if (!settings.hiddenGroups) settings.hiddenGroups = [];
        const hiddenGroups = settings.hiddenGroups;

        let orderedLabels;
        if (settings.groupOrder && settings.groupOrder.length > 0) {
            orderedLabels = settings.groupOrder.filter(g => groups.includes(g));
            groups.forEach(g => { if (!orderedLabels.includes(g)) orderedLabels.push(g); });
        } else {
            orderedLabels = [...groups];
        }

        listEl.innerHTML = '';
        orderedLabels.forEach((label, idx) => {
            const gi = groups.indexOf(label);
            const color = this.growthRenderer._getColor(gi);
            const isHidden = hiddenGroups.includes(label);

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
            const ov = settings.groupOverrides && settings.groupOverrides[label];
            labelSpan.textContent = (ov && ov.label) || label;

            const eyeBtn = document.createElement('button');
            eyeBtn.className = 'visibility-btn';
            eyeBtn.textContent = isHidden ? '\u{1F6AB}' : '\u{1F441}';
            eyeBtn.title = isHidden ? 'Show group' : 'Hide group';
            eyeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cur = settings.hiddenGroups;
                if (cur.includes(label)) {
                    settings.hiddenGroups = cur.filter(l => l !== label);
                } else {
                    settings.hiddenGroups = [...cur, label];
                }
                this.updateGraph();
            });

            item.appendChild(handle);
            item.appendChild(dot);
            item.appendChild(labelSpan);
            item.appendChild(eyeBtn);
            listEl.appendChild(item);

            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', idx.toString());
                item.style.opacity = '0.5';
            });
            item.addEventListener('dragend', () => {
                item.style.opacity = '';
                listEl.querySelectorAll('.group-item').forEach(el => el.classList.remove('drag-over'));
            });
            item.addEventListener('dragover', (e) => { e.preventDefault(); item.classList.add('drag-over'); });
            item.addEventListener('dragleave', () => { item.classList.remove('drag-over'); });
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                const toIdx = idx;
                if (fromIdx === toIdx) return;
                const newOrder = [...orderedLabels];
                const [moved] = newOrder.splice(fromIdx, 1);
                newOrder.splice(toIdx, 0, moved);
                settings.groupOrder = newOrder;
                this.updateGraph();
            });
        });
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
                const cur = settings.hiddenGroups;
                if (cur.includes(label)) {
                    settings.hiddenGroups = cur.filter(l => l !== label);
                } else {
                    settings.hiddenGroups = [...cur, label];
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

        // Correlation tests
        if (['pearson', 'spearman', 'linear-regression'].includes(testType)) {
            this._runCorrelationTest(testType);
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

    _runCorrelationTest(testType) {
        const corrData = this.dataTable.getCorrelationData();
        if (!corrData || !corrData.allPoints || corrData.allPoints.length < 3) {
            this._showStatsResult('Need at least 3 data points to run a correlation test.');
            return;
        }

        const regScope = this.correlationRenderer.settings.regressionScope || 'all';
        const hiddenGroups = this.correlationRenderer.settings.hiddenGroups || [];
        const visibleGroups = corrData.groups.filter(g => !hiddenGroups.includes(g.group));
        const visiblePoints = visibleGroups.flatMap(g => g.points);

        const fmt = (v, d = 4) => v != null && !isNaN(v) ? v.toFixed(d) : 'N/A';
        const fmtP = p => {
            if (p == null || isNaN(p)) return 'N/A';
            if (p < 0.001) return p.toExponential(2);
            return p.toFixed(4);
        };
        const sig = p => p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : 'ns';

        // Helper: build one stats block (HTML + plain text) for a set of points
        const buildBlock = (label, points) => {
            const bx = points.map(p => p.xMean);
            const by = points.map(p => p.yMean);
            const bn = points.length;
            if (bn < 3) return { html: `<div style="font-size:12px;color:#888">${label}: too few points (n=${bn})</div>`, text: `${label}: too few points (n=${bn})\n` };

            const pearson = Statistics.pearsonCorrelation(bx, by);
            const spearman = Statistics.spearmanCorrelation(bx, by);
            const reg = Statistics.linearRegression(bx, by);

            let h = '';
            let t = '';
            h += `<div style="font-weight:600;margin-top:6px;margin-bottom:4px">${label} (n = ${bn})</div>`;
            t += `${label} (n = ${bn})\n`;

            h += `<div style="font-size:12px;margin-bottom:2px">y = ${fmt(reg.slope)} \u00D7 x + ${fmt(reg.intercept)}</div>`;
            t += `  Equation: y = ${fmt(reg.slope)} * x + ${fmt(reg.intercept)}\n`;
            h += `<div style="font-size:12px;margin-bottom:2px">R\u00B2 = ${fmt(reg.rSquared)} &nbsp;|&nbsp; Residual SE = ${fmt(reg.residualSE)}</div>`;
            t += `  R\u00B2 = ${fmt(reg.rSquared)}  |  Residual SE = ${fmt(reg.residualSE)}\n`;
            h += `<div style="font-size:12px;margin-bottom:2px">Slope SE = ${fmt(reg.slopeStdErr)} &nbsp;|&nbsp; Intercept SE = ${fmt(reg.interceptStdErr)}</div>`;
            t += `  Slope SE = ${fmt(reg.slopeStdErr)}  |  Intercept SE = ${fmt(reg.interceptStdErr)}\n`;
            h += `<div style="font-size:12px;margin-bottom:4px">Pearson r = ${fmt(pearson.r)}, ${fmtP(pearson.p)} ${sig(pearson.p)} &nbsp;|&nbsp; Spearman \u03C1 = ${fmt(spearman.rho)}, ${fmtP(spearman.p)} ${sig(spearman.p)}</div>`;
            t += `  Pearson r = ${fmt(pearson.r)}, p = ${fmtP(pearson.p)} ${sig(pearson.p)}\n`;
            t += `  Spearman \u03C1 = ${fmt(spearman.rho)}, p = ${fmtP(spearman.p)} ${sig(spearman.p)}\n`;
            h += `<div style="font-size:11px;color:#666">df = ${reg.df}</div>`;
            t += `  df = ${reg.df}\n`;

            return { html: h, text: t };
        };

        if (testType === 'pearson' || testType === 'spearman' || testType === 'linear-regression') {
            const isPerGroup = regScope === 'per-group' && visibleGroups.length > 1;
            let html = '';
            let plainText = '';

            if (isPerGroup) {
                html += `<div style="font-weight:600;margin-bottom:4px">Per-Group Correlation Analysis (total n = ${visiblePoints.length})</div>`;
                plainText += `Per-Group Correlation Analysis (total n = ${visiblePoints.length})\n${'='.repeat(50)}\n`;
                visibleGroups.forEach(g => {
                    const block = buildBlock(g.group, g.points);
                    html += block.html;
                    plainText += '\n' + block.text;
                });
            } else {
                const block = buildBlock('All data', visiblePoints);
                html += block.html;
                plainText += block.text;

                // Also show per-group summary if multiple groups
                if (visibleGroups.length > 1) {
                    html += `<div style="font-weight:600;margin-top:10px;margin-bottom:4px">Per-Group Summary</div>`;
                    plainText += '\nPer-Group Summary\n' + '-'.repeat(40) + '\n';
                    visibleGroups.forEach(g => {
                        if (g.points.length < 3) return;
                        const gx = g.points.map(p => p.xMean);
                        const gy = g.points.map(p => p.yMean);
                        const gp = Statistics.pearsonCorrelation(gx, gy);
                        const gr = Statistics.linearRegression(gx, gy);
                        html += `<div style="font-size:12px;margin-bottom:2px">${g.group} (n=${g.points.length}): r=${fmt(gp.r)}, ${fmtP(gp.p)} ${sig(gp.p)}, R\u00B2=${fmt(gr.rSquared)}</div>`;
                        plainText += `  ${g.group} (n=${g.points.length}): r=${fmt(gp.r)}, p=${fmtP(gp.p)} ${sig(gp.p)}, R\u00B2=${fmt(gr.rSquared)}\n`;
                    });
                }
            }

            this._showStatsResult(html);
            // Store plain text for export
            this._lastCorrelationStatsText = plainText + '\nAnalysis performed using jStat (JavaScript Statistical Library)\n';
        }
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

    _autoSuggestTest() {
        const testSel = document.getElementById('testType');
        if (!testSel) return;
        // Don't change if user already ran a test (results visible)
        const results = document.getElementById('statsResults');
        if (results && results.innerHTML.trim()) return;

        if (this.mode === 'growth') {
            testSel.value = 'two-way-rm-anova';
        } else if (this.mode === 'column') {
            const data = this.dataTable.getData();
            const filled = data.filter(d => d.values.length > 0);
            const graphType = document.getElementById('graphType')?.value;
            if (graphType === 'before-after' && filled.length === 2) {
                testSel.value = 't-test-paired';
            } else if (filled.length === 2) {
                testSel.value = 't-test-unpaired';
            } else if (filled.length > 2) {
                testSel.value = 'one-way-anova';
            }
        }
        testSel.dispatchEvent(new Event('change'));
    }

    // --- Mode Selection Popout ---

    _buildModePopout() {
        const grid = document.getElementById('modePopoutGrid');
        if (!grid) return;

        const modes = [
            { id: 'heatmap', name: 'Heatmap*', desc: 'Clustered heatmaps with dendrograms', icon: '<svg viewBox="0 0 40 32"><rect x="4" y="4" width="7" height="7" fill="#c0392b"/><rect x="12" y="4" width="7" height="7" fill="#e67e22"/><rect x="20" y="4" width="7" height="7" fill="#f1c40f"/><rect x="28" y="4" width="7" height="7" fill="#27ae60"/><rect x="4" y="12" width="7" height="7" fill="#f1c40f"/><rect x="12" y="12" width="7" height="7" fill="#c0392b"/><rect x="20" y="12" width="7" height="7" fill="#27ae60"/><rect x="28" y="12" width="7" height="7" fill="#e67e22"/><rect x="4" y="20" width="7" height="7" fill="#27ae60"/><rect x="12" y="20" width="7" height="7" fill="#f1c40f"/><rect x="20" y="20" width="7" height="7" fill="#c0392b"/><rect x="28" y="20" width="7" height="7" fill="#f1c40f"/></svg>' },
            { id: 'pca', name: 'PCA*', desc: 'PCA, t-SNE & UMAP reduction', icon: '<svg viewBox="0 0 40 32"><circle cx="12" cy="10" r="2.5" fill="#4a8f32"/><circle cx="16" cy="13" r="2.5" fill="#4a8f32"/><circle cx="10" cy="14" r="2.5" fill="#4a8f32"/><circle cx="28" cy="20" r="2.5" fill="#e67e22"/><circle cx="25" cy="23" r="2.5" fill="#e67e22"/><circle cx="30" cy="24" r="2.5" fill="#e67e22"/><circle cx="20" cy="8" r="2.5" fill="#457b9d"/><circle cx="24" cy="10" r="2.5" fill="#457b9d"/></svg>' },
            { id: 'column', name: 'Column', desc: 'Bar charts, scatter, box & violin plots', icon: '<svg viewBox="0 0 40 32"><rect x="4" y="14" width="7" height="14" rx="1" fill="#4a8f32"/><rect x="16" y="8" width="7" height="20" rx="1" fill="#3a7d28"/><rect x="28" y="18" width="7" height="10" rx="1" fill="#6aab4a"/></svg>' },
            { id: 'growth', name: 'Time Series', desc: 'Longitudinal data with means & error bars', icon: '<svg viewBox="0 0 40 32"><polyline points="4,24 12,18 20,20 28,10 36,12" fill="none" stroke="#4a8f32" stroke-width="2"/><polyline points="4,26 12,22 20,24 28,16 36,18" fill="none" stroke="#e67e22" stroke-width="2" stroke-dasharray="3,2"/></svg>' },
            { id: 'kaplan-meier', name: 'Kaplan-Meier', desc: 'Survival curves with log-rank test', icon: '<svg viewBox="0 0 40 32"><polyline points="4,6 12,6 12,12 20,12 20,18 28,18 28,24 36,24" fill="none" stroke="#4a8f32" stroke-width="2"/><polyline points="4,8 10,8 10,14 18,14 18,22 24,22 24,28 36,28" fill="none" stroke="#e67e22" stroke-width="2"/></svg>' },
            { id: 'volcano', name: 'Volcano', desc: 'Fold-change vs p-value scatter', icon: '<svg viewBox="0 0 40 32"><circle cx="8" cy="8" r="2" fill="#457b9d"/><circle cx="10" cy="12" r="2" fill="#457b9d"/><circle cx="32" cy="6" r="2" fill="#c0392b"/><circle cx="30" cy="10" r="2" fill="#c0392b"/><circle cx="18" cy="22" r="1.5" fill="#999"/><circle cx="20" cy="20" r="1.5" fill="#999"/><circle cx="22" cy="24" r="1.5" fill="#999"/><circle cx="16" cy="26" r="1.5" fill="#999"/><circle cx="24" cy="26" r="1.5" fill="#999"/></svg>' },
            { id: 'correlation', name: 'Correlation', desc: 'Scatter plots with regression', icon: '<svg viewBox="0 0 40 32"><circle cx="8" cy="24" r="2" fill="#4a8f32"/><circle cx="14" cy="20" r="2" fill="#4a8f32"/><circle cx="18" cy="16" r="2" fill="#4a8f32"/><circle cx="24" cy="14" r="2" fill="#4a8f32"/><circle cx="30" cy="8" r="2" fill="#4a8f32"/><line x1="6" y1="26" x2="34" y2="6" stroke="#c0392b" stroke-width="1.5" stroke-dasharray="3,2"/></svg>' },
            { id: 'venn', name: 'Venn / UpSet', desc: 'Set overlaps & intersections', icon: '<svg viewBox="0 0 40 32"><circle cx="15" cy="14" r="10" fill="#4a8f32" opacity="0.35" stroke="#4a8f32" stroke-width="1"/><circle cx="25" cy="14" r="10" fill="#e67e22" opacity="0.35" stroke="#e67e22" stroke-width="1"/></svg>' },
            { id: 'oncoprint', name: 'OncoPrint', desc: 'Mutation landscape plots', icon: '<svg viewBox="0 0 40 32"><rect x="4" y="4" width="5" height="6" fill="#ddd"/><rect x="5.5" y="5" width="2" height="4" fill="#c0392b"/><rect x="10" y="4" width="5" height="6" fill="#ddd"/><rect x="16" y="4" width="5" height="6" fill="#ddd"/><rect x="17.5" y="5" width="2" height="4" fill="#4a8f32"/><rect x="22" y="4" width="5" height="6" fill="#ddd"/><rect x="23.5" y="5" width="2" height="4" fill="#c0392b"/><rect x="28" y="4" width="5" height="6" fill="#ddd"/><rect x="4" y="12" width="5" height="6" fill="#ddd"/><rect x="10" y="12" width="5" height="6" fill="#ddd"/><rect x="11.5" y="13" width="2" height="4" fill="#457b9d"/><rect x="16" y="12" width="5" height="6" fill="#ddd"/><rect x="17.5" y="13" width="2" height="4" fill="#c0392b"/><rect x="22" y="12" width="5" height="6" fill="#ddd"/><rect x="28" y="12" width="5" height="6" fill="#ddd"/><rect x="29.5" y="13" width="2" height="4" fill="#4a8f32"/><rect x="4" y="22" width="5" height="6" fill="#ddd"/><rect x="5.5" y="23" width="2" height="4" fill="#4a8f32"/><rect x="10" y="22" width="5" height="6" fill="#ddd"/><rect x="16" y="22" width="5" height="6" fill="#ddd"/><rect x="22" y="22" width="5" height="6" fill="#ddd"/><rect x="23.5" y="23" width="2" height="4" fill="#457b9d"/><rect x="28" y="22" width="5" height="6" fill="#ddd"/><rect x="29.5" y="23" width="2" height="4" fill="#c0392b"/></svg>' },
        ];

        modes.forEach(m => {
            const card = document.createElement('div');
            card.className = 'mode-popout-card';
            card.dataset.mode = m.id;
            card.innerHTML = `<div class="mp-icon">${m.icon}</div><div class="mp-name">${m.name}</div><div class="mp-desc">${m.desc}</div>`;
            card.addEventListener('click', () => {
                this._selectModeFromPopout(m.id);
            });
            grid.appendChild(card);
        });

        // Footnote
        const footnote = document.createElement('div');
        footnote.style.cssText = 'grid-column:1/-1;font-size:10px;color:#6b7280;text-align:center;margin-top:4px';
        footnote.textContent = '* = optimized for FlowJo output data';
        grid.appendChild(footnote);

        // "Choose Mode" button
        const chooseBtn = document.getElementById('chooseModeBtn');
        if (chooseBtn) {
            chooseBtn.addEventListener('click', () => this._showModePopout());
        }
    }

    _showModePopout() {
        const popout = document.getElementById('modePopout');
        if (popout) popout.style.display = '';
    }

    _hideModePopout() {
        const popout = document.getElementById('modePopout');
        if (popout) popout.style.display = 'none';
    }

    _selectModeFromPopout(modeId) {
        this._hideModePopout();
        sessionStorage.setItem('visualize_mode_chosen', '1');

        // Click the corresponding mode button
        const btn = document.querySelector(`.mode-btn[data-mode="${modeId}"]`);
        if (btn && !btn.classList.contains('active')) {
            btn.click();
        }
    }

    _initModePopout() {
        this._buildModePopout();

        // Close on background click
        const popout = document.getElementById('modePopout');
        if (popout) {
            popout.addEventListener('click', (e) => {
                if (e.target === popout) this._hideModePopout();
            });
        }

        // Show on first load (if not already dismissed this session)
        if (!sessionStorage.getItem('visualize_mode_chosen')) {
            this._showModePopout();
        }
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
