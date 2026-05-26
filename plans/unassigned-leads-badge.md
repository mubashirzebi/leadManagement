# Unassigned Leads Badge + Tab — Plan

## Goal
Show admin/superadmin how many leads are unassigned with a small badge on the dashboard, and add an "Unassigned" tab in the LeadListScreen for quick access.

## Changes

### 1. Backend — `getDashboardStats` (leadController.ts)
Add `unassigned_leads` count to the response:
```typescript
const unassignedCount = await Lead.countDocuments({
  ...matchQuery,
  assigned_to: null,
  status: { $nin: ['NOT_INTERESTED', 'INVALID_NUMBER'] },
});
// Add to formattedStats:
unassigned_leads: unassignedCount,
```
Exclude dead leads (NOT_INTERESTED + INVALID_NUMBER) — they don't need assignment.

### 2. Backend — `getLeads` (leadController.ts) — already supports `assigned_to=null`
Current code at line 282-283:
```typescript
} else if (assigned_to) {
  query.assigned_to = assigned_to === 'null' ? null : assigned_to;
}
```
Frontend passes `?assigned_to=null` → backend sets `query.assigned_to = null`. Already works. No change needed.

### 3. Frontend — `DashboardScreen.tsx`
Add `unassigned_leads` to stats state. In the stat cards row, add a small badge pill inline next to "Total Leads":
```tsx
{stats.unassigned_leads > 0 && (
  <View style={styles.unassignedBadge}>
    <Text style={styles.unassignedBadgeText}>{stats.unassigned_leads} unassigned</Text>
  </View>
)}
```
Visible only when `isManager && stats.unassigned_leads > 0`. Tapping navigates to LeadList with the unassigned filter.

### 4. Frontend — `LeadListScreen.tsx`
Add "Unassigned" as a third segment in the segmented control (Organization Leads | My Leads | Unassigned):
```tsx
const [viewMode, setViewMode] = useState<'organization' | 'mine' | 'unassigned'>('organization');
```
When `viewMode === 'unassigned'`:
- Fetch with `?assigned_to=null&status!=NOT_INTERESTED&status!=INVALID_NUMBER` (or pass active-only filter)
- The unassigned tab shows only for `canUseManagerViews` (admin + superadmin)
- Tab label shows count: "Unassigned (5)"

## Execution Order
1. Backend: Add `unassigned_leads` to `getDashboardStats`
2. Frontend: Add `unassigned_leads` to stats state, add badge below "Total Leads" card
3. Frontend: Add "Unassigned" segment to LeadListScreen, wire fetch
4. Rebuild backend, verify