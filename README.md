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
3. Create `.env` from `.env.example` and add your `MONGO_URI`.
4. `npm start` to run the backend.
5. `cd ../frontend && npm install`.
6. `npx expo start` to run the mobile app.

## Development Status
- **Phase 1-5 (Backend)**: Complete (13/13 Tests Passing).
- **Phase 6-11 (Frontend)**: Complete (MVP Screens & Navigation).