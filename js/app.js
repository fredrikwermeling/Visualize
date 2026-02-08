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
        this._bindFontControls();
        this._bindDimensionControls();
        this._bindStatisticsControls();
        this._bindExportControls();

        // Load sample data and draw initial graph
        this.dataTable.loadSampleData();
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

    _bindFontControls() {
        document.getElementById('fontFamily').addEventListener('change', (e) => {
            this.graphRenderer.updateSettings({ fontFamily: e.target.value });
            this.updateGraph();
        });

        document.getElementById('fontSize').addEventListener('input', (e) => {
            this.graphRenderer.updateSettings({ fontSize: parseInt(e.target.value) || 12 });
            this.updateGraph();
        });

        document.getElementById('fontBold').addEventListener('change', (e) => {
            this.graphRenderer.updateSettings({ fontBold: e.target.checked });
            this.updateGraph();
        });

        document.getElementById('fontItalic').addEventListener('change', (e) => {
            this.graphRenderer.updateSettings({ fontItalic: e.target.checked });
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
    }

    _bindStatisticsControls() {
        document.getElementById('runStats').addEventListener('click', () => {
            this._runStatisticalTest();
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

        // Run test on first two groups with data
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

        // Add significance bracket to graph
        this.graphRenderer.setSignificance([{
            group1Index,
            group2Index,
            pValue: result.p,
            significanceLabel: sigLevel
        }]);
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
