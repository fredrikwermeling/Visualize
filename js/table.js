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
