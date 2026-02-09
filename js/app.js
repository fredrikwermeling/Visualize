// app.js - Main application controller

class App {
    constructor() {
        // Initialize components
        this.dataTable = new DataTable('dataTable', 'tableBody', 'headerRow');
        this.graphRenderer = new GraphRenderer('graphContainer');
        this.exportManager = new ExportManager(this.graphRenderer);
        this.annotationManager = new AnnotationManager();
        this.graphRenderer.annotationManager = this.annotationManager;

        // Bind event listeners
        this._bindTableControls();
        this._bindGraphControls();
        this._bindDimensionControls();
        this._bindAppearanceControls();
        this._bindStatisticsControls();
        this._bindExportControls();
        this._bindDrawingTools();

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
    }

    _bindGraphControls() {
        document.getElementById('graphType').addEventListener('change', (e) => {
            this.graphRenderer.updateSettings({ graphType: e.target.value });
            this.updateGraph();
        });
    }

    _bindDimensionControls() {
        document.getElementById('graphWidth').addEventListener('input', (e) => {
            const width = parseInt(e.target.value) || 600;
            this.graphRenderer.setDimensions(width, this.graphRenderer.height);
            this.updateGraph();
        });

        document.getElementById('graphHeight').addEventListener('input', (e) => {
            const height = parseInt(e.target.value) || 400;
            this.graphRenderer.setDimensions(this.graphRenderer.width, height);
            this.updateGraph();
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
            const title = this.graphRenderer.settings.title || 'graph';
            const safeName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            this.exportManager.exportPNG(`${safeName}.png`);
        });

        document.getElementById('exportSVG').addEventListener('click', () => {
            const title = this.graphRenderer.settings.title || 'graph';
            const safeName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            this.exportManager.exportSVG(`${safeName}.svg`);
        });

        document.getElementById('copyClipboard').addEventListener('click', (e) => {
            this.exportManager.copyToClipboard(e.target);
        });
    }

    _bindDrawingTools() {
        const toolButtons = ['drawToolNone', 'drawToolText', 'drawToolLine', 'drawToolArrow', 'drawToolBracket'];
        const toolMap = { drawToolNone: 'none', drawToolText: 'text', drawToolLine: 'line', drawToolArrow: 'arrow', drawToolBracket: 'bracket' };

        toolButtons.forEach(id => {
            document.getElementById(id).addEventListener('click', () => {
                this.annotationManager.setTool(toolMap[id]);
                this.updateGraph();
            });
        });

        document.getElementById('drawUndo').addEventListener('click', () => {
            this.annotationManager.undo();
        });

        document.getElementById('drawDeleteSelected').addEventListener('click', () => {
            this.annotationManager.deleteSelected();
        });

        document.getElementById('drawClearAll').addEventListener('click', () => {
            this.annotationManager.clearAll();
        });

        // Ctrl+Z / Cmd+Z for undo
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
                e.preventDefault();
                this.annotationManager.undo();
            }
        });
    }

    // --- Core methods ---

    updateGraph() {
        const data = this.dataTable.getData();
        this.graphRenderer.render(data);
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

            item.appendChild(handle);
            item.appendChild(dot);
            item.appendChild(labelSpan);
            item.appendChild(eyeBtn);
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
