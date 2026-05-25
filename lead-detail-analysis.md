# Lead Detail Screen — Comprehensive Analysis

> Based on: [`LeadDetailScreen.tsx`](frontend/src/screens/LeadDetailScreen.tsx), [`specs.md`](specs.md), [`screen-flow.md`](screen-flow.md), [`data-schema.md`](data-schema.md), [`api-spec.md`](api-spec.md), [`Lead.ts` (model)](backend/src/models/Lead.ts), [`leadController.ts`](backend/src/controllers/leadController.ts), [`leadRoutes.ts`](backend/src/routes/leadRoutes.ts), [`types/index.ts`](frontend/src/types/index.ts)

---

## 1. Current State — What's Implemented

### Displayed Fields
| Field | Present? | Notes |
|---|---|---|
| Name | ✅ | |
| Mobile | ✅ | |
| Status | ✅ | Badge display |
| Heat | ✅ | Badge display |
| Duplicate Status | ✅ | |
| Project | ✅ | Conditionally shown |
| Source | ✅ | |
| Facebook Page Name | ✅ | Conditionally shown |
| Facebook Form Name | ✅ | Conditionally shown |
| Custom Data (Form Answers) | ✅ | Prettified key display |
| City | ❌ | Exists in schema, not shown |
| Budget | ❌ | Exists in schema, not shown |
| Email | ❌ | Exists in schema, not shown |
| Assigned To | ❌ | Not displayed |
| Next Reminder Info | ❌ | Not displayed |

### Actions Available
| Action | Implemented? | Notes |
|---|---|---|
| Update Status | ✅ | With optional remark dialog |
| Set Heat | ✅ | HOT/WARM/COLD buttons |
| Site Visit Book | ✅ | Only when status = INTERESTED, but just boolean toggle |
| Schedule Follow-up | ✅ | Date & Time picker |
| Assign Lead | ✅ | Admin/Superadmin only |
| Duplicate Management | ✅ | Admin/Superadmin only |
| WhatsApp (wa.me) | ❌ | Missing |
| Call (tel:) | ❌ | Missing |
| Standalone Remark/Note | ❌ | Only in status change dialog |
| Site Visit Date/Time | ❌ | Missing date/time picker for visit |
| Re-visit toggle | ❌ | Missing |

### Activity Log (History Tab)
- ✅ Shows chronological activity logs with dot indicators
- ✅ Displays user name and timestamp
- ❌ No differentiation by activity type (icon/badge per type)
- ❌ No empty state illustration (just italic text)

---

## 2. Gaps vs Product Specs

### From [`specs.md`](specs.md) §26 — Lead Detail Screen
> Display: name, phone, source, project, assigned user, status, heat, remarks, follow-up date, activity history
> Actions: WhatsApp, update status, add remark, assign follow-up

- ❌ **Assigned user** is not displayed in the info card
- ❌ **Remarks** are not shown in the info card (only logged but not visible standalone)
- ❌ **Follow-up date** is not displayed
- ❌ **WhatsApp** quick action missing
- ❌ **Standalone remark** (not tied to status change) missing

### From [`screen-flow.md`](screen-flow.md) §3.4 — Lead Detail Screen (Admin & Staff)
> Header: Customer name + Action Bar (Call, WhatsApp, Temperature Toggle) + ⋮ menu
> Customer Info: Name, Mobile, Source, Project, City, Budget
> Status Update: Dropdown picker with optional Remark/Note
> Conditional Fields (Site Visit): Visit Date & Time (Picker), Is Re-visit? (Toggle)
> Activity Log: status_change, note, call_init, whatsapp_send, assigned

- ❌ **Action Bar** with Call/WhatsApp/Temperature toggle at top
- ❌ **⋮ menu** (more options dropdown) missing
- ❌ **City & Budget** not displayed
- ❌ **Site Visit** flow is incomplete (no date/time picker, no re-visit toggle)
- ❌ Activity types in log (call_init, whatsapp_send, etc.) not visually differentiated

### From [`data-schema.md`](data-schema.md) — Lead Model
Fields not used on detail screen:
- `budget` (Number) — available on model
- `city` (String) — available on model
- `email` (String) — available on model
- `next_reminder_at` (Timestamp) — available on model
- `next_reminder_remark` (String) — available on model
- `last_call_at` (Timestamp) — available on model
- `last_whatsapp_at` (Timestamp) — available on model
- `visit_date` (Timestamp) — only exists in schema, not in the Lead type

---

## 3. Code Quality Observations

### Strengths
- Clean functional component with hooks
- Good separation of local state management
- Proper error handling with Alert.alert
- Remark dialog for status changes adds context to activity logs
- Assignable users memoized with deduplication
- Keyboard-aware (keyboardShouldPersistTaps="handled")
- Accessible modal patterns with proper onRequestClose

### Issues & Improvements
1. **Lead data from route params** — `route.params.lead` is passed directly, but never refreshed from API. If another user updates the lead, stale data persists.
2. **No initial loading state** — No skeleton/shimmer for initial render
3. **No pull-to-refresh** — Can't refresh lead data or activity logs
4. **No error state UI** — Failed API calls show alert but no inline error UI
5. **Site Visit is oversimplified** — Just a boolean toggle, no date/time picker or re-visit option as per screen-flow.md
6. **`any` types used** — `route: any`, `navigation: any`, `log: any`, `member: any`, `s: any` — should use proper typed interfaces
7. **Activity log types not utilized** — `log.type` available but not used for visual differentiation
8. **No WhatsApp/Call quick actions** — wa.me and tel: deep links missing
9. **City, Budget, Email, Assigned user** not displayed despite being available
10. **No activity log type icons/badges** — All logs look identical regardless of type
11. **Back button is plain text** — Could be more intuitive

---

## 4. Backend Analysis

### API Endpoints Used
| Endpoint | Method | Purpose | Used? |
|---|---|---|---|
| `/leads/:id` | PATCH | Update lead fields | ✅ |
| `/leads/:id/logs` | GET | Fetch activity logs | ✅ |
| `/users` | GET | Fetch staff list | ✅ |
| `/reminders` | POST | Create reminder | ✅ |

### Missing Backend Features
- No dedicated endpoint for adding remarks/notes (`POST /api/leads/:id/activity` exists in api-spec.md but not implemented)
- No dedicated endpoint for site visit scheduling with date/time
- The `GET /leads/:id` endpoint exists (getLeadDetails) but the frontend doesn't call it on mount

---

## 5. Summary of Recommended Improvements

### High Priority
1. **Add WhatsApp & Call quick action buttons** (wa.me / tel: links)
2. **Display missing fields**: City, Budget, Email, Assigned User, Next Reminder
3. **Add Pull-to-Refresh** on the ScrollView
4. **Fetch lead data from API on mount** instead of relying solely on route params

### Medium Priority
5. **Standalone remark/note input** (not tied to status change)
6. **Site Visit date/time picker** with re-visit toggle
7. **Differentiate activity log items by type** (icons/colors)
8. **Add loading skeleton** for initial data fetch
9. **Proper TypeScript types** instead of `any`

### Low Priority
10. **Action Bar** with temperature toggle at top as per screen-flow.md
11. **⋮ menu** for additional options
12. **Error boundary / inline error states**