// export.js - Graph export functionality (PNG and SVG)

class ExportManager {
    constructor(graphRenderer) {
        this.graphRenderer = graphRenderer;
    }

    exportPNG(filename = 'graph.png') {
        const svgEl = this.graphRenderer.getSvgElement();
        if (!svgEl) {
            alert('No graph to export. Please enter data first.');
            return;
        }

        // Clone the SVG and inline all computed styles
        const cloned = svgEl.cloneNode(true);
        this._inlineStyles(svgEl, cloned);

        const svgData = new XMLSerializer().serializeToString(cloned);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        const scaleEl = document.getElementById('pngScale');
        const scale = scaleEl ? parseInt(scaleEl.value) || 2 : 2;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = svgEl.getAttribute('width') * scale;
            canvas.height = svgEl.getAttribute('height') * scale;

            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0);

            URL.revokeObjectURL(url);

            canvas.toBlob(blob => {
                this._downloadBlob(blob, filename);
            }, 'image/png');
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            // Fallback: try html2canvas if available
            if (typeof html2canvas !== 'undefined') {
                this._fallbackPNG(filename);
            } else {
                alert('Failed to export PNG. Please try SVG export instead.');
            }
        };

        img.src = url;
    }

    exportSVG(filename = 'graph.svg') {
        const svgEl = this.graphRenderer.getSvgElement();
        if (!svgEl) {
            alert('No graph to export. Please enter data first.');
            return;
        }

        // Clone and inline styles for standalone SVG
        const cloned = svgEl.cloneNode(true);
        this._inlineStyles(svgEl, cloned);

        // Add XML namespace
        cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        cloned.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

        // Add white background rect
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('width', '100%');
        bg.setAttribute('height', '100%');
        bg.setAttribute('fill', 'white');
        cloned.insertBefore(bg, cloned.firstChild);

        const svgData = new XMLSerializer().serializeToString(cloned);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        this._downloadBlob(blob, filename);
    }

    copyToClipboard(buttonEl) {
        const svgEl = this.graphRenderer.getSvgElement();
        if (!svgEl) {
            alert('No graph to copy. Please enter data first.');
            return;
        }

        if (!navigator.clipboard || !navigator.clipboard.write) {
            alert('Clipboard API not available. This feature requires HTTPS or localhost.');
            return;
        }

        // Clone the SVG and inline styles
        const cloned = svgEl.cloneNode(true);
        this._inlineStyles(svgEl, cloned);

        // Add white background
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('width', '100%');
        bg.setAttribute('height', '100%');
        bg.setAttribute('fill', 'white');
        cloned.insertBefore(bg, cloned.firstChild);

        cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        const svgData = new XMLSerializer().serializeToString(cloned);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        const scale = 2;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = svgEl.getAttribute('width') * scale;
            canvas.height = svgEl.getAttribute('height') * scale;

            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0);

            URL.revokeObjectURL(url);

            canvas.toBlob(blob => {
                navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]).then(() => {
                    // Visual feedback
                    if (buttonEl) {
                        const orig = buttonEl.textContent;
                        buttonEl.textContent = 'Copied!';
                        buttonEl.style.backgroundColor = '#27ae60';
                        setTimeout(() => {
                            buttonEl.textContent = orig;
                            buttonEl.style.backgroundColor = '';
                        }, 1500);
                    }
                }).catch(err => {
                    alert('Failed to copy: ' + err.message);
                });
            }, 'image/png');
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            alert('Failed to render graph for clipboard.');
        };

        img.src = url;
    }

    _exportSvgEl(svgEl, format, filename) {
        const cloned = svgEl.cloneNode(true);
        this._inlineStyles(svgEl, cloned);

        if (format === 'svg') {
            cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            cloned.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('width', '100%');
            bg.setAttribute('height', '100%');
            bg.setAttribute('fill', 'white');
            cloned.insertBefore(bg, cloned.firstChild);
            const svgData = new XMLSerializer().serializeToString(cloned);
            const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            this._downloadBlob(blob, filename);
        } else {
            const svgData = new XMLSerializer().serializeToString(cloned);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            const img = new Image();
            const scaleEl = document.getElementById('pngScale');
            const scale = scaleEl ? parseInt(scaleEl.value) || 2 : 2;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = svgEl.getAttribute('width') * scale;
                canvas.height = svgEl.getAttribute('height') * scale;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.scale(scale, scale);
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
                canvas.toBlob(blob => { this._downloadBlob(blob, filename); }, 'image/png');
            };
            img.onerror = () => { URL.revokeObjectURL(url); alert('Failed to export PNG.'); };
            img.src = url;
        }
    }

    _fallbackPNG(filename) {
        const container = this.graphRenderer.container;
        html2canvas(container, {
            backgroundColor: '#ffffff',
            scale: 2
        }).then(canvas => {
            canvas.toBlob(blob => {
                this._downloadBlob(blob, filename);
            }, 'image/png');
        });
    }

    _inlineStyles(source, target) {
        const sourceChildren = source.childNodes;
        const targetChildren = target.childNodes;

        if (source.nodeType === Node.ELEMENT_NODE) {
            const computed = window.getComputedStyle(source);
            const important = [
                'font-family', 'font-size', 'font-weight', 'font-style',
                'fill', 'stroke', 'stroke-width', 'opacity',
                'text-anchor', 'dominant-baseline'
            ];

            important.forEach(prop => {
                const val = computed.getPropertyValue(prop);
                if (val) {
                    target.style.setProperty(prop, val);
                }
            });
        }

        for (let i = 0; i < sourceChildren.length; i++) {
            if (sourceChildren[i].nodeType === Node.ELEMENT_NODE) {
                this._inlineStyles(sourceChildren[i], targetChildren[i]);
            }
        }
    }

    _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}
