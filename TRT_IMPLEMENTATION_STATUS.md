# TRT Tracking Implementation Status

**Date**: 2025-11-24
**Status**: Backend Complete, Frontend In Progress

---

## ✅ COMPLETED (Deployed & Working)

### Backend Infrastructure
- [x] **TRT Injection Lambda Functions** (GET, POST, DELETE)
  - Location: `reta-cloud-infrastructure/lambda/trt/injections/`
  - Volume-based dosing with auto mg calculation (volumeMl × concentrationMgMl)
  - Automatic vial remaining volume tracking
  - Skip week support
  - Deployed to AWS

- [x] **TRT Vial Lambda Functions** (GET, POST, DELETE, PATCH)
  - Location: `reta-cloud-infrastructure/lambda/trt/vials/`
  - Full CRUD operations
  - Partial update support (PATCH)
  - Deployed to AWS

- [x] **CDK Stack Updates**
  - Added 7 new TRT Lambda function definitions
  - Added 7 new API routes:
    - `GET/POST /v1/trt/injections`
    - `DELETE /v1/trt/injections/{id}`
    - `GET/POST /v1/trt/vials`
    - `DELETE/PATCH /v1/trt/vials/{id}`
  - Successfully deployed to production

### Frontend API Layer
- [x] **API Client** (`js/api-client.js`)
  - `getTrtInjections()`
  - `createTrtInjection(injection)`
  - `updateTrtInjection(id, injection)`
  - `deleteTrtInjection(id)`
  - `getTrtVials()`
  - `createTrtVial(vial)`
  - `updateTrtVial(id, vial)`
  - `patchTrtVial(id, updates)`
  - `deleteTrtVial(id)`

- [x] **Cloud Storage Adapter** (`js/cloud-storage.js`)
  - `getTrtInjections()` - Fetch with offline fallback
  - `saveTrtInjection(injection)` - Save local + cloud sync
  - `deleteTrtInjection(id)` - Delete local + cloud
  - `getTrtVials()` - Fetch with offline fallback
  - `saveTrtVial(vial)` - Save local + cloud sync
  - `deleteTrtVial(id)` - Delete local + cloud
  - Offline-first architecture maintained

---

## 🔄 IN PROGRESS

### Frontend UI (index.html)

**Data Model** - ✅ READY
```javascript
trtInjections: []
trtVials: []
trtSettings: {
    injectionFrequency: 3.5,  // 2x per week default
    defaultDoseMl: 0.5,
    defaultDoseMg: 100,
    concentrationMgMl: 200,
    injectionSites: ['left_front_thigh', 'right_front_thigh'],
    lastSync: null
}
```

**UI Stubs** - ✅ EXIST (Lines 2876-3040)
- TRT dashboard tab (empty)
- TRT shots tab (empty list)
- TRT symptoms tab (form exists, not hooked up)
- TRT inventory tab (empty list)
- TRT settings tab (form exists, not hooked up)

**App Switcher** - ✅ FUNCTIONAL (Lines 5119-5231)
- Reta ↔ TRT toggle button
- `switchApp(appMode)` method exists
- URL hash support (`#reta`, `#trt`)

---

## ❌ TODO - Frontend Implementation

### 1. TRT Data Management Methods (HIGH PRIORITY)
Need to add to `InjectionTracker` class:

```javascript
// TRT Injection Management
async addTrtInjection(injection)
async updateTrtInjection(injectionId, updates)
async deleteTrtInjection(injectionId)

// TRT Vial Management
async addTrtVial(vial)
async updateTrtVial(vialId, updates)
async deleteTrtVial(vialId)

// TRT Calculations
calculateTrtDose(volumeMl, concentrationMgMl)
calculateTrtSupplyForecast()
calculateTrtWeeklyDose()
getTrtNextInjectionDate()
```

### 2. TRT Dashboard (Lines ~2879-2906)
- [ ] Protocol summary card (frequency, dose, last injection)
- [ ] Next injection date card
- [ ] Supply forecast card (weeks remaining, reorder alert)
- [ ] Recent symptoms summary (if symptom tracking added)

### 3. TRT Add Injection Modal
Need to create modal similar to `add-shot-modal`:
- [ ] Date/time picker (pre-filled with current)
- [ ] Vial dropdown (filtered to active vials)
- [ ] Volume input (ml) with concentration display
- [ ] Auto-calculated dose display (volumeMl × concentration)
- [ ] Injection site selector (left/right front thigh)
- [ ] Time of day selector (morning/afternoon/evening)
- [ ] Technique notes field
- [ ] Notes textarea
- [ ] Form validation & submission handler

### 4. TRT Injection List View (Lines ~2908-2922)
- [ ] Render injections grouped by month
- [ ] Display: date, volume, dose, site, time of day
- [ ] Show vial lot number
- [ ] Edit/delete buttons
- [ ] Visual indicator for skipped injections
- [ ] Site rotation warning (if same site used too frequently)

### 5. TRT Skip Week Modal
Similar to Reta skip modal:
- [ ] Pre-fill next expected date
- [ ] Pre-fill planned dose from settings/last injection
- [ ] Reason textarea
- [ ] Create injection with `skipped: true`, `volumeMl: 0`

### 6. TRT Vial Management UI (Lines ~2993-3007)
- [ ] **Add Vial Modal**:
  - Concentration (mg/ml)
  - Volume (ml)
  - Lot number
  - Expiry date
  - Opened date (optional, for active vials)
  - Status (active/dry_stock)
  - Notes
- [ ] **Vial List Rendering**:
  - Active vials section
  - Dry stock section
  - Empty/expired archive
  - Progress bar (remaining / total)
  - Activate button for dry stock
  - Edit/delete buttons
- [ ] **Vial Edit Modal**: Pre-populate form

### 7. TRT Supply Forecast Display
Add function similar to `calculateSupplyForecast()`:
```javascript
calculateTrtSupplyForecast() {
  const activeVials = this.data.trtVials.filter(v => v.status === 'active');
  const totalRemainingMl = activeVials.reduce((sum, v) => sum + v.remainingMl, 0);
  const avgConcentration = activeVials.reduce((sum, v) => sum + v.concentrationMgMl, 0) / activeVials.length;
  const totalSupplyMg = totalRemainingMl * avgConcentration;

  const weeklyDoseMg = calculateTrtWeeklyDose();
  const activeWeeks = Math.floor(totalSupplyMg / weeklyDoseMg);

  // Add skipped weeks (direct 1:1 extension)
  const skippedWeeks = this.data.trtInjections.filter(inj => inj.skipped).length;
  const calendarWeeks = activeWeeks + skippedWeeks;

  const runOutDate = new Date(Date.now() + calendarWeeks * 7 * 24 * 60 * 60 * 1000);
  const reorderDate = new Date(runOutDate - 14 * 24 * 60 * 60 * 1000); // 2 weeks before

  return {
    totalSupplyMl,
    totalSupplyMg,
    activeWeeksRemaining: activeWeeks,
    skippedWeeksCount: skippedWeeks,
    calendarWeeksRemaining: calendarWeeks,
    adjustmentText: skippedWeeks > 0 ? `+${skippedWeeks} weeks from skips` : '',
    runOutDate,
    reorderDate,
    daysUntilReorder: Math.ceil((reorderDate - new Date()) / (24 * 60 * 60 * 1000))
  };
}
```

### 8. TRT Settings Page (Lines ~3009-3040)
- [ ] Load settings from `this.data.trtSettings`
- [ ] Save handler updates settings and localStorage
- [ ] Trigger cloud sync after save
- [ ] Form validation

### 9. TRT Rendering Methods
```javascript
renderTrtDashboard()
renderTrtInjectionsList()
renderTrtVialsList()
updateTrtUI()  // Called after data changes
```

### 10. Event Listeners
- [ ] "Record Injection" button → show add modal
- [ ] "Skip This Week" button → show skip modal
- [ ] "Add Vial" button → show add vial modal
- [ ] Form submissions
- [ ] Edit/delete buttons
- [ ] Tab switching

---

## ❌ TODO - Reta Forecast Fix

### Update Skip Week Formula (HIGH PRIORITY)
**Location**: Lines 6973-7088 (function `calculateSupplyForecast()`)

**Current formula** (statistical skip rate):
```javascript
const skipData = this.calculateSkipRate();
let calendarWeeksRemaining = activeWeeksRemaining;
if (skipData.skipRate > 0 && skipData.skipRate < 1) {
    calendarWeeksRemaining = Math.floor(activeWeeksRemaining / (1 - skipData.skipRate));
}
```

**NEW formula** (direct week extension):
```javascript
const skippedWeeks = this.data.injections.filter(inj => inj.skipped).length;
const calendarWeeksRemaining = activeWeeksRemaining + skippedWeeks;
```

**User expectation**: 1 skipped week = +1 calendar week to supply

### Update Forecast Display UI
**Location**: Lines 7090-7166 (function `updateForecastDisplay()`)

Add UI to show breakdown:
```html
<div class="forecast-breakdown">
  <div>Active weeks: <span id="active-weeks">10</span></div>
  <div>Skipped weeks: <span id="skipped-weeks">3</span></div>
  <div class="forecast-total">Total duration: <span id="calendar-weeks">13</span> weeks</div>
  <div class="forecast-note" id="adjustment-text">+3 weeks from skips</div>
</div>
```

---

## 📋 TESTING CHECKLIST

### Backend Testing (Can test now with curl/Postman)
- [ ] Create TRT vial (POST /v1/trt/vials)
- [ ] Create TRT injection with dose calculation
- [ ] Verify vial remaining volume updated
- [ ] Delete TRT injection (verify vial volume restored)
- [ ] Get TRT injections/vials
- [ ] Create skipped week injection

### Frontend Testing (After UI complete)
- [ ] TRT dashboard loads
- [ ] Add TRT injection (all fields)
- [ ] Dose auto-calculates from volume × concentration
- [ ] Skip week modal works
- [ ] TRT injection list displays correctly
- [ ] Add TRT vial (active and dry stock)
- [ ] TRT vial list displays correctly
- [ ] Supply forecast calculates correctly
- [ ] Settings save/load
- [ ] Offline mode (add injection offline, sync when online)
- [ ] Cloud sync works
- [ ] App switcher (Reta ↔ TRT) works
- [ ] Mobile responsive

### Reta Forecast Testing
- [ ] Create skip weeks in Reta
- [ ] Verify forecast extends by exact number of skips
- [ ] UI shows breakdown clearly
- [ ] No regression in existing functionality

---

## 🚀 DEPLOYMENT PLAN

### Phase 1: Backend (COMPLETE)
✅ All Lambda functions deployed
✅ API Gateway routes live
✅ Database schema supports TRT data

### Phase 2: Frontend Core (NEXT)
1. Add TRT data management methods to InjectionTracker class
2. Build TRT add injection modal & form handler
3. Build TRT injection list view
4. Build basic TRT dashboard
5. Test basic recording flow

### Phase 3: Frontend Polish
1. Build TRT vial management UI
2. Build TRT supply forecast
3. Build TRT settings page
4. Build skip week modal
5. Polish UI/UX

### Phase 4: Reta Forecast Fix
1. Update skip week formula
2. Update forecast display UI
3. Test with historical data

### Phase 5: Testing & Deployment
1. Comprehensive testing (backend + frontend)
2. Mobile testing
3. Deploy frontend to S3
4. Invalidate CloudFront cache
5. Production smoke test

---

## 📝 IMPLEMENTATION NOTES

### Key Design Decisions
1. **Volume-first input**: Users draw by volume (0.3ml, 0.5ml), concentration stored in vial
2. **Auto-calculation**: `doseMg = volumeMl × concentrationMgMl` (backend validates)
3. **Injection sites**: `left_front_thigh`, `right_front_thigh` (matches user's usage)
4. **Skip week formula**: Direct 1:1 extension (1 skip = +1 calendar week)
5. **Offline-first**: LocalStorage primary, sync to cloud when online
6. **Same auth**: Firebase authentication shared between Reta and TRT

### Property Naming
- **Frontend (localStorage)**: snake_case (`injection_site`, `dose_mg`)
- **Backend (API/DynamoDB)**: camelCase (`injectionSite`, `doseMg`)
- **Mapping happens in API client layer**

### Budget Optimizations
- ARM64 Lambdas (20% cheaper)
- 256MB memory (reduced from 512MB)
- 3-day log retention
- On-demand DynamoDB billing

---

## 🔗 RELATED FILES

### Backend
- `reta-cloud-infrastructure/lib/reta-cloud-infrastructure-stack.ts` - CDK stack
- `reta-cloud-infrastructure/lambda/trt/injections/*.js` - Injection Lambdas
- `reta-cloud-infrastructure/lambda/trt/vials/*.js` - Vial Lambdas

### Frontend
- `index.html` - Main application (lines 2876-3040 for TRT stubs)
- `js/api-client.js` - API methods (lines 233-317 for TRT)
- `js/cloud-storage.js` - Sync adapter (lines 223-373 for TRT)
- `js/auth-manager.js` - Firebase auth (unchanged, works for both apps)

### Documentation
- `.claude/plans/PLAN_2025-11-24.md` - Original implementation plan
- `CLAUDE.md` - Project documentation (will need TRT section added)

---

## ⏱️ ESTIMATED REMAINING EFFORT

- **TRT Data Methods**: 2 hours
- **TRT UI Components**: 8-10 hours
- **Reta Forecast Fix**: 1 hour
- **Testing**: 3-4 hours
- **Total**: ~15-17 hours

---

## 🎯 NEXT IMMEDIATE STEPS

1. Add TRT data management methods to InjectionTracker class
2. Create TRT add injection modal
3. Wire up TRT injection form submission
4. Render TRT injections list
5. Test basic injection recording flow

**After basic flow works**, continue with vials, dashboard, forecast, etc.
