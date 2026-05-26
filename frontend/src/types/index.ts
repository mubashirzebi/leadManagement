export interface Project {
  _id: string;
  organization_id: string;
  name: string;
  location?: string;
  builder?: string;
  description?: string;
  configurations?: Array<{ type: string; size?: string; price?: string }>;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Lead {
  _id: string;
  name: string;
  mobile: string;
  email?: string;
  source: string;
  project_id?: string;
  project?: string;
  budget?: string;
  city?: string;
  heat: 'HOT' | 'WARM' | 'COLD';
  status: 'NEW' | 'CALLBACK' | 'INTERESTED' | 'VISIT_BOOKED' | 'VISITED' | 'RE_VISIT' | 'BOOKED' | 'NOT_INTERESTED' | 'INVALID_NUMBER';
  callback_reason?: 'busy' | 'switched_off' | 'ringing' | 'disconnected';
  property_status?: 'under_construction' | 'nearing_possession' | 'ready_to_move';
  property_type?: string;
  preferred_area?: string;
  not_interested_reason?: 'too_expensive' | 'not_looking' | 'already_purchased' | 'bad_location' | 'fake_lead' | 'others';
  assigned_to?: AssignedUser | null;
  remark?: string | null;
  site_visit_booked?: boolean;
  site_visit_at?: string | null;
  duplicateFlag?: boolean;
  facebook_page_name?: string;
  facebook_form_name?: string;
  custom_data?: Record<string, string>;
  next_reminder_at?: string | null;
  next_reminder_remark?: string | null;
  last_call_at?: string | null;
  last_whatsapp_at?: string | null;
  visit_history?: Array<{
    scheduled_at: string;
    completed_at?: string;
    outcome: 'completed' | 'cancelled' | 'no_show';
    cancellation_reason?: string;
    project?: string;
    notes?: string;
    created_at: string;
  }>;
  visit_count?: number;
  revisit_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface AssignedUser {
  _id: string;
  name: string;
  mobile: string;
}

export interface ActivityLog {
  _id: string;
  type: 'creation' | 'update' | 'assignment' | 'reminder' | 'remark' | 'status_change' | 'note' | 'call_init' | 'whatsapp_send' | 'visit_completed' | 'visit_cancelled' | 'visit_rescheduled';
  content: string;
  user_id: {
    _id: string;
    name: string;
  };
  created_at: string;
}

export interface Staff {
  _id: string;
  name: string;
  mobile: string;
}

export interface WeekDay {
  label: string;        // "Mon", "Tue", ...
  label_full: string;   // "Monday", "Tuesday", ...
  day_date: string;     // "2026-05-26"
  date_num: number;     // 26
  month_short: string;  // "May"
  count: number;
  is_today: boolean;
  is_weekend: boolean;
}

export interface WeekVisitsResponse {
  days: WeekDay[];
  total: number;
  week_start: string;
  week_end: string;
}
