import mongoose, { Schema, Document } from 'mongoose';

export interface ILead extends Document {
  organization_id: mongoose.Types.ObjectId;
  assigned_to: mongoose.Types.ObjectId | null;
  name: string;
  mobile: string;
  email?: string;
  source: string;
  project_id?: mongoose.Types.ObjectId;
  project?: string;
  budget?: string;
  city?: string;
  status: 'NEW' | 'CALLBACK' | 'INTERESTED' | 'VISIT_BOOKED' | 'VISITED' | 'RE_VISIT' | 'BOOKED' | 'NOT_INTERESTED' | 'INVALID_NUMBER';
  callback_reason?: 'busy' | 'switched_off' | 'ringing' | 'disconnected';
  property_status?: 'under_construction' | 'nearing_possession' | 'ready_to_move';
  property_type?: string;
  preferred_area?: string;
  not_interested_reason?: 'too_expensive' | 'not_looking' | 'already_purchased' | 'bad_location' | 'fake_lead' | 'others';
  heat: 'HOT' | 'WARM' | 'COLD';
  next_reminder_at?: Date | null;
  next_reminder_remark?: string | null;
  site_visit_booked?: boolean;
  site_visit_at?: Date | null;
  last_call_at?: Date | null;
  last_whatsapp_at?: Date | null;
  duplicateFlag?: boolean;
  remark?: string | null;
  facebook_lead_id?: string | null;
  facebook_page_name?: string | null;
  facebook_form_name?: string | null;
  custom_data?: Record<string, string>;
  visit_history?: Array<{
    scheduled_at: Date;
    completed_at?: Date;
    outcome: 'completed' | 'cancelled' | 'no_show';
    cancellation_reason?: string;
    project?: string;
    notes?: string;
    created_at: Date;
  }>;
  visit_count?: number;
  created_at: Date;
  updated_at: Date;
}

const LeadSchema: Schema = new Schema({
  organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  assigned_to: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String },
  source: { type: String, default: 'Manual' },
  project_id: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
  project: { type: String },
  budget: { type: String },
  city: { type: String },
  status: { type: String, enum: ['NEW', 'CALLBACK', 'INTERESTED', 'VISIT_BOOKED', 'VISITED', 'RE_VISIT', 'BOOKED', 'NOT_INTERESTED', 'INVALID_NUMBER'], default: 'NEW' },
  callback_reason: { type: String, enum: ['busy', 'switched_off', 'ringing', 'disconnected'], default: null },
  property_status: { type: String, enum: ['under_construction', 'nearing_possession', 'ready_to_move'], default: null },
  property_type: { type: String, default: null },
  preferred_area: { type: String, default: null },
  not_interested_reason: { type: String, enum: ['too_expensive', 'not_looking', 'already_purchased', 'bad_location', 'fake_lead', 'others'], default: null },
  heat: { type: String, enum: ['HOT', 'WARM', 'COLD'], default: 'WARM' },
  next_reminder_at: { type: Date, default: null },
  next_reminder_remark: { type: String, default: null },
  site_visit_booked: { type: Boolean, default: false },
  site_visit_at: { type: Date, default: null },
  last_call_at: { type: Date, default: null },
  last_whatsapp_at: { type: Date, default: null },
  duplicateFlag: { type: Boolean, default: false },
  remark: { type: String, default: null },
  facebook_lead_id: { type: String, default: null },
  facebook_page_name: { type: String, default: null },
  facebook_form_name: { type: String, default: null },
  custom_data: { type: Map, of: String, default: {} },
  visit_history: [{
    scheduled_at: { type: Date },
    completed_at: { type: Date, default: null },
    outcome: { type: String, enum: ['completed', 'cancelled', 'no_show'] },
    cancellation_reason: { type: String, default: null },
    project: { type: String, default: null },
    notes: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
  }],
  visit_count: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Index on mobile and organization_id (not unique to support duplicate leads)
LeadSchema.index({ mobile: 1, organization_id: 1 });
// Index on facebook_lead_id to prevent webhook/cron duplicate overlap
LeadSchema.index({ facebook_lead_id: 1 }, { sparse: true });

export default mongoose.model<ILead>('Lead', LeadSchema);
