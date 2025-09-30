# Save Notifications & Auto-Save Guide

## Overview

Your app now has a comprehensive save notification system that provides immediate visual feedback when data is saved.

## Features

1. **Toast Notifications** - Slide-in messages in corner
2. **Auto-Save** - Saves as you type (with debouncing)
3. **Visual Indicators** - Field borders change color
4. **Inline Status** - "Saving..." and "Saved ✓" text
5. **Error Handling** - Clear error messages if save fails

---

## Quick Start

### 1. Basic Toast Notifications

Show a notification when any action completes:

```javascript
import notificationManager from './src/ui/notification-system.js';

// Initialize once on page load
notificationManager.initialize();

// Show success notification
notificationManager.success('Height saved successfully!');

// Show error notification
notificationManager.error('Failed to save weight');

// Show info notification
notificationManager.info('Remember to log your injection');

// Show warning notification
notificationManager.warning('Vial expires in 3 days');
```

### 2. Auto-Save for Input Fields

Enable auto-save on any input field:

```html
<!-- Your input field -->
<input type="number"
       id="height"
       name="height"
       placeholder="Height (cm)">

<script type="module">
import autoSaveManager from './src/ui/auto-save-manager.js';

// Initialize
autoSaveManager.initialize();

// Enable auto-save for height field
const heightInput = document.getElementById('height');

autoSaveManager.enableAutoSave(heightInput, {
  dataPath: 'settings.height_cm',     // Where to save in data
  fieldLabel: 'Height',                // Label for notifications
  debounceDelay: 1000,                 // Wait 1s after typing stops
  showNotification: true               // Show toast notification
});
</script>
```

**Result**: As you type, you'll see:
- Field border turns blue (saving)
- "⋯ Saving..." appears
- Toast notification: "Height saved ✓"
- Field border turns green briefly

---

## Complete Examples

### Example 1: Settings Page with Auto-Save

```html
<!DOCTYPE html>
<html>
<head>
  <title>Settings</title>
</head>
<body>
  <h1>Settings</h1>

  <form id="settings-form">
    <div class="form-group">
      <label for="height">Height (cm)</label>
      <input type="number" id="height" name="height" placeholder="170">
    </div>

    <div class="form-group">
      <label for="weight-unit">Weight Unit</label>
      <select id="weight-unit" name="weight-unit">
        <option value="kg">Kilograms</option>
        <option value="lbs">Pounds</option>
      </select>
    </div>

    <div class="form-group">
      <label for="reminder-time">Injection Reminder Time</label>
      <input type="time" id="reminder-time" name="reminder-time">
    </div>

    <div class="form-group">
      <label for="notes">Notes</label>
      <textarea id="notes" name="notes" rows="4"></textarea>
    </div>
  </form>

  <script type="module">
    import autoSaveManager from './src/ui/auto-save-manager.js';
    import resilientStorage from './src/core/resilient-storage.js';

    // Initialize
    autoSaveManager.initialize();

    // Load existing settings
    async function loadSettings() {
      const data = await resilientStorage.loadData();

      if (data.settings) {
        document.getElementById('height').value = data.settings.height_cm || '';
        document.getElementById('weight-unit').value = data.settings.weight_unit || 'kg';
        document.getElementById('reminder-time').value = data.settings.reminder_time || '';
        document.getElementById('notes').value = data.settings.notes || '';
      }
    }

    // Enable auto-save for all fields
    autoSaveManager.enableAutoSave(document.getElementById('height'), {
      dataPath: 'settings.height_cm',
      fieldLabel: 'Height',
      transform: (value) => parseFloat(value) || null,
      validate: (value) => {
        if (value && (value < 50 || value > 300)) {
          return 'Height must be between 50 and 300 cm';
        }
        return true;
      }
    });

    autoSaveManager.enableAutoSave(document.getElementById('weight-unit'), {
      dataPath: 'settings.weight_unit',
      fieldLabel: 'Weight Unit',
      debounceDelay: 0  // Save immediately for dropdowns
    });

    autoSaveManager.enableAutoSave(document.getElementById('reminder-time'), {
      dataPath: 'settings.reminder_time',
      fieldLabel: 'Reminder Time',
      debounceDelay: 500
    });

    autoSaveManager.enableAutoSave(document.getElementById('notes'), {
      dataPath: 'settings.notes',
      fieldLabel: 'Notes',
      debounceDelay: 2000,  // Wait 2 seconds for longer text
      showNotification: false  // Don't show toast for every keystroke
    });

    // Load on page load
    loadSettings();
  </script>
</body>
</html>
```

---

### Example 2: Form Submission with Notification

```html
<form id="add-injection-form">
  <input type="number" name="dose" placeholder="Dose (mg)" required>
  <select name="site" required>
    <option value="">Select injection site</option>
    <option value="left_thigh">Left Thigh</option>
    <option value="right_thigh">Right Thigh</option>
  </select>
  <button type="submit">Add Injection</button>
</form>

<script type="module">
import notificationManager from './src/ui/notification-system.js';
import { addInjection } from './src/managers/injection-manager.js';
import resilientStorage from './src/core/resilient-storage.js';

notificationManager.initialize();

document.getElementById('add-injection-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  // Show saving notification
  const savingId = notificationManager.saving('Adding injection...');

  try {
    const formData = new FormData(e.target);
    const data = await resilientStorage.loadData();

    const injection = addInjection({
      dose_mg: parseFloat(formData.get('dose')),
      injection_site: formData.get('site'),
      vial_id: data.vials[0]?.vial_id  // Use first available vial
    }, data.injections);

    data.injections.push(injection);
    await resilientStorage.saveData(data);

    // Update saving notification to success
    notificationManager.savingComplete(savingId, 'Injection added successfully!');

    // Reset form
    e.target.reset();

  } catch (error) {
    // Update saving notification to error
    notificationManager.savingFailed(savingId, error.message);
  }
});
</script>
```

---

### Example 3: Manual Save Button with Feedback

```html
<form id="profile-form">
  <input type="text" id="name" placeholder="Name">
  <input type="email" id="email" placeholder="Email">

  <button type="button" onclick="saveProfile()">
    Save Profile
  </button>
</form>

<script type="module">
import notificationManager from './src/ui/notification-system.js';
import resilientStorage from './src/core/resilient-storage.js';

notificationManager.initialize();

window.saveProfile = async function() {
  const button = event.target;
  const originalText = button.textContent;

  // Disable button and show saving state
  button.disabled = true;
  button.textContent = '⋯ Saving...';

  try {
    const data = await resilientStorage.loadData();

    data.settings = data.settings || {};
    data.settings.profile = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      updated: new Date().toISOString()
    };

    await resilientStorage.saveData(data);

    // Show success
    notificationManager.success('Profile saved successfully!');

    // Update button
    button.textContent = '✓ Saved';
    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 2000);

  } catch (error) {
    // Show error
    notificationManager.error('Failed to save profile: ' + error.message);

    // Reset button
    button.textContent = originalText;
    button.disabled = false;
  }
};
</script>
```

---

### Example 4: Weight Entry with Immediate Feedback

```html
<form id="weight-form">
  <input type="number"
         id="weight"
         name="weight"
         placeholder="Weight (kg)"
         step="0.1">

  <button type="submit">Log Weight</button>
</form>

<script type="module">
import notificationManager from './src/ui/notification-system.js';
import { addWeight } from './src/managers/weight-manager.js';
import resilientStorage from './src/core/resilient-storage.js';

notificationManager.initialize();

document.getElementById('weight-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const weightInput = document.getElementById('weight');
  const weightValue = parseFloat(weightInput.value);

  // Validate
  if (!weightValue || weightValue < 20 || weightValue > 500) {
    notificationManager.error('Please enter a valid weight between 20 and 500 kg');
    return;
  }

  // Show saving
  const savingId = notificationManager.saving('Logging weight...');

  try {
    const data = await resilientStorage.loadData();

    const weightEntry = addWeight({
      weight_kg: weightValue
    });

    data.weights = data.weights || [];
    data.weights.push(weightEntry);

    await resilientStorage.saveData(data);

    // Show success with details
    notificationManager.savingComplete(
      savingId,
      `${weightValue} kg logged successfully`
    );

    // Clear form
    weightInput.value = '';

  } catch (error) {
    notificationManager.savingFailed(savingId, error.message);
  }
});
</script>
```

---

## Notification Types & Colors

### Success (Green)
```javascript
notificationManager.success('Data saved!');
```
Use for: Successful saves, completed actions

### Error (Red)
```javascript
notificationManager.error('Failed to save');
```
Use for: Failed operations, validation errors

### Warning (Orange)
```javascript
notificationManager.warning('Vial expires soon');
```
Use for: Important alerts, non-critical issues

### Info (Blue)
```javascript
notificationManager.info('Tip: Rotate injection sites');
```
Use for: Tips, informational messages

### Saving (Light Blue)
```javascript
const id = notificationManager.saving('Saving...');
// Later: notificationManager.savingComplete(id);
```
Use for: In-progress operations

---

## Advanced Usage

### Custom Duration

```javascript
// Show for 5 seconds instead of default 3
notificationManager.success('Saved!', { duration: 5000 });

// Don't auto-hide
notificationManager.info('Important message', { duration: 0 });
```

### Custom Title

```javascript
notificationManager.success('Data synced', {
  title: 'Cloud Sync Complete'
});
```

### Non-Dismissible

```javascript
notificationManager.saving('Please wait...', {
  dismissible: false  // User can't close it
});
```

### Update Existing Notification

```javascript
// Create notification with ID
const id = notificationManager.saving('Uploading...', { id: 'upload' });

// Update it later
notificationManager.update(id, {
  message: 'Upload 50% complete...'
});

// Finally complete it
notificationManager.savingComplete(id, 'Upload complete!');
```

---

## Visual Feedback Summary

When user types in a field with auto-save:

1. **Typing**: Border turns **blue** (pulsing animation)
2. **Saving**: "⋯ Saving..." appears next to field
3. **Success**:
   - Border turns **green** for 2 seconds
   - "✓ Saved" appears
   - Toast notification (optional)
4. **Error**:
   - Border turns **red**
   - "✕ Failed" appears
   - Toast with error message

---

## Best Practices

### 1. Use Auto-Save for Settings
```javascript
// Good: Auto-save user preferences
autoSaveManager.enableAutoSave(heightInput, {
  dataPath: 'settings.height_cm'
});
```

### 2. Use Manual Save for Forms
```javascript
// Good: Manual save for complex forms
form.addEventListener('submit', async (e) => {
  const id = notificationManager.saving('Submitting...');
  // ... save logic ...
  notificationManager.savingComplete(id);
});
```

### 3. Debounce Long Text
```javascript
// Wait 2 seconds after user stops typing
autoSaveManager.enableAutoSave(notesField, {
  debounceDelay: 2000
});
```

### 4. Validate Before Saving
```javascript
autoSaveManager.enableAutoSave(ageInput, {
  validate: (value) => {
    if (value < 0 || value > 120) {
      return 'Age must be between 0 and 120';
    }
    return true;
  }
});
```

### 5. Transform Data
```javascript
autoSaveManager.enableAutoSave(heightInput, {
  transform: (value) => parseFloat(value) || null
});
```

---

## Troubleshooting

### Notifications Not Showing

```javascript
// Make sure to initialize
notificationManager.initialize();
```

### Auto-Save Not Working

```javascript
// Check that field has name or id
<input id="height" ...>  ✓
<input name="height" ...>  ✓
<input ...>  ✗

// Or provide dataPath explicitly
autoSaveManager.enableAutoSave(input, {
  dataPath: 'settings.height'
});
```

### Multiple Notifications

```javascript
// Use an ID to update instead of creating new
const id = notificationManager.saving('Saving...', { id: 'save' });
// Later updates use same ID
notificationManager.savingComplete('save');
```

---

## Styling Customization

Override the default styles:

```css
/* Change notification position */
.notification-container {
  top: 20px;  /* Default: 80px */
  left: 20px;  /* Default: right: 20px */
}

/* Change success color */
.notification.success {
  border-left-color: #00FF00;
}

/* Make notifications larger */
.notification {
  min-width: 400px;
  padding: 20px;
}

/* Change save indicator position */
.save-status {
  right: 5px;  /* Default: 10px */
}
```

---

## API Reference

### NotificationManager

```javascript
// Show notifications
notificationManager.success(message, options)
notificationManager.error(message, options)
notificationManager.warning(message, options)
notificationManager.info(message, options)
notificationManager.saving(message, options)

// Update notification
notificationManager.update(id, updates)

// Hide notifications
notificationManager.hide(id)
notificationManager.hideAll()

// Special saving helpers
notificationManager.savingComplete(id, message)
notificationManager.savingFailed(id, message)
```

### AutoSaveManager

```javascript
// Enable auto-save
autoSaveManager.enableAutoSave(element, options)
autoSaveManager.enableAutoSaveForAll(selector, options)

// Disable auto-save
autoSaveManager.disableAutoSave(element)

// Check status
autoSaveManager.isSaving()
autoSaveManager.getSavingFields()
```

### Options Object

```javascript
{
  dataPath: 'settings.height_cm',  // Where to save in data
  fieldLabel: 'Height',            // Label for notifications
  debounceDelay: 1000,             // Wait time in ms
  showNotification: true,          // Show toast
  transform: (value) => ...,       // Transform before save
  validate: (value) => ...,        // Validate before save
  onSave: (value, data) => ...,    // Custom save handler
  duration: 3000,                  // Notification duration
  dismissible: true,               // Can user close it
  title: 'Custom Title',           // Notification title
  id: 'unique-id'                  // Notification ID
}
```

---

## Integration Checklist

- [ ] Import notification manager
- [ ] Initialize on page load
- [ ] Add auto-save to settings fields
- [ ] Add manual save notifications to forms
- [ ] Test all notification types
- [ ] Customize styling if needed
- [ ] Test error handling

---

Now your users will **always know when their data is saved**! 🎉