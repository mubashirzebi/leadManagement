import mongoose, { Schema, Document } from 'mongoose';

export interface IActivityLog extends Document {
  organization_id: mongoose.Types.ObjectId;
  lead_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  type: 'status_change' | 'note' | 'call_init' | 'whatsapp_send' | 'assignment' | 'creation' | 'update' | 'reminder' | 'remark' | 'visit_completed' | 'visit_cancelled' | 'visit_rescheduled';
  content: string;
  visit_date?: Date | null;
  is_revisit?: boolean | null;
  created_at: Date;
}

const ActivityLogSchema: Schema = new Schema({
  organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  lead_id: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['status_change', 'note', 'call_init', 'whatsapp_send', 'assignment', 'creation', 'update', 'reminder', 'remark', 'visit_completed', 'visit_cancelled', 'visit_rescheduled'], required: true },
  content: { type: String, required: true },
  visit_date: { type: Date, default: null },
  is_revisit: { type: Boolean, default: null },
  created_at: { type: Date, default: Date.now }
});

export default mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
