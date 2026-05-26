# Multi-Project Visit Tracking (Chip/Tag Input)

## Problem
When an agent takes a client on a single site visit trip, they often tour **multiple projects** in one outing. The system must record which projects were shown during that specific visit, not just one.

**Real scenario:** Agent schedules Monday 11 AM visit. Client arrives. Agent shows "Green Valley", then drives to nearby "Skyline Towers", then "Palm Residency". Three projects, one trip, one "Mark Done".

## Design: `projects: string[]` with Chip/Tag Input

Each visit_history entry stores an array of project names. The Mark Done dialog uses a custom chip/tag input — pre-filled with `lead.project`, agent adds/removes chips.

---

## Implementation Plan

### 1. Backend: Model (`backend/src/models/Lead.ts`)

**Change from** `project?: string` **to** `projects?: string[]` in visit_history:

```typescript
// Interface
visit_history?: Array<{
  scheduled_at: Date;
  completed_at?: Date;
  outcome: 'completed' | 'cancelled' | 'no_show';
  cancellation_reason?: string;
  projects?: string[];           // <-- CHANGED from project?: string
  notes?: string;
  created_at: Date;
}>;
```

```typescript
// Schema
visit_history: [{
  scheduled_at: { type: Date },
  completed_at: { type: Date, default: null },
  outcome: { type: String, enum: ['completed', 'cancelled', 'no_show'] },
  cancellation_reason: { type: String, default: null },
  projects: [{ type: String }],   // <-- CHANGED: array of strings
  notes: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
}],
```

### 2. Backend: Controller (`backend/src/controllers/leadController.ts`)

**Destructure** `visit_projects` from body:
```typescript
const { ..., visit_projects } = req.body;
```

**Store in visit_entry** when `status === 'VISITED'`:
```typescript
if (status === 'VISITED') {
  const visitEntry: any = {
    scheduled_at: existingLead.site_visit_at || new Date(),
    completed_at: new Date(),
    outcome: 'completed',
    projects: visit_projects?.length
      ? visit_projects
      : [existingLead.project].filter(Boolean),  // fallback to lead.project
    notes: visit_notes || null,
    created_at: new Date(),
  };
  updateData.$push = { visit_history: visitEntry };
  updateData.$inc = { visit_count: 1 };
}
```

### 3. Frontend: Types (`frontend/src/types/index.ts`)

```typescript
visit_history?: Array<{
  scheduled_at: string;
  completed_at?: string;
  outcome: 'completed' | 'cancelled' | 'no_show';
  cancellation_reason?: string;
  projects?: string[];        // <-- CHANGED
  notes?: string;
  created_at: string;
}>;
```

### 4. Frontend: Chip Input Component

A lightweight custom chip input built with existing RN primitives (no new dependencies):

**States:**
```typescript
const [markDoneProjects, setMarkDoneProjects] = useState<string[]>([]);
const [chipInputText, setChipInputText] = useState('');
const chipInputRef = useRef<TextInput>(null);
```

**`openMarkDone`** — pre-fill with lead.project:
```typescript
const openMarkDone = () => {
  setMarkDoneNotes('');
  setMarkDoneProjects(lead.project ? [lead.project] : []);
  setChipInputText('');
  setMarkDoneOpen(true);
};
```

**Add chip** — triggered on Enter key or comma:
```typescript
const addProjectChip = () => {
  const trimmed = chipInputText.trim().replace(/,+$/, ''); // strip trailing commas
  if (!trimmed) return;
  // Support comma-separated paste: "Green Valley, Skyline Towers"
  const newProjects = trimmed.split(',').map(p => p.trim()).filter(p => p.length > 0);
  setMarkDoneProjects(prev => [...prev, ...newProjects.filter(p => !prev.includes(p))]);
  setChipInputText('');
};
```

**Remove chip:**
```typescript
const removeProjectChip = (index: number) => {
  setMarkDoneProjects(prev => prev.filter((_, i) => i !== index));
};
```

**Mark Done modal UI layout:**

```
┌──────────────────────────────────────────┐
│  ✓ Mark Visit as Done                    │
│                                          │
│  Projects visited                        │
│  ┌────────────────────────────────────┐  │
│  │ [Green Valley ×] [Skyline Towers ×]│  │
│  │ [Palm Residency ×]                 │  │
│  │ ┌──────────────────────────────┐   │  │
│  │ │ Type project name, Enter...  │   │  │
│  │ └──────────────────────────────┘   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Notes (optional)                        │
│  ┌────────────────────────────────────┐  │
│  │ Preferred Skyline for lake view   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [Cancel]                  [✓ Confirm]   │
└──────────────────────────────────────────┘
```

**Chip container (wrap row):**
```tsx
<View style={styles.chipContainer}>
  {markDoneProjects.map((proj, idx) => (
    <View key={idx} style={styles.chip}>
      <Text style={styles.chipText} numberOfLines={1}>{proj}</Text>
      <TouchableOpacity onPress={() => removeProjectChip(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.chipClose}>×</Text>
      </TouchableOpacity>
    </View>
  ))}
  <TextInput
    ref={chipInputRef}
    value={chipInputText}
    onChangeText={setChipInputText}
    onSubmitEditing={addProjectChip}
    placeholder={markDoneProjects.length === 0 ? 'Type project name, press Enter...' : '+ Add project'}
    placeholderTextColor={Colors.textSecondary}
    style={styles.chipInput}
    returnKeyType="done"
    blurOnSubmit={false}
  />
</View>
```

**Chip styles (new additions to StyleSheet):**
```typescript
chipContainer: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  padding: 10,
  backgroundColor: Colors.background,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: Colors.border,
  minHeight: 44,
},
chip: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: Colors.primary + '18',
  borderRadius: 16,
  paddingHorizontal: 10,
  paddingVertical: 5,
  gap: 4,
},
chipText: {
  color: Colors.primary,
  fontSize: 13,
  fontWeight: '600',
  maxWidth: 140,
},
chipClose: {
  color: Colors.primary,
  fontSize: 16,
  fontWeight: '700',
  marginLeft: 2,
},
chipInput: {
  flex: 1,
  minWidth: 120,
  fontSize: 14,
  color: Colors.text,
  paddingVertical: 4,
},
```

### 5. Frontend: `handleMarkVisitDone` — Send projects array

```typescript
const handleMarkVisitDone = async () => {
  setUpdating(true);
  try {
    const projectList = markDoneProjects.length > 0
      ? markDoneProjects.join(', ')
      : 'site visit';
    await client.patch(`/leads/${lead._id}`, {
      status: 'VISITED',
      site_visit_at: null,
      next_reminder_at: null,
      visit_projects: markDoneProjects,   // <-- array of strings
      visit_notes: markDoneNotes.trim() || null,
      activity_type: 'visit_completed',
      activity_content: `Site visit completed — ${projectList} on ${new Date(lead.site_visit_at!).toLocaleDateString()}`,
    });
    await client.delete(`/reminders?lead_id=${lead._id}`).catch(() => {});
    closeMarkDone();
    fetchLead();
    fetchLogs();
  } catch (error) { Alert.alert('Error', 'Failed to mark visit as done'); }
  finally { setUpdating(false); }
};
```

### 6. Frontend: Visits Tab — Display project chips

In the visit history rendering block, after the outcome line and before notes:

```tsx
{visit.projects && visit.projects.length > 0 && (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
    {visit.projects.map((proj, idx) => (
      <View key={idx} style={{
        backgroundColor: Colors.primary + '12',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}>
        <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '600' }}>
          🏗️ {proj}
        </Text>
      </View>
    ))}
  </View>
)}
```

Place this after the `visit.completed_at` line and before the `visit.cancellation_reason` line in the Visits tab mapping.

### 7. Edge Cases

| Scenario | Behavior |
|---|---|
| No project on lead, agent adds none | `visit_projects: []` — stored as empty array, no chips shown |
| Agent removes all chips before confirm | `visit_projects: []` — same as above |
| Agent pastes comma-separated text | `addProjectChip` splits on commas, adds each as chip |
| Duplicate project name typed | Filtered out in `addProjectChip` (`!prev.includes(p)`) |
| Very long project name | Chip text truncated with `numberOfLines={1}`, `maxWidth: 140` |
| Cancelled visit | No project tracking needed (cancelled visits don't get projects) |
| Multiple visits over time | Each visit_history entry has its own `projects[]` |

---

## Files Changed (Summary)

| # | File | Change |
|---|---|---|
| 1 | [`backend/src/models/Lead.ts`](backend/src/models/Lead.ts) | `project?: string` → `projects?: string[]` in interface + schema |
| 2 | [`backend/src/controllers/leadController.ts`](backend/src/controllers/leadController.ts) | Destructure `visit_projects`, store array in visit_entry with fallback |
| 3 | [`frontend/src/types/index.ts`](frontend/src/types/index.ts) | `project?: string` → `projects?: string[]` in visit_history type |
| 4 | [`frontend/src/screens/LeadDetailScreen.tsx`](frontend/src/screens/LeadDetailScreen.tsx) | New states (`markDoneProjects`, `chipInputText`), chip input UI, updated `handleMarkVisitDone`, Visits tab chip display, new styles |

---

## Visual Flow

```mermaid
flowchart TD
    A["Agent clicks Mark Done"] --> B["Dialog opens with lead.project as first chip"]
    B --> C["Agent types more projects — Enter to add chips"]
    C --> D["Agent removes any chips with ×"]
    D --> E["Agent adds optional notes"]
    E --> F["Clicks Confirm"]
    F --> G["visit_projects sent as array"]
    G --> H["Backend stores projects in visit_history"]
    H --> I["Activity log: Site visit completed — Green Valley, Skyline Towers, Palm Residency"]
    H --> J["Visits tab shows project chips per entry"]