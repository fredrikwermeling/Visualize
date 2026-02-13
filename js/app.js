// app.js - Main application controller

class App {
    constructor() {
        // Initialize components
        this.dataTable = new DataTable('dataTable', 'tableBody', 'headerRow');
        this.graphRenderer = new GraphRenderer('graphContainer');
        this.heatmapRenderer = new HeatmapRenderer('graphContainer');
        this.exportManager = new ExportManager(this.graphRenderer);
        this.columnAnnotationManager = new AnnotationManager();
        this.heatmapAnnotationManager = new AnnotationManager();
        this.graphRenderer.annotationManager = this.columnAnnotationManager;
        this._undoStack = [];
        this.mode = 'column';

        // Separate data storage per mode
        this._columnTableData = null;  // saved when switching away from column
        this._heatmapTableData = null; // saved when switching away from heatmap

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

        // Load sample data and draw initial graph
        this.dataTable.loadSampleData();
        this.updateGraph();
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
        document.getElementById('addTestData').addEventListener('click', () => {
            if (this.mode === 'heatmap') {
                this.dataTable.loadHeatmapSampleData();
            } else {
                this.dataTable.loadSampleData();
            }
        });
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
        ['heatmapWidth', 'heatmapHeight'].forEach(id => {
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

        // Title / axis label visibility
        ['showTitle', 'showXLabel', 'showYLabel'].forEach(id => {
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

        document.getElementById('showStatsLegend').addEventListener('change', (e) => {
            this.graphRenderer.updateSettings({ showStatsLegend: e.target.checked });
            this.updateGraph();
        });

        // Show/hide post-hoc controls based on test type
        document.getElementById('testType').addEventListener('change', (e) => {
            const isMultiGroup = this._isMultiGroupTest(e.target.value);
            const isFriedman = e.target.value === 'friedman';
            document.getElementById('postHocGroup').style.display = (isMultiGroup && !isFriedman) ? '' : 'none';
            this._updatePostHocAdvice();
            this._updateDunnettVisibility();
            this._updateTwoGroupSelectors();
            this._updateTestDescription();
        });

        document.getElementById('postHocMethod').addEventListener('change', () => {
            this._updatePostHocAdvice();
            this._updateDunnettVisibility();
        });

        // Initialize post-hoc visibility
        const testType = document.getElementById('testType').value;
        const isMulti = this._isMultiGroupTest(testType);
        document.getElementById('postHocGroup').style.display = (isMulti && testType !== 'friedman') ? '' : 'none';
        this._updatePostHocAdvice();
        this._updateTwoGroupSelectors();
        this._updateTestDescription();
    }

    _isMultiGroupTest(testType) {
        return testType === 'one-way-anova' || testType === 'kruskal-wallis' || testType === 'friedman';
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
            'wilcoxon': '<b>Wilcoxon signed-rank</b> — Non-parametric, paired, compares 2 groups. Rank-based alternative to paired t-test. Requires equal sample sizes.'
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
            const title = this.mode === 'heatmap'
                ? (this.heatmapRenderer.settings.title || 'heatmap')
                : (this.graphRenderer.settings.title || 'graph');
            const safeName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            this._exportWithInfo('png', `${safeName}.png`);
        });

        document.getElementById('exportSVG').addEventListener('click', () => {
            const title = this.mode === 'heatmap'
                ? (this.heatmapRenderer.settings.title || 'heatmap')
                : (this.graphRenderer.settings.title || 'graph');
            const safeName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            this._exportWithInfo('svg', `${safeName}.svg`);
        });

        document.getElementById('copyClipboard').addEventListener('click', (e) => {
            this.exportManager.copyToClipboard(e.target);
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

        // Use container-based export for heatmap mode
        if (this.mode === 'heatmap') {
            const svgEl = document.getElementById('graphContainer').querySelector('svg');
            if (svgEl) {
                this.exportManager._exportSvgEl(svgEl, format, filename);
            }
        } else {
            if (format === 'png') {
                this.exportManager.exportPNG(filename);
            } else {
                this.exportManager.exportSVG(filename);
            }
        }

        // Restore SVG after a short delay
        if (showInfo) {
            setTimeout(() => this.updateGraph(), 500);
        }
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
                this._applyMode();

                // Restore saved data or load sample
                this._restoreTableData(this.mode);
                this.updateGraph();
            });
        });
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
        const key = mode === 'column' ? '_columnTableData' : '_heatmapTableData';
        this[key] = { headers, rows, idData, disabledRows, numRows: rows.length };
    }

    _restoreTableData(mode) {
        const key = mode === 'column' ? '_columnTableData' : '_heatmapTableData';
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
            } else {
                this.dataTable.loadSampleData();
            }
        }
    }

    _applyMode() {
        const isHeatmap = this.mode === 'heatmap';

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
        columnEls.forEach(el => { if (el) el.style.display = isHeatmap ? 'none' : ''; });

        // Heatmap-specific: column/row order managers
        const heatmapColMgr = document.getElementById('heatmapColManager');
        if (heatmapColMgr) heatmapColMgr.style.display = isHeatmap ? '' : 'none';

        // Hide all .column-only elements in heatmap mode
        document.querySelectorAll('.column-only').forEach(el => {
            el.style.display = isHeatmap ? 'none' : '';
        });

        // Control sections inside .graph-controls
        const controlSections = document.querySelectorAll('.graph-controls .control-section');
        controlSections.forEach(section => {
            const h3 = section.querySelector('h3');
            if (!h3) return;
            const title = h3.textContent.trim();
            if (title === 'Statistics' || title === 'Dimensions & Style') {
                section.style.display = isHeatmap ? 'none' : '';
            }
        });

        // Heatmap controls
        const heatmapControls = document.getElementById('heatmapControls');
        if (heatmapControls) heatmapControls.style.display = isHeatmap ? '' : 'none';
    }

    _bindHeatmapControls() {
        const ids = ['heatmapCluster', 'heatmapLinkage', 'heatmapNormalize', 'heatmapNormMethod', 'heatmapWinsorize', 'heatmapColorScheme', 'heatmapColLabelAngle', 'heatmapGroupColorTheme', 'heatmapClusterFlipRows', 'heatmapClusterFlipCols'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.updateGraph());
        });
        ['heatmapShowValues', 'heatmapShowGroupBar', 'heatmapShowInfo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.updateGraph());
        });

        const csvBtn = document.getElementById('exportGroupedCSV');
        if (csvBtn) csvBtn.addEventListener('click', () => {
            const matrixData = this.dataTable.getMatrixData();
            this.heatmapRenderer.exportGroupedCSV(matrixData);
        });

        const hmCsvBtn = document.getElementById('exportHeatmapCSV');
        if (hmCsvBtn) hmCsvBtn.addEventListener('click', () => {
            this.heatmapRenderer.exportHeatmapCSV();
        });

        // View as Column button - converts grouped heatmap data to column format
        const viewColBtn = document.getElementById('viewAsColumn');
        if (viewColBtn) viewColBtn.addEventListener('click', () => {
            this._viewHeatmapAsColumn();
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
            html += `<hr style="margin:8px 0;border-color:#eee">`;

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

                    html += `<div class="result-item"><span class="result-value"><b>${colLabels[mi]}:</b> ${pFormatted} <span class="${isSignificant ? 'significant' : 'not-significant'}">${sigLevel}</span></span></div>`;
                } catch (e) {
                    html += `<div class="result-item"><span class="result-value"><b>${colLabels[mi]}:</b> Error — ${e.message}</span></div>`;
                }
            }

            document.getElementById('testType').value = 't-test-unpaired';
            document.getElementById('postHocGroup').style.display = 'none';
            document.getElementById('postHocAdvice').style.display = 'none';
            this._updateTestDescription();
            this.graphRenderer.updateSettings({ statsTestName: testName, showStatsLegend: true });
            document.getElementById('showStatsLegend').checked = true;
            this._showStatsResult(html);
            this.graphRenderer.setSignificance(pairs);
            this.updateGraph();
        }
    }

    _getHeatmapSettings() {
        return {
            cluster: document.getElementById('heatmapCluster')?.value || 'none',
            linkage: document.getElementById('heatmapLinkage')?.value || 'average',
            normalize: document.getElementById('heatmapNormalize')?.value || 'none',
            normMethod: document.getElementById('heatmapNormMethod')?.value || 'zscore',
            winsorize: document.getElementById('heatmapWinsorize')?.value || 'none',
            colorScheme: document.getElementById('heatmapColorScheme')?.value || 'RdBu',
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
            rowLabelOverrides: this.heatmapRenderer.settings.rowLabelOverrides || {}
        };
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
        const colorLabels = { RdBu: 'Red\u2013Blue', RdYlGn: 'Red\u2013Yellow\u2013Green', Viridis: 'Viridis', YlOrRd: 'Yellow\u2013Red', BuPu: 'Blue\u2013Purple' };

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

    updateGraph() {
        const infoEl = document.getElementById('heatmapInfo');
        if (this.mode === 'heatmap') {
            const matrixData = this.dataTable.getMatrixData();
            const settings = this._getHeatmapSettings();
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
        if (infoEl) infoEl.style.display = 'none';

        const data = this.dataTable.getData();
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

        const filled = data.filter(d => d.values.length > 0);
        if (filled.length === 0) {
            container.style.display = 'none';
            return;
        }
        container.style.display = '';

        const settings = this.graphRenderer.settings;
        const hiddenGroups = settings.hiddenGroups;

        // Determine display order: use groupOrder if set, otherwise data order
        let orderedLabels;
        if (settings.groupOrder.length > 0) {
            // Start with stored order, add any new groups at end
            const knownSet = new Set(settings.groupOrder);
            orderedLabels = [...settings.groupOrder.filter(l => filled.some(d => d.label === l))];
            filled.forEach(d => {
                if (!knownSet.has(d.label)) orderedLabels.push(d.label);
            });
        } else {
            orderedLabels = filled.map(d => d.label);
        }

        // Build color index map (same as graph.js)
        const colorIndexMap = {};
        filled.forEach((d, i) => { colorIndexMap[d.label] = i; });

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
        const data = this.dataTable.getData();
        const filledGroups = data.filter(d => d.values.length > 0);

        if (filledGroups.length < 2) {
            this._showStatsResult('Need at least 2 groups with data to run a test.');
            return;
        }

        const testType = document.getElementById('testType').value;

        if (testType === 'none') {
            this._clearStats();
            this.graphRenderer.setSignificance([]);
            this.updateGraph();
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
        this.graphRenderer.updateSettings({ statsTestName: testName });

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
            this.graphRenderer.updateSettings({ statsTestName: testName });

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
            this.graphRenderer.updateSettings({ statsTestName: testName });

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
        } else {
            html += `<div class="result-item" style="color:#888;font-size:12px"><em>No significant differences — post-hoc not needed</em></div>`;
            this.graphRenderer.updateSettings({ statsTestName: testName });
        }

        this._showStatsResult(html);
        this.graphRenderer.setSignificance(significantPairs);
        this.updateGraph();
    }

    _showStatsResult(html) {
        const container = document.getElementById('statsResults');
        container.innerHTML = html;
        container.classList.remove('empty');
    }

    _clearStats() {
        const container = document.getElementById('statsResults');
        container.innerHTML = '';
        container.classList.add('empty');
        this.graphRenderer.setSignificance([]);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
