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
        this.table.addEventListener('keydown', (e) => {
            const cell = e.target;
            if (!cell.matches('td[contenteditable], th[contenteditable]')) return;

            const row = cell.parentElement;
            // Get only data cells for this row (exclude delete cells/headers)
            const dataCells = row.tagName === 'TR'
                ? Array.from(row.querySelectorAll('td:not(.row-delete-cell):not(.row-toggle-cell):not(.id-cell)'))
                : Array.from(row.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)'));
            const colIndex = dataCells.indexOf(cell);
            const numCols = dataCells.length;

            // Build navigable grid: header row + body rows
            const allRows = [this.headerRow, ...this.tbody.querySelectorAll('tr')];
            const rowIndex = allRows.indexOf(row);

            const focusCell = (r, c) => {
                if (r < 0 || r >= allRows.length) return;
                const targetRow = allRows[r];
                const targetCells = targetRow.tagName === 'TR'
                    ? targetRow.querySelectorAll('td:not(.row-delete-cell):not(.row-toggle-cell):not(.id-cell)')
                    : targetRow.querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)');
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
                                ? allRows[rowIndex - 1].querySelectorAll('td:not(.row-delete-cell):not(.row-toggle-cell):not(.id-cell)')
                                : allRows[rowIndex - 1].querySelectorAll('th:not(.delete-col-header):not(.id-col):not(.row-toggle-col)');
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

            // In heatmap mode: detect first text column as Group ID
            // In column mode: no ID detection
            const isHeatmap = window.app && window.app.mode === 'heatmap';
            let groupColIdx = -1;
            if (isHeatmap && dataRows.length > 0) {
                let textCount = 0, numCount = 0;
                for (const row of dataRows) {
                    const v = (row[0] || '').trim();
                    if (v === '') continue;
                    if (isNaN(parseFloat(v))) textCount++;
                    else numCount++;
                }
                if (textCount > 0 && textCount >= numCount) groupColIdx = 0;
            }
            const idColCount = groupColIdx >= 0 ? 1 : 0;

            const dataColCount = numCols - idColCount;
            const dataHeaderLabels = hasHeader ? headerLabels.slice(idColCount) : Array.from({ length: dataColCount }, (_, i) => `Group ${i + 1}`);

            // Remove existing data headers (keep id-col)
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

            // Rebuild rows
            const neededRows = Math.max(dataRows.length, 1);
            this.numRows = neededRows;
            this.tbody.innerHTML = '';
            for (let r = 0; r < neededRows; r++) {
                const row = this._createRow(dataColCount);
                this.tbody.appendChild(row);
            }

            // Fill data
            const bodyRows = this.tbody.querySelectorAll('tr');
            dataRows.forEach((rowData, r) => {
                if (r >= bodyRows.length) return;
                // Fill Group ID cell if detected
                if (groupColIdx >= 0) {
                    const idCells = bodyRows[r].querySelectorAll('td.id-cell');
                    if (idCells[0]) idCells[0].textContent = rowData[0] || '';
                }
                // Fill data cells
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
}
