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

    static friedmanTest(groups) {
        // Friedman test — non-parametric paired test for 3+ groups
        // groups = array of value arrays, all must have equal length
        const k = groups.length;       // number of treatments/conditions
        const n = groups[0].length;    // number of subjects/blocks

        // Build matrix: rows = subjects, columns = treatments
        // Rank within each subject (row)
        let sumRanks = new Array(k).fill(0);

        for (let i = 0; i < n; i++) {
            // Get values for this subject across all groups
            const row = groups.map((g, j) => ({ value: g[i], group: j }));
            row.sort((a, b) => a.value - b.value);

            // Assign ranks with tie handling
            let rank = 1;
            for (let r = 0; r < row.length; r++) {
                let tieCount = 1;
                let tieSum = rank;
                while (r + tieCount < row.length && row[r].value === row[r + tieCount].value) {
                    tieSum += rank + tieCount;
                    tieCount++;
                }
                const avgRank = tieSum / tieCount;
                for (let t = 0; t < tieCount; t++) {
                    sumRanks[row[r + t].group] += avgRank;
                }
                rank += tieCount;
                r += tieCount - 1;
            }
        }

        // Friedman chi-squared statistic
        const meanRank = (k + 1) / 2;
        let Q = 0;
        for (let j = 0; j < k; j++) {
            Q += Math.pow(sumRanks[j] / n - meanRank, 2);
        }
        Q = (12 * n / (k * (k + 1))) * Q;

        const df = k - 1;
        const p = 1 - jStat.chisquare.cdf(Q, df);

        return { Q, p, df, n };
    }

    static friedmanPostHoc(groups, groupLabels) {
        // Post-hoc for Friedman: pairwise Wilcoxon signed-rank with Bonferroni correction
        const results = [];
        const numComparisons = (groups.length * (groups.length - 1)) / 2;

        for (let i = 0; i < groups.length; i++) {
            for (let j = i + 1; j < groups.length; j++) {
                let testResult;
                try {
                    testResult = this.wilcoxonSignedRank(groups[i], groups[j]);
                } catch (e) {
                    testResult = { W: 0, p: 1 };
                }
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

    static holmBonferroniPostHoc(groups, groupLabels) {
        const results = [];
        const k = groups.length;

        // Generate all pairwise comparisons
        const comparisons = [];
        for (let i = 0; i < k; i++) {
            for (let j = i + 1; j < k; j++) {
                const testResult = this.tTest(groups[i], groups[j], false);
                comparisons.push({
                    group1Index: i,
                    group2Index: j,
                    group1Label: groupLabels[i],
                    group2Label: groupLabels[j],
                    rawP: testResult.p
                });
            }
        }

        // Sort by raw p-value ascending
        comparisons.sort((a, b) => a.rawP - b.rawP);
        const m = comparisons.length;

        // Apply Holm correction: p_i * (m - i), enforce monotonicity
        let maxSoFar = 0;
        comparisons.forEach((comp, i) => {
            let correctedP = comp.rawP * (m - i);
            correctedP = Math.min(correctedP, 1.0);
            correctedP = Math.max(correctedP, maxSoFar); // enforce monotonicity
            maxSoFar = correctedP;
            comp.correctedP = correctedP;
            comp.significanceLabel = this.getSignificanceLevel(correctedP);
            comp.significant = correctedP < 0.05;
        });

        return comparisons;
    }

    static tukeyHSDPostHoc(groups, groupLabels) {
        const k = groups.length;
        const allValues = groups.flat();
        const N = allValues.length;

        // Calculate MSW (mean square within)
        let ssw = 0;
        groups.forEach(g => {
            const gMean = this.mean(g);
            g.forEach(v => { ssw += Math.pow(v - gMean, 2); });
        });
        const dfWithin = N - k;
        if (dfWithin <= 0) return [];
        const msw = ssw / dfWithin;

        const results = [];
        for (let i = 0; i < k; i++) {
            for (let j = i + 1; j < k; j++) {
                const mean_i = this.mean(groups[i]);
                const mean_j = this.mean(groups[j]);
                const n_i = groups[i].length;
                const n_j = groups[j].length;

                const q = Math.abs(mean_i - mean_j) / Math.sqrt(msw * 0.5 * (1 / n_i + 1 / n_j));

                // p-value from Tukey's studentized range distribution
                // jStat.tukey.cdf(q, k, dfWithin)
                let p;
                try {
                    p = 1 - jStat.tukey.cdf(q, k, dfWithin);
                } catch (e) {
                    // Fallback: approximate with Bonferroni-corrected t-test
                    const testResult = this.tTest(groups[i], groups[j], false);
                    const numComp = (k * (k - 1)) / 2;
                    p = Math.min(testResult.p * numComp, 1.0);
                }

                p = Math.max(0, Math.min(1, p));
                const sigLabel = this.getSignificanceLevel(p);

                results.push({
                    group1Index: i,
                    group2Index: j,
                    group1Label: groupLabels[i],
                    group2Label: groupLabels[j],
                    rawP: p,
                    correctedP: p,
                    significanceLabel: sigLabel,
                    significant: p < 0.05
                });
            }
        }

        return results;
    }

    static dunnettPostHoc(groups, groupLabels, controlIdx = 0) {
        const k = groups.length;
        const results = [];
        const m = k - 1; // number of comparisons (vs control only)

        for (let i = 0; i < k; i++) {
            if (i === controlIdx) continue;

            const testResult = this.tTest(groups[controlIdx], groups[i], false);
            // Bonferroni correction with m = k-1 comparisons
            const correctedP = Math.min(testResult.p * m, 1.0);
            const sigLabel = this.getSignificanceLevel(correctedP);

            results.push({
                group1Index: controlIdx,
                group2Index: i,
                group1Label: groupLabels[controlIdx],
                group2Label: groupLabels[i],
                rawP: testResult.p,
                correctedP: correctedP,
                significanceLabel: sigLabel,
                significant: correctedP < 0.05
            });
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

    static twoWayRepeatedMeasuresAnova(growthData) {
        const { timepoints, groups, subjects, groupMap } = growthData;
        const a = groups.length;        // number of groups (between-subjects factor)
        const b = timepoints.length;    // number of timepoints (within-subjects factor)

        // Build data matrix: data[group][subject][time]
        const groupData = [];
        const nPerGroup = [];
        for (let gi = 0; gi < a; gi++) {
            const sids = groupMap[groups[gi]] || [];
            const subjectData = [];
            sids.forEach(sid => {
                const vals = subjects[sid];
                if (!vals) return;
                // Only include subjects with all timepoints
                const allValid = vals.every((v, ti) => ti >= b || (v !== null && !isNaN(v)));
                if (allValid) subjectData.push(vals.slice(0, b));
            });
            groupData.push(subjectData);
            nPerGroup.push(subjectData.length);
        }

        const N = nPerGroup.reduce((s, n) => s + n, 0); // total subjects
        if (N < a + 1) throw new Error('Not enough subjects for RM ANOVA');

        // Grand mean
        let grandSum = 0, grandCount = 0;
        groupData.forEach(gd => gd.forEach(sv => sv.forEach(v => { grandSum += v; grandCount++; })));
        const grandMean = grandSum / grandCount;

        // Group means (across all subjects and times)
        const groupMeans = groupData.map(gd => {
            let s = 0, c = 0;
            gd.forEach(sv => sv.forEach(v => { s += v; c++; }));
            return s / c;
        });

        // Time means (across all subjects and groups)
        const timeMeans = [];
        for (let ti = 0; ti < b; ti++) {
            let s = 0, c = 0;
            groupData.forEach(gd => gd.forEach(sv => { s += sv[ti]; c++; }));
            timeMeans.push(s / c);
        }

        // Cell means (group x time)
        const cellMeans = [];
        for (let gi = 0; gi < a; gi++) {
            cellMeans[gi] = [];
            for (let ti = 0; ti < b; ti++) {
                let s = 0, c = 0;
                groupData[gi].forEach(sv => { s += sv[ti]; c++; });
                cellMeans[gi][ti] = s / c;
            }
        }

        // Subject means within each group
        const subjectMeans = [];
        for (let gi = 0; gi < a; gi++) {
            subjectMeans[gi] = groupData[gi].map(sv => {
                return sv.reduce((s, v) => s + v, 0) / sv.length;
            });
        }

        // SS_Group (between-subjects)
        let ssGroup = 0;
        for (let gi = 0; gi < a; gi++) {
            ssGroup += nPerGroup[gi] * b * (groupMeans[gi] - grandMean) ** 2;
        }

        // SS_Subjects(Group) — subjects nested within groups
        let ssSubjects = 0;
        for (let gi = 0; gi < a; gi++) {
            for (let si = 0; si < nPerGroup[gi]; si++) {
                ssSubjects += b * (subjectMeans[gi][si] - groupMeans[gi]) ** 2;
            }
        }

        // SS_Time (within-subjects)
        let ssTime = 0;
        for (let ti = 0; ti < b; ti++) {
            ssTime += N * (timeMeans[ti] - grandMean) ** 2;
        }

        // SS_Interaction (Group x Time)
        let ssInteraction = 0;
        for (let gi = 0; gi < a; gi++) {
            for (let ti = 0; ti < b; ti++) {
                ssInteraction += nPerGroup[gi] * (cellMeans[gi][ti] - groupMeans[gi] - timeMeans[ti] + grandMean) ** 2;
            }
        }

        // SS_Error (residual within-subjects)
        let ssError = 0;
        for (let gi = 0; gi < a; gi++) {
            for (let si = 0; si < nPerGroup[gi]; si++) {
                for (let ti = 0; ti < b; ti++) {
                    const residual = groupData[gi][si][ti] - cellMeans[gi][ti] - subjectMeans[gi][si] + groupMeans[gi];
                    ssError += residual ** 2;
                }
            }
        }

        // Degrees of freedom
        const dfGroup = a - 1;
        const dfSubjects = N - a;
        const dfTime = b - 1;
        const dfInteraction = (a - 1) * (b - 1);
        const dfError = (N - a) * (b - 1);

        // Mean squares
        const msGroup = ssGroup / dfGroup;
        const msSubjects = ssSubjects / dfSubjects;
        const msTime = ssTime / dfTime;
        const msInteraction = ssInteraction / dfInteraction;
        const msError = ssError / dfError;

        // F ratios
        const fGroup = msGroup / msSubjects;
        const fTime = msTime / msError;
        const fInteraction = msInteraction / msError;

        // p-values
        const pGroup = 1 - jStat.centralF.cdf(fGroup, dfGroup, dfSubjects);
        const pTime = 1 - jStat.centralF.cdf(fTime, dfTime, dfError);
        const pInteraction = 1 - jStat.centralF.cdf(fInteraction, dfInteraction, dfError);

        return {
            group: { F: fGroup, p: pGroup, df1: dfGroup, df2: dfSubjects },
            time: { F: fTime, p: pTime, df1: dfTime, df2: dfError },
            interaction: { F: fInteraction, p: pInteraction, df1: dfInteraction, df2: dfError }
        };
    }

    // --- Correlation / regression helpers ---

    static pearsonCorrelation(x, y) {
        const n = Math.min(x.length, y.length);
        if (n < 3) return { r: NaN, p: NaN, t: NaN, df: NaN, n };
        const mx = this.mean(x.slice(0, n));
        const my = this.mean(y.slice(0, n));
        let ssXX = 0, ssYY = 0, ssXY = 0;
        for (let i = 0; i < n; i++) {
            const dx = x[i] - mx;
            const dy = y[i] - my;
            ssXX += dx * dx;
            ssYY += dy * dy;
            ssXY += dx * dy;
        }
        const r = ssXX > 0 && ssYY > 0 ? ssXY / Math.sqrt(ssXX * ssYY) : 0;
        const df = n - 2;
        const t = r * Math.sqrt(df / (1 - r * r + 1e-15));
        const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
        return { r, p, t, df, n };
    }

    static spearmanCorrelation(x, y) {
        const n = Math.min(x.length, y.length);
        if (n < 3) return { rho: NaN, p: NaN, n };
        const rank = (arr) => {
            const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
            const ranks = new Array(arr.length);
            let i = 0;
            while (i < sorted.length) {
                let j = i;
                while (j < sorted.length && sorted[j].v === sorted[i].v) j++;
                const avgRank = (i + j - 1) / 2 + 1;
                for (let k = i; k < j; k++) ranks[sorted[k].i] = avgRank;
                i = j;
            }
            return ranks;
        };
        const rx = rank(x.slice(0, n));
        const ry = rank(y.slice(0, n));
        const result = this.pearsonCorrelation(rx, ry);
        return { rho: result.r, p: result.p, n };
    }

    static linearRegression(x, y) {
        const n = Math.min(x.length, y.length);
        if (n < 3) return null;
        const mx = this.mean(x.slice(0, n));
        const my = this.mean(y.slice(0, n));
        let ssXX = 0, ssXY = 0;
        for (let i = 0; i < n; i++) {
            const dx = x[i] - mx;
            ssXX += dx * dx;
            ssXY += dx * (y[i] - my);
        }
        if (ssXX === 0) return null;
        const slope = ssXY / ssXX;
        const intercept = my - slope * mx;
        // Residuals
        let ssRes = 0, ssTot = 0;
        for (let i = 0; i < n; i++) {
            const pred = slope * x[i] + intercept;
            ssRes += (y[i] - pred) ** 2;
            ssTot += (y[i] - my) ** 2;
        }
        const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
        const df = n - 2;
        const residualSE = Math.sqrt(ssRes / df);
        const slopeStdErr = residualSE / Math.sqrt(ssXX);
        const interceptStdErr = residualSE * Math.sqrt(1 / n + mx * mx / ssXX);
        return { slope, intercept, rSquared, slopeStdErr, interceptStdErr, residualSE, df, n, meanX: mx, ssXX };
    }

    static growthPostHoc(growthData, options = {}) {
        const { timepoints, groups, subjects, groupMap } = growthData;
        const correction = options.correction || 'holm';
        const compareMode = options.compareMode || 'all';  // 'all' or 'control'
        const controlGroup = options.controlGroup || groups[0];
        const nGroups = groups.length;

        // Per-timepoint ANOVA results (stored for display)
        const anovaPerTimepoint = [];

        // Build raw p-values for all relevant comparisons
        const raw = [];
        timepoints.forEach((t, ti) => {
            // Gather group values at this timepoint
            const groupVals = groups.map(g =>
                (groupMap[g] || []).map(sid => subjects[sid]?.[ti]).filter(v => v !== null && !isNaN(v))
            );

            // For >2 groups, first run one-way ANOVA as gatekeeper
            if (nGroups > 2) {
                const validGroups = groupVals.filter(v => v.length >= 2);
                if (validGroups.length < 2) return;
                const anova = this.oneWayAnova(validGroups);
                anovaPerTimepoint.push({ timepoint: t, F: anova.F, p: anova.p, significant: anova.p < 0.05 });
                // Skip pairwise if ANOVA not significant at this timepoint
                if (anova.p >= 0.05) return;
            }

            const pairs = [];
            if (compareMode === 'control') {
                groups.forEach(g => {
                    if (g === controlGroup) return;
                    pairs.push([controlGroup, g]);
                });
            } else {
                for (let g1 = 0; g1 < nGroups; g1++) {
                    for (let g2 = g1 + 1; g2 < nGroups; g2++) {
                        pairs.push([groups[g1], groups[g2]]);
                    }
                }
            }

            pairs.forEach(([gn1, gn2]) => {
                const vals1 = (groupMap[gn1] || []).map(sid => subjects[sid]?.[ti]).filter(v => v !== null && !isNaN(v));
                const vals2 = (groupMap[gn2] || []).map(sid => subjects[sid]?.[ti]).filter(v => v !== null && !isNaN(v));
                if (vals1.length < 2 || vals2.length < 2) return;

                const result = this.tTest(vals1, vals2, false);
                raw.push({ timepoint: t, group1: gn1, group2: gn2, p: result.p });
            });
        });

        // Store ANOVA results on the return for display
        this._lastGrowthAnovaPerTimepoint = anovaPerTimepoint;

        // Apply correction
        const m = raw.length;
        const results = raw.map((r, i) => ({ ...r, correctedP: r.p }));

        if (correction === 'bonferroni') {
            results.forEach(r => { r.correctedP = Math.min(r.p * m, 1); });
        } else if (correction === 'holm') {
            // Holm-Bonferroni: sort by p, multiply by (m - rank)
            const sorted = results.map((r, i) => ({ r, i, p: r.p })).sort((a, b) => a.p - b.p);
            sorted.forEach((item, rank) => {
                item.r.correctedP = Math.min(item.r.p * (m - rank), 1);
            });
            // Enforce monotonicity
            let maxP = 0;
            sorted.forEach(item => {
                maxP = Math.max(maxP, item.r.correctedP);
                item.r.correctedP = maxP;
            });
        } else if (correction === 'sidak') {
            results.forEach(r => { r.correctedP = Math.min(1 - Math.pow(1 - r.p, m), 1); });
        }
        // correction === 'none': correctedP stays = p

        results.forEach(r => {
            r.significant = r.correctedP < 0.05;
            r.sigLabel = this.getSignificanceLevel(r.correctedP);
        });

        return results;
    }
}
