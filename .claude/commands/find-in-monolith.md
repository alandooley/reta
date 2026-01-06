# Find in Monolith Command

Find in the index.html monolith: $ARGUMENTS

## Search Strategy

The index.html file is 12,600+ lines. NEVER read it entirely.

### Search Commands

```bash
# Find function definition:
grep -n "$ARGUMENTS" index.html | head -20

# Find with context:
grep -n -B2 -A5 "$ARGUMENTS" index.html | head -40

# Find in specific section (CSS: 50-2420, JS: 3632-12664):
sed -n '3632,12664p' index.html | grep -n "$ARGUMENTS"
```

### Common Searches

| Looking for... | Search pattern |
|----------------|----------------|
| Method | `function $ARGUMENTS\|$ARGUMENTS\s*(` |
| Element by ID | `id="$ARGUMENTS"` |
| Element by class | `class=".*$ARGUMENTS` |
| CSS rule | `\.$ARGUMENTS` |
| Event handler | `addEventListener.*$ARGUMENTS` |
| Variable | `this\.$ARGUMENTS\|const $ARGUMENTS\|let $ARGUMENTS` |

### After Finding

1. Note the line number(s)
2. Read surrounding context (10-20 lines)
3. Find related code (calls, callers, styles)
4. Report findings with line references

### Section Map

- Lines 50-2420: CSS styles
- Lines 2420-3630: HTML body
- Lines 3632-12664: JavaScript (InjectionTracker class)
  - ~4500: Injection methods
  - ~6000: Vial methods
  - ~7500: Weight methods
  - ~8500: Render methods
  - ~10000: Calculations
  - ~11000: Charts
  - ~12000: Cloud sync
