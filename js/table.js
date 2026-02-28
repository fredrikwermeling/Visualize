// table.js - Data table management

class DataTable {
    constructor(tableId, bodyId, headerRowId) {
        this.table = document.getElementById(tableId);
        this.tbody = document.getElementById(bodyId);
        this.headerRow = document.getElementById(headerRowId);
        this.numRows = 20; // Initial number of rows
        this.initialize();
    }

    initialize() {
        // Generate initial rows
        this.generateRows(this.numRows);

        // Add event listeners for live data changes
        this.table.addEventListener('input', () => {
            if (window.app) {
                window.app.updateGraph();
            }
        });

        // Allow header editing
        this.setupHeaderEditing();

        // Keyboard navigation
        this.setupKeyboardNavigation();

        // Excel paste support
        this.setupPasteHandler();
    }

    generateRows(count) {
        this.tbody.innerHTML = '';
        // Count only data columns (exclude the delete-col-header if present)
        const numCols = this._dataColCount();

        for (let i = 0; i < count; i++) {
            const row = this._createRow(numCols);
            this.tbody.appendChild(row);
        }

        this._addDeleteColumnHeaders();
        this._updateDeleteButtonVisibility();
    }

    _createRow(numCols) {
        const row = document.createElement('tr');

        // Toggle cell
        const toggleCell = document.createElement('td');
        toggleCell.className = 'row-toggle-cell';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.style.visibility = 'hidden';
        cb.title = 'Toggle row on/off';
        cb.addEventListener('change', () => {
            row.classList.toggle('row-disabled', !cb.checked);
            if (window.app) window.app.updateGraph();
        });
        toggleCell.appendChild(cb);
        row.appendChild(toggleCell);

        // ID cells (Group, Sample) — no validation
        for (let j = 0; j < 2; j++) {
            const idCell = document.createElement('td');
            idCell.className = 'id-cell';
            idCell.contentEditable = true;
            idCell.textContent = '';
            row.appendChild(idCell);
        }
        // Data cells
        for (let j = 0; j < numCols; j++) {
            const cell = document.createElement('td');
            cell.contentEditable = true;
            cell.textContent = '';
            cell.addEventListener('blur', (e) => {
                this.validateCell(e.target);
                clearTimeout(this._toggleVisTimer);
                this._toggleVisTimer = setTimeout(() => this._updateToggleVisibility(), 100);
            });
            row.appendChild(cell);
        }

        // Add row delete cell
        const delCell = document.createElement('td');
        delCell.className = 'row-delete-cell';
        const delBtn = document.createElement('button');
        delBtn.className = 'row-delete-btn';
        delBtn.textContent = '\u00d7';
        delBtn.title = 'Delete row';
        delBtn.addEventListener('click', () => {
            this.deleteRow(row);
        });
        delCell.appendChild(delBtn);
        row.appendChild(delCell);

        return row;
    }

    _addDeleteColumnHeaders() {
        // Ensure delete-col-header exists (for row delete column alignment)
        if (!this.headerRow.querySelector('.delete-col-header')) {
            const delTh = document.createElement('th');
            delTh.className = 'delete-col-header';
            this.headerRow.appendChild(delTh);
        }
    }

    _updateToggleVisibility() {
        const rows = this.tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const dataCells = row.querySelectorAll('td:not(.id-cell):not(.row-delete-cell):not(.row-toggle-cell)');
            let hasData = false;
            for (const cell of dataCells) {
                if (cell.textContent.trim() !== '') { hasData = true; break; }
            }
            const cb = row.querySelector('.row-toggle-cell input');
            if (cb) cb.style.visibility = hasData ? 'visible' : 'hidden';
        });
    }

    validateCell(cell) {
        const value = cell.textContent.trim();
        if (value === '') return;
        
        // Check if it's a valid number
        const num = parseFloat(value);
        if (isNaN(num)) {
            cell.style.backgroundColor = '#ffe6e6';
            setTimeout(() => {
                cell.style.backgroundColor = '';
            }, 1000);
        }
    }

    _dataColCount() {
        return this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)').length;
    }

    _updateDeleteButtonVisibility() {
        const colCount = this._dataColCount();
        const rowCount = this.tbody.querySelectorAll('tr').length;

        // Hide/show column delete buttons
        this.headerRow.querySelectorAll('.th-delete-btn').forEach(btn => {
            btn.style.display = colCount <= 2 ? 'none' : '';
        });

        // Hide/show row delete buttons
        this.tbody.querySelectorAll('.row-delete-btn').forEach(btn => {
            btn.style.display = rowCount <= 1 ? 'none' : '';
        });
    }

    deleteColumn(colIndex) {
        if (this._dataColCount() <= 2) return;

        // Remove data header (skip id-col)
        const headers = this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)');
        if (headers[colIndex]) {
            headers[colIndex].remove();
        }

        // Remove corresponding data td from each body row (skip id-cells)
        const rows = this.tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td:not(.row-delete-cell):not(.id-cell):not(.row-toggle-cell)');
            if (cells[colIndex]) {
                cells[colIndex].remove();
            }
        });

        // Re-bind delete buttons with updated indices
        this._rebindColumnDeleteButtons();
        this._updateDeleteButtonVisibility();

        if (window.app) window.app.updateGraph();
    }

    deleteRow(rowEl) {
        const rows = this.tbody.querySelectorAll('tr');
        if (rows.length <= 1) return;
        rowEl.remove();
        this.numRows--;
        this._updateDeleteButtonVisibility();
        if (window.app) window.app.updateGraph();
    }

    _rebindColumnDeleteButtons() {
        const headers = this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)');
        headers.forEach((th, idx) => {
            const btn = th.querySelector('.th-delete-btn');
            if (btn) {
                const newBtn = btn.cloneNode(true);
                btn.replaceWith(newBtn);
                newBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteColumn(idx);
                });
            }
        });
    }

    setupHeaderEditing() {
        const headers = this.headerRow.querySelectorAll('th');
        headers.forEach(header => {
            header.addEventListener('input', () => {
                if (window.app) {
                    window.app.updateGraph();
                }
            });
        });
    }

    setupKeyboardNavigation() {
        // Track selected cell range for shift+arrow and copy/paste
        this._selectedCells = new Set();
        this._anchorCell = null;

        const isHeatmapMode = () => window.app && window.app.mode === 'heatmap';

        const getRowCells = (row) => {
            if (isHeatmapMode()) {
                return row.tagName === 'TR'
                    ? Array.from(row.querySelectorAll('td:not(.row-delete-cell):not(.row-toggle-cell)'))
                    : Array.from(row.querySelectorAll('th:not(.delete-col-header):not(.row-toggle-col)'));
            }
            return row.tagName === 'TR'
                ? Array.from(row.querySelectorAll('td:not(.row-delete-cell):not(.row-toggle-cell)'))
                : Array.from(row.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)'));
        };

        const getCellCoords = (cell) => {
            const row = cell.parentElement;
            const allRows = [this.headerRow, ...this.tbody.querySelectorAll('tr')];
            const r = allRows.indexOf(row);
            const cells = getRowCells(row);
            const c = cells.indexOf(cell);
            return { r, c };
        };

        const getCellAt = (r, c) => {
            const allRows = [this.headerRow, ...this.tbody.querySelectorAll('tr')];
            if (r < 0 || r >= allRows.length) return null;
            const row = allRows[r];
            const cells = getRowCells(row);
            return cells[c] || null;
        };

        const clearSelection = () => {
            this._selectedCells.forEach(cell => cell.classList.remove('cell-selected'));
            this._selectedCells.clear();
        };

        const selectRange = (r1, c1, r2, c2) => {
            clearSelection();
            const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
            const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
            for (let r = minR; r <= maxR; r++) {
                for (let c = minC; c <= maxC; c++) {
                    const cell = getCellAt(r, c);
                    if (cell) {
                        cell.classList.add('cell-selected');
                        this._selectedCells.add(cell);
                    }
                }
            }
        };

        const selectSingle = (cell) => {
            clearSelection();
            const coords = getCellCoords(cell);
            this._anchorCell = coords;
            this._focusCell = coords;
            cell.classList.add('cell-selected');
            this._selectedCells.add(cell);
        };

        // Click to select single cell
        this.table.addEventListener('mousedown', (e) => {
            const cell = e.target.closest('td[contenteditable], th[contenteditable]');
            if (!cell) return;
            selectSingle(cell);
        });

        // Ctrl+C to copy selected cells
        this.table.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && this._selectedCells.size > 1) {
                e.preventDefault();
                const anchor = this._anchorCell;
                const focus = this._focusCell;
                if (!anchor || !focus) return;
                const minR = Math.min(anchor.r, focus.r), maxR = Math.max(anchor.r, focus.r);
                const minC = Math.min(anchor.c, focus.c), maxC = Math.max(anchor.c, focus.c);
                const lines = [];
                for (let r = minR; r <= maxR; r++) {
                    const row = [];
                    for (let c = minC; c <= maxC; c++) {
                        const cell = getCellAt(r, c);
                        row.push(cell ? cell.textContent.trim() : '');
                    }
                    lines.push(row.join('\t'));
                }
                navigator.clipboard.writeText(lines.join('\n'));
            }
        });

        // Delete/Backspace to clear selected cells
        this.table.addEventListener('keydown', (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && this._selectedCells.size > 1) {
                e.preventDefault();
                this._selectedCells.forEach(cell => { cell.textContent = ''; });
                if (window.app) window.app.updateGraph();
            }
        });

        // Ctrl+X to cut selected cells
        this.table.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'x' && this._selectedCells.size > 1) {
                e.preventDefault();
                const anchor = this._anchorCell;
                const focus = this._focusCell;
                if (!anchor || !focus) return;
                const minR = Math.min(anchor.r, focus.r), maxR = Math.max(anchor.r, focus.r);
                const minC = Math.min(anchor.c, focus.c), maxC = Math.max(anchor.c, focus.c);
                const lines = [];
                for (let r = minR; r <= maxR; r++) {
                    const row = [];
                    for (let c = minC; c <= maxC; c++) {
                        const cell = getCellAt(r, c);
                        row.push(cell ? cell.textContent.trim() : '');
                    }
                    lines.push(row.join('\t'));
                }
                navigator.clipboard.writeText(lines.join('\n'));
                this._selectedCells.forEach(cell => { cell.textContent = ''; });
                if (window.app) window.app.updateGraph();
            }
        });

        this.table.addEventListener('keydown', (e) => {
            const cell = e.target;
            if (!cell.matches('td[contenteditable], th[contenteditable]')) return;

            const allRows = [this.headerRow, ...this.tbody.querySelectorAll('tr')];
            const coords = getCellCoords(cell);
            const { r: rowIndex, c: colIndex } = coords;
            const row = cell.parentElement;
            const dataCells = getRowCells(row);
            const numCols = dataCells.length;

            const focusCell = (r, c) => {
                const target = getCellAt(r, c);
                if (target) {
                    target.focus();
                    const sel = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(target);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                return target;
            };

            if (e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                if (!this._anchorCell) this._anchorCell = coords;
                let nr = (this._focusCell || coords).r;
                let nc = (this._focusCell || coords).c;
                if (e.key === 'ArrowUp') nr = Math.max(0, nr - 1);
                else if (e.key === 'ArrowDown') nr = Math.min(allRows.length - 1, nr + 1);
                else if (e.key === 'ArrowLeft') nc = Math.max(0, nc - 1);
                else if (e.key === 'ArrowRight') nc = Math.min(numCols - 1, nc + 1);
                this._focusCell = { r: nr, c: nc };
                selectRange(this._anchorCell.r, this._anchorCell.c, nr, nc);
                const target = getCellAt(nr, nc);
                if (target) target.focus();
                return;
            }

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    if (focusCell(rowIndex - 1, colIndex)) selectSingle(getCellAt(rowIndex - 1, colIndex));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (focusCell(rowIndex + 1, colIndex)) selectSingle(getCellAt(rowIndex + 1, colIndex));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (focusCell(rowIndex + 1, colIndex)) selectSingle(getCellAt(rowIndex + 1, colIndex));
                    break;
                case 'ArrowLeft': {
                    const sel = window.getSelection();
                    if (sel.rangeCount && sel.getRangeAt(0).startOffset === 0 && sel.isCollapsed) {
                        e.preventDefault();
                        if (focusCell(rowIndex, colIndex - 1)) selectSingle(getCellAt(rowIndex, colIndex - 1));
                    }
                    break;
                }
                case 'ArrowRight': {
                    const sel = window.getSelection();
                    const textLen = cell.textContent.length;
                    if (sel.rangeCount && sel.getRangeAt(0).endOffset >= textLen && sel.isCollapsed) {
                        e.preventDefault();
                        if (focusCell(rowIndex, colIndex + 1)) selectSingle(getCellAt(rowIndex, colIndex + 1));
                    }
                    break;
                }
                case 'Tab': {
                    e.preventDefault();
                    if (e.shiftKey) {
                        if (colIndex > 0) {
                            focusCell(rowIndex, colIndex - 1);
                        } else if (rowIndex > 0) {
                            const prevCells = getRowCells(allRows[rowIndex - 1]);
                            focusCell(rowIndex - 1, prevCells.length - 1);
                        }
                    } else {
                        if (colIndex < numCols - 1) {
                            focusCell(rowIndex, colIndex + 1);
                        } else if (rowIndex < allRows.length - 1) {
                            focusCell(rowIndex + 1, 0);
                        }
                    }
                    break;
                }
            }
        });
    }

    setupPasteHandler() {
        this.table.addEventListener('paste', (e) => {
            const clipText = (e.clipboardData || window.clipboardData).getData('text');
            if (!clipText) return;

            // Parse tab/newline separated data (Excel format)
            const rows = clipText.split(/\r?\n/).filter(r => r.trim() !== '');
            if (rows.length === 0) return;

            const parsed = rows.map(r => r.split('\t').map(c => c.trim()));
            // Need at least 2 cells to treat as a table paste
            if (parsed.length === 1 && parsed[0].length <= 1) return;

            e.preventDefault();

            // If focused on a cell, overlay paste from that position
            // But first check if the pasted data looks like a full dataset with headers
            const firstRowNonEmpty = parsed[0].filter(c => c !== '');
            const firstRowNumeric = firstRowNonEmpty.filter(c => !isNaN(parseFloat(c))).length;
            const looksLikeHeaders = firstRowNonEmpty.length >= 2 && firstRowNumeric < firstRowNonEmpty.length / 2;

            const focusedCell = e.target;
            if (focusedCell && focusedCell.matches('td[contenteditable]') && !looksLikeHeaders) {
                const bodyRows = Array.from(this.tbody.querySelectorAll('tr'));
                const focusRow = focusedCell.parentElement;
                const rowIdx = bodyRows.indexOf(focusRow);
                const isIdCell = focusedCell.classList.contains('id-cell');
                const allCells = Array.from(focusRow.querySelectorAll('td:not(.row-delete-cell):not(.row-toggle-cell)'));
                const colIdx = allCells.indexOf(focusedCell);
                if (rowIdx >= 0 && colIdx >= 0) {
                    for (let r = 0; r < parsed.length; r++) {
                        const tr = bodyRows[rowIdx + r];
                        if (!tr) break;
                        const cells = tr.querySelectorAll('td:not(.row-delete-cell):not(.row-toggle-cell)');
                        for (let c = 0; c < parsed[r].length; c++) {
                            const cell = cells[colIdx + c];
                            if (cell) cell.textContent = parsed[r][c];
                        }
                    }
                    this._updateToggleVisibility();
                    if (window.app) window.app.updateGraph();
                    return;
                }
            }

            const numCols = Math.max(...parsed.map(r => r.length));

            // Detect if first row is a header (contains mostly non-numeric text)
            const firstRow = parsed[0];
            const numericCount = firstRow.filter(c => c !== '' && !isNaN(parseFloat(c))).length;
            const hasHeader = numericCount < firstRow.length / 2;

            let headerLabels;
            let dataRows;
            if (hasHeader) {
                headerLabels = firstRow;
                dataRows = parsed.slice(1);
            } else {
                headerLabels = Array.from({ length: numCols }, (_, i) => `Group ${i + 1}`);
                dataRows = parsed;
            }

            // In heatmap mode: detect leading text columns as Group/Sample IDs
            const isHeatmap = window.app && (window.app.mode === 'heatmap' || window.app.mode === 'correlation');
            let idColCount = 0;
            if (isHeatmap && dataRows.length > 0) {
                for (let col = 0; col < Math.min(2, numCols); col++) {
                    let textCount = 0, numCount = 0;
                    for (const row of dataRows) {
                        const v = (row[col] || '').trim();
                        if (v === '') continue;
                        if (isNaN(parseFloat(v))) textCount++;
                        else numCount++;
                    }
                    if (textCount > 0 && textCount >= numCount) idColCount = col + 1;
                    else break;
                }
            }

            const dataColCount = numCols - idColCount;
            const dataHeaderLabels = hasHeader ? headerLabels.slice(idColCount) : Array.from({ length: dataColCount }, (_, i) => `Group ${i + 1}`);

            // Append mode: add rows below existing data instead of replacing
            const appendMode = document.getElementById('pasteAppend')?.checked;
            if (appendMode) {
                const existingDataCols = this._dataColCount();
                // Add rows for the new data
                for (let r = 0; r < dataRows.length; r++) {
                    const row = this._createRow(existingDataCols);
                    this.tbody.appendChild(row);
                    this.numRows++;
                    // Fill ID cells
                    if (idColCount > 0) {
                        const idCells = row.querySelectorAll('td.id-cell');
                        if (idCells[0]) idCells[0].textContent = dataRows[r][0] || '';
                        if (idColCount > 1 && idCells[1]) idCells[1].textContent = dataRows[r][1] || '';
                    }
                    // Fill data cells - match by header name if possible
                    const dataCells = row.querySelectorAll('td:not(.id-cell):not(.row-delete-cell):not(.row-toggle-cell)');
                    const existingHeaderEls = this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)');
                    const existingHeaderNames = Array.from(existingHeaderEls).map(th => {
                        const cl = th.cloneNode(true);
                        const btn = cl.querySelector('.th-delete-btn');
                        if (btn) btn.remove();
                        return cl.textContent.trim();
                    });
                    for (let c = 0; c < dataColCount; c++) {
                        const colName = dataHeaderLabels[c];
                        let targetIdx = existingHeaderNames.indexOf(colName);
                        if (targetIdx < 0) targetIdx = c; // fallback to positional
                        if (targetIdx < dataCells.length) {
                            dataCells[targetIdx].textContent = dataRows[r][idColCount + c] || '';
                        }
                    }
                }
                this._updateToggleVisibility();
                this._updateDeleteButtonVisibility();
                if (window.app) window.app.updateGraph();
                return;
            }

            // Replace mode: rebuild entire table
            const existingHeaders = this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)');
            const delColHeader = this.headerRow.querySelector('.delete-col-header');
            existingHeaders.forEach(h => h.remove());

            for (let c = 0; c < dataColCount; c++) {
                const th = document.createElement('th');
                th.contentEditable = true;
                th.textContent = dataHeaderLabels[c] || `Group ${c + 1}`;
                if (delColHeader) {
                    this.headerRow.insertBefore(th, delColHeader);
                } else {
                    this.headerRow.appendChild(th);
                }
            }

            const neededRows = Math.max(dataRows.length, 1);
            this.numRows = neededRows;
            this.tbody.innerHTML = '';
            for (let r = 0; r < neededRows; r++) {
                const row = this._createRow(dataColCount);
                this.tbody.appendChild(row);
            }

            const bodyRows = this.tbody.querySelectorAll('tr');
            dataRows.forEach((rowData, r) => {
                if (r >= bodyRows.length) return;
                if (idColCount > 0) {
                    const idCells = bodyRows[r].querySelectorAll('td.id-cell');
                    if (idCells[0]) idCells[0].textContent = rowData[0] || '';
                    if (idColCount > 1 && idCells[1]) idCells[1].textContent = rowData[1] || '';
                }
                const dataCells = bodyRows[r].querySelectorAll('td:not(.id-cell):not(.row-delete-cell):not(.row-toggle-cell)');
                for (let c = 0; c < dataColCount && c < dataCells.length; c++) {
                    dataCells[c].textContent = rowData[idColCount + c] || '';
                }
            });

            // Rebuild delete buttons
            this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col) .th-delete-btn').forEach(b => b.remove());
            this._addDeleteColumnHeaders();
            this._updateDeleteButtonVisibility();
            this._updateToggleVisibility();
            this.setupHeaderEditing();

            if (window.app) window.app.updateGraph();
        });
    }

    addColumn() {
        const colNum = this._dataColCount() + 1;

        // Add header before the delete-col-header
        const newHeader = document.createElement('th');
        newHeader.contentEditable = true;
        newHeader.textContent = `Group ${colNum}`;

        const delColHeader = this.headerRow.querySelector('.delete-col-header');
        if (delColHeader) {
            this.headerRow.insertBefore(newHeader, delColHeader);
        } else {
            this.headerRow.appendChild(newHeader);
        }

        // Add cells to each row (before the row-delete-cell)
        const rows = this.tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cell = document.createElement('td');
            cell.contentEditable = true;
            cell.textContent = '';
            cell.addEventListener('blur', (e) => {
                this.validateCell(e.target);
            });
            const delCell = row.querySelector('.row-delete-cell');
            if (delCell) {
                row.insertBefore(cell, delCell);
            } else {
                row.appendChild(cell);
            }
        });

        // Re-add delete buttons on all headers
        this.headerRow.querySelectorAll('th:not(.delete-col-header) .th-delete-btn').forEach(b => b.remove());
        this._addDeleteColumnHeaders();
        this._updateDeleteButtonVisibility();

        // Rebuild axis assignment row if visible (correlation mode)
        const axisRow = document.getElementById('axisAssignmentRow');
        if (axisRow && axisRow.style.display !== 'none') {
            this._rebuildAxisAssignmentCells();
        }

        if (window.app) {
            window.app.updateGraph();
        }
    }

    addRow() {
        this.numRows++;
        const numCols = this._dataColCount();
        const row = this._createRow(numCols);
        this.tbody.appendChild(row);
        this._updateDeleteButtonVisibility();
    }

    clearData() {
        // Clear all cells (including id-cells, skip toggles)
        const cells = this.tbody.querySelectorAll('td:not(.row-delete-cell):not(.row-toggle-cell)');
        cells.forEach(cell => {
            cell.textContent = '';
        });
        // Re-enable all rows
        this.tbody.querySelectorAll('tr.row-disabled').forEach(r => r.classList.remove('row-disabled'));
        this.tbody.querySelectorAll('.row-toggle-cell input').forEach(cb => { cb.checked = true; });

        // Clear data headers back to defaults (skip id-col)
        const headers = this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)');
        headers.forEach((th, i) => {
            const btn = th.querySelector('.th-delete-btn');
            th.textContent = `Group ${i + 1}`;
            if (btn) th.appendChild(btn);
        });

        if (window.app) {
            window.app.updateGraph();
        }
    }

    getData() {
        const data = [];
        const headers = [];

        // Get headers (data columns only, skip id-col)
        const headerCells = this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)');
        let emptyCount = 0;
        headerCells.forEach(th => {
            const clone = th.cloneNode(true);
            const btn = clone.querySelector('.th-delete-btn');
            if (btn) btn.remove();
            const txt = clone.textContent.trim();
            if (txt !== '') {
                headers.push(txt);
            } else {
                // Unique invisible label: space + zero-width spaces so each empty column is distinct
                headers.push(' ' + '\u200B'.repeat(emptyCount));
                emptyCount++;
            }
        });

        // Get data for each column (skip id-cells, skip disabled rows)
        for (let colIndex = 0; colIndex < headers.length; colIndex++) {
            const columnData = [];
            const rows = this.tbody.querySelectorAll('tr:not(.row-disabled)');

            rows.forEach(row => {
                const cells = row.querySelectorAll('td:not(.row-delete-cell):not(.id-cell):not(.row-toggle-cell)');
                const cell = cells[colIndex];
                if (!cell) return;
                const value = cell.textContent.trim();
                if (value !== '') {
                    const num = parseFloat(value);
                    if (!isNaN(num)) {
                        columnData.push(num);
                    }
                }
            });

            data.push({
                label: headers[colIndex],
                values: columnData
            });
        }

        return data;
    }

    getMatrixData() {
        // Collect data column headers (skip id-col headers)
        const colLabels = [];
        const headerCells = this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)');
        headerCells.forEach(th => {
            const clone = th.cloneNode(true);
            const btn = clone.querySelector('.th-delete-btn');
            if (btn) btn.remove();
            colLabels.push(clone.textContent.trim() || 'Unnamed');
        });

        const rows = this.tbody.querySelectorAll('tr:not(.row-disabled)');
        const matrix = [];
        const rowLabels = [];
        const groupAssignments = [];
        let rowNum = 1;

        rows.forEach(row => {
            // ID cells
            const idCells = row.querySelectorAll('td.id-cell');
            const groupVal = idCells[0] ? idCells[0].textContent.trim() : '';
            const sampleVal = idCells[1] ? idCells[1].textContent.trim() : '';

            // Data cells (everything except id-cell, toggle-cell and row-delete-cell)
            const dataCells = row.querySelectorAll('td:not(.id-cell):not(.row-delete-cell):not(.row-toggle-cell)');
            const rowData = [];
            let hasAny = false;
            for (let c = 0; c < dataCells.length; c++) {
                const value = dataCells[c].textContent.trim();
                if (value === '') {
                    rowData.push(NaN);
                } else {
                    const num = parseFloat(value);
                    rowData.push(num);
                    if (!isNaN(num)) hasAny = true;
                }
            }
            if (hasAny) {
                matrix.push(rowData);
                groupAssignments.push(groupVal);
                // Build row label from Group/Sample columns
                if (groupVal && sampleVal) {
                    rowLabels.push(groupVal + '_' + sampleVal);
                } else if (groupVal) {
                    rowLabels.push(groupVal);
                } else if (sampleVal) {
                    rowLabels.push(sampleVal);
                } else {
                    rowLabels.push('Row ' + rowNum);
                }
            }
            rowNum++;
        });

        return { colLabels, rowLabels, matrix, groupAssignments };
    }

    _buildCSVLines() {
        const headerCells = this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.row-toggle-col)');
        const headers = [];
        headerCells.forEach(th => {
            const clone = th.cloneNode(true);
            const btn = clone.querySelector('.th-delete-btn');
            if (btn) btn.remove();
            headers.push(clone.textContent.trim());
        });
        const lines = [headers.join(',')];

        // Include axis assignment row if in correlation mode
        const axisRow = document.getElementById('axisAssignmentRow');
        if (axisRow && axisRow.style.display !== 'none' && this._axisAssignments) {
            // ID columns (Group, Sample) get empty axis labels
            const axisParts = ['', ''];
            const dataHeaders = this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)');
            dataHeaders.forEach((_, idx) => {
                const a = this._axisAssignments[idx];
                axisParts.push(a === 'X' ? 'X' : a === 'Y' ? 'Y' : '');
            });
            lines.push(axisParts.join(','));
        }

        const rows = this.tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td:not(.row-delete-cell):not(.row-toggle-cell)');
            const vals = [];
            cells.forEach(td => vals.push(td.textContent.trim()));
            if (vals.some(v => v !== '')) lines.push(vals.join(','));
        });
        return lines;
    }

    getRawCSVText() {
        return this._buildCSVLines().join('\n');
    }

    exportRawCSV() {
        const csv = this._buildCSVLines().join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'raw_data.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    // headers: data column headers, rowData: array of arrays (data only),
    // idData: optional array of [group, sample] per row
    setupTable(headers, numRows, rowData, idData) {
        // Remove existing data headers (keep id-col, toggle-col, delete-col-header)
        const existingDataHeaders = this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)');
        const delColHeader = this.headerRow.querySelector('.delete-col-header');
        existingDataHeaders.forEach(h => h.remove());

        // Ensure id-col headers exist
        const idCols = this.headerRow.querySelectorAll('th.id-col');
        if (idCols.length === 0) {
            const ref = this.headerRow.firstChild;
            ['Group', 'Sample'].forEach(label => {
                const th = document.createElement('th');
                th.className = 'id-col';
                th.textContent = label;
                this.headerRow.insertBefore(th, ref);
            });
        }

        for (const label of headers) {
            const th = document.createElement('th');
            th.contentEditable = true;
            th.textContent = label;
            if (delColHeader) {
                this.headerRow.insertBefore(th, delColHeader);
            } else {
                this.headerRow.appendChild(th);
            }
        }

        // Rebuild rows
        this.numRows = numRows;
        this.tbody.innerHTML = '';
        for (let r = 0; r < numRows; r++) {
            const row = this._createRow(headers.length);
            this.tbody.appendChild(row);
        }

        // Fill ID data
        if (idData) {
            const bodyRows = this.tbody.querySelectorAll('tr');
            idData.forEach((ids, r) => {
                if (r >= bodyRows.length) return;
                const idCells = bodyRows[r].querySelectorAll('td.id-cell');
                if (ids[0] !== undefined && idCells[0]) idCells[0].textContent = ids[0];
                if (ids[1] !== undefined && idCells[1]) idCells[1].textContent = ids[1];
            });
        }

        // Fill data cells
        if (rowData) {
            const bodyRows = this.tbody.querySelectorAll('tr');
            rowData.forEach((rd, r) => {
                if (r >= bodyRows.length) return;
                const dataCells = bodyRows[r].querySelectorAll('td:not(.id-cell):not(.row-delete-cell):not(.row-toggle-cell)');
                rd.forEach((val, c) => {
                    if (c < dataCells.length) dataCells[c].textContent = val;
                });
            });
        }

        this._addDeleteColumnHeaders();
        this._updateDeleteButtonVisibility();
        this._updateToggleVisibility();
        this.setupHeaderEditing();
    }

    loadSampleData(index = 0) {
        const datasets = [
            { // 0: 3 groups, moderate difference, n=10
                headers: ['Control', 'Treatment A', 'Treatment B'],
                rows: [
                    [4.2,8.1,6.7],[5.8,6.3,5.1],[3.6,9.4,7.8],[5.1,7.7,4.9],[6.4,5.9,8.3],
                    [4.7,8.8,6.2],[3.9,7.2,5.5],[5.5,10.1,7.1],[4.3,6.6,9.0],[6.0,8.5,5.8]
                ]
            },
            { // 1: 2 groups, large effect, low variability, n=6
                headers: ['Placebo', 'Drug'],
                rows: [
                    [2.1,8.4],[2.5,9.1],[1.8,7.9],[2.3,8.7],[2.0,8.2],[2.6,9.3]
                ]
            },
            { // 2: 5 groups, dose-response, n=8
                headers: ['Vehicle', '1 mg', '5 mg', '10 mg', '50 mg'],
                rows: [
                    [10.2,12.1,18.5,25.3,32.1],[11.8,11.5,16.8,27.1,35.4],
                    [9.5,13.2,19.2,22.8,30.8],[12.1,10.8,17.1,26.5,33.9],
                    [10.8,12.8,20.1,24.2,31.5],[11.2,11.1,15.9,23.9,34.2],
                    [9.9,13.5,18.8,25.8,29.7],[10.5,12.4,17.5,24.8,32.8]
                ]
            },
            { // 3: 4 groups, high variability, overlapping
                headers: ['WT', 'Het', 'KO', 'Rescue'],
                rows: [
                    [45,52,28,41],[62,38,35,55],[38,61,22,48],[55,45,42,38],
                    [41,58,18,52],[68,42,31,45],[35,55,25,60],[58,48,38,42],
                    [42,50,20,50],[52,62,30,55],[48,40,36,48],[60,55,28,58]
                ]
            },
            { // 4: 2 groups, no significant difference
                headers: ['Morning', 'Evening'],
                rows: [
                    [7.2,7.5],[6.8,7.1],[7.5,6.9],[7.0,7.3],[6.6,7.0],
                    [7.3,6.8],[7.1,7.4],[6.9,7.2],[7.4,6.7],[6.7,7.1]
                ]
            },
            { // 5: 3 groups, temperature change (negative values)
                headers: ['Room Temp', 'Refrigerated', 'Frozen'],
                rows: [
                    [2.1,-4.5,-18.2],[1.8,-5.1,-20.5],[2.5,-3.8,-17.8],[1.5,-4.9,-19.1],[2.8,-4.2,-21.3],
                    [1.2,-5.5,-18.9],[2.3,-3.5,-20.1],[1.9,-4.8,-19.5],[2.6,-4.1,-17.5],[1.7,-5.2,-20.8]
                ]
            }
        ];
        const d = datasets[index % datasets.length];
        this.setupTable(d.headers, Math.max(d.rows.length + 2, 10), d.rows);
        if (window.app) window.app.updateGraph();
    }

    loadHeatmapSampleData(index = 0) {
        const datasets = [
            { // 0: 2 groups, 4 markers, n=3
                headers: ['CD14','CD101','CD124','CD45'],
                ids: [['ctrl','1'],['ctrl','2'],['ctrl','3'],['treat','1'],['treat','2'],['treat','3']],
                rows: [[12,23,67,45],[14,32,64,48],[11,28,71,42],[31,54,34,82],[28,48,38,79],[33,51,31,85]]
            },
            { // 1: 3 groups, 6 markers, n=4
                headers: ['IL2','IL6','TNFa','IFNg','IL10','IL17'],
                ids: [['Naive','1'],['Naive','2'],['Naive','3'],['Naive','4'],
                      ['Th1','1'],['Th1','2'],['Th1','3'],['Th1','4'],
                      ['Th17','1'],['Th17','2'],['Th17','3'],['Th17','4']],
                rows: [
                    [5,3,2,1,8,1],[4,4,3,2,9,2],[6,2,1,1,7,1],[5,3,2,2,10,2],
                    [25,8,45,82,3,5],[28,10,42,78,4,6],[22,7,48,85,2,4],[26,9,40,80,3,5],
                    [12,35,10,8,4,65],[14,38,12,6,5,72],[10,32,8,10,3,60],[13,36,11,7,4,68]
                ]
            },
            { // 2: 4 groups, 8 markers — immune profiling
                headers: ['CD3','CD4','CD8','CD19','CD56','FoxP3','PD1','Ki67'],
                ids: [['Healthy','1'],['Healthy','2'],['Healthy','3'],
                      ['Mild','1'],['Mild','2'],['Mild','3'],
                      ['Severe','1'],['Severe','2'],['Severe','3'],
                      ['Recovery','1'],['Recovery','2'],['Recovery','3']],
                rows: [
                    [65,40,25,12,8,5,3,10],[62,38,27,14,9,4,4,12],[68,42,23,11,7,6,2,8],
                    [55,32,22,18,12,8,15,25],[52,30,20,20,14,9,18,28],[58,35,24,16,10,7,12,22],
                    [35,18,15,25,20,15,35,45],[32,16,12,28,22,18,40,50],[38,20,18,22,18,12,30,42],
                    [58,36,24,15,10,6,8,15],[60,38,22,13,9,5,6,12],[56,34,26,16,11,7,10,18]
                ]
            },
            { // 3: 2 groups, 10 markers — subtle differences
                headers: ['Gene1','Gene2','Gene3','Gene4','Gene5','Gene6','Gene7','Gene8','Gene9','Gene10'],
                ids: [['A','1'],['A','2'],['A','3'],['A','4'],['A','5'],
                      ['B','1'],['B','2'],['B','3'],['B','4'],['B','5']],
                rows: [
                    [50,48,52,45,55,60,42,58,47,53],[52,50,48,47,53,58,44,56,49,51],
                    [48,52,50,43,57,62,40,60,45,55],[51,47,53,46,54,59,43,57,48,52],
                    [49,51,49,44,56,61,41,59,46,54],
                    [55,42,58,48,50,52,50,48,55,45],[53,44,56,50,48,54,48,50,53,47],
                    [57,40,60,46,52,50,52,46,57,43],[54,43,57,49,49,53,49,49,54,46],
                    [56,41,59,47,51,51,51,47,56,44]
                ]
            }
        ];
        const d = datasets[index % datasets.length];
        this.setupTable(d.headers, Math.max(d.rows.length + 2, 10), d.rows, d.ids);
        if (window.app) window.app.updateGraph();
    }

    loadPCASampleData(index = 0) {
        // PCA datasets: realistic flow cytometry data with biological noise (~15-25% CV)
        const datasets = [
            { // 0: Immune status — 4 groups × 8, 8 markers (% of parent)
                headers: ['CD3','CD4','CD8','CD19','CD56','FoxP3','PD1','Ki67'],
                ids: [
                    ['Healthy','1'],['Healthy','2'],['Healthy','3'],['Healthy','4'],['Healthy','5'],['Healthy','6'],['Healthy','7'],['Healthy','8'],
                    ['Infection','1'],['Infection','2'],['Infection','3'],['Infection','4'],['Infection','5'],['Infection','6'],['Infection','7'],['Infection','8'],
                    ['Autoimmune','1'],['Autoimmune','2'],['Autoimmune','3'],['Autoimmune','4'],['Autoimmune','5'],['Autoimmune','6'],['Autoimmune','7'],['Autoimmune','8'],
                    ['ImmunoDefi','1'],['ImmunoDefi','2'],['ImmunoDefi','3'],['ImmunoDefi','4'],['ImmunoDefi','5'],['ImmunoDefi','6'],['ImmunoDefi','7'],['ImmunoDefi','8']
                ],
                rows: [
                    // Healthy: balanced T cells, low activation
                    [68,42,22,14,10,4,3,5],[62,38,26,16,8,5,4,7],[71,45,20,11,12,3,2,4],[58,35,28,18,9,6,5,8],
                    [65,40,24,15,11,4,3,6],[73,48,19,12,7,3,2,3],[60,37,27,17,10,5,4,7],[66,41,23,13,9,4,3,5],
                    // Infection: high CD8, high PD1/Ki67, low CD4 ratio
                    [72,18,52,8,15,3,38,42],[68,15,55,10,18,4,44,48],[75,22,48,6,12,2,32,38],[65,14,58,11,20,5,48,52],
                    [70,20,50,7,14,3,35,40],[78,16,54,9,22,4,42,46],[63,19,56,12,17,3,40,44],[71,21,49,8,13,2,36,39],
                    // Autoimmune: high FoxP3 but dysfunctional, high CD4, elevated Ki67
                    [74,55,12,22,5,18,15,28],[70,52,15,26,7,22,18,34],[78,58,10,19,4,15,12,24],[66,48,18,28,8,25,20,38],
                    [72,54,13,24,6,20,16,30],[76,56,11,20,4,16,14,26],[68,50,16,27,7,23,19,36],[75,57,11,21,5,17,13,25],
                    // Immunodeficiency: low CD3/CD4, low NK, high CD19 relative
                    [28,12,10,35,4,2,8,3],[32,15,12,38,6,3,10,4],[24,9,8,42,3,1,6,2],[35,18,14,32,5,3,12,5],
                    [26,10,9,40,3,2,7,2],[30,14,11,36,5,2,9,3],[22,8,7,44,2,1,5,1],[33,16,13,34,4,3,11,4]
                ]
            },
            { // 1: T cell differentiation — 5 groups × 7, 8 markers
                headers: ['CD45RA','CCR7','CD28','CD27','Granzyme B','Perforin','PD1','KLRG1'],
                ids: [
                    ['Naive','1'],['Naive','2'],['Naive','3'],['Naive','4'],['Naive','5'],['Naive','6'],['Naive','7'],
                    ['CM','1'],['CM','2'],['CM','3'],['CM','4'],['CM','5'],['CM','6'],['CM','7'],
                    ['EM','1'],['EM','2'],['EM','3'],['EM','4'],['EM','5'],['EM','6'],['EM','7'],
                    ['TEMRA','1'],['TEMRA','2'],['TEMRA','3'],['TEMRA','4'],['TEMRA','5'],['TEMRA','6'],['TEMRA','7'],
                    ['Exhausted','1'],['Exhausted','2'],['Exhausted','3'],['Exhausted','4'],['Exhausted','5'],['Exhausted','6'],['Exhausted','7']
                ],
                rows: [
                    // Naive: CD45RA+CCR7+CD28+CD27+, no effector molecules
                    [92,88,95,90,1,0.5,2,1],[88,84,92,87,2,1,3,2],[95,91,97,93,0.5,0.3,1,0.5],[86,82,90,85,3,1.5,4,3],
                    [90,86,94,88,1,0.8,2,1],[93,90,96,92,0.8,0.4,1.5,1],[87,83,91,86,2,1,3,2],
                    // Central Memory: CD45RA-CCR7+CD28+CD27+, low effector
                    [8,75,88,82,5,3,8,4],[12,80,92,86,3,2,6,3],[6,70,85,78,7,4,10,5],[15,82,90,84,4,2,7,3],
                    [10,77,89,80,6,3,9,4],[7,72,86,79,5,3.5,8,5],[13,78,91,83,4,2.5,7,3],
                    // Effector Memory: CD45RA-CCR7-CD28mid, effector molecules up
                    [5,8,45,35,42,28,22,38],[8,12,50,40,36,24,18,32],[3,6,38,28,48,34,26,44],[10,15,52,42,34,22,16,30],
                    [6,10,42,32,44,30,24,40],[4,7,40,30,46,32,25,42],[9,13,48,38,38,26,20,35],
                    // TEMRA: CD45RA+CCR7-CD28-CD27-, high cytotoxic
                    [82,4,12,8,78,65,10,85],[78,6,15,12,72,58,14,80],[86,3,8,5,84,72,8,90],[75,8,18,15,68,55,16,76],
                    [80,5,14,10,76,62,12,82],[84,3,10,6,82,70,9,88],[77,7,16,13,70,58,15,78],
                    // Exhausted: high PD1, Tim3/LAG3 proxy via low CD28/CD27, intermediate GrB
                    [15,6,18,12,25,15,72,22],[18,8,22,15,20,12,68,18],[12,4,14,9,30,18,78,26],[20,10,25,18,18,10,65,16],
                    [14,5,16,10,28,16,75,24],[16,7,20,14,22,13,70,20],[19,9,24,16,19,11,66,17]
                ]
            },
            { // 2: Tissue comparison — 4 groups × 8, 7 markers (% of live)
                headers: ['CD3','CD19','CD14','CD56','CD11c','CD4:CD8','HLA-DR'],
                ids: [
                    ['Blood','1'],['Blood','2'],['Blood','3'],['Blood','4'],['Blood','5'],['Blood','6'],['Blood','7'],['Blood','8'],
                    ['Spleen','1'],['Spleen','2'],['Spleen','3'],['Spleen','4'],['Spleen','5'],['Spleen','6'],['Spleen','7'],['Spleen','8'],
                    ['LymphNode','1'],['LymphNode','2'],['LymphNode','3'],['LymphNode','4'],['LymphNode','5'],['LymphNode','6'],['LymphNode','7'],['LymphNode','8'],
                    ['BoneMarrow','1'],['BoneMarrow','2'],['BoneMarrow','3'],['BoneMarrow','4'],['BoneMarrow','5'],['BoneMarrow','6'],['BoneMarrow','7'],['BoneMarrow','8']
                ],
                rows: [
                    // Blood: high T, moderate B, high monocytes, moderate NK
                    [62,12,18,8,4,2.1,25],[58,14,22,10,5,1.8,28],[66,10,15,7,3,2.4,22],[55,15,24,11,6,1.6,30],
                    [64,11,17,9,4,2.2,24],[60,13,20,8,5,1.9,27],[68,9,14,6,3,2.5,21],[57,14,21,10,5,1.7,29],
                    // Spleen: high B, moderate T, macrophages, low monocytes
                    [35,32,5,12,8,1.2,45],[32,36,6,14,9,1.0,48],[38,28,4,10,7,1.4,42],[30,38,7,15,10,0.9,50],
                    [34,34,5,13,8,1.1,46],[36,30,4,11,7,1.3,43],[31,37,6,14,9,1.0,49],[37,29,5,10,8,1.4,44],
                    // Lymph Node: very high T, high B, very low monocytes/NK
                    [55,35,1,2,6,3.5,52],[52,38,2,3,7,3.0,55],[58,32,1,1,5,4.0,48],[50,40,2,4,8,2.8,58],
                    [54,36,1,2,6,3.4,50],[56,33,1,2,5,3.8,49],[51,39,2,3,7,2.9,56],[57,34,1,1,6,3.6,51],
                    // Bone Marrow: high progenitors (CD19/B), low T, high HLA-DR
                    [15,42,8,3,12,0.8,62],[18,38,10,4,14,1.0,58],[12,46,6,2,10,0.6,66],[20,36,11,5,15,1.1,56],
                    [14,44,7,3,11,0.7,64],[16,40,9,3,13,0.9,60],[11,48,5,2,10,0.5,68],[19,37,10,4,14,1.0,57]
                ]
            },
            { // 3: Tumor immune microenvironment — 3 groups × 10, 8 markers
                headers: ['CD8 TIL','CD68 TAM','FoxP3 Treg','PDL1','VEGF','Ki67','Granzyme B','CD103'],
                ids: [
                    ['Hot','1'],['Hot','2'],['Hot','3'],['Hot','4'],['Hot','5'],
                    ['Hot','6'],['Hot','7'],['Hot','8'],['Hot','9'],['Hot','10'],
                    ['Cold','1'],['Cold','2'],['Cold','3'],['Cold','4'],['Cold','5'],
                    ['Cold','6'],['Cold','7'],['Cold','8'],['Cold','9'],['Cold','10'],
                    ['Excluded','1'],['Excluded','2'],['Excluded','3'],['Excluded','4'],['Excluded','5'],
                    ['Excluded','6'],['Excluded','7'],['Excluded','8'],['Excluded','9'],['Excluded','10']
                ],
                rows: [
                    // Hot: high TIL, high GrB, high PDL1 (responsive), high CD103
                    [45,18,8,42,12,35,52,38],[40,22,10,38,15,32,48,34],[50,15,6,48,10,38,58,42],[38,24,12,35,18,30,44,30],
                    [42,20,9,40,14,34,50,36],[48,16,7,45,11,37,55,40],[36,25,13,33,20,28,42,28],[52,14,5,50,8,40,60,44],
                    [44,19,8,41,13,33,51,37],[46,17,7,44,12,36,54,39],
                    // Cold: low TIL, low GrB, low PDL1, high VEGF (non-responsive)
                    [4,8,2,5,55,48,2,3],[6,10,3,7,50,45,3,4],[3,6,1,4,60,52,1,2],[8,12,4,9,48,42,4,5],
                    [5,9,2,6,53,47,2,3],[3,7,1,4,58,50,1,2],[7,11,3,8,50,44,3,4],[4,8,2,5,56,49,2,3],
                    [6,10,3,7,52,46,3,4],[5,9,2,6,54,48,2,3],
                    // Excluded: TILs at margin (moderate), high TAM, high Treg, low GrB
                    [22,42,28,20,30,25,8,12],[18,48,32,18,34,28,6,10],[25,38,24,22,28,22,10,14],[16,52,35,16,36,30,5,8],
                    [20,44,30,19,32,26,7,11],[24,40,26,21,29,24,9,13],[17,50,33,17,35,29,5,9],[26,36,22,24,26,21,11,15],
                    [21,43,29,20,31,25,8,12],[19,46,31,18,33,27,6,10]
                ]
            }
        ];
        const d = datasets[index % datasets.length];
        this.setupTable(d.headers, Math.max(d.rows.length + 2, 10), d.rows, d.ids);
        if (window.app) window.app.updateGraph();
    }

    getGrowthData() {
        const headerCells = this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)');
        const headers = [];
        headerCells.forEach(th => {
            const clone = th.cloneNode(true);
            const btn = clone.querySelector('.th-delete-btn');
            if (btn) btn.remove();
            headers.push(clone.textContent.trim());
        });

        if (headers.length < 2) return null;

        // Read all rows
        const rows = this.tbody.querySelectorAll('tr:not(.row-disabled)');
        const rawRows = [];
        rows.forEach(row => {
            const cells = row.querySelectorAll('td:not(.row-delete-cell):not(.id-cell):not(.row-toggle-cell)');
            const rowVals = [];
            cells.forEach(c => rowVals.push(c.textContent.trim()));
            // Only include rows where at least the time column has a value
            if (rowVals[0] !== '') rawRows.push(rowVals);
        });

        if (rawRows.length === 0) return null;

        // First column = timepoints
        const timepoints = rawRows.map(r => parseFloat(r[0])).filter(v => !isNaN(v));
        const validRows = rawRows.filter(r => !isNaN(parseFloat(r[0])));

        // Remaining columns: parse Group_SubjectID or Group SubjectID
        const subjects = {};
        const groupMap = {};
        const groupsSet = [];

        for (let c = 1; c < headers.length; c++) {
            const h = headers[c];
            if (!h) continue;
            let group, subjectId;
            // Try splitting by underscore first, then by last space
            const uIdx = h.indexOf('_');
            if (uIdx > 0) {
                group = h.substring(0, uIdx);
                subjectId = h;
            } else {
                const sIdx = h.lastIndexOf(' ');
                if (sIdx > 0) {
                    group = h.substring(0, sIdx);
                    subjectId = h;
                } else {
                    group = h;
                    subjectId = h;
                }
            }

            if (!groupsSet.includes(group)) groupsSet.push(group);
            if (!groupMap[group]) groupMap[group] = [];
            if (!groupMap[group].includes(subjectId)) groupMap[group].push(subjectId);

            const vals = validRows.map(r => {
                const v = parseFloat(r[c]);
                return isNaN(v) ? null : v;
            });
            subjects[subjectId] = vals;
        }

        return { timepoints, groups: groupsSet, subjects, groupMap };
    }

    loadGrowthSampleData(index = 0) {
        const datasets = [
            { // 0: 3 groups, tumor volume, exponential divergence with variability
                headers: ['Time','Vehicle_1','Vehicle_2','Vehicle_3','Vehicle_4','Vehicle_5','Vehicle_6',
                    'Treat_1','Treat_2','Treat_3','Treat_4','Treat_5','Treat_6',
                    'High_1','High_2','High_3','High_4','High_5','High_6'],
                rows: [
                    [0,102,95,118,88,108,97,98,112,91,105,89,110,94,107,100,88,115,92],
                    [3,162,145,198,128,185,152,125,138,105,148,98,155,102,122,95,108,128,88],
                    [7,265,228,345,195,310,248,165,182,128,205,115,195,108,132,98,118,142,95],
                    [10,405,348,555,285,490,375,208,245,168,275,150,260,115,148,105,128,158,100],
                    [14,610,520,820,425,750,568,262,315,210,355,195,340,120,155,108,135,172,105],
                    [17,855,725,1120,605,1050,790,318,385,258,435,245,410,125,165,112,142,182,108],
                    [21,1180,1010,1580,850,1450,1100,382,468,312,530,298,495,128,172,118,148,190,112]
                ]
            },
            { // 1: 2 groups, body weight, parallel curves with realistic variability
                headers: ['Time','Control_1','Control_2','Control_3','Control_4','Control_5',
                    'KO_1','KO_2','KO_3','KO_4','KO_5'],
                rows: [
                    [0,20.1,19.4,21.2,19.7,20.8,15.2,14.5,16.1,14.8,15.7],
                    [2,21.3,20.2,22.0,20.5,21.5,15.9,15.0,16.8,15.3,16.4],
                    [4,22.5,21.4,23.1,21.8,22.8,16.8,15.8,17.5,16.0,17.2],
                    [6,23.4,22.1,24.5,22.6,23.9,17.2,16.2,18.3,16.5,17.8],
                    [8,24.2,23.0,25.3,23.5,24.8,17.5,16.4,18.8,16.8,18.1],
                    [10,25.1,23.8,26.0,24.2,25.6,17.9,16.8,19.1,17.1,18.5],
                    [12,25.8,24.5,26.8,24.9,26.3,18.2,17.0,19.4,17.4,18.8]
                ]
            },
            { // 2: 4 groups, cell proliferation, crossing curves
                headers: ['Time','DMSO_1','DMSO_2','DMSO_3',
                    'DrugA_1','DrugA_2','DrugA_3',
                    'DrugB_1','DrugB_2','DrugB_3',
                    'Combo_1','Combo_2','Combo_3'],
                rows: [
                    [0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0],
                    [24,2.1,1.9,2.3,1.6,1.5,1.7,1.8,1.7,2.0,1.2,1.1,1.3],
                    [48,4.5,4.0,5.0,2.2,2.0,2.5,3.1,2.8,3.5,1.1,1.0,1.2],
                    [72,9.2,8.5,10.1,2.8,2.5,3.2,5.5,4.8,6.2,0.8,0.7,0.9],
                    [96,15.8,14.2,17.0,3.1,2.8,3.5,8.2,7.5,9.5,0.5,0.4,0.6],
                    [120,22.5,20.8,24.5,3.2,2.9,3.6,10.5,9.8,12.0,0.3,0.2,0.4]
                ]
            },
            { // 3: 5 groups, dose-response over time, high variability
                headers: ['Time','Veh_1','Veh_2','Veh_3','Veh_4',
                    'Low_1','Low_2','Low_3','Low_4',
                    'Mid_1','Mid_2','Mid_3','Mid_4',
                    'High_1','High_2','High_3','High_4',
                    'Max_1','Max_2','Max_3','Max_4'],
                rows: [
                    [0,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100],
                    [1,105,115,98,120,102,108,95,112,98,105,92,110,92,98,88,102,85,90,80,95],
                    [3,118,140,108,150,110,120,100,128,95,108,88,115,82,92,75,98,65,72,58,78],
                    [7,145,185,125,200,125,145,110,155,88,105,78,115,68,80,60,88,42,50,35,55],
                    [14,180,250,155,270,148,175,128,188,78,98,65,110,52,65,42,72,22,30,18,35],
                    [21,220,320,190,350,172,210,150,225,68,88,55,100,38,50,30,58,12,18,8,22]
                ]
            },
            { // 4: 3 groups, cytokine secretion over time, diverging with variability
                headers: ['Time','Unstim_1','Unstim_2','Unstim_3','Unstim_4','Unstim_5',
                    'LPS_1','LPS_2','LPS_3','LPS_4','LPS_5',
                    'LPS+IFN_1','LPS+IFN_2','LPS+IFN_3','LPS+IFN_4','LPS+IFN_5'],
                rows: [
                    [0,12,15,9,18,11,14,10,17,13,16,11,16,13,9,15],
                    [2,18,22,14,25,16,45,38,52,41,55,85,72,95,78,102],
                    [6,20,25,17,28,19,120,98,145,110,135,280,245,320,260,305],
                    [12,22,27,18,30,21,185,155,210,170,198,520,460,580,490,545],
                    [24,24,29,20,32,23,220,185,255,200,240,780,690,850,720,810],
                    [48,25,30,21,33,24,235,198,270,215,252,920,830,1010,860,950]
                ]
            },
            { // 5: 3 groups, temperature drop (negative values)
                headers: ['Time','Indoor_1','Indoor_2','Indoor_3','Indoor_4',
                    'Outdoor_1','Outdoor_2','Outdoor_3','Outdoor_4',
                    'Arctic_1','Arctic_2','Arctic_3','Arctic_4'],
                rows: [
                    [0,22.0,21.5,22.3,21.8,22.1,21.7,22.4,21.9,22.0,21.6,22.2,21.8],
                    [2,20.5,20.1,20.8,20.3,12.5,11.8,13.2,12.0,5.2,4.5,5.8,4.9],
                    [4,19.2,18.8,19.5,19.0,4.2,3.5,5.0,3.8,-8.5,-9.2,-7.8,-8.8],
                    [6,18.0,17.5,18.4,17.8,-2.5,-3.2,-1.8,-2.9,-18.5,-19.5,-17.8,-18.9],
                    [8,17.1,16.8,17.5,17.0,-6.8,-7.5,-6.1,-7.2,-25.2,-26.1,-24.5,-25.8],
                    [12,16.5,16.1,16.8,16.3,-8.2,-9.0,-7.5,-8.5,-30.5,-31.8,-29.2,-30.9],
                    [24,15.8,15.5,16.2,15.7,-10.5,-11.2,-9.8,-10.8,-35.2,-36.5,-34.0,-35.8]
                ]
            }
        ];
        const d = datasets[index % datasets.length];
        this.setupTable(d.headers, Math.max(d.rows.length + 2, 10), d.rows);
        if (window.app) window.app.updateGraph();
    }

    getVolcanoData() {
        // Expects columns: Gene/Feature, Log2FC, P-value
        const headerCells = this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)');
        const headers = [];
        headerCells.forEach(th => {
            const clone = th.cloneNode(true);
            const btn = clone.querySelector('.th-delete-btn');
            if (btn) btn.remove();
            headers.push(clone.textContent.trim());
        });

        if (headers.length < 3) return null;

        const rows = this.tbody.querySelectorAll('tr:not(.row-disabled)');
        const points = [];
        rows.forEach(row => {
            const cells = row.querySelectorAll('td:not(.row-delete-cell):not(.id-cell):not(.row-toggle-cell)');
            const name = cells[0]?.textContent.trim() || '';
            const fc = parseFloat(cells[1]?.textContent.trim());
            const pval = parseFloat(cells[2]?.textContent.trim());
            if (name && !isNaN(fc) && !isNaN(pval)) {
                points.push({ name, fc, pval });
            }
        });

        return points.length > 0 ? { points } : null;
    }

    loadVolcanoSampleData(index = 0) {
        const headers = ['Gene', 'Log2FC', 'P-value'];
        const datasets = [
            { // 0: balanced up/down, classic cancer genes
                rows: [
                    ['TP53',2.8,0.00001],['BRCA1',-2.1,0.00005],['MYC',3.5,1e-7],['EGFR',1.9,0.0003],
                    ['VEGFA',-1.5,0.002],['KRAS',2.2,0.0001],['PIK3CA',-2.6,0.00003],['PTEN',-3.1,5e-8],
                    ['RB1',-1.8,0.001],['AKT1',1.2,0.01],['BRAF',0.8,0.05],['CDH1',-0.5,0.3],
                    ['NOTCH1',0.3,0.6],['STAT3',1.6,0.004],['JAK2',2.0,0.0008],['FLT3',-1.1,0.02],
                    ['NPM1',0.4,0.4],['IDH1',-0.2,0.7],['CDKN2A',-2.4,0.00008],['MDM2',1.4,0.008],
                    ['BCL2',0.9,0.06],['RAF1',0.1,0.9],['ERBB2',2.5,0.00006],['MAP2K1',0.6,0.15],
                    ['SMAD4',-1.3,0.015],['FOXP3',-0.7,0.12],['IL6',1.7,0.003],['TNF',0.5,0.25],
                    ['CXCL8',2.9,0.00002],['CCL2',-1.0,0.04],['HIF1A',0.2,0.8],['MTOR',-0.4,0.5],
                    ['SRC',0.7,0.08],['ABL1',-0.3,0.65],['KIT',1.1,0.03],['MET',-1.6,0.005],
                    ['ALK',0.0,0.95],['ROS1',-0.1,0.85],['NRAS',1.3,0.009],['CTNNB1',-0.6,0.2]
                ]
            },
            { // 1: mostly upregulated, inflammatory response
                rows: [
                    ['IL1B',4.2,1e-9],['IL6',3.8,5e-8],['TNF',3.1,1e-7],['CXCL1',3.5,2e-8],
                    ['CXCL8',2.9,1e-6],['CCL2',2.5,5e-6],['IL10',-1.2,0.005],['TGFB1',-0.8,0.04],
                    ['IFNG',2.1,0.0001],['IL17A',1.8,0.0005],['IL23A',1.5,0.002],['NFKB1',1.9,0.0003],
                    ['PTGS2',3.2,5e-7],['MMP9',2.8,2e-6],['ICAM1',2.0,0.0002],['VCAM1',1.6,0.003],
                    ['SELE',1.4,0.008],['CRP',2.4,0.00005],['SAA1',2.7,0.00002],['HP',-0.3,0.5],
                    ['ALB',-0.5,0.3],['TF',-0.2,0.7],['SERPINA1',0.4,0.4],['FGA',0.1,0.9],
                    ['LBP',1.1,0.02],['CD14',0.9,0.06],['TLR4',0.7,0.1],['MYD88',0.6,0.15]
                ]
            },
            { // 2: mostly downregulated, metabolic genes
                rows: [
                    ['PPARG',-3.5,1e-8],['ADIPOQ',-4.1,5e-10],['LEP',-2.8,2e-7],['FABP4',-3.2,8e-8],
                    ['SLC2A4',-2.5,5e-6],['INSR',-1.8,0.0005],['IRS1',-2.1,0.0001],['PCK1',-2.9,1e-7],
                    ['G6PC',-2.2,0.00008],['ACACA',-1.5,0.003],['FASN',-1.9,0.0004],['CPT1A',1.2,0.01],
                    ['HMGCR',-1.1,0.02],['LDLR',-0.9,0.05],['APOB',-1.4,0.007],['MTTP',-1.6,0.002],
                    ['CYP7A1',-2.0,0.0002],['ABCG5',0.3,0.6],['NR1H4',-0.7,0.1],['HNF4A',-1.3,0.01],
                    ['UCP1',0.8,0.07],['PPARGC1A',0.5,0.25],['SIRT1',0.2,0.75],['FOXO1',-0.4,0.4],
                    ['GSK3B',0.1,0.9],['AKT2',-0.6,0.18],['PRKAA1',0.4,0.35],['AMPK',-0.3,0.55]
                ]
            },
            { // 3: many significant genes, large dataset, immune markers
                rows: [
                    ['CD3D',2.5,1e-6],['CD3E',2.3,3e-6],['CD4',-1.8,0.0003],['CD8A',3.1,5e-8],
                    ['CD8B',2.9,2e-7],['GZMA',3.5,1e-9],['GZMB',4.0,5e-10],['PRF1',3.2,8e-8],
                    ['IFNG',2.8,1e-6],['FASLG',2.1,0.0001],['CD19',-2.5,5e-6],['MS4A1',-2.2,0.00008],
                    ['CD79A',-1.9,0.0004],['PAX5',-1.5,0.003],['FOXP3',-3.0,1e-7],['IL2RA',1.4,0.008],
                    ['CTLA4',1.8,0.0005],['PDCD1',2.4,0.00005],['LAG3',1.6,0.002],['HAVCR2',1.3,0.012],
                    ['TIGIT',1.1,0.025],['CD274',2.0,0.0002],['PDCD1LG2',1.7,0.001],['IDO1',2.6,0.00003],
                    ['CD68',0.5,0.3],['CD163',-0.8,0.08],['ARG1',-1.2,0.015],['NOS2',1.0,0.04],
                    ['TGFB1',-0.9,0.06],['IL10',-1.1,0.03],['CXCL9',2.7,0.00002],['CXCL10',3.0,1e-7],
                    ['CCL5',1.9,0.0003],['CXCR3',1.5,0.004],['ITGAE',0.7,0.12],['SELL',-0.4,0.45],
                    ['CCR7',-1.3,0.01],['KLRK1',1.2,0.02],['NCR1',0.9,0.06],['NCAM1',0.6,0.18]
                ]
            }
        ];
        const d = datasets[index % datasets.length];
        this.setupTable(headers, Math.max(d.rows.length + 2, 10), d.rows);
        if (window.app) window.app.updateGraph();
    }

    // --- Correlation mode: axis assignment row ---

    showAxisAssignmentRow() {
        if (!this._axisAssignments) this._axisAssignments = {};
        let row = document.getElementById('axisAssignmentRow');
        if (!row) {
            row = document.createElement('tr');
            row.id = 'axisAssignmentRow';
            row.className = 'axis-assignment-row';
            // Insert after header row
            const thead = this.headerRow.parentElement;
            if (thead) {
                const nextEl = this.headerRow.nextSibling;
                if (nextEl) thead.insertBefore(row, nextEl);
                else thead.appendChild(row);
            }
        }
        row.style.display = '';
        this._rebuildAxisAssignmentCells();
    }

    hideAxisAssignmentRow() {
        const row = document.getElementById('axisAssignmentRow');
        if (row) row.style.display = 'none';
    }

    _rebuildAxisAssignmentCells() {
        const row = document.getElementById('axisAssignmentRow');
        if (!row) return;
        row.innerHTML = '';

        // Toggle col placeholder
        const toggleTd = document.createElement('td');
        toggleTd.className = 'row-toggle-cell';
        row.appendChild(toggleTd);

        // ID col placeholders (Group, Sample)
        for (let i = 0; i < 2; i++) {
            const td = document.createElement('td');
            td.className = 'id-cell axis-assignment-label';
            td.textContent = i === 0 ? '' : 'Axis:';
            td.style.fontSize = '10px';
            td.style.fontWeight = '600';
            td.style.color = '#2d6a1e';
            row.appendChild(td);
        }

        // One dropdown per data column
        const headers = this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)');
        headers.forEach((th, idx) => {
            const td = document.createElement('td');
            td.className = 'axis-assignment-cell';
            const sel = document.createElement('select');
            sel.className = 'axis-select';
            ['—', 'X', 'Y'].forEach(v => {
                const opt = document.createElement('option');
                opt.value = v === '—' ? '' : v;
                opt.textContent = v;
                sel.appendChild(opt);
            });
            const current = this._axisAssignments[idx];
            if (current) sel.value = current;
            sel.addEventListener('change', () => {
                this._axisAssignments[idx] = sel.value;
                if (window.app) window.app.updateGraph();
            });
            td.appendChild(sel);
            row.appendChild(td);
        });

        // Delete col placeholder
        const delTd = document.createElement('td');
        delTd.className = 'row-delete-cell';
        row.appendChild(delTd);
    }

    getCorrelationData() {
        if (!this._axisAssignments) return null;

        const headers = this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)');
        const xIndices = [];
        const yIndices = [];
        headers.forEach((_, idx) => {
            const a = this._axisAssignments[idx];
            if (a === 'X') xIndices.push(idx);
            else if (a === 'Y') yIndices.push(idx);
        });

        if (xIndices.length === 0 || yIndices.length === 0) return null;

        const rows = this.tbody.querySelectorAll('tr:not(.row-disabled)');
        const groupsMap = {};
        const allPoints = [];

        rows.forEach(row => {
            const idCells = row.querySelectorAll('td.id-cell');
            const group = idCells[0] ? idCells[0].textContent.trim() : '';
            const sample = idCells[1] ? idCells[1].textContent.trim() : '';
            const dataCells = row.querySelectorAll('td:not(.id-cell):not(.row-delete-cell):not(.row-toggle-cell)');

            // Collect X values
            const xVals = [];
            xIndices.forEach(ci => {
                const v = dataCells[ci] ? parseFloat(dataCells[ci].textContent.trim()) : NaN;
                if (!isNaN(v)) xVals.push(v);
            });
            // Collect Y values
            const yVals = [];
            yIndices.forEach(ci => {
                const v = dataCells[ci] ? parseFloat(dataCells[ci].textContent.trim()) : NaN;
                if (!isNaN(v)) yVals.push(v);
            });

            if (xVals.length === 0 || yVals.length === 0) return;

            const xMean = Statistics.mean(xVals);
            const yMean = Statistics.mean(yVals);
            const xSD = xVals.length > 1 ? Statistics.std(xVals) : 0;
            const ySD = yVals.length > 1 ? Statistics.std(yVals) : 0;
            const xSEM = xVals.length > 1 ? Statistics.sem(xVals) : 0;
            const ySEM = yVals.length > 1 ? Statistics.sem(yVals) : 0;

            const pt = { sample, group, xMean, yMean, xSD, ySD, xSEM, ySEM, xValues: xVals, yValues: yVals };
            allPoints.push(pt);

            const gKey = group || '__ungrouped__';
            if (!groupsMap[gKey]) groupsMap[gKey] = { group: group || 'All', points: [] };
            groupsMap[gKey].points.push(pt);
        });

        const groups = Object.values(groupsMap);
        return { groups, allPoints };
    }

    getVennData() {
        // Auto-detect binary matrix vs group-based sets
        const headers = [];
        this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)').forEach(th => {
            const clone = th.cloneNode(true);
            const btn = clone.querySelector('.th-delete-btn');
            if (btn) btn.remove();
            headers.push(clone.textContent.trim());
        });

        const rows = this.tbody.querySelectorAll('tr:not(.row-disabled)');
        const rowData = [];
        const ids = [];

        rows.forEach(row => {
            const idCells = row.querySelectorAll('td.id-cell');
            const group = idCells[0] ? idCells[0].textContent.trim() : '';
            const sample = idCells[1] ? idCells[1].textContent.trim() : '';
            const dataCells = row.querySelectorAll('td:not(.id-cell):not(.row-delete-cell):not(.row-toggle-cell)');
            const vals = [];
            dataCells.forEach(td => vals.push(td.textContent.trim()));
            if (vals.some(v => v !== '')) {
                rowData.push(vals);
                ids.push({ group, sample });
            }
        });

        if (rowData.length === 0) return null;

        // Check if binary matrix (all non-empty values are 0 or 1)
        let isBinary = headers.length > 0;
        for (const row of rowData) {
            for (const v of row) {
                if (v !== '' && v !== '0' && v !== '1') { isBinary = false; break; }
            }
            if (!isBinary) break;
        }

        const sets = {};

        if (isBinary && headers.length > 0) {
            // Binary matrix: columns = sets, rows = items, 1 = member
            headers.forEach((h, ci) => {
                const members = [];
                rowData.forEach((row, ri) => {
                    if (row[ci] === '1') {
                        members.push(ids[ri].sample || ids[ri].group || ('Item ' + (ri + 1)));
                    }
                });
                if (members.length > 0) sets[h] = members;
            });
            return { format: 'binary', sets };
        } else {
            // Group-based: Group column = set name, items = Sample/row IDs
            ids.forEach((id, ri) => {
                const setName = id.group || 'Set 1';
                const itemId = id.sample || ('Item ' + (ri + 1));
                if (!sets[setName]) sets[setName] = [];
                sets[setName].push(itemId);
            });
            return { format: 'group', sets };
        }
    }

    getOncoPrintData() {
        // Returns { colLabels: [sample names], rowLabels: [gene names], matrix: [[category strings]] }
        const colLabels = [];
        this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)').forEach(th => {
            const clone = th.cloneNode(true);
            const btn = clone.querySelector('.th-delete-btn');
            if (btn) btn.remove();
            colLabels.push(clone.textContent.trim() || 'Unnamed');
        });

        const rows = this.tbody.querySelectorAll('tr:not(.row-disabled)');
        const matrix = [];
        const rowLabels = [];

        rows.forEach((row, ri) => {
            const idCells = row.querySelectorAll('td.id-cell');
            const groupVal = idCells[0] ? idCells[0].textContent.trim() : '';
            const sampleVal = idCells[1] ? idCells[1].textContent.trim() : '';
            const dataCells = row.querySelectorAll('td:not(.id-cell):not(.row-delete-cell):not(.row-toggle-cell)');
            const rowData = [];
            let hasAny = false;
            for (let c = 0; c < dataCells.length; c++) {
                const v = dataCells[c].textContent.trim();
                rowData.push(v);
                if (v) hasAny = true;
            }
            if (hasAny) {
                matrix.push(rowData);
                rowLabels.push(sampleVal || groupVal || ('Row ' + (ri + 1)));
            }
        });

        return { colLabels, rowLabels, matrix };
    }

    loadOncoPrintSampleData(index = 0) {
        const datasets = [
            { // Genomic alteration landscape
                headers: ['Sample1','Sample2','Sample3','Sample4','Sample5','Sample6','Sample7','Sample8','Sample9','Sample10'],
                ids: [
                    ['','TP53'],['','KRAS'],['','PIK3CA'],['','BRAF'],['','EGFR'],['','PTEN'],['','APC'],['','CDKN2A']
                ],
                rows: [
                    ['missense','','nonsense','missense','','missense','','frameshift','missense',''],
                    ['','missense','','','missense','missense','','','','missense'],
                    ['missense','','','missense','','','amplification','','missense',''],
                    ['','','missense','','','','','missense','',''],
                    ['','amplification','','','deletion','','missense','','amplification',''],
                    ['deletion','','','deletion','','nonsense','','deletion','',''],
                    ['','nonsense','frameshift','','nonsense','','frameshift','','','nonsense'],
                    ['','','deletion','','','deletion','','','deletion','deletion']
                ]
            },
            { // Drug response categories
                headers: ['Patient1','Patient2','Patient3','Patient4','Patient5','Patient6','Patient7','Patient8'],
                ids: [
                    ['','DrugA'],['','DrugB'],['','DrugC'],['','DrugD'],['','DrugE']
                ],
                rows: [
                    ['positive','negative','positive','positive','negative','positive','negative','positive'],
                    ['negative','positive','positive','negative','positive','negative','positive','negative'],
                    ['positive','positive','negative','positive','','positive','negative',''],
                    ['','negative','positive','','negative','','positive','negative'],
                    ['positive','','negative','positive','positive','negative','','positive']
                ]
            },
            { // Protein expression levels
                headers: ['S1','S2','S3','S4','S5','S6','S7','S8','S9','S10','S11','S12'],
                ids: [
                    ['','CD4'],['','CD8'],['','PD-L1'],['','Ki67'],['','HER2'],['','ER']
                ],
                rows: [
                    ['present','absent','present','present','absent','present','absent','present','absent','present','present','absent'],
                    ['absent','present','present','absent','present','absent','present','present','absent','absent','present','present'],
                    ['present','present','absent','present','absent','absent','present','absent','present','present','absent','present'],
                    ['present','absent','present','absent','present','present','absent','present','present','absent','present','absent'],
                    ['absent','present','absent','present','absent','present','present','absent','absent','present','absent','present'],
                    ['present','present','present','absent','absent','present','absent','present','present','absent','present','absent']
                ]
            },
            { // Multi-alteration per cell
                headers: ['S1','S2','S3','S4','S5','S6','S7','S8'],
                ids: [
                    ['','TP53'],['','BRCA1'],['','MYC'],['','RB1']
                ],
                rows: [
                    ['missense;amplification','nonsense','','missense','deletion','frameshift;deletion','','missense'],
                    ['','missense','amplification','','missense;deletion','','nonsense',''],
                    ['amplification','','amplification','amplification','','amplification','','amplification;deletion'],
                    ['deletion','','','deletion;frameshift','','','deletion','']
                ]
            }
        ];
        const d = datasets[index % datasets.length];
        this.setupTable(d.headers, Math.max(d.rows.length + 2, 10), d.rows, d.ids);
        if (window.app) window.app.updateGraph();
    }

    loadVennSampleData(index = 0) {
        const datasets = [
            { // Binary matrix: 3 pathways (Venn)
                headers: ['Pathway A', 'Pathway B', 'Pathway C'],
                ids: [['','Gene1'],['','Gene2'],['','Gene3'],['','Gene4'],['','Gene5'],
                      ['','Gene6'],['','Gene7'],['','Gene8'],['','Gene9'],['','Gene10'],
                      ['','Gene11'],['','Gene12'],['','Gene13'],['','Gene14'],['','Gene15'],
                      ['','Gene16'],['','Gene17'],['','Gene18'],['','Gene19'],['','Gene20']],
                rows: [[1,1,0],[1,0,0],[0,1,1],[1,1,1],[0,0,1],
                       [1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],
                       [0,1,0],[1,0,0],[0,1,1],[0,0,1],[1,1,0],
                       [1,0,0],[0,1,0],[0,0,1],[1,1,1],[0,1,0]]
            },
            { // Group-based: cell types in tissues (3 sets, Venn)
                headers: ['Present'],
                ids: [['Blood','T-cell'],['Blood','B-cell'],['Blood','NK-cell'],['Blood','Monocyte'],['Blood','Neutrophil'],
                      ['Spleen','T-cell'],['Spleen','B-cell'],['Spleen','Macrophage'],['Spleen','DC'],
                      ['Lymph Node','T-cell'],['Lymph Node','B-cell'],['Lymph Node','DC'],['Lymph Node','FDC'],
                      ['Blood','Platelet'],['Spleen','NK-cell'],['Lymph Node','NK-cell']],
                rows: [[1],[1],[1],[1],[1],[1],[1],[1],[1],[1],[1],[1],[1],[1],[1],[1]]
            },
            { // Binary matrix: 5 sets (UpSet)
                headers: ['Set A', 'Set B', 'Set C', 'Set D', 'Set E'],
                ids: [['','I1'],['','I2'],['','I3'],['','I4'],['','I5'],
                      ['','I6'],['','I7'],['','I8'],['','I9'],['','I10'],
                      ['','I11'],['','I12'],['','I13'],['','I14'],['','I15'],
                      ['','I16'],['','I17'],['','I18'],['','I19'],['','I20'],
                      ['','I21'],['','I22'],['','I23'],['','I24'],['','I25']],
                rows: [[1,1,0,0,0],[1,0,1,0,0],[0,1,1,0,0],[1,1,1,0,0],[0,0,0,1,1],
                       [1,0,0,1,0],[0,1,0,0,1],[1,0,0,0,1],[0,0,1,1,0],[1,1,0,1,0],
                       [0,0,0,0,1],[1,0,0,0,0],[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0],
                       [1,1,0,0,1],[0,0,1,1,1],[1,0,1,0,1],[0,1,0,1,0],[1,0,0,1,1],
                       [0,0,1,0,1],[1,1,1,1,0],[0,1,1,1,1],[1,0,0,0,0],[0,0,1,0,0]]
            },
            { // Binary matrix: 2 sets (simple Venn)
                headers: ['Upregulated', 'Downregulated'],
                ids: [['','Gene1'],['','Gene2'],['','Gene3'],['','Gene4'],['','Gene5'],
                      ['','Gene6'],['','Gene7'],['','Gene8'],['','Gene9'],['','Gene10'],
                      ['','Gene11'],['','Gene12'],['','Gene13'],['','Gene14'],['','Gene15']],
                rows: [[1,0],[1,0],[1,0],[1,1],[1,1],
                       [0,1],[0,1],[0,1],[1,0],[1,1],
                       [0,1],[1,0],[0,0],[1,0],[0,1]]
            }
        ];
        const d = datasets[index % datasets.length];
        this.setupTable(d.headers, Math.max(d.rows.length + 2, 10), d.rows, d.ids);
        if (window.app) window.app.updateGraph();
    }

    loadCorrelationSampleData(index = 0) {
        const datasets = [
            { // 0: Protein vs mRNA — 2 groups, 3X + 3Y replicates, moderate correlation with scatter
                headers: ['mRNA_1', 'mRNA_2', 'mRNA_3', 'Protein_1', 'Protein_2', 'Protein_3'],
                ids: [
                    ['WT','Gene1'],['WT','Gene2'],['WT','Gene3'],['WT','Gene4'],['WT','Gene5'],['WT','Gene6'],['WT','Gene7'],['WT','Gene8'],
                    ['KO','Gene1'],['KO','Gene2'],['KO','Gene3'],['KO','Gene4'],['KO','Gene5'],['KO','Gene6'],['KO','Gene7'],['KO','Gene8']
                ],
                rows: [
                    [2.1,2.5,1.7, 18,12,16], [4.5,3.8,5.2, 28,35,24], [6.1,5.4,6.8, 52,41,48],
                    [3.2,3.9,2.7, 26,19,30], [7.8,7.1,8.5, 55,68,60], [5.4,4.8,6.0, 35,44,38],
                    [1.5,2.1,1.0, 14,8,18], [8.5,7.9,9.2, 62,75,58],
                    [1.8,2.3,1.4, 6,12,9], [3.8,3.2,4.5, 14,20,17], [5.5,4.9,6.2, 32,24,29],
                    [2.5,3.1,1.9, 10,16,8], [7.2,6.5,7.8, 42,34,45], [4.8,4.2,5.5, 19,26,22],
                    [6.8,6.2,7.4, 30,38,33], [8.0,7.4,8.7, 48,38,52]
                ],
                assignments: { 0: 'X', 1: 'X', 2: 'X', 3: 'Y', 4: 'Y', 5: 'Y' }
            },
            { // 1: Drug dose vs response — 3 groups, non-linear (saturation curve), noisy
                headers: ['Dose', 'Response'],
                ids: [
                    ['DrugA','S1'],['DrugA','S2'],['DrugA','S3'],['DrugA','S4'],['DrugA','S5'],['DrugA','S6'],['DrugA','S7'],['DrugA','S8'],
                    ['DrugB','S1'],['DrugB','S2'],['DrugB','S3'],['DrugB','S4'],['DrugB','S5'],['DrugB','S6'],['DrugB','S7'],['DrugB','S8'],
                    ['Placebo','S1'],['Placebo','S2'],['Placebo','S3'],['Placebo','S4'],['Placebo','S5'],['Placebo','S6'],['Placebo','S7'],['Placebo','S8']
                ],
                rows: [
                    [1,15],[5,38],[10,52],[20,68],[50,82],[100,88],[2,22],[8,44],
                    [1,10],[5,18],[10,35],[20,48],[50,62],[100,70],[2,14],[8,28],
                    [1,8],[5,6],[10,12],[20,9],[50,14],[100,11],[2,5],[8,10]
                ],
                assignments: { 0: 'X', 1: 'Y' }
            },
            { // 2: Height vs Weight — 2 groups, realistic scatter
                headers: ['Height_cm', 'Weight_kg'],
                ids: [
                    ['Male','P1'],['Male','P2'],['Male','P3'],['Male','P4'],['Male','P5'],['Male','P6'],['Male','P7'],['Male','P8'],['Male','P9'],['Male','P10'],
                    ['Female','P1'],['Female','P2'],['Female','P3'],['Female','P4'],['Female','P5'],['Female','P6'],['Female','P7'],['Female','P8'],['Female','P9'],['Female','P10']
                ],
                rows: [
                    [170,72],[175,68],[180,85],[168,63],[185,95],[178,74],[172,78],[182,80],[176,71],[169,66],
                    [158,55],[162,51],[168,66],[155,48],[172,70],[165,53],[160,58],[170,62],[157,50],[163,57]
                ],
                assignments: { 0: 'X', 1: 'Y' }
            },
            { // 3: Study hours vs Score — weak/noisy positive correlation, single group
                headers: ['Hours', 'Score'],
                ids: [
                    ['','S1'],['','S2'],['','S3'],['','S4'],['','S5'],['','S6'],['','S7'],['','S8'],['','S9'],['','S10'],
                    ['','S11'],['','S12'],['','S13'],['','S14'],['','S15'],['','S16'],['','S17'],['','S18'],['','S19'],['','S20']
                ],
                rows: [
                    [2,58],[4,55],[6,72],[1,42],[8,70],[3,61],[5,48],[7,78],[2,65],[9,74],
                    [4,52],[6,66],[1,38],[10,80],[3,68],[5,59],[7,62],[8,85],[1,55],[6,60]
                ],
                assignments: { 0: 'X', 1: 'Y' }
            },
            { // 4: Age vs Biomarker — 3 groups, different slopes per group
                headers: ['Age', 'Biomarker'],
                ids: [
                    ['Healthy','P1'],['Healthy','P2'],['Healthy','P3'],['Healthy','P4'],['Healthy','P5'],['Healthy','P6'],['Healthy','P7'],['Healthy','P8'],
                    ['Disease','P1'],['Disease','P2'],['Disease','P3'],['Disease','P4'],['Disease','P5'],['Disease','P6'],['Disease','P7'],['Disease','P8'],
                    ['Treated','P1'],['Treated','P2'],['Treated','P3'],['Treated','P4'],['Treated','P5'],['Treated','P6'],['Treated','P7'],['Treated','P8']
                ],
                rows: [
                    [25,12],[35,15],[45,18],[55,22],[65,28],[30,14],[50,20],[60,25],
                    [25,22],[35,35],[45,52],[55,68],[65,88],[30,28],[50,58],[60,75],
                    [25,16],[35,20],[45,28],[55,32],[65,40],[30,18],[50,26],[60,35]
                ],
                assignments: { 0: 'X', 1: 'Y' }
            }
        ];
        const d = datasets[index % datasets.length];
        this._axisAssignments = { ...d.assignments };
        this.setupTable(d.headers, Math.max(d.rows.length + 2, 10), d.rows, d.ids);
        // Rebuild axis assignment row if visible
        if (document.getElementById('axisAssignmentRow')?.style.display !== 'none') {
            this._rebuildAxisAssignmentCells();
        }
        if (window.app) window.app.updateGraph();
    }

    getKaplanMeierData() {
        // Expects table format: Group | Sample | Time | Event (1=event, 0=censored)
        const rows = this.tbody.querySelectorAll('tr:not(.row-disabled)');
        const subjects = [];
        rows.forEach(row => {
            const idCells = row.querySelectorAll('td.id-cell');
            const group = idCells[0] ? idCells[0].textContent.trim() : '';
            const dataCells = row.querySelectorAll('td:not(.id-cell):not(.row-delete-cell):not(.row-toggle-cell)');
            const time = dataCells[0] ? parseFloat(dataCells[0].textContent.trim()) : NaN;
            const event = dataCells[1] ? parseInt(dataCells[1].textContent.trim()) : NaN;
            if (!isNaN(time) && !isNaN(event) && group) {
                subjects.push({ group, time, event: event === 1 ? 1 : 0 });
            }
        });
        if (subjects.length === 0) return null;
        const groups = [...new Set(subjects.map(s => s.group))];
        return { groups, subjects };
    }

    loadKaplanMeierSampleData(index = 0) {
        const datasets = [
            {
                headers: ['Time', 'Event'],
                ids: [
                    ['Treatment','P1'],['Treatment','P2'],['Treatment','P3'],['Treatment','P4'],['Treatment','P5'],
                    ['Treatment','P6'],['Treatment','P7'],['Treatment','P8'],['Treatment','P9'],['Treatment','P10'],
                    ['Treatment','P11'],['Treatment','P12'],['Treatment','P13'],['Treatment','P14'],['Treatment','P15'],
                    ['Control','C1'],['Control','C2'],['Control','C3'],['Control','C4'],['Control','C5'],
                    ['Control','C6'],['Control','C7'],['Control','C8'],['Control','C9'],['Control','C10'],
                    ['Control','C11'],['Control','C12'],['Control','C13'],['Control','C14'],['Control','C15']
                ],
                rows: [
                    ['6','1'],['9','1'],['10','0'],['11','1'],['14','1'],
                    ['18','0'],['21','1'],['24','0'],['27','1'],['30','0'],
                    ['32','1'],['36','0'],['40','0'],['42','1'],['48','0'],
                    ['3','1'],['5','1'],['6','1'],['8','1'],['9','0'],
                    ['11','1'],['12','1'],['14','0'],['16','1'],['18','1'],
                    ['20','0'],['22','1'],['24','1'],['26','0'],['28','1']
                ]
            }
        ];
        const d = datasets[index % datasets.length];
        this.setupTable(d.headers, Math.max(d.rows.length + 2, 10), d.rows, d.ids);
        if (window.app) window.app.updateGraph();
    }
}
