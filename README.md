# Multi-Tenant Real Estate CRM

A robust, modular monolith backend and React Native frontend for managing real estate leads across multiple agencies.

## Features

### 🏢 Multi-Tenancy
- **Hard Isolation**: Organization-level data isolation using `organization_id`.
- **Kill Switch**: Instant access revocation for suspended agencies.

### 🔐 Authentication
- **Role-Based Access**: SuperAdmin, Admin, and Staff roles.
- **Security First**: Forced password change on first login.
- **JWT Protected**: Secure API communication with token-based auth.

### 🎯 Lead Management
- **Webhook Ingestion**: Automated lead capture from Meta and Google.
- **Manual Entry**: Quick-add leads directly from the mobile app.
- **Smart Tracking**: Heat tracking (Hot/Warm/Cold) and status lifecycle management.
- **Activity Logs**: Complete audit trail of all lead interactions.

### ⏰ Automation
- **Reminders**: Background cron job for follow-up notifications.
- **Bulk Assignment**: Rapid distribution of leads to staff members.

## Tech Stack
- **Backend**: Node.js, Express, TypeScript, MongoDB Atlas.
- **Frontend**: React Native, Expo, React Navigation, Axios.
- **Testing**: Jest, Supertest (TDD workflow).

## Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas Account
- Expo Go app (for mobile testing)

### Setup
1. Clone the repo.
2. `cd backend && npm install`.
3. Create `backend/.env` from `.env.example` and add your `MONGO_URI` and JWT value.
4. `npm start` to run the backend.
5. `cd ../frontend && npm install`.
6. `npx expo start` to run the mobile app.

## Meta Connection Setup

1. Add Meta credentials in `backend/.env`:
   - `META_APP_ID`
   - `META_APP_SECRET`
   - `META_VERIFY_TOKEN`
2. Add frontend env in `frontend/.env`:
   - `EXPO_PUBLIC_META_APP_ID` (same as backend app id)
   - `EXPO_PUBLIC_API_URL` (backend base URL ending with `/api`)
3. In Meta Developer App settings:
   - Add OAuth redirect URI: `leadmanagement://meta-auth`
   - Enable required permissions: `pages_show_list`, `pages_manage_ads`, `leads_retrieval`, `pages_read_engagement`
4. Configure webhook callback URL to `https://<your-domain>/api/webhooks/meta` with verify token = `META_VERIFY_TOKEN`.

## Development Status
- **Phase 1-5 (Backend)**: Complete (13/13 Tests Passing).
- **Phase 6-11 (Frontend)**: Complete (MVP Screens & Navigation).