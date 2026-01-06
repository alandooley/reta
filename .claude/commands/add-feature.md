# Add Feature Command

Add a new feature to RETA: $ARGUMENTS

## Pre-Implementation Analysis

BEFORE writing any code, answer these questions:

### 1. Feature Scope
- What does this feature do?
- Who uses it? When?
- What's the user journey?

### 2. Data Requirements
- What data does this feature need?
- New fields required?
- Which data type (injection, vial, weight, settings)?

### 3. Impact Analysis
Per the CLAUDE.md "Cross-Cutting Concerns" table, check:

| If touching... | Also check... |
|----------------|---------------|
| Injection data | Vial tracking, supply forecast, Results metrics |
| Vial data | Injection vial selection, supply forecast |
| Weight data | Results chart, BMI, 6 metric cards |
| Settings | All features reading settings |

### 4. Implementation Checklist

For EVERY new field, ensure ALL layers:
- [ ] HTML input/display in `index.html`
- [ ] JavaScript in InjectionTracker (snake_case)
- [ ] localStorage persistence (automatic)
- [ ] API client (transform to camelCase)
- [ ] Lambda validation and storage
- [ ] DynamoDB accepts field
- [ ] Sync merge handles field
- [ ] Tests cover new field
- [ ] Dark theme styles
- [ ] Mobile responsive

### 5. Verification

- [ ] Run `npm test` - all pass
- [ ] No console errors
- [ ] Data persists on refresh
- [ ] Cloud sync works (if applicable)
- [ ] Related features still work

## Implementation Order

1. Design data structure first
2. Add backend (Lambda/DynamoDB) if needed
3. Add API client methods
4. Add UI elements
5. Add JavaScript logic
6. Add tests
7. Test manually
8. Deploy
