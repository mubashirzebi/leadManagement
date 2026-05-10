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
  status: 'New' | 'Contacted' | 'Qualified' | 'Lost' | 'Closed' | 'Imported' | 'Invalid Number';
  temperature: 'Hot' | 'Warm' | 'Cold';
  next_reminder_at?: Date | null;
  next_reminder_remark?: string | null;
  visit_date?: Date | null;
  is_revisit?: boolean;
  last_call_at?: Date | null;
  last_whatsapp_at?: Date | null;
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
  status: { type: String, enum: ['New', 'Contacted', 'Qualified', 'Lost', 'Closed', 'Imported', 'Invalid Number'], default: 'New' },
  temperature: { type: String, enum: ['Hot', 'Warm', 'Cold'], default: 'Warm' },
  next_reminder_at: { type: Date, default: null },
  next_reminder_remark: { type: String, default: null },
  visit_date: { type: Date, default: null },
  is_revisit: { type: Boolean, default: false },
  last_call_at: { type: Date, default: null },
  last_whatsapp_at: { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Unique mobile per organization
LeadSchema.index({ mobile: 1, organization_id: 1 }, { unique: true });

export default mongoose.model<ILead>('Lead', LeadSchema);
