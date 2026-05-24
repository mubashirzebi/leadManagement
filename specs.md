# LeadFlow CRM — MASTER PRODUCT & ENGINEERING SPEC
Version: V1
Target: Claude Code / Codex
Product Type: Multi-Tenant Real Estate Lead Distribution CRM
Platform: Android App + Mobile Web (iOS Safari via Expo Web)

---

# Current Build Status

Phase 1 implementation has started in this repo.

Implemented foundation:
- npm workspace monorepo
- shared TypeScript enums/types
- Express + TypeScript backend skeleton
- MongoDB/Mongoose models
- JWT auth routes
- organization/user/project/lead routes
- Meta integration routes
- Meta webhook verification and intake route
- mock/live Meta client switch
- Expo Router mobile skeleton

Development requirement:
- Use Node.js 20 or 22 LTS. Expo web currently fails under Node 24 in this project with a port-scanner error.

Phase 1 focus:
- Meta lead capture
- multi-page Meta integration per organization
- form-to-project mapping foundation
- admin lead inbox
- caller lead access/update foundation

See:
- `docs/PHASE_1_META.md`
- `apps/backend/.env.example`
- `apps/mobile/.env.example`

---

# 1. Product Vision

LeadFlow is a lightweight SaaS CRM for real estate agencies.

Core workflow:

1. Agency admin connects Meta/Google lead source
2. Leads automatically enter system
3. Admin assigns leads to callers/staff
4. Caller updates status + remarks
5. Admin tracks lead progress

Primary goal:
- fast lead handling
- mobile-first workflow
- simple team management
- zero CRM complexity

This is NOT a generic enterprise CRM.

---

# 2. Tech Stack

## Frontend
- React Native
- Expo
- Expo Router
- Expo Web
- TypeScript
- Zustand
- TanStack Query
- Axios
- React Hook Form
- Zod

## Backend
- Node.js
- Express.js
- TypeScript
- MongoDB
- Mongoose
- JWT
- bcrypt
- node-cron

## Notifications
- OneSignal

## Hosting
- Frontend → Vercel / Netlify
- Backend → Railway / Render
- Database → MongoDB Atlas

---

# 3. Product Architecture

/apps
  /mobile
  /backend

/packages
  /shared-types

Single codebase:
- Android app
- iOS Safari web app

No separate Next.js app in V1.

---

# 4. Multi-Tenant Architecture

Each agency is isolated.

Every collection MUST contain:
- organizationId

All queries MUST filter using organizationId.

No cross-organization access allowed.

---

# 5. User Hierarchy

## Platform Super Admin
Platform owner.

Responsibilities:
- create organizations
- create first agency admin
- reset agency admin passwords
- suspend/activate organizations
- monitor integrations
- monitor webhook failures

Super Admin is NOT part of any organization.

---

## Agency Admin
Agency owner/manager.

Responsibilities:
- manage staff/callers
- create team members
- reset staff passwords
- assign leads
- connect Meta/Google integrations
- manage projects
- view organization leads

Agency Admin belongs to one organization only.

---

## Staff / Caller
Operational users.

Responsibilities:
- access assigned leads only
- update lead status
- add remarks
- schedule follow-ups

No access to:
- integrations
- organization settings
- user management

---

# 6. Authentication System

## Auth Type
- JWT Access Token
- Refresh Token

## Login
- mobile number/password only

## Security Rules
- hashed passwords only
- JWT protected APIs
- forced password change on first login

---

# 7. Organization Creation Flow

1. Super Admin creates organization
2. Super Admin creates first agency admin
3. System generates temporary password
4. Agency admin logs in
5. Forced password change

No public signup in V1.

---

# 8. Staff Creation Flow

1. Agency admin creates staff/caller
2. System generates temporary password
3. Staff logs in
4. Forced password change required

---

# 9. Password Reset Rules

## Super Admin
Can reset:
- agency admin passwords

Cannot reset:
- staff passwords

---

## Agency Admin
Can reset:
- staff/caller passwords inside own organization

Cannot reset:
- super admin
- other organizations

---

# 10. Suspension Rules

If organization.isSuspended === true:
- all users blocked from login
- integrations disabled
- webhook processing stopped

Acts as platform kill switch.

---

# 11. Lead Sources

Supported:
- Meta Lead Ads
- Google Ads Lead Forms
- Manual Entry

---

# 12. Meta Integration (V1)

V1 uses TOKEN-BASED integration.

NO OAuth initially.

## Admin Inputs
- pageAccessToken
- pageId

## Flow
1. Admin pastes token + page ID
2. Backend stores encrypted token
3. Meta webhook hits backend
4. Backend fetches lead details
5. Lead stored in DB
6. Admin notified

## Token Expiry
If token fails:
- mark integration disconnected
- show reconnect alert

---

# 13. Google Lead Integration

Webhook-based integration.

Store:
- customerId
- webhook token
- integration metadata

---

# 14. Notification Rules

Use OneSignal.

## Notification Events

### Admin
- new lead received

### Staff/Caller
- lead assigned

No other notifications in V1.

---

# 15. Lead Assignment Flow

## Admin Flow
1. Open unassigned leads
2. Select one or multiple leads
3. Select caller/staff
4. Assign

## Staff Flow
1. Receive notification
2. Open assigned lead
3. Update status
4. Add remark
5. Schedule follow-up

---

# 16. Lead Status System

STRICT ENUM ONLY.

## LeadStatus
- NEW
- INVALID_NUMBER
- CALLBACK
- INTERESTED
- NOT_INTERESTED

No custom statuses allowed.

---

# 17. Callback Reasons

## CallbackReason
- busy
- switched_off
- ringing
- disconnected

---

# 18. Interested Lead Data

Optional fields:
- propertyType
- budget
- preferredArea

---

# 19. Not Interested Data

Optional:
- reasonDropdown
- remark

## Suggested Reasons
- too_expensive
- not_looking
- already_purchased
- bad_location
- fake_lead
- others

---

# 20. Lead Heat Tracking

## LeadHeat
- HOT
- WARM
- COLD

---

# 21. Duplicate Detection

Duplicate rule:
- same phone number inside same organization

When duplicate found:
- flag duplicate
- admin decides action

Possible actions:
- merge
- ignore
- create separate

---

# 22. Projects

Organizations can manage multiple projects.

Each lead belongs to optional project.

## Project Fields
- name
- location
- builder
- configuration

---

# 23. WhatsApp Integration

Use wa.me deep links only.

Example:
https://wa.me/919999999999

Optional text:
https://wa.me/919999999999?text=Hello

NO WhatsApp API in V1.

---

# 24. Mobile Screens

## Authentication
- Splash
- Login
- Change Password

---

## Super Admin
- Dashboard
- Organizations List
- Organization Details
- Integration Health
- Webhook Logs

---

## Agency Admin
- Dashboard
- Lead Inbox
- Lead Details
- Assign Leads
- Team Management
- Integration Settings
- Projects

---

## Staff / Caller
- My Leads
- Lead Details
- Follow-ups

---

# 25. Dashboard Metrics

## Super Admin Dashboard
- total organizations
- total users
- total leads
- active organizations
- suspended organizations
- failed integrations

---

## Agency Dashboard
- total leads
- unassigned leads
- interested leads
- today's follow-ups

No analytics engine in V1.

---

# 26. Lead Detail Screen

## Display
- name
- phone
- source
- project
- assigned user
- status
- heat
- remarks
- follow-up date
- activity history

## Actions
- WhatsApp
- update status
- add remark
- assign follow-up

---

# 27. MongoDB Collections

## organizations
{
  name,
  isSuspended,
  planType,
  createdAt
}

---

## users
{
  organizationId,
  role,
  name,
  mobileNumber,
  passwordHash,
  mustChangePassword,
  isActive,
  oneSignalPlayerId,
  createdAt
}

---

## integrations
{
  organizationId,
  type,
  metaPageId,
  metaAccessToken,
  status,
  lastWebhookAt,
  createdAt
}

---

## projects
{
  organizationId,
  name,
  location,
  builder,
  configuration,
  createdAt
}

---

## leads
{
  organizationId,
  projectId,
  assignedTo,
  source,
  name,
  phone,
  email,
  status,
  heat,
  callOutcome,
  remarks,
  followUpDate,
  duplicateFlag,
  createdAt
}

---

## activities
{
  organizationId,
  leadId,
  userId,
  type,
  message,
  createdAt
}

---

## webhookLogs
{
  organizationId,
  source,
  payload,
  status,
  errorMessage,
  createdAt
}

---

# 28. Lead callOutcome Structure

Example:

{
  "status": "CALLBACK",
  "callOutcome": {
    "callbackReason": "busy"
  }
}

Example:

{
  "status": "INTERESTED",
  "callOutcome": {
    "propertyType": "2BHK",
    "budget": "80L",
    "preferredArea": "Thane"
  }
}

---

# 29. API Endpoints

## Auth
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/change-password

---

## Organizations
GET /api/organizations
POST /api/organizations
PATCH /api/organizations/:id/suspend

---

## Users
GET /api/users
POST /api/users
PATCH /api/users/:id/reset-password

---

## Leads
GET /api/leads
GET /api/leads/:id
POST /api/leads
PATCH /api/leads/:id
PATCH /api/leads/bulk-assign

---

## Projects
GET /api/projects
POST /api/projects

---

## Integrations
POST /api/integrations/meta/connect
POST /api/integrations/google/connect

---

## Webhooks
POST /api/webhooks/meta
POST /api/webhooks/google

---

# 30. Query Rules

All lead APIs:
- paginated
- searchable
- filterable

Filters:
- status
- assignedTo
- project
- source
- heat
- follow-up date

---

# 31. Backend Structure

/src
  /modules
    /auth
    /organizations
    /users
    /projects
    /leads
    /integrations
    /notifications
    /webhooks

  /middleware
  /utils
  /config
  /cron

---

# 32. Cron Jobs

Use node-cron.

## Jobs
- follow-up reminders
- token health checks

Run:
- every day 8 AM IST

---

# 33. Activity Logs

Every important action creates activity log.

Examples:
- lead assigned
- status updated
- remark added
- password reset
- organization suspended

---

# 34. Business Rules

1. Caller can only access assigned leads
2. Agency data fully isolated
3. Duplicate check only inside organization
4. Admin can bulk assign leads
5. Status values strictly controlled
6. Meta token expiry disables integration
7. Every lead update creates activity log
8. Suspended organizations blocked completely
9. No public registration in V1

---

# 35. V1 Non-Goals

DO NOT BUILD:
- AI features
- WhatsApp API
- campaign automation
- advanced analytics
- desktop-first dashboard
- drag/drop pipelines
- Redis
- BullMQ
- microservices
- IVR integration
- payment system
- file uploads

---

# 36. Deployment

## Frontend
Deploy Expo Web build on:
- Vercel
OR
- Netlify

## Backend
Deploy on:
- Railway
OR
- Render

## Database
- MongoDB Atlas Free Tier

---

# 37. Development Phases

## Phase 1
- auth
- organizations
- roles
- lead CRUD

## Phase 2
- Meta webhook
- assignment flow
- caller workflow

## Phase 3
- notifications
- follow-ups
- projects

## Phase 4
- Google integration
- webhook logs
- production fixes

---

# 38. Product Philosophy

Keep product:
- fast
- mobile-first
- operationally simple
- easy for callers

Avoid enterprise CRM complexity.

This product is:
lead distribution + caller workflow system first.

NOT a bloated CRM.
