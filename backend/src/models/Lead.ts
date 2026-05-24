import mongoose, { Schema, Document } from 'mongoose';

export interface ILead extends Document {
  organization_id: mongoose.Types.ObjectId;
  assigned_to: mongoose.Types.ObjectId | null;
  name: string;
  mobile: string;
  email?: string;
  source: string;
  project?: string;
  budget?: number;
  city?: string;
  status: 'NEW' | 'INVALID_NUMBER' | 'CALLBACK' | 'INTERESTED' | 'NOT_INTERESTED';
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
  project: { type: String },
  budget: { type: Number },
  city: { type: String },
  status: { type: String, enum: ['NEW', 'INVALID_NUMBER', 'CALLBACK', 'INTERESTED', 'NOT_INTERESTED'], default: 'NEW' },
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
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Index on mobile and organization_id (not unique to support duplicate leads)
LeadSchema.index({ mobile: 1, organization_id: 1 });
// Index on facebook_lead_id to prevent webhook/cron duplicate overlap
LeadSchema.index({ facebook_lead_id: 1 }, { sparse: true });

export default mongoose.model<ILead>('Lead', LeadSchema);
