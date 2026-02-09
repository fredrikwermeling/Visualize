// stats.js - Statistical calculations

class Statistics {
    static mean(values) {
        if (values.length === 0) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    static median(values) {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 
            ? (sorted[mid - 1] + sorted[mid]) / 2 
            : sorted[mid];
    }

    static std(values, sample = true) {
        if (values.length === 0) return 0;
        const avg = this.mean(values);
        const squareDiffs = values.map(value => Math.pow(value - avg, 2));
        const avgSquareDiff = this.mean(squareDiffs);
        const divisor = sample ? values.length - 1 : values.length;
        return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / divisor);
    }

    static sem(values) {
        if (values.length === 0) return 0;
        return this.std(values) / Math.sqrt(values.length);
    }

    static quartiles(values) {
        if (values.length === 0) return { q1: 0, q2: 0, q3: 0 };
        const sorted = [...values].sort((a, b) => a - b);
        const q2 = this.median(sorted);
        const mid = Math.floor(sorted.length / 2);
        const lower = sorted.slice(0, mid);
        const upper = sorted.length % 2 === 0 
            ? sorted.slice(mid) 
            : sorted.slice(mid + 1);
        
        return {
            q1: this.median(lower),
            q2: q2,
            q3: this.median(upper)
        };
    }

    static tTest(group1, group2, paired = false) {
        if (group1.length === 0 || group2.length === 0) {
            return { t: 0, p: 1, df: 0 };
        }

        if (paired) {
            // Paired t-test
            if (group1.length !== group2.length) {
                throw new Error('Paired test requires equal sample sizes');
            }
            
            const differences = group1.map((val, i) => val - group2[i]);
            const meanDiff = this.mean(differences);
            const stdDiff = this.std(differences);
            const n = differences.length;
            const t = meanDiff / (stdDiff / Math.sqrt(n));
            const df = n - 1;
            
            // Using jStat for p-value calculation
            const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
            
            return { t, p, df };
        } else {
            // Unpaired t-test (Welch's t-test)
            const mean1 = this.mean(group1);
            const mean2 = this.mean(group2);
            const std1 = this.std(group1);
            const std2 = this.std(group2);
            const n1 = group1.length;
            const n2 = group2.length;
            
            const variance1 = std1 * std1;
            const variance2 = std2 * std2;
            
            const pooledStd = Math.sqrt(variance1 / n1 + variance2 / n2);
            const t = (mean1 - mean2) / pooledStd;
            
            // Welch-Satterthwaite degrees of freedom
            const df = Math.pow(variance1 / n1 + variance2 / n2, 2) / 
                      (Math.pow(variance1 / n1, 2) / (n1 - 1) + 
                       Math.pow(variance2 / n2, 2) / (n2 - 1));
            
            const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
            
            return { t, p, df };
        }
    }

    static mannWhitneyU(group1, group2) {
        if (group1.length === 0 || group2.length === 0) {
            return { U: 0, p: 1 };
        }

        // Combine and rank all values
        const combined = [
            ...group1.map(v => ({ value: v, group: 1 })),
            ...group2.map(v => ({ value: v, group: 2 }))
        ].sort((a, b) => a.value - b.value);

        // Assign ranks (handling ties)
        let rank = 1;
        for (let i = 0; i < combined.length; i++) {
            let tieCount = 1;
            let tieSum = rank;
            
            while (i + tieCount < combined.length && 
                   combined[i].value === combined[i + tieCount].value) {
                tieSum += rank + tieCount;
                tieCount++;
            }
            
            const avgRank = tieSum / tieCount;
            for (let j = 0; j < tieCount; j++) {
                combined[i + j].rank = avgRank;
            }
            
            rank += tieCount;
            i += tieCount - 1;
        }

        // Calculate sum of ranks for each group
        const R1 = combined.filter(x => x.group === 1)
                           .reduce((sum, x) => sum + x.rank, 0);
        const R2 = combined.filter(x => x.group === 2)
                           .reduce((sum, x) => sum + x.rank, 0);

        const n1 = group1.length;
        const n2 = group2.length;

        const U1 = n1 * n2 + (n1 * (n1 + 1)) / 2 - R1;
        const U2 = n1 * n2 + (n2 * (n2 + 1)) / 2 - R2;
        const U = Math.min(U1, U2);

        // Approximate p-value using normal distribution for large samples
        const meanU = (n1 * n2) / 2;
        const stdU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
        const z = (U - meanU) / stdU;
        const p = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));

        return { U, p, z };
    }

    static wilcoxonSignedRank(group1, group2) {
        if (group1.length !== group2.length || group1.length === 0) {
            throw new Error('Paired test requires equal sample sizes');
        }

        // Calculate differences and their absolute values
        const differences = group1.map((val, i) => ({
            diff: val - group2[i],
            absDiff: Math.abs(val - group2[i]),
            sign: val - group2[i] >= 0 ? 1 : -1
        })).filter(d => d.diff !== 0); // Remove zeros

        if (differences.length === 0) {
            return { W: 0, p: 1 };
        }

        // Rank absolute differences
        const sorted = [...differences].sort((a, b) => a.absDiff - b.absDiff);
        
        let rank = 1;
        for (let i = 0; i < sorted.length; i++) {
            let tieCount = 1;
            let tieSum = rank;
            
            while (i + tieCount < sorted.length && 
                   sorted[i].absDiff === sorted[i + tieCount].absDiff) {
                tieSum += rank + tieCount;
                tieCount++;
            }
            
            const avgRank = tieSum / tieCount;
            for (let j = 0; j < tieCount; j++) {
                sorted[i + j].rank = avgRank;
            }
            
            rank += tieCount;
            i += tieCount - 1;
        }

        // Calculate W+ and W-
        const Wplus = sorted.filter(d => d.sign > 0)
                            .reduce((sum, d) => sum + d.rank, 0);
        const Wminus = sorted.filter(d => d.sign < 0)
                             .reduce((sum, d) => sum + d.rank, 0);
        
        const W = Math.min(Wplus, Wminus);
        const n = differences.length;

        // Approximate p-value for large samples
        const meanW = (n * (n + 1)) / 4;
        const stdW = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24);
        const z = (W - meanW) / stdW;
        const p = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));

        return { W, p, z };
    }

    static oneWayAnova(groups) {
        // groups = array of value arrays
        const k = groups.length;
        const allValues = groups.flat();
        const N = allValues.length;
        const grandMean = this.mean(allValues);

        // Sum of squares between (SSB)
        let ssb = 0;
        groups.forEach(g => {
            const gMean = this.mean(g);
            ssb += g.length * Math.pow(gMean - grandMean, 2);
        });

        // Sum of squares within (SSW)
        let ssw = 0;
        groups.forEach(g => {
            const gMean = this.mean(g);
            g.forEach(v => {
                ssw += Math.pow(v - gMean, 2);
            });
        });

        const dfBetween = k - 1;
        const dfWithin = N - k;

        if (dfWithin <= 0) {
            return { F: 0, p: 1, dfBetween, dfWithin };
        }

        const msb = ssb / dfBetween;
        const msw = ssw / dfWithin;
        const F = msw > 0 ? msb / msw : 0;

        // p-value from F-distribution
        const p = 1 - jStat.centralF.cdf(F, dfBetween, dfWithin);

        return { F, p, dfBetween, dfWithin };
    }

    static kruskalWallis(groups) {
        // groups = array of value arrays
        const k = groups.length;
        const allTagged = [];
        groups.forEach((g, gi) => {
            g.forEach(v => allTagged.push({ value: v, group: gi }));
        });
        const N = allTagged.length;

        // Sort and assign ranks (handle ties)
        allTagged.sort((a, b) => a.value - b.value);

        let rank = 1;
        for (let i = 0; i < allTagged.length; i++) {
            let tieCount = 1;
            let tieSum = rank;
            while (i + tieCount < allTagged.length &&
                   allTagged[i].value === allTagged[i + tieCount].value) {
                tieSum += rank + tieCount;
                tieCount++;
            }
            const avgRank = tieSum / tieCount;
            for (let j = 0; j < tieCount; j++) {
                allTagged[i + j].rank = avgRank;
            }
            rank += tieCount;
            i += tieCount - 1;
        }

        // Calculate H statistic
        let H = 0;
        groups.forEach((g, gi) => {
            const ranks = allTagged.filter(x => x.group === gi).map(x => x.rank);
            const Ri = ranks.reduce((a, b) => a + b, 0);
            const ni = g.length;
            H += (Ri * Ri) / ni;
        });
        H = (12 / (N * (N + 1))) * H - 3 * (N + 1);

        const df = k - 1;
        // p-value from chi-squared distribution
        const p = 1 - jStat.chisquare.cdf(H, df);

        return { H, p, df };
    }

    static bonferroniPostHoc(groups, groupLabels) {
        const results = [];
        const numComparisons = (groups.length * (groups.length - 1)) / 2;

        for (let i = 0; i < groups.length; i++) {
            for (let j = i + 1; j < groups.length; j++) {
                const testResult = this.tTest(groups[i], groups[j], false);
                const correctedP = Math.min(testResult.p * numComparisons, 1.0);
                const sigLabel = this.getSignificanceLevel(correctedP);

                results.push({
                    group1Index: i,
                    group2Index: j,
                    group1Label: groupLabels[i],
                    group2Label: groupLabels[j],
                    rawP: testResult.p,
                    correctedP: correctedP,
                    significanceLabel: sigLabel,
                    significant: correctedP < 0.05
                });
            }
        }

        return results;
    }

    static formatPValue(p) {
        if (p < 0.0001) return 'p < 0.0001';
        if (p < 0.001) return `p = ${p.toFixed(4)}`;
        if (p < 0.01) return `p = ${p.toFixed(3)}`;
        return `p = ${p.toFixed(3)}`;
    }

    static getSignificanceLevel(p) {
        if (p < 0.001) return '***';
        if (p < 0.01) return '**';
        if (p < 0.05) return '*';
        return 'ns';
    }
}
