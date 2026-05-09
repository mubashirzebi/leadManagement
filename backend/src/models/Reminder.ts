import mongoose, { Schema, Document } from 'mongoose';

export interface IReminder extends Document {
  organization_id: mongoose.Types.ObjectId;
  lead_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  remind_at: Date;
  remark: string;
  is_sent: boolean;
  created_at: Date;
}

const ReminderSchema: Schema = new Schema({
  organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  lead_id: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  remind_at: { type: Date, required: true },
  remark: { type: String, required: true },
  is_sent: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

export default mongoose.model<IReminder>('Reminder', ReminderSchema);
