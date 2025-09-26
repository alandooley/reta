# Retatrutide Tracker 💉

A comprehensive Progressive Web App (PWA) for tracking Retatrutide injections with advanced vial management, weight tracking, and cloud synchronization capabilities.

## 🌟 Features

### Core Functionality
- **📊 Shot History & Tracking**: Complete injection logging with sites, doses, and notes
- **📈 Medication Level Visualization**: Real-time half-life calculations and projections
- **⚖️ Weight & Dose Correlation**: Dual-axis charts showing progress analysis
- **📦 Vial & Inventory Management**: Comprehensive cost tracking and expiration alerts
- **⏰ Next Shot Countdown**: Live countdown with visual progress indicators
- **☁️ Cloud Sync**: Google Drive integration for multi-device access
- **🏋️ Withings Health Integration**: Automatic weight data import
- **📱 PWA Support**: Install as a native app on any device

## 🚀 Quick Start

### Installation

1. **Local Deployment**:
   ```bash
   # Simply open index.html in a web browser
   # Or serve it with any web server
   python -m http.server 8000
   ```

2. **Install as PWA**:
   - Open the app in Chrome/Edge/Safari
   - Click the install button in the address bar
   - Or use browser menu > "Install Retatrutide Tracker"

### First Time Setup

1. **Add Your First Vial**:
   - Navigate to the Inventory tab
   - Click "Add Vial"
   - Enter vial details (mg, BAC water, reconstitution date)

2. **Log Your First Shot**:
   - Click "Add Shot" button
   - Select date, dose, injection site, and vial
   - Optionally add weight and notes

3. **Configure Settings**:
   - Go to Settings tab
   - Set injection frequency (weekly, bi-weekly, etc.)
   - Enter height for BMI calculations
   - Enable notifications for reminders

## 📋 Features in Detail

### Medication Level Tracking
- **Half-life Calculations**: Uses 165-hour Retatrutide half-life
- **Real-time Levels**: Shows current medication in bloodstream
- **Future Projections**: Dotted line shows expected decay
- **Time Period Filters**: View by week, month, 90 days, or all time

### Vial Management System
- **Reconstitution Tracking**: Calculate concentration automatically
- **28-Day Expiration**: Countdown from reconstitution date
- **Cost Analysis**: Track cost per vial, dose, and monthly
- **Smart Inventory**:
  - Reorder alerts when stock is low
  - Usage rate calculations
  - Waste tracking for expired vials
  - Supply duration projections

### Weight Correlation Analysis
- **Dual-Axis Charts**: Weight trends vs dose amounts
- **Statistical Analysis**: Weight loss rate calculations
- **BMI Tracking**: Automatic calculations with height
- **Source Indicators**: Differentiate manual vs Withings data

### Next Shot Scheduling
- **Circular Progress**: Visual countdown display
- **Smart Reminders**: Color-coded urgency levels
- **Flexible Scheduling**: Weekly to monthly intervals
- **Push Notifications**: Browser-based reminders

## 🔧 Configuration

### Google Drive Setup

1. **Get Google API Credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing
   - Enable Google Drive API
   - Create OAuth 2.0 credentials
   - Add authorized JavaScript origins

2. **Update Application**:
   ```javascript
   // In index.html, update these values:
   this.CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
   this.API_KEY = 'YOUR_GOOGLE_API_KEY';
   ```

3. **Connect in App**:
   - Settings > Cloud Sync > Connect Google Drive
   - Authorize the application
   - Data syncs automatically

### Withings Health Integration

1. **Register at Withings**:
   - Visit [developer.withings.com](https://developer.withings.com)
   - Create an application
   - Note Client ID and Secret

2. **Configure OAuth**:
   ```javascript
   // Update in index.html:
   const WITHINGS_CLIENT_ID = 'YOUR_WITHINGS_CLIENT_ID';
   ```

3. **Connect Account**:
   - Settings > Cloud Sync > Connect Withings
   - Authorize access to weight data
   - Historical data imports automatically

## 📊 Data Management

### Export Options
- **JSON Export**: Complete data backup
- **CSV Export**: Injection history for spreadsheets
- **Automatic Backups**: Via Google Drive sync

### Import Data
- **JSON Import**: Restore from backup
- **Merge Options**: Combine with existing data
- **Validation**: Ensures data integrity

### Data Structure

```json
{
  "injections": [{
    "id": "unique_id",
    "timestamp": "2025-09-26T07:00:00Z",
    "dose_mg": 2.0,
    "injection_site": "left_thigh",
    "vial_id": "vial_001",
    "weight_kg": 82.5,
    "notes": "No side effects"
  }],
  "vials": [{
    "vial_id": "vial_001",
    "total_mg": 15,
    "bac_water_ml": 1.5,
    "concentration_mg_ml": 10.0,
    "reconstitution_date": "2025-09-20T10:00:00Z",
    "expiration_date": "2025-10-18T10:00:00Z",
    "remaining_ml": 1.2,
    "cost_usd": 299.99
  }],
  "weights": [{
    "timestamp": "2025-09-26T07:00:00Z",
    "weight_kg": 82.5,
    "source": "manual",
    "body_fat_percentage": 18.5
  }]
}
```

## 🎨 User Interface

### Dark Theme Design
- **Mobile-First**: Optimized for phone screens
- **Touch-Friendly**: Large tap targets
- **Responsive**: Adapts to tablets and desktop
- **Accessibility**: High contrast, clear typography

### Navigation
- **Bottom Tabs**: Easy thumb reach on mobile
- **Quick Actions**: Floating add button
- **Swipe Gestures**: Navigate between charts
- **URL Shortcuts**: Direct links to tabs

## 🔒 Privacy & Security

### Data Storage
- **Local First**: Data stored in browser localStorage
- **Optional Cloud**: Google Drive sync is opt-in
- **Encryption Ready**: Structure supports encryption
- **No Analytics**: No tracking or third-party analytics

### Permissions
- **Minimal Scope**: Only essential permissions requested
- **User Control**: Easy to disconnect services
- **Data Portability**: Export your data anytime
- **HIPAA Conscious**: Designed with healthcare privacy in mind

## 🛠️ Technical Details

### Technologies Used
- **Frontend**: Vanilla JavaScript (ES6+)
- **Charts**: Chart.js with date-fns adapter
- **PWA**: Service Worker with offline support
- **Storage**: localStorage with Google Drive backup
- **Styling**: CSS3 with CSS Variables

### Browser Support
- Chrome/Edge 90+
- Safari 14+
- Firefox 88+
- Mobile browsers (iOS/Android)

### Performance
- **Single File**: ~2500 lines of optimized code
- **Fast Loading**: < 2 second initial load
- **Offline First**: Works without internet
- **Efficient Charts**: Lazy loading and caching

## 📱 PWA Features

### Installation
- **Add to Home Screen**: Native app experience
- **Offline Support**: Full functionality offline
- **Auto Updates**: Service worker handles updates
- **Push Notifications**: Injection reminders

### App Manifest
```json
{
  "name": "Retatrutide Tracker",
  "short_name": "RetaTracker",
  "display": "standalone",
  "theme_color": "#1a1a1a",
  "background_color": "#1a1a1a"
}
```

## 🔄 Updates & Maintenance

### Auto Updates
- Service Worker checks for updates
- Seamless background updates
- Version control via cache naming

### Manual Updates
1. Clear browser cache
2. Reload the application
3. Check version in console

## 🐛 Troubleshooting

### Common Issues

**Data Not Syncing**:
- Check internet connection
- Verify Google Drive is connected
- Look for sync status in Settings

**Charts Not Loading**:
- Ensure Chart.js CDN is accessible
- Check browser console for errors
- Try refreshing the page

**PWA Not Installing**:
- Must be served over HTTPS (or localhost)
- Check browser compatibility
- Clear browser cache

## 📞 Support & Feedback

### Getting Help
- Check browser console for error messages
- Export data for backup before troubleshooting
- Test in incognito/private mode

### Contributing
This is an open-source project. Contributions welcome!

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- Chart.js for visualization
- Google Drive API for cloud sync
- Withings Health API for weight data
- The Retatrutide community for feedback

---

**Disclaimer**: This application is for personal tracking only. Always consult with healthcare providers for medical decisions. This tool does not provide medical advice.

**Version**: 1.0.0
**Last Updated**: 2025-09-26
**Author**: Retatrutide Tracker Team