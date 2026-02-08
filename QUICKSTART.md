# Quick Start Guide - Visualize Project

## What You Have
A fully structured web application project ready for development with Claude Code!

**Completed:**
- ✅ Complete HTML interface
- ✅ Professional CSS styling
- ✅ Data table management (table.js)
- ✅ Statistical calculations (stats.js)

**Still Needed (Use Claude Code for these):**
- ⏳ Graph rendering (graph.js)
- ⏳ Main app controller (app.js)
- ⏳ Export functionality (export.js)

## Immediate Next Steps

### 1. Copy Logo File
```bash
cd /Users/fredrikwermeling/Documents/graph\ app
cp "Visualize logo.png" visualize/assets/logo.png
```

### 2. Test the Structure Locally
```bash
cd visualize
python3 -m http.server 8000
# Open: http://localhost:8000
```
You'll see the interface, but graphs won't render yet (that's expected).

### 3. Use Claude Code to Build Core Features

Start Claude Code in your project:
```bash
cd /Users/fredrikwermeling/Documents/graph\ app/visualize
claude-code
```

Then tell Claude Code:

#### First Priority: Graph Rendering
```
Create js/graph.js with a GraphRenderer class. It should use D3.js to render 
column graphs showing individual data points with mean lines. Take data from 
the DataTable.getData() method and render into #graphContainer. Support the 
graph dimensions and styling options from the HTML controls.
```

#### Second Priority: App Controller
```
Create js/app.js to coordinate everything. Initialize DataTable and GraphRenderer, 
wire up all event listeners from the HTML controls, and make sure the graph updates 
when data or settings change.
```

#### Third Priority: Export
```
Create js/export.js to export graphs as PNG (using html2canvas) and SVG. 
Wire up the export buttons to download files with the current graph exactly 
as shown on screen.
```

### 4. Push to GitHub

Once basic functionality works:
```bash
git init
git add .
git commit -m "Initial commit with core functionality"
git remote add origin https://github.com/fredrikwermeling/Visualize.git
git branch -M main
git push -u origin main
```

### 5. Enable GitHub Pages
1. Go to: https://github.com/fredrikwermeling/Visualize/settings/pages
2. Source: Deploy from branch
3. Branch: main / (root)
4. Save

Your site will be live at: `https://fredrikwermeling.github.io/Visualize/`

## File Overview

```
visualize/
├── index.html              # Complete UI structure ✅
├── css/
│   └── styles.css         # All styling ✅
├── js/
│   ├── table.js           # Data input ✅
│   ├── stats.js           # Statistics ✅
│   ├── graph.js           # Graph rendering ⏳ (NEXT)
│   ├── app.js             # Main controller ⏳ (NEXT)
│   └── export.js          # Export ⏳ (NEXT)
├── assets/
│   └── logo.png           # Your logo (copy here)
├── README.md              # Project info
├── SETUP.md               # Detailed setup
├── TASKS.md               # Full task list
└── PROJECT_PLAN.md        # Development plan
```

## Testing Your Progress

After each Claude Code session:
1. Refresh browser (Cmd+R)
2. Open console (Cmd+Option+J)
3. Check for errors
4. Test features incrementally

## Development Workflow

1. **Think** → Review TASKS.md for what to build next
2. **Build** → Use Claude Code with specific prompts
3. **Test** → Check in browser locally
4. **Commit** → `git commit -am "Added [feature]"`
5. **Push** → `git push` (updates live site)
6. **Iterate** → Get feedback, repeat

## Key Commands for Claude Code

Once you're in the claude-code session, you can say:

- "Show me what files exist"
- "Read the PROJECT_PLAN.md file"
- "Create graph.js following the spec in TASKS.md"
- "Add error handling to the DataTable class"
- "Fix the bug where [describe issue]"
- "Add comments to explain [function]"
- "Make the export button actually work"

## Pro Tips

1. **Work incrementally** - Get one graph type perfect before adding others
2. **Test early, test often** - Check each feature immediately
3. **Use sample data** - Add a "Load Sample Data" button for testing
4. **Check TASKS.md** - It has detailed acceptance criteria
5. **Commit frequently** - Small commits are easier to debug

## If You Get Stuck

1. Check browser console for JavaScript errors
2. Verify D3.js and jStat are loading (check Network tab)
3. Test with simple data first
4. Use console.log() to debug data flow
5. Ask Claude Code: "Debug why [feature] isn't working"

## Resources

- **Your Documentation**: Check TASKS.md, SETUP.md, PROJECT_PLAN.md
- **D3.js Examples**: https://observablehq.com/@d3/gallery
- **Reference Styles**: Review your PowerPoint slides

## Success Metrics

You'll know it's working when:
- ✅ You can enter data in the table
- ✅ Graph renders with your data
- ✅ Controls update the graph in real-time
- ✅ Statistics calculate correctly
- ✅ Export creates usable images
- ✅ It looks professional

---

**Ready to start?** Begin with copying the logo and testing locally, then use Claude Code to build graph.js!
