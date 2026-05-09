# Real Estate CRM — Screen Flow Specification
> Framework: React Native + React Native Web (Android Native + iOS/Web PWA)

## 1. Authentication & Onboarding

### 1.1 Splash Screen
- App logo centered.
- Auto-redirect:
  - Valid JWT → Role-based Dashboard.
  - No JWT → Login Screen.

### 1.2 Sign-Up (Admin Registration)
- **Removed:** System is Invite-Only. The Developer manually creates the Organization and hands the Admin a starting password.

### 1.3 Login Screen
- Fields: Mobile Number, Password.
- Actions: `Login` → Dashboard.
- *(No "Forgot Password" link. Admin must contact Developer for reset; Staff contacts Admin.)*

### 1.4 Forced Password Change (First Login)
- Triggered automatically if `must_change_password: true` in JWT.
- Cannot navigate to Dashboard until completed.
- Fields: New Password, Confirm Password (no current password needed).
- On success: `must_change_password` set to `false` → redirect to Dashboard.

### 1.5 Account Suspended Screen
- Shown automatically if the backend returns a `403 Suspended` error.
- Message: "Your agency's account has been suspended. Please contact the system administrator to resume access."

---

## 2. Navigation Structure (Bottom Tabs)

### 2.1 Admin Tabs
- Home (Admin Dashboard)
- Leads (All Leads)
- Unassigned (Queue)
- Staff (List)
- Profile

### 2.2 Staff Tabs
- Home (My Summary)
- My Leads
- Follow-ups
- Profile

### 2.3 SuperAdmin Tabs
- Agencies (Dashboard + List)
- Profile

---

## 3. Admin Experience

### 3.1 Admin Dashboard
- **Stats (2x2 grid):** Total Leads, Unassigned, Today's Follow-ups, Monthly Closed.
- **Leads by Status:** Tappable donut chart or horizontal bar (Status: New, Call Back, Interested, etc.).
- **Staff List:** Quick view of top 3 performers (Name, Leads Assigned, Leads Closed).

### 3.2 All Leads Screen
- **Header:** "All Leads" + total count badge.
- **Search Bar:** Name or Mobile.
- **Filter Chips (Scrollable):** Status, Source, Staff, Date.
- **Bulk Selection Mode:** Long-press to Select All/Multiple for `Bulk Assign`, `Bulk Status Update`, or `Bulk Archive`.
- **Lead List (FlatList):**
  - Card Structure: Customer Name, Full Mobile Number (tap to call), Status Badge (color-coded), Lead Temperature (🔥/🌤️/❄️), Quick Actions (`📞 Call` | `💬 WhatsApp`), Activity Info ("Last called: 2h ago"), Source Badge.
- **FAB:** `+ Add Lead` button.

### 3.3 Unassigned Queue
- **Header:** "Unassigned" + count badge (leads < 24h old).
- **Lead List:** Shows fresh leads needing immediate assignment.
- **Assign Bottom Sheet:** Searchable staff picker or "Take it myself".

### 3.4 Lead Detail Screen (Admin & Staff)
- **Role Differences:**
  - **Staff cannot see:** Assignment history, Reassign option in `⋮` menu.
  - **Admin can:** View history, Reassign, and update any lead regardless of assignment.
- **Header:** Customer name + Action Bar (Call, WhatsApp, Temperature Toggle) + `⋮` menu.
- **Customer Info:** Name, Mobile, Source, Project, City, Budget.
- **Status Update:** Dropdown picker.
  - Options: New / Invalid / Call Back / Interested / Site Visit / Closed / Not Interested
  - **Optional Field:** `Remark / Note` (Text input).
  - **Conditional Fields (Site Visit):** `Visit Date & Time` (Picker), `Is Re-visit?` (Toggle).
- **Activity Log:** Chronological list (status_change, note, call, whatsapp, assigned).
- **Add Note:** Text input + `Save Note` button.

### 3.5 Add Lead Screen
- **Fields:** Customer Name (req), Mobile Number (req), Source (dropdown), Project Name, City, Budget, Assign To (optional).
- **Actions:** `Save Lead`.

### 3.6 Staff Management (List & Detail)
- **Staff List:** Cards showing Avatar, Name, Mobile, Active/Inactive badge, Leads assigned count.
- **Staff Detail:** Performance stats (Total assigned, leads by status, WhatsApp messages sent count), List of assigned leads. `⋮` menu to Deactivate or Reset Password.

### 3.7 Add Staff Screen
- **Fields:** Full Name, Mobile Number, Role.
- **Actions:** `Create Staff`.
- **WhatsApp Invite:** Tapping "Share Credentials" opens WhatsApp: *"Hi {name}, you've been added to {AgencyName} CRM. Login with mobile and temp password: {tempPassword}."*

---

## 4. Staff Experience

### 4.1 Staff Home (My Summary)
- Stats: My Leads (total assigned), Pending Actions.
- Today's Follow-ups: List of leads with reminders due today.

### 4.2 My Leads Screen
- List of leads assigned to the logged-in staff.
- Automatic Archive: `Closed`, `Not Interested`, and `Invalid` leads are hidden.

### 4.3 Follow-up List Screen
- **Tabs:** Today (highlighted), Upcoming (next 7 days), Overdue.
- **Lead Card:** Customer name, Status, Follow-up date/time. Tap → Lead Detail.

---

## 5. Shared Components & UX Polish

### 5.1 Notifications Screen
- List of system alerts: New lead assigned, Re-assigned, Reminder due.
- Mark all as read button.
- **iOS Note:** Push notifications require PWA "Add to Home Screen" (iOS 16.4+).

### 5.2 Profile & Settings
- Personal info, Role badge, Logout.
- **Change Password:** 
  - **Fields:** `Current Password` (optional on forced first login), `New Password`, `Confirm Password`.
  - **Action:** `Update Password`.

### 5.3 Empty States & Loaders
- **Empty States:** "No unassigned leads 🎉", "No leads assigned yet", "No follow-ups scheduled".
- **Loaders:** Skeleton loaders for list screens, spinner inside buttons for actions.
- **Pull-to-Refresh:** All list screens support pull-to-refresh.

---

## 6. SuperAdmin Experience (Developer UI)

### 6.1 SuperAdmin Dashboard
- **Stats:** Total Active Agencies, Total Suspended, Total Leads System-Wide.
- **Agency List:** A list of all organizations using the CRM.
- **Agency Card:** Agency Name, Admin Name, Mobile, Status Badge (`Active` / `Suspended`).

### 6.2 Agency Detail & Actions
- **Actions Menu:**
  - `Suspend Agency` / `Activate Agency`.
  - `Reset Admin Password`.
- **Details:** Shows when they joined and how many leads they are processing.

### 6.3 Add New Agency Screen
- **Fields:** Agency Name, Admin Full Name, Admin Mobile Number, Admin Starting Password.
- **Action:** `Create Agency`. This provisions their database space instantly.
