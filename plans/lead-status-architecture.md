# Lead Status System — Architecture Plan

> Based on discussion and [specs.md §16-19](specs.md)

---

## 1. LeadStatus Enum (Pipeline Stages Only)

```
NEW → CALLBACK → INTERESTED → VISIT_BOOKED → BOOKED
  ↘ INVALID_NUMBER
  ↘ NOT_INTERESTED
```

| Value | Meaning | Terminal? |
|-------|---------|-----------|
| `NEW` | Fresh lead, not contacted yet | No |
| `CALLBACK` | Need to call back later | No |
| `INTERESTED` | Lead showed interest | No |
| `VISIT_BOOKED` | Site visit scheduled | No |
| `BOOKED` | Deal closed / unit booked | **Yes** |
| `NOT_INTERESTED` | Lead declined | **Yes** |
| `INVALID_NUMBER` | Wrong/unreachable number | **Yes** |

> ❌ `RINGING`, `BUSY`, `RE_VISIT`, `CLOSED` are **removed** from status enum (they belong as sub-fields)

---

## 2. Sub-Fields (Conditional Based on Status)

### 2a. Callback Reason (`callback_reason`)
- **Visible when:** `status === 'CALLBACK'`
- **Type:** `enum`: `'busy' | 'switched_off' | 'ringing' | 'disconnected'`
- **UI:** Dropdown/picker in status dialog

### 2b. Interested Data
- **Visible when:** `status === 'INTERESTED'`
- **Fields:**
  - `property_type`: string (optional) — e.g., "2BHK", "Villa"
  - `budget`: string (already exists in Lead type)
  - `preferred_area`: string (optional)

### 2c. Not Interested Reason (`not_interested_reason`)
- **Visible when:** `status === 'NOT_INTERESTED'`
- **Type:** `enum`: `'too_expensive' | 'not_looking' | 'already_purchased' | 'bad_location' | 'fake_lead' | 'others'`

### 2d. Site Visit (already exists)
- **Visible when:** `status === 'VISIT_BOOKED'`
- `site_visit_at`: Date (optional)
- `site_visit_booked`: boolean

---

## 3. Status Dialog UX Flow

When user taps a status button:

```
┌─────────────────────────────┐
│      Update Status          │
│      ── CALLBACK ──         │
│                             │
│  [Callback Reason dropdown] │  ← only for CALLBACK
│  ┌─ busy                    │
│  │─ switched_off            │
│  └─ ringing                 │
│                             │
│  ── or ──                   │
│                             │
│  [Property Type input]      │  ← only for INTERESTED
│  [Budget input]             │
│  [Preferred Area input]     │
│                             │
│  ── or ──                   │
│                             │
│  [Not Interested dropdown]  │  ← only for NOT_INTERESTED
│                             │
│  ── always ──               │
│                             │
│  [Optional remark...]       │
│                             │
│  [Cancel]    [Save]         │
└─────────────────────────────┘
```

---

## 4. Files to Modify

| File | What Changes |
|------|-------------|
| [`frontend/src/types/index.ts`](frontend/src/types/index.ts) | Revert status enum to pipeline stages + add new sub-fields |
| [`backend/src/models/Lead.ts`](backend/src/models/Lead.ts) | Revert status enum + add `callback_reason`, `property_type`, `preferred_area`, `not_interested_reason` |
| [`backend/src/controllers/leadController.ts`](backend/src/controllers/leadController.ts) | Update dashboard stats to new statuses, support sub-fields in `updateLead` |
| [`frontend/src/screens/LeadDetailScreen.tsx`](frontend/src/screens/LeadDetailScreen.tsx) | Conditional sub-field UI in status dialog, revert status buttons |
| [`frontend/src/screens/LeadListScreen.tsx`](frontend/src/screens/LeadListScreen.tsx) | Revert filter chips to pipeline statuses |
| [`frontend/src/screens/DashboardScreen.tsx`](frontend/src/screens/DashboardScreen.tsx) | Update pipeline view to new statuses (Callback, Interested, Visit Booked, Booked) |

---

## 5. Dashboard Pipeline View

```
┌───────────────┬───────────────┐
│  Total Leads  │     New       │
│      (45)     │     (12)      │
└───────────────┴───────────────┘
┌──────────────────────────────────┐
│        Pipeline Status           │
│  ┌─────────┬──────────┬───────┐ │
│  │Callback │Interested│ Visit │ │
│  │  (8)    │   (5)    │  (3)  │ │
│  └─────────┴──────────┴───────┘ │
│  ┌─────────┬──────────┬───────┐ │
│  │ Booked  │Not Int.  │Invalid│ │
│  │  (2)    │   (3)    │  (1)  │ │
│  └─────────┴──────────┴───────┘ │
└──────────────────────────────────┘
```

---

## 6. Implementation Order

1. **Revert types** — Fix `status` enum in both frontend types and backend model
2. **Add sub-fields** — `callback_reason`, `property_type`, `preferred_area`, `not_interested_reason` to model + types
3. **Update backend controller** — Support sub-fields in `updateLead`, fix dashboard stats
4. **Update status dialog UI** — Conditional sub-field rendering per status
5. **Fix filter chips** — Revert to pipeline stages
6. **Fix dashboard** — Revert to pipeline stages