export interface Lead {
  _id: string;
  name: string;
  mobile: string;
  source: string;
  project?: string;
  budget?: string;
  city?: string;
  heat: 'HOT' | 'WARM' | 'COLD';
  status: 'NEW' | 'INVALID_NUMBER' | 'CALLBACK' | 'INTERESTED' | 'NOT_INTERESTED';
  assigned_to?: any;
  remark?: string | null;
  site_visit_booked?: boolean;
  site_visit_at?: string | null;
  duplicateFlag?: boolean;
  facebook_page_name?: string;
  facebook_form_name?: string;
  custom_data?: Record<string, string>;
  created_at: string;
}

export interface ActivityLog {
  _id: string;
  type: 'creation' | 'update' | 'assignment' | 'reminder' | 'remark';
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
