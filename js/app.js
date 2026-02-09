// app.js - Main application controller

class App {
    constructor() {
        // Initialize components
        this.dataTable = new DataTable('dataTable', 'tableBody', 'headerRow');
        this.graphRenderer = new GraphRenderer('graphContainer');
        this.exportManager = new ExportManager(this.graphRenderer);

        // Bind event listeners
        this._bindTableControls();
        this._bindGraphControls();
        this._bindDimensionControls();
        this._bindAppearanceControls();
        this._bindStatisticsControls();
        this._bindExportControls();

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

        document.getElementById('graphTitle').addEventListener('input', (e) => {
            this.graphRenderer.updateSettings({ title: e.target.value });
            this.updateGraph();
        });

        document.getElementById('xAxisLabel').addEventListener('input', (e) => {
            this.graphRenderer.updateSettings({ xLabel: e.target.value });
            this.updateGraph();
        });

        document.getElementById('yAxisLabel').addEventListener('input', (e) => {
            this.graphRenderer.updateSettings({ yLabel: e.target.value });
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
    }

    _bindStatisticsControls() {
        document.getElementById('runStats').addEventListener('click', () => {
            this._runStatisticalTest();
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

    // --- Core methods ---

    updateGraph() {
        const data = this.dataTable.getData();
        this.graphRenderer.render(data);
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

        // Multi-group tests (ANOVA / Kruskal-Wallis)
        if (testType === 'one-way-anova' || testType === 'kruskal-wallis') {
            this._runMultiGroupTest(testType, data, filledGroups);
            return;
        }

        // Two-group tests — use first two groups with data
        const group1 = filledGroups[0];
        const group2 = filledGroups[1];
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

        html += `<div class="result-item"><span class="result-label">P value:</span> <span class="result-value">${pFormatted}</span></div>`;
        html += `<div class="result-item"><span class="result-label">Significance:</span> <span class="${isSignificant ? 'significant' : 'not-significant'}">${sigLevel} (${isSignificant ? 'Significant' : 'Not significant'} at p &lt; 0.05)</span></div>`;

        // Per-group summary
        html += `<hr style="margin:8px 0;border-color:#eee">`;
        filledGroups.forEach(g => {
            html += `<div class="result-item"><span class="result-label">Mean ${g.label}:</span> <span class="result-value">${Statistics.mean(g.values).toFixed(4)} (N=${g.values.length})</span></div>`;
        });

        // Post-hoc testing (Bonferroni) for significant ANOVA/KW
        const significantPairs = [];
        if (isSignificant) {
            const postHocName = testType === 'one-way-anova'
                ? 'Bonferroni post-hoc (pairwise t-tests)'
                : 'Bonferroni post-hoc (pairwise t-tests)';

            const postHocResults = Statistics.bonferroniPostHoc(groupValues, groupLabels);

            html += `<hr style="margin:8px 0;border-color:#eee">`;
            html += `<div class="result-item"><span class="result-label">Post-hoc:</span> <span class="result-value">${postHocName}</span></div>`;

            postHocResults.forEach(ph => {
                const phPFormatted = Statistics.formatPValue(ph.correctedP);
                const phClass = ph.significant ? 'significant' : 'not-significant';
                html += `<div class="result-item"><span class="result-value">${ph.group1Label} vs ${ph.group2Label}: ${phPFormatted} <span class="${phClass}">${ph.significanceLabel}</span></span></div>`;

                if (ph.significant) {
                    // Map filledGroups index to data index
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

            this.graphRenderer.updateSettings({ statsTestName: testName + ' + Bonferroni' });
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
