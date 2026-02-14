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
                ? Array.from(row.querySelectorAll('td:not(.row-delete-cell):not(.row-toggle-cell):not(.id-cell)'))
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
            const isHeatmap = window.app && window.app.mode === 'heatmap';
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
        headerCells.forEach(th => {
            const clone = th.cloneNode(true);
            const btn = clone.querySelector('.th-delete-btn');
            if (btn) btn.remove();
            headers.push(clone.textContent.trim() || 'Unnamed');
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

    exportRawCSV() {
        const headerCells = this.headerRow.querySelectorAll('th:not(.delete-col-header):not(.row-toggle-col)');
        const headers = [];
        headerCells.forEach(th => {
            const clone = th.cloneNode(true);
            const btn = clone.querySelector('.th-delete-btn');
            if (btn) btn.remove();
            headers.push(clone.textContent.trim());
        });

        const lines = [headers.join(',')];
        const rows = this.tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td:not(.row-delete-cell):not(.row-toggle-cell)');
            const vals = [];
            cells.forEach(td => vals.push(td.textContent.trim()));
            if (vals.some(v => v !== '')) lines.push(vals.join(','));
        });

        const csv = lines.join('\n');
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

    loadSampleData() {
        const headers = ['Control', 'Treatment A', 'Treatment B'];
        // Column-oriented sample data with realistic biological variability
        const rowData = [
            [4.2, 8.1, 6.7],
            [5.8, 6.3, 5.1],
            [3.6, 9.4, 7.8],
            [5.1, 7.7, 4.9],
            [6.4, 5.9, 8.3],
            [4.7, 8.8, 6.2],
            [3.9, 7.2, 5.5],
            [5.5, 10.1, 7.1],
            [4.3, 6.6, 9.0],
            [6.0, 8.5, 5.8]
        ];
        this.setupTable(headers, 12, rowData);

        if (window.app) {
            window.app.updateGraph();
        }
    }

    loadHeatmapSampleData() {
        const headers = ['CD14', 'CD101', 'CD124', 'CD45'];
        const idData = [
            ['ctrl', '1'], ['ctrl', '2'], ['ctrl', '3'],
            ['treat', '1'], ['treat', '2'], ['treat', '3']
        ];
        const rowData = [
            [12, 23, 67, 45],
            [14, 32, 64, 48],
            [11, 28, 71, 42],
            [31, 54, 34, 82],
            [28, 48, 38, 79],
            [33, 51, 31, 85]
        ];
        this.setupTable(headers, 10, rowData, idData);

        if (window.app) {
            window.app.updateGraph();
        }
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

    loadGrowthSampleData() {
        // 4 groups x 5 subjects x 6 timepoints — tumor growth data
        const headers = [
            'Time',
            'Vehicle_S1', 'Vehicle_S2', 'Vehicle_S3', 'Vehicle_S4', 'Vehicle_S5',
            'Low_S1', 'Low_S2', 'Low_S3', 'Low_S4', 'Low_S5',
            'Mid_S1', 'Mid_S2', 'Mid_S3', 'Mid_S4', 'Mid_S5',
            'High_S1', 'High_S2', 'High_S3', 'High_S4', 'High_S5'
        ];
        const rowData = [
            [0,  100,105,98,102,97,  100,103,99,101,96,  101,99,104,98,102,  100,97,103,101,99],
            [3,  145,152,138,148,142, 130,135,128,132,126, 118,122,115,120,117, 108,112,105,110,107],
            [7,  210,225,198,218,205, 175,182,168,178,170, 145,150,138,148,142, 120,128,115,122,118],
            [10, 310,335,290,320,300, 230,242,218,235,225, 175,185,165,180,172, 135,142,128,138,132],
            [14, 450,480,420,460,440, 300,315,285,305,290, 210,225,198,218,205, 148,155,140,150,145],
            [17, 620,660,580,640,600, 380,400,360,390,370, 245,260,230,252,240, 158,165,150,160,155]
        ];
        this.setupTable(headers, Math.max(rowData.length, 10), rowData);

        if (window.app) {
            window.app.updateGraph();
        }
    }
}
