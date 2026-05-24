export interface Lead {
  _id: string;
  name: string;
  mobile: string;
  source: string;
  project?: string;
  budget?: string;
  city?: string;
  temperature: 'Hot' | 'Warm' | 'Cold';
  status: 'New' | 'Contacted' | 'Qualified' | 'Lost' | 'Closed';
  assigned_to?: any;
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
