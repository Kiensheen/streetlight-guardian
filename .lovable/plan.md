

## Streetlight Monitoring Dashboard

A data-rich web application to monitor 3 streetlights in real-time, track faults, and view weekly performance summaries. Connected to Firebase for live sensor data.

---

### 🔐 Authentication

**Simple Login System**
- Login page with email and password
- Secure session management
- Protected dashboard (only logged-in users can access)

---

### 📊 Main Dashboard

**Real-Time Monitoring Panel**
- Overview cards showing each of the 3 streetlights
- Live status indicators (On/Off/Flickering/Dim)
- Current voltage and power readings per light
- Visual health status (green = healthy, yellow = warning, red = fault)

**Fault Detection Display**
- Automatic detection of light issues (off when should be on, flickering, dim output)
- Timestamp for when each fault was detected
- Fault severity indicators

---

### 🔔 Notification Center

**In-App Notifications**
- Bell icon in the header showing unread notification count
- Dropdown panel listing recent fault alerts
- Each notification shows: streetlight ID, fault type, and detection time
- Ability to mark notifications as read
- Notification history log

---

### 📈 Weekly Summary Reports

**Voltage Statistics**
- Line/area charts showing voltage trends over the week
- Min, max, and average voltage per streetlight
- Voltage anomaly highlighting

**Current & Power Readings**
- Power consumption charts per light
- Weekly power usage comparison

**Fault Frequency Analysis**
- Bar chart showing how often faults occurred
- Breakdown by fault type and time of day

**Uptime/Downtime Report**
- Percentage uptime for each streetlight
- Visual timeline showing on/off periods
- Total operational hours

---

### 🔥 Firebase Integration

**Real-Time Data Connection**
- Connect to your existing Firebase database
- Live updates when sensor data changes
- Fetch historical data for charts and summaries

---

### 🎨 Design & Layout

**Data-Rich Dashboard Style**
- Clean, professional interface with charts and graphs
- Responsive design for desktop and tablet viewing
- Dark/light mode support
- Interactive charts with hover details and tooltips

