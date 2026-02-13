// clustering.js - Hierarchical agglomerative clustering

class HierarchicalClustering {

    static euclidean(a, b) {
        let sum = 0;
        let count = 0;
        for (let i = 0; i < a.length; i++) {
            if (!isNaN(a[i]) && !isNaN(b[i])) {
                sum += (a[i] - b[i]) ** 2;
                count++;
            }
        }
        if (count === 0) return Infinity;
        return Math.sqrt(sum);
    }

    static cluster(vectors, linkage = 'average') {
        const n = vectors.length;
        if (n === 0) return null;
        if (n === 1) return { index: 0, height: 0, indices: [0] };

        // Initialize leaves
        const nodes = vectors.map((_, i) => ({ index: i, height: 0, indices: [i] }));

        // Compute initial distance matrix (lower triangular)
        const dist = [];
        for (let i = 0; i < n; i++) {
            dist[i] = [];
            for (let j = 0; j < i; j++) {
                dist[i][j] = HierarchicalClustering.euclidean(vectors[i], vectors[j]);
            }
        }

        const active = new Set(Array.from({ length: n }, (_, i) => i));

        while (active.size > 1) {
            // Find closest pair
            let minDist = Infinity;
            let minI = -1, minJ = -1;
            const activeArr = Array.from(active);

            for (let ai = 0; ai < activeArr.length; ai++) {
                for (let aj = ai + 1; aj < activeArr.length; aj++) {
                    const i = activeArr[ai];
                    const j = activeArr[aj];
                    const hi = Math.max(i, j);
                    const lo = Math.min(i, j);
                    const d = dist[hi][lo];
                    if (d < minDist) {
                        minDist = d;
                        minI = lo;
                        minJ = hi;
                    }
                }
            }

            // Merge minI and minJ into a new node
            const newNode = {
                left: nodes[minI],
                right: nodes[minJ],
                height: minDist,
                indices: [...nodes[minI].indices, ...nodes[minJ].indices]
            };

            const newIdx = nodes.length;
            nodes.push(newNode);

            // Compute distances from new cluster to all remaining
            dist[newIdx] = [];
            for (const k of active) {
                if (k === minI || k === minJ) continue;
                const hi1 = Math.max(k, minI);
                const lo1 = Math.min(k, minI);
                const hi2 = Math.max(k, minJ);
                const lo2 = Math.min(k, minJ);
                const d1 = dist[hi1][lo1];
                const d2 = dist[hi2][lo2];

                let d;
                if (linkage === 'single') {
                    d = Math.min(d1, d2);
                } else if (linkage === 'complete') {
                    d = Math.max(d1, d2);
                } else {
                    // Average (UPGMA)
                    const n1 = nodes[minI].indices.length;
                    const n2 = nodes[minJ].indices.length;
                    d = (d1 * n1 + d2 * n2) / (n1 + n2);
                }

                const hi = Math.max(k, newIdx);
                const lo = Math.min(k, newIdx);
                if (!dist[hi]) dist[hi] = [];
                dist[hi][lo] = d;
            }

            active.delete(minI);
            active.delete(minJ);
            active.add(newIdx);
        }

        return nodes[nodes.length - 1];
    }

    static leafOrder(tree) {
        if (!tree) return [];
        if (tree.index !== undefined) return [tree.index];
        return [
            ...HierarchicalClustering.leafOrder(tree.left),
            ...HierarchicalClustering.leafOrder(tree.right)
        ];
    }

    // Swap left/right children at every internal node (produces a valid alternative ordering)
    static flipTree(tree) {
        if (!tree || tree.index !== undefined) return tree;
        const flipped = { ...tree, left: tree.right, right: tree.left };
        flipped.left = HierarchicalClustering.flipTree(flipped.left);
        flipped.right = HierarchicalClustering.flipTree(flipped.right);
        return flipped;
    }

    // Swap only at root level
    static flipRoot(tree) {
        if (!tree || tree.index !== undefined) return tree;
        return { ...tree, left: tree.right, right: tree.left };
    }
}
