# Claude Code Setup Instructions

## Prerequisites
- Git installed
- GitHub account configured
- Claude Code installed
- Web browser

## Initial Setup Steps

### 1. Navigate to Project Directory
```bash
cd /Users/fredrikwermeling/Documents/graph\ app
```

### 2. Copy Logo File
The logo file should be placed in the assets folder:
```bash
# From your Documents/graph app directory
cp "Visualize logo.png" /path/to/visualize/assets/logo.png
```

### 3. Initialize Git Repository
```bash
cd /path/to/visualize
git init
git add .
git commit -m "Initial commit: Project structure and core files"
```

### 4. Create GitHub Repository
Go to https://github.com/new and create a new repository named "Visualize"

### 5. Connect to GitHub
```bash
git remote add origin https://github.com/fredrikwermeling/Visualize.git
git branch -M main
git push -u origin main
```

### 6. Enable GitHub Pages
1. Go to repository Settings
2. Navigate to Pages
3. Select branch: main
4. Select folder: / (root)
5. Save

Your app will be live at: https://fredrikwermeling.github.io/Visualize/

## Local Development

### Testing Locally
```bash
# Simple Python HTTP server
python3 -m http.server 8000

# Or use any local server
# Then open: http://localhost:8000
```

### Making Changes
```bash
# Make your changes to files
git add .
git commit -m "Description of changes"
git push
```

## Using Claude Code

### Starting a Session
```bash
cd /Users/fredrikwermeling/Documents/graph\ app/visualize
claude-code
```

### Common Commands in Claude Code
- "Add a new feature to [file]"
- "Fix the bug in [component]"
- "Improve the styling of [element]"
- "Add error handling to [function]"
- "Create tests for [module]"

### File Structure You'll Work With
```
visualize/
├── index.html          # Main page structure
├── css/
│   └── styles.css      # All styling
├── js/
│   ├── app.js          # Main application (TO BE CREATED)
│   ├── table.js        # Data table management ✓
│   ├── graph.js        # Graph rendering (TO BE CREATED)
│   ├── stats.js        # Statistics ✓
│   └── export.js       # Export functionality (TO BE CREATED)
└── assets/
    └── logo.png        # Your logo
```

## Next Steps

### Immediate Tasks
1. ✅ Copy logo file to assets folder
2. ✅ Create remaining JavaScript modules (graph.js, export.js, app.js)
3. ✅ Test locally
4. ✅ Push to GitHub
5. ✅ Enable GitHub Pages
6. ✅ Test online version

### Development Workflow
1. Open Claude Code in the project directory
2. Describe what you want to add/change
3. Claude Code will modify the files
4. Test locally in browser
5. Commit and push changes
6. Check live site for updates

## Troubleshooting

### Logo Not Showing
- Check file path: should be `assets/logo.png`
- Verify file name matches exactly (case-sensitive)
- Check image format (PNG recommended)

### Graph Not Rendering
- Open browser console (F12) to check for errors
- Verify D3.js and jStat are loading from CDN
- Check that data is being parsed correctly

### GitHub Pages Not Updating
- Changes can take 1-2 minutes to deploy
- Clear browser cache
- Try incognito/private browsing mode

## Resources
- D3.js Documentation: https://d3js.org/
- jStat Documentation: https://jstat.github.io/
- GitHub Pages: https://pages.github.com/

## Contact
Fredrik Wermeling
For issues or questions about development
