// table.js - Data table management

class DataTable {
    constructor(tableId, bodyId, headerRowId) {
        this.table = document.getElementById(tableId);
        this.tbody = document.getElementById(bodyId);
        this.headerRow = document.getElementById(headerRowId);
        this.numRows = 10; // Initial number of rows
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
        // Add × delete buttons inside each data th
        const headers = this.headerRow.querySelectorAll('th:not(.delete-col-header)');
        headers.forEach((th, idx) => {
            if (!th.querySelector('.th-delete-btn')) {
                const btn = document.createElement('button');
                btn.className = 'th-delete-btn';
                btn.textContent = '\u00d7';
                btn.title = 'Delete column';
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteColumn(idx);
                });
                th.appendChild(btn);
            }
        });

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

    loadSampleData() {
        // Load some sample data for testing
        const sampleData = [
            [5.2, 5.8, 4.9, 5.5, 6.1, 5.3, 5.7],
            [7.1, 6.8, 7.5, 7.2, 6.9, 7.4, 7.0],
            [4.5, 4.2, 4.8, 4.6, 4.3, 4.7, 4.4]
        ];

        const rows = this.tbody.querySelectorAll('tr');
        sampleData.forEach((colData, colIndex) => {
            colData.forEach((value, rowIndex) => {
                if (rows[rowIndex]) {
                    const cells = rows[rowIndex].querySelectorAll('td:not(.row-delete-cell)');
                    if (cells[colIndex]) {
                        cells[colIndex].textContent = value;
                    }
                }
            });
        });

        if (window.app) {
            window.app.updateGraph();
        }
    }
}
