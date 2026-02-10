// annotations.js - Drawing/annotation tools for SVG graphs

class AnnotationManager {
    constructor() {
        this.annotations = [];
        this.activeTool = 'none'; // none, text, line, arrow, bracket
        this.selectedIndex = -1;
        this._selectedBracketIdx = -1;
        this._dragState = null;
        this._bracketDragState = null;
        this._svgRef = null;
        this._marginRef = null;
        this._boundHandlers = {};
        this._nextId = 1;
        this._undoStack = []; // stores snapshots for undo
    }

    _saveUndoState() {
        this._undoStack.push(JSON.parse(JSON.stringify(this.annotations)));
        if (this._undoStack.length > 50) this._undoStack.shift();
    }

    undo() {
        if (this._undoStack.length === 0) return;
        this.annotations = this._undoStack.pop();
        this.selectedIndex = -1;
        this._selectedBracketIdx = -1;
        if (window.app) window.app.updateGraph();
    }

    setTool(name) {
        this.activeTool = name;
        this.selectedIndex = -1;
        this._selectedBracketIdx = -1;

        const container = document.getElementById('graphContainer');
        if (name === 'none') {
            container.classList.remove('drawing-active');
        } else {
            container.classList.add('drawing-active');
        }

        // Update toolbar button states
        document.querySelectorAll('.draw-tool-btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === name);
        });
    }

    clearAll() {
        if (window.app) window.app.saveUndoState();
        this.annotations = [];
        this.selectedIndex = -1;
        this._selectedBracketIdx = -1;
        this._nextId = 1;
        if (window.app) window.app.updateGraph();
    }

    deleteSelected() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.annotations.length) {
            if (window.app) window.app.saveUndoState();
            this.annotations.splice(this.selectedIndex, 1);
            this.selectedIndex = -1;
            if (window.app) window.app.updateGraph();
        } else if (this._selectedBracketIdx >= 0 && window.app && window.app.graphRenderer) {
            const results = window.app.graphRenderer.significanceResults;
            if (this._selectedBracketIdx < results.length) {
                results.splice(this._selectedBracketIdx, 1);
                this._selectedBracketIdx = -1;
                window.app.updateGraph();
            }
        }
    }

    drawAnnotations(svg, margin) {
        this._svgRef = svg;
        this._marginRef = margin;

        // Add arrow marker defs if not present
        let defs = svg.select('defs');
        if (defs.empty()) {
            defs = svg.append('defs');
        }
        if (defs.select('#annotation-arrowhead').empty()) {
            defs.append('marker')
                .attr('id', 'annotation-arrowhead')
                .attr('viewBox', '0 0 10 10')
                .attr('refX', 9)
                .attr('refY', 5)
                .attr('markerWidth', 8)
                .attr('markerHeight', 8)
                .attr('orient', 'auto-start-reverse')
                .append('path')
                .attr('d', 'M 0 0 L 10 5 L 0 10 z')
                .attr('fill', '#333');
        }

        const layer = svg.append('g')
            .attr('class', 'annotations-layer');

        this.annotations.forEach((ann, idx) => {
            const isSelected = idx === this.selectedIndex;
            this._drawSingleAnnotation(layer, ann, idx, isSelected);
        });

        this._bindSVGEvents(svg, margin);
    }

    _drawSingleAnnotation(layer, ann, idx, isSelected) {
        const g = layer.append('g')
            .attr('class', 'annotation-item')
            .attr('data-ann-idx', idx)
            .style('cursor', this.activeTool === 'none' ? 'move' : 'default');

        switch (ann.type) {
            case 'text':
                g.append('text')
                    .attr('x', ann.x)
                    .attr('y', ann.y)
                    .style('font-size', `${ann.fontSize || 14}px`)
                    .style('font-family', ann.fontFamily || 'Arial')
                    .style('font-weight', ann.bold ? 'bold' : 'normal')
                    .style('font-style', ann.italic ? 'italic' : 'normal')
                    .style('fill', ann.color || '#333')
                    .text(ann.text || 'Text');
                break;

            case 'line':
                g.append('line')
                    .attr('x1', ann.x1).attr('y1', ann.y1)
                    .attr('x2', ann.x2).attr('y2', ann.y2)
                    .attr('stroke', ann.color || '#333')
                    .attr('stroke-width', ann.strokeWidth || 2);
                break;

            case 'arrow':
                g.append('line')
                    .attr('x1', ann.x1).attr('y1', ann.y1)
                    .attr('x2', ann.x2).attr('y2', ann.y2)
                    .attr('stroke', ann.color || '#333')
                    .attr('stroke-width', ann.strokeWidth || 2)
                    .attr('marker-end', 'url(#annotation-arrowhead)');
                break;

            case 'bracket': {
                const y = ann.y;
                const tickH = ann.tickHeight || 6;
                g.append('line')
                    .attr('x1', ann.x1).attr('y1', y + tickH)
                    .attr('x2', ann.x1).attr('y2', y)
                    .attr('stroke', ann.color || '#333')
                    .attr('stroke-width', ann.strokeWidth || 1.5);
                g.append('line')
                    .attr('x1', ann.x1).attr('y1', y)
                    .attr('x2', ann.x2).attr('y2', y)
                    .attr('stroke', ann.color || '#333')
                    .attr('stroke-width', ann.strokeWidth || 1.5);
                g.append('line')
                    .attr('x1', ann.x2).attr('y1', y + tickH)
                    .attr('x2', ann.x2).attr('y2', y)
                    .attr('stroke', ann.color || '#333')
                    .attr('stroke-width', ann.strokeWidth || 1.5);
                if (ann.text) {
                    g.append('text')
                        .attr('x', (ann.x1 + ann.x2) / 2)
                        .attr('y', y - 4)
                        .attr('text-anchor', 'middle')
                        .style('font-size', `${ann.fontSize || 12}px`)
                        .style('font-family', 'Arial')
                        .style('fill', ann.color || '#333')
                        .text(ann.text);
                }
                break;
            }
        }

        // Selection highlight
        if (isSelected) {
            const bbox = g.node().getBBox();
            g.insert('rect', ':first-child')
                .attr('x', bbox.x - 3).attr('y', bbox.y - 3)
                .attr('width', bbox.width + 6).attr('height', bbox.height + 6)
                .attr('fill', 'none')
                .attr('stroke', '#5E8C31')
                .attr('stroke-width', 1.5)
                .attr('stroke-dasharray', '4,3');

            // Endpoint grab handles for lines and arrows
            if (ann.type === 'line' || ann.type === 'arrow') {
                const handleR = 5;
                g.append('circle')
                    .attr('class', 'endpoint-handle')
                    .attr('cx', ann.x1).attr('cy', ann.y1)
                    .attr('r', handleR)
                    .attr('fill', '#5E8C31').attr('fill-opacity', 0.5)
                    .attr('stroke', '#5E8C31').attr('stroke-width', 1.5)
                    .style('cursor', 'crosshair');
                g.append('circle')
                    .attr('class', 'endpoint-handle')
                    .attr('cx', ann.x2).attr('cy', ann.y2)
                    .attr('r', handleR)
                    .attr('fill', '#5E8C31').attr('fill-opacity', 0.5)
                    .attr('stroke', '#5E8C31').attr('stroke-width', 1.5)
                    .style('cursor', 'crosshair');
            }
        }
    }

    _bindSVGEvents(svg, margin) {
        const svgNode = svg.node();

        // Clean up old handlers
        if (this._boundHandlers.mousedown) {
            svgNode.removeEventListener('mousedown', this._boundHandlers.mousedown);
            document.removeEventListener('mousemove', this._boundHandlers.mousemove);
            document.removeEventListener('mouseup', this._boundHandlers.mouseup);
        }

        const getPos = (e) => {
            const rect = svgNode.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        };

        const mousedown = (e) => {
            const pos = getPos(e);

            // Check if clicking on an existing annotation (select mode)
            if (this.activeTool === 'none') {
                const target = e.target.closest('.annotation-item');
                if (target) {
                    const idx = parseInt(target.getAttribute('data-ann-idx'));
                    const ann = this.annotations[idx];
                    this.selectedIndex = idx;
                    this._selectedBracketIdx = -1;

                    // Check if clicking near an endpoint of a line/arrow
                    if (ann.type === 'line' || ann.type === 'arrow') {
                        const d1 = Math.hypot(pos.x - ann.x1, pos.y - ann.y1);
                        const d2 = Math.hypot(pos.x - ann.x2, pos.y - ann.y2);
                        const threshold = 8;
                        if (d1 <= threshold && d1 <= d2) {
                            this._dragState = { type: 'endpoint', annIdx: idx, endpoint: 1, startX: pos.x, startY: pos.y };
                            if (window.app) window.app.updateGraph();
                            e.preventDefault();
                            return;
                        }
                        if (d2 <= threshold) {
                            this._dragState = { type: 'endpoint', annIdx: idx, endpoint: 2, startX: pos.x, startY: pos.y };
                            if (window.app) window.app.updateGraph();
                            e.preventDefault();
                            return;
                        }
                    }

                    this._dragState = {
                        type: 'move',
                        annIdx: idx,
                        startX: pos.x,
                        startY: pos.y,
                        origAnn: JSON.parse(JSON.stringify(ann))
                    };
                    if (window.app) window.app.updateGraph();
                    e.preventDefault();
                    return;
                }

                // Check if clicking on a significance bracket
                const bracketTarget = e.target.closest('.bracket-group');
                if (bracketTarget) {
                    const bracketIdx = parseInt(bracketTarget.getAttribute('data-bracket-idx'));
                    if (!isNaN(bracketIdx) && window.app && window.app.graphRenderer) {
                        this.selectedIndex = -1;
                        this._selectedBracketIdx = bracketIdx;
                        this._bracketDragState = {
                            bracketIdx: bracketIdx,
                            startX: pos.x,
                            startY: pos.y,
                            origOffset: window.app.graphRenderer.significanceResults[bracketIdx].yOffset || 0
                        };
                        if (window.app) window.app.updateGraph();
                        e.preventDefault();
                        return;
                    }
                }

                if (!target) {
                    // Clicked empty space — deselect
                    if (this.selectedIndex >= 0 || this._selectedBracketIdx >= 0) {
                        this.selectedIndex = -1;
                        this._selectedBracketIdx = -1;
                        if (window.app) window.app.updateGraph();
                    }
                    return;
                }
            }

            // Text tool: click to place — but let clicks on graph labels pass through
            if (this.activeTool === 'text') {
                const clickedEl = e.target;
                const isGraphLabel = clickedEl.closest('.graph-title, .axis-label, .legend-item, .x-axis .tick, .y-axis .tick');
                if (isGraphLabel) {
                    // Let the label's own click handler fire
                    return;
                }
                this._showTextInput(pos.x, pos.y, svgNode);
                e.preventDefault();
                return;
            }

            // Line/Arrow/Bracket tool: start drag
            if (this.activeTool === 'line' || this.activeTool === 'arrow' || this.activeTool === 'bracket') {
                this._dragState = {
                    type: 'draw',
                    tool: this.activeTool,
                    startX: pos.x,
                    startY: pos.y
                };
                e.preventDefault();
                return;
            }
        };

        const mousemove = (e) => {
            // Handle bracket dragging
            if (this._bracketDragState) {
                const pos = getPos(e);
                const renderer = window.app && window.app.graphRenderer;
                if (renderer && renderer.significanceResults[this._bracketDragState.bracketIdx]) {
                    const isH = renderer.settings.orientation === 'horizontal';
                    // For vertical charts: dragging up = negative yOffset (brackets above bars)
                    // For horizontal charts: dragging right = positive yOffset (brackets right of bars)
                    const delta = isH
                        ? (pos.x - this._bracketDragState.startX)
                        : (pos.y - this._bracketDragState.startY);
                    renderer.significanceResults[this._bracketDragState.bracketIdx].yOffset = this._bracketDragState.origOffset + delta;
                    if (window.app) window.app.updateGraph();
                }
                return;
            }

            if (!this._dragState) return;
            const pos = getPos(e);

            if (this._dragState.type === 'endpoint') {
                const ann = this.annotations[this._dragState.annIdx];
                if (this._dragState.endpoint === 1) {
                    ann.x1 = pos.x;
                    ann.y1 = pos.y;
                } else {
                    ann.x2 = pos.x;
                    ann.y2 = pos.y;
                }
                if (window.app) window.app.updateGraph();
            } else if (this._dragState.type === 'move') {
                const dx = pos.x - this._dragState.startX;
                const dy = pos.y - this._dragState.startY;
                const ann = this.annotations[this._dragState.annIdx];
                const orig = this._dragState.origAnn;

                if (ann.type === 'text') {
                    ann.x = orig.x + dx;
                    ann.y = orig.y + dy;
                } else if (ann.type === 'line' || ann.type === 'arrow') {
                    ann.x1 = orig.x1 + dx;
                    ann.y1 = orig.y1 + dy;
                    ann.x2 = orig.x2 + dx;
                    ann.y2 = orig.y2 + dy;
                } else if (ann.type === 'bracket') {
                    ann.x1 = orig.x1 + dx;
                    ann.x2 = orig.x2 + dx;
                    ann.y = orig.y + dy;
                }
                if (window.app) window.app.updateGraph();
            }
        };

        const mouseup = (e) => {
            // Clear bracket drag state
            if (this._bracketDragState) {
                this._bracketDragState = null;
                return;
            }
            if (!this._dragState) return;
            const pos = getPos(e);

            if (this._dragState.type === 'draw') {
                const dx = pos.x - this._dragState.startX;
                const dy = pos.y - this._dragState.startY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 5) {
                    if (window.app) window.app.saveUndoState();
                    const tool = this._dragState.tool;
                    if (tool === 'line') {
                        this.annotations.push({
                            type: 'line',
                            x1: this._dragState.startX,
                            y1: this._dragState.startY,
                            x2: pos.x,
                            y2: pos.y,
                            strokeWidth: 2,
                            color: '#333',
                            id: this._nextId++
                        });
                    } else if (tool === 'arrow') {
                        this.annotations.push({
                            type: 'arrow',
                            x1: this._dragState.startX,
                            y1: this._dragState.startY,
                            x2: pos.x,
                            y2: pos.y,
                            strokeWidth: 2,
                            color: '#333',
                            id: this._nextId++
                        });
                    } else if (tool === 'bracket') {
                        const minX = Math.min(this._dragState.startX, pos.x);
                        const maxX = Math.max(this._dragState.startX, pos.x);
                        const bracketY = Math.min(this._dragState.startY, pos.y);
                        this.annotations.push({
                            type: 'bracket',
                            x1: minX,
                            x2: maxX,
                            y: bracketY,
                            text: '',
                            tickHeight: 6,
                            strokeWidth: 1.5,
                            color: '#333',
                            id: this._nextId++
                        });
                    }
                    if (window.app) window.app.updateGraph();
                }
            }

            this._dragState = null;
        };

        svgNode.addEventListener('mousedown', mousedown);
        document.addEventListener('mousemove', mousemove);
        document.addEventListener('mouseup', mouseup);

        this._boundHandlers = { mousedown, mousemove, mouseup };

        // Keyboard: Delete selected + arrow key movement
        if (!this._keyHandler) {
            this._keyHandler = (e) => {
                // Don't handle if user is typing in an input
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

                if ((e.key === 'Delete' || e.key === 'Backspace') && (this.selectedIndex >= 0 || this._selectedBracketIdx >= 0)) {
                    this.deleteSelected();
                    e.preventDefault();
                    return;
                }

                // Arrow key movement for selected significance bracket
                if (this._selectedBracketIdx >= 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    const renderer = window.app?.graphRenderer;
                    if (renderer && renderer.significanceResults[this._selectedBracketIdx]) {
                        e.preventDefault();
                        const step = e.shiftKey ? 10 : 2;
                        const isH = renderer.settings.orientation === 'horizontal';
                        let delta = 0;
                        if (isH) {
                            if (e.key === 'ArrowRight') delta = step;
                            else if (e.key === 'ArrowLeft') delta = -step;
                        } else {
                            if (e.key === 'ArrowUp') delta = -step;
                            else if (e.key === 'ArrowDown') delta = step;
                        }
                        if (delta !== 0) {
                            renderer.significanceResults[this._selectedBracketIdx].yOffset =
                                (renderer.significanceResults[this._selectedBracketIdx].yOffset || 0) + delta;
                            if (window.app) window.app.updateGraph();
                        }
                    }
                    return;
                }

                // Arrow key movement for selected annotation
                if (this.selectedIndex >= 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    const step = e.shiftKey ? 10 : 2;
                    const ann = this.annotations[this.selectedIndex];
                    let dx = 0, dy = 0;
                    if (e.key === 'ArrowUp') dy = -step;
                    else if (e.key === 'ArrowDown') dy = step;
                    else if (e.key === 'ArrowLeft') dx = -step;
                    else if (e.key === 'ArrowRight') dx = step;

                    if (ann.type === 'text') {
                        ann.x += dx; ann.y += dy;
                    } else if (ann.type === 'line' || ann.type === 'arrow') {
                        ann.x1 += dx; ann.y1 += dy;
                        ann.x2 += dx; ann.y2 += dy;
                    } else if (ann.type === 'bracket') {
                        ann.x1 += dx; ann.x2 += dx; ann.y += dy;
                    }
                    if (window.app) window.app.updateGraph();
                    e.preventDefault();
                }
            };
            document.addEventListener('keydown', this._keyHandler);
        }

        // Double-click to edit annotations
        svgNode.addEventListener('dblclick', (e) => {
            if (this.activeTool !== 'none') return;
            const target = e.target.closest('.annotation-item');
            if (!target) return;
            const idx = parseInt(target.getAttribute('data-ann-idx'));
            const ann = this.annotations[idx];
            if (ann.type === 'text' || ann.type === 'bracket') {
                this._editAnnotation(idx, e, svgNode);
            }
        });
    }

    _showTextInput(x, y, svgNode) {
        const existing = document.querySelector('.annotation-text-popup');
        if (existing) existing.remove();

        const svgRect = svgNode.getBoundingClientRect();

        const popup = document.createElement('div');
        popup.className = 'svg-edit-popup annotation-text-popup';
        popup.style.left = `${svgRect.left + x + window.scrollX}px`;
        popup.style.top = `${svgRect.top + y + window.scrollY - 10}px`;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'svg-inline-edit';
        input.placeholder = 'Type text...';
        input.style.width = '150px';
        input.style.fontSize = '14px';
        popup.appendChild(input);

        document.body.appendChild(popup);
        input.focus();

        const commit = () => {
            if (!document.body.contains(popup)) return;
            const text = input.value.trim();
            if (text) {
                if (window.app) window.app.saveUndoState();
                this.annotations.push({
                    type: 'text',
                    text: text,
                    x: x,
                    y: y,
                    fontSize: 14,
                    fontFamily: 'Arial',
                    bold: false,
                    italic: false,
                    color: '#333',
                    id: this._nextId++
                });
                if (window.app) window.app.updateGraph();
            }
            popup.remove();
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); popup.remove(); }
        });

        popup.addEventListener('focusout', () => {
            setTimeout(() => {
                if (document.body.contains(popup) && !popup.contains(document.activeElement)) {
                    commit();
                }
            }, 100);
        });
    }

    _editAnnotation(idx, event, svgNode) {
        const ann = this.annotations[idx];
        const existing = document.querySelector('.annotation-text-popup');
        if (existing) existing.remove();

        const svgRect = svgNode.getBoundingClientRect();
        let popX, popY;

        if (ann.type === 'text') {
            popX = svgRect.left + ann.x + window.scrollX;
            popY = svgRect.top + ann.y + window.scrollY - 10;
        } else if (ann.type === 'bracket') {
            popX = svgRect.left + (ann.x1 + ann.x2) / 2 + window.scrollX;
            popY = svgRect.top + ann.y + window.scrollY - 30;
        }

        const popup = document.createElement('div');
        popup.className = 'svg-edit-popup annotation-text-popup';
        popup.style.left = `${popX}px`;
        popup.style.top = `${popY}px`;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'svg-inline-edit';
        input.value = ann.text || '';
        input.style.width = '150px';
        input.style.fontSize = '14px';
        popup.appendChild(input);

        // For text: also add font size control
        if (ann.type === 'text') {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '4px';
            row.style.marginTop = '4px';

            const sizeInput = document.createElement('input');
            sizeInput.type = 'number';
            sizeInput.value = ann.fontSize || 14;
            sizeInput.min = 8;
            sizeInput.max = 48;
            sizeInput.style.width = '50px';
            sizeInput.className = 'svg-edit-font-size';

            const boldBtn = document.createElement('button');
            boldBtn.className = 'svg-edit-btn' + (ann.bold ? ' active' : '');
            boldBtn.innerHTML = '<b>B</b>';
            boldBtn.addEventListener('click', (e) => {
                e.preventDefault();
                boldBtn.classList.toggle('active');
            });

            const italicBtn = document.createElement('button');
            italicBtn.className = 'svg-edit-btn' + (ann.italic ? ' active' : '');
            italicBtn.innerHTML = '<i>I</i>';
            italicBtn.addEventListener('click', (e) => {
                e.preventDefault();
                italicBtn.classList.toggle('active');
            });

            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = ann.color || '#333333';
            colorInput.style.width = '30px';
            colorInput.style.height = '24px';
            colorInput.style.border = 'none';
            colorInput.style.cursor = 'pointer';

            row.appendChild(sizeInput);
            row.appendChild(boldBtn);
            row.appendChild(italicBtn);
            row.appendChild(colorInput);
            popup.appendChild(row);

            const commitEdit = () => {
                if (!document.body.contains(popup)) return;
                ann.text = input.value;
                ann.fontSize = parseInt(sizeInput.value) || 14;
                ann.bold = boldBtn.classList.contains('active');
                ann.italic = italicBtn.classList.contains('active');
                ann.color = colorInput.value;
                popup.remove();
                if (window.app) window.app.updateGraph();
            };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                else if (e.key === 'Escape') { e.preventDefault(); popup.remove(); }
            });

            popup.addEventListener('focusout', () => {
                setTimeout(() => {
                    if (document.body.contains(popup) && !popup.contains(document.activeElement)) {
                        commitEdit();
                    }
                }, 100);
            });
        } else {
            // Bracket text edit
            const commit = () => {
                if (!document.body.contains(popup)) return;
                ann.text = input.value;
                popup.remove();
                if (window.app) window.app.updateGraph();
            };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                else if (e.key === 'Escape') { e.preventDefault(); popup.remove(); }
            });

            popup.addEventListener('focusout', () => {
                setTimeout(() => {
                    if (document.body.contains(popup) && !popup.contains(document.activeElement)) {
                        commit();
                    }
                }, 100);
            });
        }

        document.body.appendChild(popup);
        input.focus();
        input.select();
    }
}
