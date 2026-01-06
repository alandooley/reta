---
name: monolith-navigation
description: "RETA-specific skill for navigating the 12,600-line index.html monolith. Use when working in the frontend. Contains line references, section maps, and search strategies."
---

# RETA Monolith Navigation Skill

## Core Principle

**The frontend is a 12,600-line single file. Navigate with grep, not scrolling.**

Never read the entire file. Search for specific functions, elements, or sections.

## File Structure Map

```
index.html (12,600+ lines)
├─── Lines 1-50:        HTML head, meta tags, script imports
├─── Lines 50-2420:     CSS styles (dark theme, responsive)
├─── Lines 2420-3630:   HTML body, auth gate, app structure
└─── Lines 3632-12664:  JavaScript (InjectionTracker class)
     ├─── Lines 3632-3700:   Constructor, state initialization
     ├─── Lines 3700-4500:   Core methods (saveData, loadData)
     ├─── Lines 4500-6000:   Injection CRUD operations
     ├─── Lines 6000-7500:   Vial CRUD operations
     ├─── Lines 7500-8500:   Weight CRUD operations
     ├─── Lines 8500-10000:  UI rendering methods
     ├─── Lines 10000-11000: Calculations (supply, metrics)
     ├─── Lines 11000-12000: Chart rendering (Chart.js)
     ├─── Lines 12000-12400: Cloud sync, backup methods
     └─── Lines 12400-12664: Initialization, event handlers
```

## Key Class: InjectionTracker

**Definition starts:** Line ~3632

**Core properties:**
```javascript
this.data = {
  injections: [],      // Array of injection records
  vials: [],           // Array of vial records  
  weights: [],         // Array of weight records
  settings: {},        // User settings
  deletedIds: {        // Pending deletions for sync
    injections: [],
    vials: [],
    weights: []
  }
};
```

## Navigation Strategies

### Finding a Function

```bash
# Search for function definition:
grep -n "addInjection" index.html | head -5

# Search for method in class:
grep -n "^\s*async\s*addInjection\|^\s*addInjection\s*(" index.html
```

### Finding HTML Elements

```bash
# Find element by ID:
grep -n 'id="injection-form"' index.html

# Find elements by class:
grep -n 'class=".*metric-card' index.html
```

### Finding CSS Styles

```bash
# Find style rule:
grep -n "\.injection-list" index.html

# Find all color definitions:
grep -n "color:" index.html | head -20
```

### Finding Event Handlers

```bash
# Find click handlers:
grep -n "addEventListener.*click" index.html

# Find form submissions:
grep -n "addEventListener.*submit" index.html
```

## Section Landmarks

Use these comments/patterns to navigate:

| Section | Search Pattern |
|---------|----------------|
| CSS Start | `<style>` |
| CSS End | `</style>` |
| Auth Gate | `id="auth-gate"` |
| Main App Container | `id="app"` |
| Injections Page | `id="injections-page"` |
| Vials Page | `id="vials-page"` |
| Weights Page | `id="weights-page"` |
| Results Page | `id="results-page"` |
| Settings Page | `id="settings-page"` |
| InjectionTracker Class | `class InjectionTracker` |
| Constructor | `constructor()` |
| Initialization | `new InjectionTracker()` |

## Key Methods Reference

### Data Operations

| Method | Purpose | Approx Line |
|--------|---------|-------------|
| `saveData()` | Persist to localStorage | ~3800 |
| `loadData()` | Load from localStorage | ~3850 |
| `renderData()` | Refresh all UI | ~8500 |

### Injection Operations

| Method | Purpose | Approx Line |
|--------|---------|-------------|
| `addInjection()` | Create new injection | ~4500 |
| `editInjection()` | Update injection | ~4700 |
| `deleteInjection()` | Remove injection | ~4900 |
| `renderInjections()` | Display injection list | ~8600 |

### Vial Operations

| Method | Purpose | Approx Line |
|--------|---------|-------------|
| `addVial()` | Create new vial | ~6000 |
| `editVial()` | Update vial | ~6200 |
| `deleteVial()` | Remove vial | ~6400 |
| `renderVials()` | Display vial list | ~8900 |

### Weight Operations

| Method | Purpose | Approx Line |
|--------|---------|-------------|
| `addWeight()` | Create weight entry | ~7500 |
| `editWeight()` | Update weight | ~7700 |
| `deleteWeight()` | Remove weight | ~7900 |
| `renderWeights()` | Display weight list | ~9200 |

### Calculations

| Method | Purpose | Approx Line |
|--------|---------|-------------|
| `calculateSupplyForecast()` | Supply remaining | ~10000 |
| `calculateMetrics()` | Results page stats | ~10200 |
| `calculateBMI()` | BMI calculation | ~10400 |

### Charts

| Method | Purpose | Approx Line |
|--------|---------|-------------|
| `renderWeightChart()` | Results page chart | ~11000 |
| `updateChartData()` | Refresh chart data | ~11200 |

### Cloud Sync

| Method | Purpose | Approx Line |
|--------|---------|-------------|
| `syncToCloud()` | Push to cloud | ~12000 |
| `syncFromCloud()` | Pull from cloud | ~12100 |
| `mergeCloudData()` | Merge cloud + local | ~12200 |

## Common Edit Patterns

### Adding a New Field to Injections

1. Find form: `grep -n 'id="injection-form"' index.html`
2. Add input field in HTML
3. Find `addInjection()`: `grep -n "addInjection" index.html`
4. Add field to data object
5. Find `renderInjections()`: `grep -n "renderInjections" index.html`
6. Add field to display

### Modifying a Calculation

1. Find calculation method: `grep -n "calculateSupplyForecast" index.html`
2. Read the function logic
3. Make changes
4. Find where it's called: `grep -n "calculateSupplyForecast()" index.html`
5. Verify all call sites work

### Changing Styling

1. Find element: `grep -n 'class="target-class"' index.html`
2. Find CSS: `grep -n "\.target-class" index.html`
3. CSS section is lines ~50-2420
4. Make style changes
5. Check dark theme variant: `grep -n "\.dark.*target-class\|@media.*prefers-color-scheme" index.html`

## Performance Tips

### Use Line Ranges

```bash
# Read specific lines:
sed -n '4500,4600p' index.html

# Read around a match:
grep -n "addInjection" index.html  # Get line number
sed -n '4500,4600p' index.html      # Read context
```

### Use View Tool with Range

```
view index.html 4500-4600
```

### Search Before Reading

Always search first. Never load entire file into context.

## Anti-Patterns

- ❌ Reading entire index.html (12,600 lines will overflow context)
- ❌ Making changes without finding all related code
- ❌ Ignoring dark theme styles (always check both)
- ❌ Forgetting mobile responsive styles
- ❌ Not verifying renderData() is called after changes

## Related Files

The monolith imports these modules:
- `js/api-client.js` - Cloud API calls
- `js/auth-manager.js` - Firebase authentication
- `js/cloud-storage.js` - Legacy sync (being replaced)
- `js/sync-queue.js` - Offline queue management

Chart.js loaded via CDN:
- Chart.js v4.x
- chartjs-adapter-date-fns
