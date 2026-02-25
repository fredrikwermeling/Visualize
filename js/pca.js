// pca.js - Dimensionality reduction renderer (PCA, t-SNE, UMAP)
// Uses same matrix data as heatmap (getMatrixData)

class PCARenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.settings = {
            method: 'pca', // pca | tsne | umap
            title: 'PCA',
            xLabel: 'PC1',
            yLabel: 'PC2',
            width: 400,
            height: 400,
            pointSize: 6,
            pointOpacity: 0.8,
            colorTheme: 'default',
            showTitle: true,
            showXLabel: true,
            showYLabel: true,
            showLegend: true,
            showLoadings: false,
            // PCA-specific
            pcX: 1,
            pcY: 2,
            // t-SNE params
            perplexity: 30,
            tsneIterations: 1000,
            tsneLearningRate: 200,
            // UMAP params
            nNeighbors: 15,
            minDist: 0.1,
            umapIterations: 500,
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
            // Group
            groupOverrides: {},
            hiddenGroups: [],
            groupOrder: []
        };
        this._nudgeOffsetKey = null;
        this._cachedEmbedding = null; // cache for t-SNE/UMAP (expensive)
        this._cachedMethod = null;
        this._cachedDataHash = null;

        this.colorThemes = {
            default: ['#5B8DB8','#E8927C','#7EBF7E','#C490D1','#F2CC8F','#81D4DB','#FF9F9F','#A8D5A2','#C2A0D5','#F4B183'],
            pastel: ['#AEC6CF','#FFB7B2','#B5EAD7','#C7CEEA','#FFDAC1','#E2F0CB','#F0E6EF','#D4F0F0','#FCE1E4','#DAEAF6'],
            vivid: ['#E63946','#457B9D','#2A9D8F','#E9C46A','#F4A261','#264653','#A8DADC','#F77F00','#D62828','#023E8A'],
            colorblind: ['#0072B2','#E69F00','#009E73','#CC79A7','#56B4E9','#D55E00','#F0E442','#000000'],
            earth: ['#8B4513','#A0522D','#6B8E23','#556B2F','#B8860B','#D2691E','#CD853F','#DEB887'],
            ocean: ['#003F5C','#2F4B7C','#665191','#A05195','#D45087','#F95D6A','#FF7C43','#FFA600'],
            neon: ['#FF006E','#FB5607','#FFBE0B','#3A86FF','#8338EC','#06D6A0','#EF476F','#FFD166']
        };
        this.symbolCycle = ['circle','square','triangle','diamond','cross','star'];
    }

    // ===== PCA ALGORITHM =====
    _runPCA(matrix) {
        const n = matrix.length;
        const p = matrix[0].length;
        if (n < 2 || p < 2) return null;

        // Center data (subtract column means)
        const means = new Array(p).fill(0);
        for (let j = 0; j < p; j++) {
            for (let i = 0; i < n; i++) {
                means[j] += isNaN(matrix[i][j]) ? 0 : matrix[i][j];
            }
            means[j] /= n;
        }
        const centered = matrix.map(row => row.map((v, j) => (isNaN(v) ? 0 : v) - means[j]));

        // Covariance matrix (p×p)
        const cov = Array.from({ length: p }, () => new Array(p).fill(0));
        for (let i = 0; i < p; i++) {
            for (let j = i; j < p; j++) {
                let s = 0;
                for (let k = 0; k < n; k++) s += centered[k][i] * centered[k][j];
                cov[i][j] = cov[j][i] = s / (n - 1);
            }
        }

        // Eigendecomposition via Jacobi iteration (symmetric matrix)
        const { eigenvalues, eigenvectors } = this._jacobiEigen(cov);

        // Sort by descending eigenvalue
        const indices = eigenvalues.map((v, i) => i);
        indices.sort((a, b) => eigenvalues[b] - eigenvalues[a]);
        const sortedEvals = indices.map(i => eigenvalues[i]);
        const sortedEvecs = indices.map(i => eigenvectors.map(row => row[i]));

        // Project data: scores = centered * eigenvectors
        const totalVar = sortedEvals.reduce((a, b) => a + Math.max(0, b), 0);
        const scores = centered.map(row => {
            return sortedEvecs.map(evec => {
                let dot = 0;
                for (let j = 0; j < p; j++) dot += row[j] * evec[j];
                return dot;
            });
        });

        // Variance explained per component
        const varExplained = sortedEvals.map(v => totalVar > 0 ? Math.max(0, v) / totalVar * 100 : 0);

        return {
            scores,        // n × numPC
            eigenvalues: sortedEvals,
            eigenvectors: sortedEvecs, // numPC × p (loadings)
            varExplained,
            means
        };
    }

    _jacobiEigen(A) {
        const n = A.length;
        // Clone A
        const a = A.map(row => [...row]);
        // Initialize eigenvectors as identity
        const v = Array.from({ length: n }, (_, i) => {
            const row = new Array(n).fill(0);
            row[i] = 1;
            return row;
        });

        const maxIter = 100;
        for (let iter = 0; iter < maxIter; iter++) {
            // Find largest off-diagonal element
            let maxVal = 0, p = 0, q = 1;
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    if (Math.abs(a[i][j]) > maxVal) {
                        maxVal = Math.abs(a[i][j]);
                        p = i; q = j;
                    }
                }
            }
            if (maxVal < 1e-10) break;

            // Compute rotation
            const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
            const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
            const c = 1 / Math.sqrt(t * t + 1);
            const s = t * c;

            // Update matrix
            const app = a[p][p], aqq = a[q][q], apq = a[p][q];
            a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
            a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
            a[p][q] = a[q][p] = 0;

            for (let i = 0; i < n; i++) {
                if (i !== p && i !== q) {
                    const aip = a[i][p], aiq = a[i][q];
                    a[i][p] = a[p][i] = c * aip - s * aiq;
                    a[i][q] = a[q][i] = s * aip + c * aiq;
                }
                const vip = v[i][p], viq = v[i][q];
                v[i][p] = c * vip - s * viq;
                v[i][q] = s * vip + c * viq;
            }
        }

        const eigenvalues = new Array(n);
        for (let i = 0; i < n; i++) eigenvalues[i] = a[i][i];

        return { eigenvalues, eigenvectors: v };
    }

    // ===== t-SNE ALGORITHM =====
    _runTSNE(matrix) {
        const n = matrix.length;
        const p = matrix[0].length;
        if (n < 3) return null;

        const perplexity = Math.min(this.settings.perplexity, Math.floor((n - 1) / 3));
        const maxIter = this.settings.tsneIterations;
        const baseLr = this.settings.tsneLearningRate;

        // Clean NaN and z-score standardize columns
        const raw = matrix.map(row => row.map(v => isNaN(v) ? 0 : v));
        const means = new Array(p).fill(0);
        const stds = new Array(p).fill(0);
        for (let j = 0; j < p; j++) {
            for (let i = 0; i < n; i++) means[j] += raw[i][j];
            means[j] /= n;
            for (let i = 0; i < n; i++) stds[j] += (raw[i][j] - means[j]) ** 2;
            stds[j] = Math.sqrt(stds[j] / n) || 1;
        }
        const data = raw.map(row => row.map((v, j) => (v - means[j]) / stds[j]));

        // Pairwise squared distances
        const dist2 = Array.from({ length: n }, () => new Array(n).fill(0));
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                let d = 0;
                for (let k = 0; k < p; k++) d += (data[i][k] - data[j][k]) ** 2;
                dist2[i][j] = dist2[j][i] = d;
            }
        }

        // Compute P (conditional probabilities) with binary search for sigma
        const P = Array.from({ length: n }, () => new Array(n).fill(0));
        const logPerp = Math.log(perplexity);

        for (let i = 0; i < n; i++) {
            let lo = 1e-20, hi = 1e20, beta = 1;
            for (let iter = 0; iter < 50; iter++) {
                let sumP = 0;
                for (let j = 0; j < n; j++) {
                    if (j === i) continue;
                    P[i][j] = Math.exp(-dist2[i][j] * beta);
                    sumP += P[i][j];
                }
                if (sumP < 1e-20) sumP = 1e-20;
                let H = 0;
                for (let j = 0; j < n; j++) {
                    if (j === i) continue;
                    P[i][j] /= sumP;
                    if (P[i][j] > 1e-7) H -= P[i][j] * Math.log(P[i][j]);
                }
                const diff = H - logPerp;
                if (Math.abs(diff) < 1e-5) break;
                if (diff > 0) { lo = beta; beta = hi >= 1e20 ? beta * 2 : (beta + hi) / 2; }
                else { hi = beta; beta = lo <= 1e-20 ? beta / 2 : (lo + beta) / 2; }
            }
        }

        // Symmetrize P
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const val = (P[i][j] + P[j][i]) / (2 * n);
                P[i][j] = P[j][i] = Math.max(val, 1e-12);
            }
        }

        // Initialize Y with small random values (use seeded pseudo-random)
        let seed = 42;
        const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
        const Y = Array.from({ length: n }, () => [(rand() - 0.5) * 0.01, (rand() - 0.5) * 0.01]);
        const gains = Array.from({ length: n }, () => [1, 1]);
        const prevY = Array.from({ length: n }, () => [0, 0]);

        // Early exaggeration
        const exagEnd = Math.min(100, Math.floor(maxIter * 0.1));
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++)
                if (i !== j) P[i][j] *= 4;

        for (let iter = 0; iter < maxIter; iter++) {
            if (iter === exagEnd) {
                for (let i = 0; i < n; i++)
                    for (let j = 0; j < n; j++)
                        if (i !== j) P[i][j] /= 4;
            }

            // Learning rate decay: baseLr → 0.1*baseLr over iterations
            const lr = baseLr * (1 - 0.9 * iter / maxIter);

            // Compute Q (student-t)
            const Q = Array.from({ length: n }, () => new Array(n).fill(0));
            let sumQ = 0;
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    const d2 = (Y[i][0] - Y[j][0]) ** 2 + (Y[i][1] - Y[j][1]) ** 2;
                    const q = 1 / (1 + d2);
                    Q[i][j] = Q[j][i] = q;
                    sumQ += 2 * q;
                }
            }
            if (sumQ < 1e-20) sumQ = 1e-20;

            // Gradient
            const momentum = iter < 250 ? 0.5 : 0.8;
            for (let i = 0; i < n; i++) {
                let gx = 0, gy = 0;
                for (let j = 0; j < n; j++) {
                    if (j === i) continue;
                    const mult = 4 * (P[i][j] - Q[i][j] / sumQ) * Q[i][j];
                    gx += mult * (Y[i][0] - Y[j][0]);
                    gy += mult * (Y[i][1] - Y[j][1]);
                }

                // Gradient norm clipping (max 5.0 per point)
                const gnorm = Math.sqrt(gx * gx + gy * gy);
                if (gnorm > 5.0) {
                    gx = gx * 5.0 / gnorm;
                    gy = gy * 5.0 / gnorm;
                }

                // Adaptive gains
                gains[i][0] = (Math.sign(gx) !== Math.sign(prevY[i][0])) ? gains[i][0] + 0.2 : Math.max(gains[i][0] * 0.8, 0.01);
                gains[i][1] = (Math.sign(gy) !== Math.sign(prevY[i][1])) ? gains[i][1] + 0.2 : Math.max(gains[i][1] * 0.8, 0.01);

                const dx = momentum * prevY[i][0] - lr * gains[i][0] * gx;
                const dy = momentum * prevY[i][1] - lr * gains[i][1] * gy;
                Y[i][0] += dx;
                Y[i][1] += dy;
                prevY[i][0] = dx;
                prevY[i][1] = dy;
            }

            // Center
            let mx = 0, my = 0;
            for (let i = 0; i < n; i++) { mx += Y[i][0]; my += Y[i][1]; }
            mx /= n; my /= n;
            for (let i = 0; i < n; i++) { Y[i][0] -= mx; Y[i][1] -= my; }
        }

        return { scores: Y.map(y => [y[0], y[1]]) };
    }

    // ===== UMAP ALGORITHM (simplified) =====
    _runUMAP(matrix) {
        const n = matrix.length;
        const p = matrix[0].length;
        if (n < 3) return null;

        const nNeighbors = Math.min(this.settings.nNeighbors, n - 1);
        const minDist = this.settings.minDist;
        const maxIter = this.settings.umapIterations;

        // Clean NaN and z-score standardize columns
        const raw = matrix.map(row => row.map(v => isNaN(v) ? 0 : v));
        const colMeans = new Array(p).fill(0);
        const colStds = new Array(p).fill(0);
        for (let j = 0; j < p; j++) {
            for (let i = 0; i < n; i++) colMeans[j] += raw[i][j];
            colMeans[j] /= n;
            for (let i = 0; i < n; i++) colStds[j] += (raw[i][j] - colMeans[j]) ** 2;
            colStds[j] = Math.sqrt(colStds[j] / n) || 1;
        }
        const data = raw.map(row => row.map((v, j) => (v - colMeans[j]) / colStds[j]));

        // Compute a, b from minDist (approximation of UMAP curve parameters)
        const umapA = 1.929 / (1 + 0.0815 * Math.pow(minDist, 1.8));
        const umapB = 0.7915;

        // Pairwise distances
        const dists = Array.from({ length: n }, () => new Array(n).fill(0));
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                let d = 0;
                for (let k = 0; k < p; k++) d += (data[i][k] - data[j][k]) ** 2;
                d = Math.sqrt(d);
                dists[i][j] = dists[j][i] = d;
            }
        }

        // Find k nearest neighbors per point
        const knn = [];
        for (let i = 0; i < n; i++) {
            const sorted = dists[i].map((d, j) => ({ j, d })).filter(x => x.j !== i).sort((a, b) => a.d - b.d);
            knn.push(sorted.slice(0, nNeighbors));
        }

        // Compute fuzzy simplicial set (membership weights)
        const graph = Array.from({ length: n }, () => new Array(n).fill(0));
        for (let i = 0; i < n; i++) {
            const rho = knn[i][0].d; // distance to nearest neighbor
            // Binary search for sigma
            let lo = 1e-20, hi = 1000, sigma = 1;
            const logK = Math.log2(nNeighbors);
            for (let iter = 0; iter < 64; iter++) {
                let sumW = 0;
                for (const nb of knn[i]) {
                    const w = Math.exp(-Math.max(0, nb.d - rho) / sigma);
                    sumW += w;
                }
                if (Math.abs(sumW - logK) < 1e-5) break;
                if (sumW > logK) { hi = sigma; sigma = (lo + sigma) / 2; }
                else { lo = sigma; sigma = hi >= 1000 ? sigma * 2 : (sigma + hi) / 2; }
            }
            for (const nb of knn[i]) {
                graph[i][nb.j] = Math.exp(-Math.max(0, nb.d - rho) / sigma);
            }
        }

        // Symmetrize: w_sym = w + w^T - w * w^T
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const ga = graph[i][j], gb = graph[j][i];
                const sym = ga + gb - ga * gb;
                graph[i][j] = graph[j][i] = sym;
            }
        }

        // Initialize with PCA, normalize to unit variance (not *0.01)
        let seed = 42;
        const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

        const pcaResult = this._runPCA(data);
        let Y;
        if (pcaResult) {
            const pc0 = pcaResult.scores.map(s => s[0]);
            const pc1 = pcaResult.scores.map(s => s[1]);
            const std0 = Math.sqrt(pc0.reduce((s, v) => s + v * v, 0) / n) || 1;
            const std1 = Math.sqrt(pc1.reduce((s, v) => s + v * v, 0) / n) || 1;
            Y = pcaResult.scores.map(s => [s[0] / std0, s[1] / std1]);
        } else {
            Y = Array.from({ length: n }, () => [(rand() - 0.5) * 10, (rand() - 0.5) * 10]);
        }

        // Collect edges
        const edges = [];
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (graph[i][j] > 0.01) edges.push({ i, j, w: graph[i][j] });
            }
        }

        // Optimization (simplified SGD)
        for (let epoch = 0; epoch < maxIter; epoch++) {
            const alpha = 1.0 - epoch / maxIter; // learning rate decay

            // Attractive forces (along edges)
            for (const e of edges) {
                const dx = Y[e.i][0] - Y[e.j][0];
                const dy = Y[e.i][1] - Y[e.j][1];
                const d2 = dx * dx + dy * dy + 1e-6;
                const grad = -2 * umapA * umapB * Math.pow(d2, umapB - 1) / (1 + umapA * Math.pow(d2, umapB));
                const gx = grad * dx * alpha * e.w;
                const gy = grad * dy * alpha * e.w;
                Y[e.i][0] += gx;
                Y[e.i][1] += gy;
                Y[e.j][0] -= gx;
                Y[e.j][1] -= gy;
            }

            // Repulsive forces (sample negative edges)
            const nNeg = Math.min(5, n - 1);
            for (let i = 0; i < n; i++) {
                for (let s = 0; s < nNeg; s++) {
                    const j = Math.floor(rand() * n);
                    if (j === i) continue;
                    if (graph[i][j] > 0.5) continue; // skip positive edges
                    const dx = Y[i][0] - Y[j][0];
                    const dy = Y[i][1] - Y[j][1];
                    const d2 = dx * dx + dy * dy + 1e-6;
                    const grad = 2 * umapB / ((0.001 + d2) * (1 + umapA * Math.pow(d2, umapB)));
                    const clip = Math.min(grad, 4);
                    Y[i][0] += clip * dx * alpha * 1.0;
                    Y[i][1] += clip * dy * alpha * 1.0;
                }
            }
        }

        return { scores: Y.map(y => [y[0], y[1]]) };
    }

    // ===== RENDER =====
    render(matrixData, settings) {
        if (settings) Object.assign(this.settings, settings);
        this.container.innerHTML = '';

        if (!matrixData || !matrixData.matrix || matrixData.matrix.length < 2) {
            this.container.innerHTML = '<div class="empty-state"><h3>Enter data for PCA</h3><p>Uses the same data format as Heatmap (Group/Sample rows, numeric columns)</p></div>';
            return;
        }

        const s = this.settings;
        const { matrix, rowLabels, groupAssignments, colLabels } = matrixData;

        // Keep full group list for legend display
        const allGroupNames = [...new Set(groupAssignments)];

        // Filter matrix rows by visible groups BEFORE computing embedding
        const hiddenGroups = s.hiddenGroups || [];
        const visibleIndices = [];
        for (let i = 0; i < matrix.length; i++) {
            if (!hiddenGroups.includes(groupAssignments[i])) {
                visibleIndices.push(i);
            }
        }
        const visibleMatrix = visibleIndices.map(i => matrix[i]);
        const visibleRowLabels = visibleIndices.map(i => rowLabels[i]);
        const visibleGroups = visibleIndices.map(i => groupAssignments[i]);

        if (visibleMatrix.length < 2 || !visibleMatrix[0] || visibleMatrix[0].length < 2) {
            this.container.innerHTML = '<div class="empty-state"><h3>Need at least 2 visible samples</h3><p>Unhide groups to see the embedding</p></div>';
            return;
        }

        // Compute embedding (only on visible data)
        const dataHash = JSON.stringify(visibleMatrix).length + '_' + visibleMatrix.length + '_' + visibleMatrix[0].length + '_' + [...hiddenGroups].sort().join(',');
        let embedding;

        if (this._cachedEmbedding && this._cachedMethod === s.method && this._cachedDataHash === dataHash
            && (s.method === 'pca' || (s.method === 'tsne' && this._cachedPerplexity === s.perplexity)
                || (s.method === 'umap' && this._cachedNNeighbors === s.nNeighbors && this._cachedMinDist === s.minDist))) {
            embedding = this._cachedEmbedding;
        } else {
            if (s.method === 'pca') {
                embedding = this._runPCA(visibleMatrix);
            } else if (s.method === 'tsne') {
                embedding = this._runTSNE(visibleMatrix);
            } else if (s.method === 'umap') {
                embedding = this._runUMAP(visibleMatrix);
            }
            this._cachedEmbedding = embedding;
            this._cachedMethod = s.method;
            this._cachedDataHash = dataHash;
            this._cachedPerplexity = s.perplexity;
            this._cachedNNeighbors = s.nNeighbors;
            this._cachedMinDist = s.minDist;
        }

        if (!embedding || !embedding.scores) {
            this.container.innerHTML = '<div class="empty-state"><h3>Cannot compute embedding</h3><p>Need at least 3 samples with 2+ numeric columns</p></div>';
            return;
        }

        // Get coordinates
        let xIdx = 0, yIdx = 1;
        if (s.method === 'pca') {
            xIdx = Math.max(0, s.pcX - 1);
            yIdx = Math.max(0, s.pcY - 1);
            const maxPC = embedding.scores[0].length;
            if (xIdx >= maxPC) xIdx = 0;
            if (yIdx >= maxPC) yIdx = Math.min(1, maxPC - 1);
        }

        // Build points from visible data only
        const visiblePoints = embedding.scores.map((sc, i) => ({
            x: sc[xIdx],
            y: sc[yIdx],
            group: visibleGroups[i] || 'All',
            label: visibleRowLabels[i] || `Sample ${i + 1}`
        }));

        // Layout — increase right margin for legend
        const legendWidth = (s.showLegend && allGroupNames.length > 1) ? this._estimateLegendWidth(allGroupNames) + 16 : 30;
        const margin = { top: 50, right: legendWidth, bottom: 65, left: 65 };
        const width = s.width;
        const height = s.height;
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        const svg = d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('font-family', 'Arial, sans-serif')
            .style('overflow', 'visible');

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        if (visiblePoints.length === 0) {
            svg.append('text').attr('x', width / 2).attr('y', height / 2)
                .attr('text-anchor', 'middle').attr('fill', '#999').text('All groups hidden');
            return;
        }

        // Scales
        const allX = visiblePoints.map(p => p.x);
        const allY = visiblePoints.map(p => p.y);
        let [xMin, xMax] = d3.extent(allX);
        let [yMin, yMax] = d3.extent(allY);
        const xPad = (xMax - xMin) * 0.1 || 1;
        const yPad = (yMax - yMin) * 0.1 || 1;
        xMin -= xPad; xMax += xPad;
        yMin -= yPad; yMax += yPad;

        const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, innerW]).nice();
        const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]).nice();

        // Axes
        const xAxisG = g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(xScale));
        this._styleAxisTicks(xAxisG, s.xTickFont);
        const yAxisG = g.append('g').call(d3.axisLeft(yScale));
        this._styleAxisTicks(yAxisG, s.yTickFont);

        // Draw points
        visiblePoints.forEach(pt => {
            const gi = allGroupNames.indexOf(pt.group);
            const color = this._getColor(gi >= 0 ? gi : 0);
            const symbolGen = this._d3Symbol(this._getSymbolForGroup(gi >= 0 ? gi : 0));

            g.append('path')
                .attr('d', symbolGen.size(s.pointSize * s.pointSize * Math.PI)())
                .attr('transform', `translate(${xScale(pt.x)},${yScale(pt.y)})`)
                .attr('fill', color)
                .attr('fill-opacity', s.pointOpacity)
                .attr('stroke', d3.color(color).darker(0.5))
                .attr('stroke-width', 1)
                .attr('cursor', 'pointer')
                .append('title')
                .text(`${pt.label} (${pt.group})`);
        });

        // Loading arrows (PCA only)
        if (s.method === 'pca' && s.showLoadings && embedding.eigenvectors && colLabels) {
            const loadX = embedding.eigenvectors[xIdx];
            const loadY = embedding.eigenvectors[yIdx];
            if (loadX && loadY) {
                // Scale loadings to fit in plot
                const maxLoad = Math.max(
                    ...loadX.map(Math.abs),
                    ...loadY.map(Math.abs)
                ) || 1;
                const xRange = xScale.domain()[1] - xScale.domain()[0];
                const yRange = yScale.domain()[1] - yScale.domain()[0];
                const scale = Math.min(xRange, yRange) * 0.35 / maxLoad;

                const clipId = 'load-clip-' + Math.random().toString(36).slice(2, 8);
                g.append('defs').append('clipPath').attr('id', clipId)
                    .append('rect').attr('x', 0).attr('y', 0).attr('width', innerW).attr('height', innerH);

                for (let j = 0; j < colLabels.length; j++) {
                    const lx = loadX[j] * scale;
                    const ly = loadY[j] * scale;
                    if (Math.abs(lx) < 0.001 && Math.abs(ly) < 0.001) continue;

                    const cx = xScale(0), cy = yScale(0);
                    const ex = xScale(lx), ey = yScale(ly);

                    g.append('line')
                        .attr('clip-path', `url(#${clipId})`)
                        .attr('x1', cx).attr('y1', cy)
                        .attr('x2', ex).attr('y2', ey)
                        .attr('stroke', '#c0392b')
                        .attr('stroke-width', 1)
                        .attr('stroke-opacity', 0.7)
                        .attr('marker-end', 'url(#arrowhead)');

                    g.append('text')
                        .attr('clip-path', `url(#${clipId})`)
                        .attr('x', ex + (lx >= 0 ? 3 : -3))
                        .attr('y', ey - 3)
                        .attr('text-anchor', lx >= 0 ? 'start' : 'end')
                        .attr('font-size', '11px')
                        .attr('fill', '#c0392b')
                        .style('paint-order', 'stroke')
                        .attr('stroke', 'white')
                        .attr('stroke-width', 3)
                        .attr('stroke-linejoin', 'round')
                        .text(colLabels[j]);
                }

                // Arrowhead marker
                svg.select('defs').append('marker')
                    .attr('id', 'arrowhead')
                    .attr('viewBox', '0 0 10 10')
                    .attr('refX', 10).attr('refY', 5)
                    .attr('markerWidth', 6).attr('markerHeight', 6)
                    .attr('orient', 'auto')
                    .append('path').attr('d', 'M0,0 L10,5 L0,10 z').attr('fill', '#c0392b');
            }
        }

        // Legend
        this._drawLegend(g, innerW, allGroupNames);

        // Variance explained info (PCA only)
        if (s.method === 'pca' && embedding.varExplained) {
            const veX = embedding.varExplained[xIdx];
            const veY = embedding.varExplained[yIdx];
            if (veX !== undefined) {
                s.xLabel = `PC${xIdx + 1} (${veX.toFixed(1)}%)`;
                s.yLabel = `PC${yIdx + 1} (${veY.toFixed(1)}%)`;
            }
        } else if (s.method === 'tsne') {
            s.xLabel = 't-SNE 1';
            s.yLabel = 't-SNE 2';
        } else if (s.method === 'umap') {
            s.xLabel = 'UMAP 1';
            s.yLabel = 'UMAP 2';
        }

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

        // Annotations
        if (this.annotationManager) {
            this.annotationManager.drawAnnotations(svg, margin);
        }
    }

    _estimateLegendWidth(groupNames) {
        const lf = this.settings.legendFont;
        // Rough estimate: ~7px per char at 11px font, plus symbol+padding
        const charWidth = lf.size * 0.6;
        const maxLabelWidth = Math.max(...groupNames.map(n => n.length * charWidth));
        return 20 + maxLabelWidth + 12; // symbol + text + padding
    }

    _drawLegend(g, innerW, groupNames) {
        const s = this.settings;
        if (!s.showLegend || groupNames.length <= 1) return;

        // Respect groupOrder for legend item ordering
        let orderedNames;
        if (s.groupOrder && s.groupOrder.length > 0) {
            orderedNames = s.groupOrder.filter(g => groupNames.includes(g));
            groupNames.forEach(g => { if (!orderedNames.includes(g)) orderedNames.push(g); });
        } else {
            orderedNames = [...groupNames];
        }

        const lf = s.legendFont;
        const loff = s.legendOffset;
        const hiddenGroups = s.hiddenGroups || [];

        const baseX = innerW + 12;
        const baseY = 0;

        const legendG = g.append('g')
            .attr('transform', `translate(${baseX + loff.x}, ${baseY + loff.y})`)
            .attr('cursor', 'grab');

        // White background rect
        const legendW = this._estimateLegendWidth(orderedNames);
        const legendH = orderedNames.length * 20 + 8;
        legendG.append('rect')
            .attr('x', -4).attr('y', -10)
            .attr('width', legendW)
            .attr('height', legendH)
            .attr('fill', 'white')
            .attr('stroke', '#ddd')
            .attr('stroke-width', 1)
            .attr('rx', 3);

        orderedNames.forEach((name, i) => {
            const gi = groupNames.indexOf(name);
            const ly = i * 20;
            const color = this._getColor(gi >= 0 ? gi : 0);
            const symbolGen = this._d3Symbol(this._getSymbolForGroup(gi >= 0 ? gi : 0));
            const isHidden = hiddenGroups.includes(name);
            const opacity = isHidden ? 0.3 : 1;

            legendG.append('path')
                .attr('d', symbolGen.size(50)())
                .attr('transform', `translate(6,${ly})`)
                .attr('fill', color)
                .attr('opacity', opacity);

            legendG.append('text')
                .attr('x', 16).attr('y', ly + 4)
                .attr('font-size', lf.size + 'px')
                .attr('font-family', lf.family)
                .attr('font-weight', lf.bold ? 'bold' : 'normal')
                .attr('font-style', lf.italic ? 'italic' : 'normal')
                .attr('fill', '#333')
                .attr('opacity', opacity)
                .text(name);
        });

        const self = this;
        legendG.call(d3.drag()
            .on('start', function() { d3.select(this).style('cursor', 'grabbing'); })
            .on('drag', function(event) {
                self.settings.legendOffset.x += event.dx;
                self.settings.legendOffset.y += event.dy;
                d3.select(this).attr('transform',
                    `translate(${baseX + self.settings.legendOffset.x}, ${baseY + self.settings.legendOffset.y})`);
            })
            .on('end', function() {
                d3.select(this).style('cursor', 'grab');
                if (window.app) window.app.updateGraph();
                self._selectLabelForNudge('legendOffset');
            })
        );
    }

    // --- Shared helper methods (same as correlation.js) ---

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

    _createFontToolbar(fontObj) {
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display:flex;align-items:center;gap:4px;flex-wrap:wrap;';
        const families = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New'];
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

    _styleAxisTicks(axisG, tickFont) {
        axisG.selectAll('text')
            .attr('font-size', tickFont.size + 'px')
            .attr('font-family', tickFont.family)
            .attr('font-weight', tickFont.bold ? 'bold' : 'normal')
            .attr('font-style', tickFont.italic ? 'italic' : 'normal');
    }

    _getColor(groupIndex) {
        const theme = this.colorThemes[this.settings.colorTheme] || this.colorThemes.default;
        return theme[groupIndex % theme.length];
    }

    _getSymbolForGroup(groupIndex) {
        return this.symbolCycle[groupIndex % this.symbolCycle.length];
    }

    _d3Symbol(shapeName) {
        const map = {
            circle: d3.symbolCircle, square: d3.symbolSquare, triangle: d3.symbolTriangle,
            diamond: d3.symbolDiamond, cross: d3.symbolCross, star: d3.symbolStar
        };
        return d3.symbol().type(map[shapeName] || d3.symbolCircle);
    }

    getSvgElement() {
        return this.container.querySelector('svg');
    }
}
