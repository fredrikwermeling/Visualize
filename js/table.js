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
        for (let j = 0; j < numCols; j++) {
            const cell = document.createElement('td');
            cell.contentEditable = true;
            cell.textContent = '';
            cell.addEventListener('blur', (e) => {
                this.validateCell(e.target);
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
        // Count only data th's (not the delete-col-header)
        return this.headerRow.querySelectorAll('th:not(.delete-col-header)').length;
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

        // Remove header (recalculate actual th elements)
        const headers = this.headerRow.querySelectorAll('th:not(.delete-col-header)');
        if (headers[colIndex]) {
            headers[colIndex].remove();
        }

        // Remove corresponding td from each body row
        const rows = this.tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td:not(.row-delete-cell)');
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
        const headers = this.headerRow.querySelectorAll('th:not(.delete-col-header)');
        headers.forEach((th, idx) => {
            const btn = th.querySelector('.th-delete-btn');
            if (btn) {
                // Replace to remove old listener
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
        this.table.addEventListener('keydown', (e) => {
            const cell = e.target;
            if (!cell.matches('td[contenteditable], th[contenteditable]')) return;

            const row = cell.parentElement;
            // Get only data cells for this row (exclude delete cells/headers)
            const dataCells = row.tagName === 'TR'
                ? Array.from(row.querySelectorAll('td:not(.row-delete-cell)'))
                : Array.from(row.querySelectorAll('th:not(.delete-col-header)'));
            const colIndex = dataCells.indexOf(cell);
            const numCols = dataCells.length;

            // Build navigable grid: header row + body rows
            const allRows = [this.headerRow, ...this.tbody.querySelectorAll('tr')];
            const rowIndex = allRows.indexOf(row);

            const focusCell = (r, c) => {
                if (r < 0 || r >= allRows.length) return;
                const targetRow = allRows[r];
                const targetCells = targetRow.tagName === 'TR'
                    ? targetRow.querySelectorAll('td:not(.row-delete-cell)')
                    : targetRow.querySelectorAll('th:not(.delete-col-header)');
                const targetCell = targetCells[c];
                if (targetCell) {
                    targetCell.focus();
                    const sel = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(targetCell);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            };

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    focusCell(rowIndex - 1, colIndex);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    focusCell(rowIndex + 1, colIndex);
                    break;
                case 'Enter':
                    e.preventDefault();
                    focusCell(rowIndex + 1, colIndex);
                    break;
                case 'ArrowLeft': {
                    const sel = window.getSelection();
                    if (sel.rangeCount && sel.getRangeAt(0).startOffset === 0 && sel.isCollapsed) {
                        e.preventDefault();
                        focusCell(rowIndex, colIndex - 1);
                    }
                    break;
                }
                case 'ArrowRight': {
                    const sel = window.getSelection();
                    const textLen = cell.textContent.length;
                    if (sel.rangeCount && sel.getRangeAt(0).endOffset >= textLen && sel.isCollapsed) {
                        e.preventDefault();
                        focusCell(rowIndex, colIndex + 1);
                    }
                    break;
                }
                case 'Tab': {
                    e.preventDefault();
                    if (e.shiftKey) {
                        if (colIndex > 0) {
                            focusCell(rowIndex, colIndex - 1);
                        } else if (rowIndex > 0) {
                            const prevCells = allRows[rowIndex - 1].tagName === 'TR'
                                ? allRows[rowIndex - 1].querySelectorAll('td:not(.row-delete-cell)')
                                : allRows[rowIndex - 1].querySelectorAll('th:not(.delete-col-header)');
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

            // Resize table to match pasted data
            // Set headers
            const existingHeaders = this.headerRow.querySelectorAll('th:not(.delete-col-header)');
            const delColHeader = this.headerRow.querySelector('.delete-col-header');

            // Remove existing data headers
            existingHeaders.forEach(h => h.remove());

            // Create new headers
            for (let c = 0; c < numCols; c++) {
                const th = document.createElement('th');
                th.contentEditable = true;
                th.textContent = headerLabels[c] || `Group ${c + 1}`;
                if (delColHeader) {
                    this.headerRow.insertBefore(th, delColHeader);
                } else {
                    this.headerRow.appendChild(th);
                }
            }

            // Ensure we have enough rows
            const neededRows = Math.max(dataRows.length, 1);
            this.numRows = neededRows;
            this.tbody.innerHTML = '';
            for (let r = 0; r < neededRows; r++) {
                const row = this._createRow(numCols);
                this.tbody.appendChild(row);
            }

            // Fill in data
            const bodyRows = this.tbody.querySelectorAll('tr');
            dataRows.forEach((rowData, r) => {
                if (r >= bodyRows.length) return;
                const cells = bodyRows[r].querySelectorAll('td:not(.row-delete-cell)');
                rowData.forEach((val, c) => {
                    if (c < cells.length) {
                        cells[c].textContent = val;
                    }
                });
            });

            // Rebuild delete buttons and update
            this.headerRow.querySelectorAll('th:not(.delete-col-header) .th-delete-btn').forEach(b => b.remove());
            this._addDeleteColumnHeaders();
            this._updateDeleteButtonVisibility();
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
        const cells = this.tbody.querySelectorAll('td:not(.row-delete-cell)');
        cells.forEach(cell => {
            cell.textContent = '';
        });
        
        if (window.app) {
            window.app.updateGraph();
        }
    }

    getData() {
        const data = [];
        const headers = [];

        // Get headers (data columns only)
        const headerCells = this.headerRow.querySelectorAll('th:not(.delete-col-header)');
        headerCells.forEach(th => {
            // Get only text content, not the button text
            const clone = th.cloneNode(true);
            const btn = clone.querySelector('.th-delete-btn');
            if (btn) btn.remove();
            headers.push(clone.textContent.trim() || 'Unnamed');
        });

        // Get data for each column
        for (let colIndex = 0; colIndex < headers.length; colIndex++) {
            const columnData = [];
            const rows = this.tbody.querySelectorAll('tr');

            rows.forEach(row => {
                const cells = row.querySelectorAll('td:not(.row-delete-cell)');
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
        const allColLabels = [];
        const headerCells = this.headerRow.querySelectorAll('th:not(.delete-col-header)');
        headerCells.forEach(th => {
            const clone = th.cloneNode(true);
            const btn = clone.querySelector('.th-delete-btn');
            if (btn) btn.remove();
            allColLabels.push(clone.textContent.trim() || 'Unnamed');
        });

        // First pass: check if first column is text (row labels)
        const rows = this.tbody.querySelectorAll('tr');
        let firstColTextCount = 0;
        let firstColNumCount = 0;
        rows.forEach(row => {
            const cells = row.querySelectorAll('td:not(.row-delete-cell)');
            if (cells.length === 0) return;
            const val = cells[0].textContent.trim();
            if (val === '') return;
            if (isNaN(parseFloat(val))) firstColTextCount++;
            else firstColNumCount++;
        });

        const firstColIsLabels = firstColTextCount > 0 && firstColTextCount >= firstColNumCount;
        const dataColStart = firstColIsLabels ? 1 : 0;
        const colLabels = firstColIsLabels ? allColLabels.slice(1) : allColLabels;

        const matrix = [];
        const rowLabels = [];
        let rowNum = 1;

        rows.forEach(row => {
            const cells = row.querySelectorAll('td:not(.row-delete-cell)');
            const rowData = [];
            let hasAny = false;
            for (let c = dataColStart; c < cells.length; c++) {
                const value = cells[c].textContent.trim();
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
                if (firstColIsLabels && cells.length > 0) {
                    const label = cells[0].textContent.trim();
                    rowLabels.push(label || 'Row ' + rowNum);
                } else {
                    rowLabels.push('Row ' + rowNum);
                }
            }
            rowNum++;
        });

        return { colLabels, rowLabels, matrix };
    }

    setupTable(headers, numRows, rowData) {
        // Rebuild headers
        const existingHeaders = this.headerRow.querySelectorAll('th:not(.delete-col-header)');
        const delColHeader = this.headerRow.querySelector('.delete-col-header');
        existingHeaders.forEach(h => h.remove());

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

        // Fill data: rowData is array of arrays, each inner array = one row's cell values
        if (rowData) {
            const bodyRows = this.tbody.querySelectorAll('tr');
            rowData.forEach((rd, r) => {
                if (r >= bodyRows.length) return;
                const cells = bodyRows[r].querySelectorAll('td:not(.row-delete-cell)');
                rd.forEach((val, c) => {
                    if (c < cells.length) cells[c].textContent = val;
                });
            });
        }

        this._addDeleteColumnHeaders();
        this._updateDeleteButtonVisibility();
        this.setupHeaderEditing();
    }

    loadSampleData() {
        const headers = ['Group 1', 'Group 2', 'Group 3'];
        // Column-oriented sample data transposed to row-oriented
        const rowData = [
            [5.2, 7.1, 4.5],
            [5.8, 6.8, 4.2],
            [4.9, 7.5, 4.8],
            [5.5, 7.2, 4.6],
            [6.1, 6.9, 4.3],
            [5.3, 7.4, 4.7],
            [5.7, 7.0, 4.4]
        ];
        this.setupTable(headers, 10, rowData);

        if (window.app) {
            window.app.updateGraph();
        }
    }

    loadHeatmapSampleData() {
        const headers = ['Row ID', 'Condition A', 'Condition B', 'Condition C', 'Condition D'];
        const rowLabels = ['Gene A', 'Gene B', 'Gene C', 'Gene D', 'Gene E', 'Gene F', 'Gene G', 'Gene H'];
        const rowData = [
            ['Gene A', 2.1, 5.4, 1.8, 4.2],
            ['Gene B', 8.3, 3.1, 7.6, 2.9],
            ['Gene C', 1.5, 6.8, 3.2, 7.1],
            ['Gene D', 9.0, 2.4, 8.5, 1.6],
            ['Gene E', 4.7, 4.9, 5.1, 5.3],
            ['Gene F', 3.2, 8.7, 2.0, 9.1],
            ['Gene G', 6.5, 1.3, 7.9, 3.8],
            ['Gene H', 1.1, 7.2, 4.4, 6.6]
        ];
        this.setupTable(headers, 20, rowData);

        if (window.app) {
            window.app.updateGraph();
        }
    }
}
