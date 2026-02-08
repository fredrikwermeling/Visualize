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
        const numCols = this.headerRow.children.length;
        
        for (let i = 0; i < count; i++) {
            const row = document.createElement('tr');
            for (let j = 0; j < numCols; j++) {
                const cell = document.createElement('td');
                cell.contentEditable = true;
                cell.textContent = '';
                
                // Add input validation
                cell.addEventListener('blur', (e) => {
                    this.validateCell(e.target);
                });
                
                row.appendChild(cell);
            }
            this.tbody.appendChild(row);
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
            const isHeader = cell.tagName === 'TH';
            const colIndex = Array.from(row.children).indexOf(cell);
            const numCols = row.children.length;

            // Build navigable grid: header row + body rows
            const allRows = [this.headerRow, ...this.tbody.querySelectorAll('tr')];
            const rowIndex = allRows.indexOf(row);

            const focusCell = (r, c) => {
                if (r < 0 || r >= allRows.length) return;
                const targetRow = allRows[r];
                const targetCell = targetRow.children[c];
                if (targetCell) {
                    targetCell.focus();
                    // Select all content for easy overwriting
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
                        // Move left, wrap to previous row
                        if (colIndex > 0) {
                            focusCell(rowIndex, colIndex - 1);
                        } else if (rowIndex > 0) {
                            focusCell(rowIndex - 1, numCols - 1);
                        }
                    } else {
                        // Move right, wrap to next row
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
        // Add header
        const newHeader = document.createElement('th');
        newHeader.contentEditable = true;
        newHeader.textContent = `Group ${this.headerRow.children.length + 1}`;
        this.headerRow.appendChild(newHeader);
        
        // Add cells to each row
        const rows = this.tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cell = document.createElement('td');
            cell.contentEditable = true;
            cell.textContent = '';
            cell.addEventListener('blur', (e) => {
                this.validateCell(e.target);
            });
            row.appendChild(cell);
        });
        
        if (window.app) {
            window.app.updateGraph();
        }
    }

    addRow() {
        this.numRows++;
        const numCols = this.headerRow.children.length;
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
        
        this.tbody.appendChild(row);
    }

    clearData() {
        const cells = this.tbody.querySelectorAll('td');
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
        
        // Get headers
        const headerCells = this.headerRow.querySelectorAll('th');
        headerCells.forEach(th => {
            headers.push(th.textContent.trim() || 'Unnamed');
        });
        
        // Get data for each column
        for (let colIndex = 0; colIndex < headers.length; colIndex++) {
            const columnData = [];
            const rows = this.tbody.querySelectorAll('tr');
            
            rows.forEach(row => {
                const cell = row.children[colIndex];
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
                if (rows[rowIndex] && rows[rowIndex].children[colIndex]) {
                    rows[rowIndex].children[colIndex].textContent = value;
                }
            });
        });
        
        if (window.app) {
            window.app.updateGraph();
        }
    }
}
