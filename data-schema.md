# Real Estate CRM — Data Schema (MongoDB)

## 1. Organizations
- `id`: ObjectId
- `name`: String
- `status`: Enum ['active', 'suspended'] (Controlled by Developer for billing)
- `created_at`: Timestamp

## 2. Users (Admin / Staff)
- `id`: ObjectId
- `organization_id`: ObjectId | Null (Null for SuperAdmin only. Nulls must be excluded from organization uniqueness queries)
- `name`: String
- `mobile`: String
  - **Unique index:** `{ mobile: 1, organization_id: 1 }` (Staff can exist in multiple Orgs)
- `password`: String (Hashed)
- `role`: Enum ['superadmin', 'admin', 'staff']
- `status`: Enum ['active', 'inactive']
- `must_change_password`: Boolean
- `fcm_token`: String | Null
- `web_push_subscription`: Object | Null
- `created_at`: Timestamp

## 3. Leads
- `id`: ObjectId
- `organization_id`: ObjectId
- `assigned_to`: ObjectId (User ID) | Null
- `name`: String
- `mobile`: String (Unique within Org)
- `source`: String (Meta, Google, Manual, etc.)
- `project`: String
- `budget`: Number
- `city`: String
- `status`: Enum ['New', 'Imported', 'Invalid Number', 'Call Back', 'Interested', 'Site Visit', 'Closed', 'Not Interested']
- `temperature`: Enum ['Hot', 'Warm', 'Cold'] (Default: 'Warm')
- `next_reminder_at`: Timestamp | Null
- `next_reminder_remark`: String | Null
- `visit_date`: Timestamp | Null
- `is_revisit`: Boolean
- `last_call_at`: Timestamp | Null
- `last_whatsapp_at`: Timestamp | Null
- `created_at`: Timestamp
- `updated_at`: Timestamp

## 4. ActivityLogs
- `id`: ObjectId
- `organization_id`: ObjectId
- `lead_id`: ObjectId
- `user_id`: ObjectId (Who performed action)
- `type`: Enum ['status_change', 'note', 'call_init', 'whatsapp_send', 'assignment']
- `content`: String (The note or remark. For assignment: "Assigned to {staffName} by {adminName}")
- `visit_date`: Timestamp | Null (Populated if type is status_change to Site Visit)
- `is_revisit`: Boolean | Null
- `created_at`: Timestamp

## 5. Reminders
- `id`: ObjectId
- `organization_id`: ObjectId
- `lead_id`: ObjectId
- `user_id`: ObjectId
- `remind_at`: Timestamp
- `remark`: String
- `is_sent`: Boolean (Default: false)
- `created_at`: Timestamp
