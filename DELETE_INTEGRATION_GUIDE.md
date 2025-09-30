# How to Use Delete Functionality

## Current Status

The delete functionality is **fully implemented** as code modules but **not yet integrated** into your HTML UI. Here's how to add it:

---

## Quick Integration Options

### Option 1: Add Delete Buttons (Simplest)

Add a delete button next to each item in your lists.

#### For Injections List

```html
<!-- Your existing injection display -->
<div class="injection-item" data-id="injection_123">
  <div class="injection-info">
    <span class="date">Jan 15, 2024</span>
    <span class="dose">2.5 mg</span>
    <span class="site">Left Thigh</span>
  </div>

  <!-- ADD THIS -->
  <button class="delete-btn" onclick="deleteInjection('injection_123')">
    🗑️ Delete
  </button>
</div>

<script type="module">
import deleteManager from './src/managers/delete-manager.js';
import resilientStorage from './src/core/resilient-storage.js';

window.deleteInjection = async function(injectionId) {
  if (!confirm('Delete this injection?')) return;

  const data = await resilientStorage.loadData();
  const result = deleteManager.deleteInjection(data.injections, injectionId);

  data.injections = result.injections;
  await resilientStorage.saveData(data);

  alert('Deleted! Click Undo if this was a mistake.');
  location.reload();
};
</script>
```

#### For Vials List

```html
<div class="vial-item" data-id="vial_abc">
  <div class="vial-info">
    <span>Vial #1 - 100mg</span>
    <span>1.5ml remaining</span>
  </div>

  <!-- ADD THIS -->
  <button class="delete-btn" onclick="deleteVial('vial_abc')">
    🗑️ Delete
  </button>
</div>

<script type="module">
window.deleteVial = async function(vialId) {
  const data = await resilientStorage.loadData();

  try {
    const result = deleteManager.deleteVial(data.vials, vialId, data.injections);
    data.vials = result.vials;
    await resilientStorage.saveData(data);
    alert('Vial deleted!');
    location.reload();
  } catch (error) {
    // Vial has injections - ask about force delete
    if (confirm(error.message + '\n\nDelete vial AND all related injections?')) {
      const result = deleteManager.forceDeleteVial(data.vials, data.injections, vialId);
      data.vials = result.vials;
      data.injections = result.injections;
      await resilientStorage.saveData(data);
      alert('Vial and injections deleted!');
      location.reload();
    }
  }
};
</script>
```

#### For Weight Entries

```html
<div class="weight-item" data-timestamp="2024-01-15T12:00:00.000Z">
  <div class="weight-info">
    <span>80.5 kg / 177.5 lbs</span>
    <span>Jan 15, 2024</span>
  </div>

  <!-- ADD THIS -->
  <button class="delete-btn" onclick="deleteWeight('2024-01-15T12:00:00.000Z')">
    🗑️ Delete
  </button>
</div>

<script type="module">
window.deleteWeight = async function(timestamp) {
  if (!confirm('Delete this weight entry?')) return;

  const data = await resilientStorage.loadData();
  const result = deleteManager.deleteWeight(data.weights, timestamp);

  data.weights = result.weights;
  await resilientStorage.saveData(data);

  alert('Weight deleted!');
  location.reload();
};
</script>
```

---

### Option 2: Swipe to Delete (Mobile-Friendly)

Add swipe gesture support:

```html
<style>
.item-container {
  position: relative;
  overflow: hidden;
}

.item-content {
  position: relative;
  transition: transform 0.3s;
  background: var(--card-bg);
  z-index: 2;
}

.item-content.swiped {
  transform: translateX(-80px);
}

.delete-action {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 80px;
  background: #FF3B30;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
}
</style>

<div class="item-container" data-id="injection_123">
  <div class="delete-action" onclick="deleteInjection('injection_123')">
    🗑️
  </div>
  <div class="item-content">
    <!-- Your item content -->
  </div>
</div>

<script>
// Add swipe detection
document.querySelectorAll('.item-container').forEach(container => {
  const content = container.querySelector('.item-content');
  let startX = 0;
  let currentX = 0;

  content.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  });

  content.addEventListener('touchmove', (e) => {
    currentX = e.touches[0].clientX;
    const diff = startX - currentX;

    if (diff > 0 && diff < 80) {
      content.style.transform = `translateX(-${diff}px)`;
    }
  });

  content.addEventListener('touchend', () => {
    const diff = startX - currentX;

    if (diff > 40) {
      content.classList.add('swiped');
    } else {
      content.style.transform = '';
    }
  });
});
</script>
```

---

### Option 3: Long Press Menu

Add context menu on long press:

```html
<div class="injection-item"
     data-id="injection_123"
     oncontextmenu="showItemMenu(event, 'injection_123'); return false;">
  <!-- Item content -->
</div>

<div id="context-menu" class="context-menu" style="display: none;">
  <button onclick="editItem()">✏️ Edit</button>
  <button onclick="deleteItem()">🗑️ Delete</button>
  <button onclick="viewDetails()">👁️ View Details</button>
</div>

<script>
let currentItemId = null;

function showItemMenu(event, itemId) {
  event.preventDefault();
  currentItemId = itemId;

  const menu = document.getElementById('context-menu');
  menu.style.display = 'block';
  menu.style.left = event.pageX + 'px';
  menu.style.top = event.pageY + 'px';
}

// Hide menu when clicking elsewhere
document.addEventListener('click', () => {
  document.getElementById('context-menu').style.display = 'none';
});

async function deleteItem() {
  // Use deleteManager to delete currentItemId
  await deleteInjection(currentItemId);
}
</script>

<style>
.context-menu {
  position: absolute;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.context-menu button {
  display: block;
  width: 100%;
  padding: 10px 16px;
  background: none;
  border: none;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
}

.context-menu button:hover {
  background: var(--accent-color);
}
</style>
```

---

### Option 4: Dedicated Management Page

Create a separate "Manage Data" page:

```html
<!-- In your settings or menu -->
<button onclick="location.href='manage-data.html'">
  Manage Injections & Data
</button>

<!-- manage-data.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Manage Data</title>
</head>
<body>
  <h1>Manage Your Data</h1>

  <section id="injections-section">
    <h2>Injections</h2>
    <div id="injections-list"></div>
  </section>

  <section id="vials-section">
    <h2>Vials</h2>
    <div id="vials-list"></div>
  </section>

  <section id="weights-section">
    <h2>Weight Entries</h2>
    <div id="weights-list"></div>
  </section>

  <script type="module">
    import {
      renderInjectionList,
      renderVialList,
      renderWeightList
    } from './src/ui/data-management-ui.js';
    import resilientStorage from './src/core/resilient-storage.js';

    // Load and render all data
    const data = await resilientStorage.loadData();

    renderInjectionList(
      document.getElementById('injections-list'),
      data.injections
    );

    renderVialList(
      document.getElementById('vials-list'),
      data.vials
    );

    renderWeightList(
      document.getElementById('weights-list'),
      data.weights
    );
  </script>
</body>
</html>
```

---

## Adding Undo Button

Add a floating undo button that appears after deletes:

```html
<button id="undo-btn"
        class="floating-undo-btn"
        style="display: none;"
        onclick="undoDelete()">
  ↩️ Undo Delete
</button>

<script type="module">
import deleteManager from './src/managers/delete-manager.js';
import resilientStorage from './src/core/resilient-storage.js';

// Show undo button when delete happens
function showUndoButton() {
  const btn = document.getElementById('undo-btn');
  btn.style.display = 'block';

  // Hide after 10 seconds
  setTimeout(() => {
    if (deleteManager.canUndo()) {
      btn.style.display = 'none';
    }
  }, 10000);
}

window.undoDelete = async function() {
  if (!deleteManager.canUndo()) {
    alert('Nothing to undo');
    return;
  }

  const data = await resilientStorage.loadData();
  const restored = deleteManager.undoLastDelete(data);

  await resilientStorage.saveData(restored);
  alert('Undo successful!');
  location.reload();
};

// Call after any delete
window.deleteInjection = async function(id) {
  // ... delete code ...
  showUndoButton();  // Add this line
};
</script>

<style>
.floating-undo-btn {
  position: fixed;
  bottom: 80px;
  right: 20px;
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 24px;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
```

---

## Recommended Integration Steps

1. **Start Simple**: Add delete buttons to your existing item lists
2. **Test**: Try deleting a few items
3. **Add Undo**: Implement the floating undo button
4. **Enhance**: Add swipe or long-press if desired
5. **Polish**: Add confirmation dialogs and animations

---

## Full Working Example

Here's a complete example you can drop into your existing code:

```html
<!-- Add to your existing HTML where you display injections -->
<div id="injections-with-delete">
  <!-- This will be populated -->
</div>

<!-- Add this floating undo button -->
<button id="undo-btn" style="display: none;" onclick="undoLastDelete()">
  ↩️ Undo
</button>

<script type="module">
import deleteManager from './src/managers/delete-manager.js';
import resilientStorage from './src/core/resilient-storage.js';

// Load and display injections with delete buttons
async function displayInjectionsWithDelete() {
  const data = await resilientStorage.loadData();
  const container = document.getElementById('injections-with-delete');

  if (!data.injections || data.injections.length === 0) {
    container.innerHTML = '<p>No injections yet</p>';
    return;
  }

  // Sort by date (newest first)
  const sorted = [...data.injections].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  // Build HTML
  container.innerHTML = sorted.map(inj => `
    <div class="injection-item" style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: var(--card-bg);
      border-radius: 8px;
      margin-bottom: 8px;
    ">
      <div>
        <div><strong>${new Date(inj.timestamp).toLocaleDateString()}</strong></div>
        <div>${inj.dose_mg} mg - ${inj.injection_site.replace('_', ' ')}</div>
      </div>
      <button onclick="deleteInjection('${inj.id}')" style="
        background: #FF3B30;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
      ">
        🗑️ Delete
      </button>
    </div>
  `).join('');

  // Update undo button visibility
  updateUndoButton();
}

// Delete injection function
window.deleteInjection = async function(injectionId) {
  if (!confirm('Delete this injection? You can undo this action.')) {
    return;
  }

  try {
    const data = await resilientStorage.loadData();
    const result = deleteManager.deleteInjection(data.injections, injectionId);

    data.injections = result.injections;
    await resilientStorage.saveData(data);

    // Reload display
    await displayInjectionsWithDelete();

    // Show undo button
    document.getElementById('undo-btn').style.display = 'block';

  } catch (error) {
    alert('Failed to delete: ' + error.message);
  }
};

// Undo delete function
window.undoLastDelete = async function() {
  if (!deleteManager.canUndo()) {
    alert('Nothing to undo');
    return;
  }

  try {
    const data = await resilientStorage.loadData();
    const restored = deleteManager.undoLastDelete(data);

    await resilientStorage.saveData(restored);

    // Reload display
    await displayInjectionsWithDelete();

  } catch (error) {
    alert('Failed to undo: ' + error.message);
  }
};

// Update undo button visibility
function updateUndoButton() {
  const btn = document.getElementById('undo-btn');
  btn.style.display = deleteManager.canUndo() ? 'block' : 'none';
}

// Initialize on page load
displayInjectionsWithDelete();
</script>
```

---

## Next Steps

1. Choose your preferred delete method (I recommend **Option 1: Delete Buttons** to start)
2. Add the code to your main HTML file
3. Test deleting and undoing
4. Once working, add styling and animations
5. Optionally add swipe/long-press for mobile

The code is ready - it just needs to be connected to your UI! Let me know which option you prefer and I can help integrate it.