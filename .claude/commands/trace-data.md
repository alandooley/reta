# Trace Data Flow Command

Trace the data flow for: $ARGUMENTS

## Data Flow Investigation

Use the data-flow-tracing skill to systematically trace data through ALL layers.

### What to Trace

If $ARGUMENTS is a data type (injection, vial, weight):
- Trace CRUD operations end-to-end
- Check naming convention transforms (snake_case ↔ camelCase)
- Verify localStorage persistence
- Verify cloud sync

If $ARGUMENTS is a specific bug/issue:
- Start from the symptom
- Trace backward to find break in chain
- Check each layer's input/output

If $ARGUMENTS is a specific field:
- Find all places the field is used
- Verify consistent naming
- Check all transforms

### Layers to Check

1. **UI** - Form/display elements
2. **JavaScript** - InjectionTracker methods (snake_case)
3. **localStorage** - Persistence check
4. **API Client** - Transform to camelCase
5. **Lambda** - Validation and storage
6. **DynamoDB** - Data format
7. **Sync** - Merge logic
8. **UI Update** - Back to snake_case

### Output

For each layer, report:
- What data enters
- What data exits
- Any transforms applied
- Any issues found

### Files to Check

| Layer | Files |
|-------|-------|
| UI/JS | `index.html` |
| API | `js/api-client.js` |
| Sync | `js/cloud-storage.js`, `js/sync-queue.js` |
| Lambda | `reta-cloud-infrastructure/lambda/*/` |
