import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  organization_id: mongoose.Types.ObjectId | null;
  name: string;
  mobile: string;
  password?: string;
  role: 'superadmin' | 'admin' | 'staff';
  status: 'active' | 'inactive';
  must_change_password?: boolean;
  fcm_token?: string | null;
  web_push_subscription?: any | null;
  created_at: Date;
}

const UserSchema: Schema = new Schema({
  organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'admin', 'staff'], required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  must_change_password: { type: Boolean, default: true },
  fcm_token: { type: String, default: null },
  web_push_subscription: { type: Schema.Types.Mixed, default: null },
  created_at: { type: Date, default: Date.now }
});

// Unique compound index (mobile + organization_id)
// Handles superadmin (organization_id: null)
UserSchema.index({ mobile: 1, organization_id: 1 }, { unique: true });

export default mongoose.model<IUser>('User', UserSchema);
