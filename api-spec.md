# Real Estate CRM — API Specification

## 1. Authentication Strategy
- **Registration:** Invite-only. SuperAdmin (Developer) provisions the Organization and Owner Admin directly in the database.
- **Regular Login:** Uses **Mobile Number + Password + JWT** (Access + Refresh tokens).
- **Session:** JWT contains `organization_id` and `role`.

## 2. Core Endpoints

### 2.1 Standard Response Envelope
All API responses will use this standard format to ensure consistency:
```json
{
  "success": true,
  "data": {},
  "message": "Optional success/error message"
}
```

### 2.2 Auth
- *(No public registration or forgot-password endpoints to keep the system Invite-Only and zero-cost)*
- `POST /api/auth/login`: Accepts `mobile` and `password`. Returns JWT tokens.
- `PATCH /api/auth/change-password`: Used when user is logged in to update password.
  - Body: `{ currentPassword?, newPassword }`

### 2.3 Leads
- `GET /api/leads`: List leads (Filtered by `organization_id`).
  - **Query Params:** `?status=&source=&assigned_to=&search=&archived=false&from=&to=`
- `POST /api/leads`: Create lead (Manual/API).
- `GET /api/leads/:id`: Get single lead details + activity logs.
- `PATCH /api/leads/bulk-assign`: 
  - Body: `{ leadIds: string[], staffId: string }`.
  - Used for both single and bulk assignment (avoids Express routing conflict with `:id`).
- `PATCH /api/leads/:id/status`:
  - Body: `{ status, remark?, visitDate?, isRevisit? }`.
- `PATCH /api/leads/:id/temperature`: Update 🔥/🌤️/❄️.

### 2.4 Users (Staff Management)
- `GET /api/users`: List staff in organization.
- `POST /api/users`: Create staff member (returns temp password).
- `GET /api/users/:id`: Get staff details and performance stats.
- `PATCH /api/users/:id/status`: Deactivate/activate staff.

### 2.5 Reminders & Activities
- `GET /api/reminders`: List upcoming/overdue reminders for logged-in user.
- `POST /api/leads/:id/reminders`: Set a new reminder.
- `POST /api/leads/:id/activity`: Add a manual note/remark.

### 2.6 Dashboard
- `GET /api/dashboard/admin`: Admin stats (Total Leads, Unassigned, Monthly Closed, Top Staff).
- `GET /api/dashboard/staff`: Staff stats (My Leads, Reminders Today, Pending Actions).

### 2.7 Webhooks
- `POST /api/webhooks/incoming?key=ORG_ID`: Processes Meta/Google lead JSON.

### 2.8 SuperAdmin (SaaS Management)
- **Guard:** All `/api/superadmin/*` routes require `role: 'superadmin'` in JWT. Returns 403 otherwise.
- `GET /api/superadmin/organizations`: List all client agencies.
- `POST /api/superadmin/organizations`: Create a new Agency and its Owner Admin account.
  - Body: `{ agencyName, adminName, adminMobile, adminPassword }`
- `PATCH /api/superadmin/organizations/:id/status`: Suspend/Activate an agency.
- `PATCH /api/superadmin/users/:id/reset-password`: Force reset an agency admin's password.

## 3. Business Logic Rules

### 3.1 Data Freshness
- Leads created within 24 hours are marked `New` and appear in the `Unassigned Queue`.
- Leads > 24 hours are marked `Imported` and skip the queue.

### 3.2 Duplicate Policy
- Unique Key: `mobile_number` + `organization_id`.
- On match: Update existing lead, log activity, and notify assigned staff.

### 3.3 Staff Deactivation
- When a user is deactivated:
  - `assigned_to` is set to `null` for all their active leads.
  - The leads retain their current status (e.g., 'Site Visit') but will reappear in the **Unassigned Queue** for the Admin to re-distribute.

### 3.4 Lead Archive
- Leads with status `Closed`, `Not Interested`, or `Invalid` are flagged as `Inactive` and hidden from active Staff views.

### 3.5 Billing & Suspension (Kill Switch)
- Every API request validates that the user's `Organization` is `active`.
- If the Developer sets the Organization to `suspended` (non-payment), the API returns a `403 Forbidden`.
- The frontend catches this and redirects all users to the Account Suspended screen.

### 3.6 Reminder Cron Job
- `node-cron` runs every minute on the backend.
- Queries `Reminders` where `remind_at <= now` and `is_sent: false`.
- Fires FCM/Web Push to the `user_id`.
- Sets `is_sent: true`.

## 4. Exclusions
- **Call Logging:** Excluded from MVP. Tapping 'Call' triggers dialer and updates `last_call_at` but does not record duration.
