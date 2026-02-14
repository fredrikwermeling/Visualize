// volcano.js - Volcano plot renderer

class VolcanoRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.settings = {
            title: 'Volcano Plot',
            xLabel: 'Log₂ Fold Change',
            yLabel: '-Log₁₀ P-value',
            width: 450,
            height: 400,
            // Thresholds
            pValueThreshold: 0.05,
            fcThreshold: 1.0, // log2 fold change threshold
            // Colors
            upColor: '#E63946',
            downColor: '#457B9D',
            nsColor: '#BBBBBB',
            // Point settings
            pointSize: 4,
            pointOpacity: 0.7,
            // Fonts (matching other modes)
            titleFont: { family: 'Arial', size: 18, bold: true, italic: false },
            xLabelFont: { family: 'Arial', size: 15, bold: false, italic: false },
            yLabelFont: { family: 'Arial', size: 15, bold: false, italic: false },
            xTickFont: { family: 'Arial', size: 12, bold: false, italic: false },
            yTickFont: { family: 'Arial', size: 12, bold: false, italic: false },
            // Visibility & offsets (matching pattern from graph.js / growth.js)
            showTitle: true,
            showXLabel: true,
            showYLabel: true,
            titleOffset: { x: 0, y: 0 },
            xLabelOffset: { x: 0, y: 0 },
            yLabelOffset: { x: 0, y: 0 },
            // Labels
            showTopLabels: 10, // number of top significant genes to label
            labelFont: { family: 'Arial', size: 10, bold: false, italic: false }
        };
        this._titleOffset = { x: 0, y: 0 };
    }

    render(volcanoData, settings) {
        if (settings) Object.assign(this.settings, settings);
        this.container.innerHTML = '';

        if (!volcanoData || !volcanoData.points || volcanoData.points.length === 0) {
            this.container.innerHTML = '<div class="empty-state"><h3>Enter volcano plot data</h3><p>Columns: Gene, Log2FC, P-value</p></div>';
            return;
        }

        const s = this.settings;
        const margin = { top: 50, right: 30, bottom: 65, left: 65 };
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

        const points = volcanoData.points;

        // Calculate -log10 p-values
        const plotData = points.map(p => ({
            name: p.name,
            fc: p.fc,
            pval: p.pval,
            logFC: p.fc, // already log2 FC
            negLogP: p.pval > 0 ? -Math.log10(p.pval) : 0
        }));

        // Scales
        const xExtent = d3.extent(plotData, d => d.logFC);
        const xPad = Math.max(Math.abs(xExtent[0]), Math.abs(xExtent[1])) * 1.1;
        const xScale = d3.scaleLinear()
            .domain([-xPad, xPad])
            .range([0, innerW])
            .nice();

        const yMax = d3.max(plotData, d => d.negLogP) * 1.1;
        const yScale = d3.scaleLinear()
            .domain([0, yMax])
            .range([innerH, 0])
            .nice();

        // Axes
        const xAxisG = g.append('g')
            .attr('transform', `translate(0,${innerH})`)
            .call(d3.axisBottom(xScale));
        this._styleAxisTicks(xAxisG, s.xTickFont);

        const yAxisG = g.append('g')
            .call(d3.axisLeft(yScale));
        this._styleAxisTicks(yAxisG, s.yTickFont);

        // Threshold lines
        const pThreshY = -Math.log10(s.pValueThreshold);
        // Horizontal p-value threshold
        g.append('line')
            .attr('x1', 0).attr('x2', innerW)
            .attr('y1', yScale(pThreshY)).attr('y2', yScale(pThreshY))
            .attr('stroke', '#999').attr('stroke-dasharray', '4,3')
            .attr('stroke-width', 1);

        // Vertical FC thresholds
        if (s.fcThreshold > 0) {
            g.append('line')
                .attr('x1', xScale(-s.fcThreshold)).attr('x2', xScale(-s.fcThreshold))
                .attr('y1', 0).attr('y2', innerH)
                .attr('stroke', '#999').attr('stroke-dasharray', '4,3')
                .attr('stroke-width', 1);
            g.append('line')
                .attr('x1', xScale(s.fcThreshold)).attr('x2', xScale(s.fcThreshold))
                .attr('y1', 0).attr('y2', innerH)
                .attr('stroke', '#999').attr('stroke-dasharray', '4,3')
                .attr('stroke-width', 1);
        }

        // Classify points
        const classify = (d) => {
            if (d.negLogP >= pThreshY && d.logFC >= s.fcThreshold) return 'up';
            if (d.negLogP >= pThreshY && d.logFC <= -s.fcThreshold) return 'down';
            return 'ns';
        };

        const colorMap = { up: s.upColor, down: s.downColor, ns: s.nsColor };

        // Draw points
        g.selectAll('circle.volcano-point')
            .data(plotData)
            .enter()
            .append('circle')
            .attr('class', 'volcano-point')
            .attr('cx', d => xScale(d.logFC))
            .attr('cy', d => yScale(d.negLogP))
            .attr('r', s.pointSize)
            .attr('fill', d => colorMap[classify(d)])
            .attr('opacity', s.pointOpacity)
            .attr('stroke', 'none')
            .append('title')
            .text(d => `${d.name}\nLog₂FC: ${d.logFC.toFixed(2)}\nP: ${d.pval.toExponential(2)}`);

        // Label top significant genes
        if (s.showTopLabels > 0) {
            const significant = plotData
                .filter(d => classify(d) !== 'ns')
                .sort((a, b) => b.negLogP - a.negLogP)
                .slice(0, s.showTopLabels);

            const lf = s.labelFont;
            g.selectAll('text.gene-label')
                .data(significant)
                .enter()
                .append('text')
                .attr('class', 'gene-label')
                .attr('x', d => xScale(d.logFC))
                .attr('y', d => yScale(d.negLogP) - s.pointSize - 3)
                .attr('text-anchor', 'middle')
                .attr('font-size', lf.size + 'px')
                .attr('font-family', lf.family)
                .attr('font-weight', lf.bold ? 'bold' : 'normal')
                .attr('font-style', lf.italic ? 'italic' : 'normal')
                .attr('fill', '#333')
                .text(d => d.name);
        }

        // Legend (counts)
        const upCount = plotData.filter(d => classify(d) === 'up').length;
        const downCount = plotData.filter(d => classify(d) === 'down').length;
        const nsCount = plotData.filter(d => classify(d) === 'ns').length;

        const legendG = g.append('g')
            .attr('transform', `translate(${innerW - 120}, 5)`);

        const legendItems = [
            { label: `Up (${upCount})`, color: s.upColor },
            { label: `Down (${downCount})`, color: s.downColor },
            { label: `NS (${nsCount})`, color: s.nsColor }
        ];

        legendItems.forEach((item, i) => {
            const ly = i * 16;
            legendG.append('circle')
                .attr('cx', 0).attr('cy', ly)
                .attr('r', 4).attr('fill', item.color);
            legendG.append('text')
                .attr('x', 10).attr('y', ly + 4)
                .attr('font-size', '11px')
                .attr('font-family', 'Arial')
                .attr('fill', '#333')
                .text(item.label);
        });

        // Title
        this._drawTitle(svg, width, margin);

        // X label
        if (s.showXLabel) {
            const xlf = s.xLabelFont;
            const xOff = s.xLabelOffset;
            svg.append('text')
                .attr('x', margin.left + innerW / 2 + xOff.x)
                .attr('y', height - 10 + xOff.y)
                .attr('text-anchor', 'middle')
                .attr('font-size', xlf.size + 'px')
                .attr('font-family', xlf.family)
                .attr('font-weight', xlf.bold ? 'bold' : 'normal')
                .attr('font-style', xlf.italic ? 'italic' : 'normal')
                .attr('fill', '#333')
                .text(s.xLabel);
        }

        // Y label
        if (s.showYLabel) {
            const ylf = s.yLabelFont;
            const yOff = s.yLabelOffset;
            svg.append('text')
                .attr('transform', `translate(${15 + yOff.x},${margin.top + innerH / 2 + yOff.y}) rotate(-90)`)
                .attr('text-anchor', 'middle')
                .attr('font-size', ylf.size + 'px')
                .attr('font-family', ylf.family)
                .attr('font-weight', ylf.bold ? 'bold' : 'normal')
                .attr('font-style', ylf.italic ? 'italic' : 'normal')
                .attr('fill', '#333')
                .text(s.yLabel);
        }
    }

    _drawTitle(svg, width, margin) {
        const s = this.settings;
        if (!s.showTitle) return;
        const tf = s.titleFont;
        const ox = s.titleOffset.x;
        const oy = s.titleOffset.y;

        const titleEl = svg.append('text')
            .attr('x', width / 2 + ox)
            .attr('y', 22 + oy)
            .attr('text-anchor', 'middle')
            .attr('font-size', tf.size + 'px')
            .attr('font-family', tf.family)
            .attr('font-weight', tf.bold ? 'bold' : 'normal')
            .attr('font-style', tf.italic ? 'italic' : 'normal')
            .attr('fill', '#333')
            .attr('cursor', 'grab')
            .text(s.title);

        // Drag
        const self = this;
        let wasDragged = false;
        titleEl.call(d3.drag()
            .filter(event => !event.ctrlKey && !event.button && event.detail < 2)
            .on('start', function() { wasDragged = false; d3.select(this).style('cursor', 'grabbing'); })
            .on('drag', function(event) {
                wasDragged = true;
                self.settings.titleOffset.x += event.dx;
                self.settings.titleOffset.y += event.dy;
                d3.select(this)
                    .attr('x', width / 2 + self.settings.titleOffset.x)
                    .attr('y', 22 + self.settings.titleOffset.y);
            })
            .on('end', function() { d3.select(this).style('cursor', 'grab'); })
        );

        // Dblclick to edit
        titleEl.on('dblclick', () => {
            this._startInlineEdit(d3.event || window.event, 'title');
        });
    }

    _startInlineEdit(event, labelType) {
        const s = this.settings;
        let textKey, fontKey;
        if (labelType === 'title') { textKey = 'title'; fontKey = 'titleFont'; }
        else if (labelType === 'xLabel') { textKey = 'xLabel'; fontKey = 'xLabelFont'; }
        else if (labelType === 'yLabel') { textKey = 'yLabel'; fontKey = 'yLabelFont'; }
        else return;

        // Remove existing popups
        document.querySelectorAll('.svg-edit-popup').forEach(p => p.remove());

        const popup = document.createElement('div');
        popup.className = 'svg-edit-popup';
        popup.style.cssText = 'position:fixed;z-index:500;background:white;border:1px solid #ccc;border-radius:6px;padding:10px;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;flex-direction:column;gap:6px;';

        const rect = this.container.getBoundingClientRect();
        popup.style.left = (rect.left + rect.width / 2 - 120) + 'px';
        popup.style.top = (rect.top + 30) + 'px';

        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = s[textKey] || '';
        inp.style.cssText = 'width:200px;padding:4px;border:1px solid #ccc;border-radius:3px;font-size:13px;';
        inp.addEventListener('input', () => { s[textKey] = inp.value; if (window.app) window.app.updateGraph(); });
        popup.appendChild(inp);

        const { toolbar } = this._createFontToolbar(s[fontKey]);
        popup.appendChild(toolbar);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'position:absolute;top:2px;right:6px;background:none;border:none;cursor:pointer;font-size:14px;color:#999;';
        closeBtn.addEventListener('click', () => popup.remove());
        popup.appendChild(closeBtn);

        document.body.appendChild(popup);
        inp.focus();
        inp.select();
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
        sizeInput.type = 'number';
        sizeInput.min = 6; sizeInput.max = 72; sizeInput.step = 1;
        sizeInput.value = fontObj.size;
        sizeInput.style.cssText = 'width:48px;font-size:11px;padding:2px;';
        sizeInput.addEventListener('input', () => { fontObj.size = parseInt(sizeInput.value) || 12; if (window.app) window.app.updateGraph(); });
        toolbar.appendChild(sizeInput);

        const boldBtn = document.createElement('button');
        boldBtn.textContent = 'B';
        boldBtn.style.cssText = `font-weight:bold;font-size:12px;width:24px;height:24px;border:1px solid #ccc;border-radius:3px;cursor:pointer;background:${fontObj.bold ? '#ddd' : 'white'};`;
        boldBtn.addEventListener('click', () => { fontObj.bold = !fontObj.bold; boldBtn.style.background = fontObj.bold ? '#ddd' : 'white'; if (window.app) window.app.updateGraph(); });
        toolbar.appendChild(boldBtn);

        const italicBtn = document.createElement('button');
        italicBtn.textContent = 'I';
        italicBtn.style.cssText = `font-style:italic;font-size:12px;width:24px;height:24px;border:1px solid #ccc;border-radius:3px;cursor:pointer;background:${fontObj.italic ? '#ddd' : 'white'};`;
        italicBtn.addEventListener('click', () => { fontObj.italic = !fontObj.italic; italicBtn.style.background = fontObj.italic ? '#ddd' : 'white'; if (window.app) window.app.updateGraph(); });
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

    getSvgElement() {
        return this.container.querySelector('svg');
    }
}
