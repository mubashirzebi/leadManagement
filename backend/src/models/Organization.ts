import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganization extends Document {
  name: string;
  status: 'active' | 'suspended';
  created_at: Date;
  webhook_token: string | null;
  meta_config: {
    page_id: string | null;
    access_token: string | null;
  };
}

const OrganizationSchema: Schema = new Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  created_at: { type: Date, default: Date.now },
  webhook_token: { type: String, default: null, unique: true, sparse: true },
  google_key: { type: String, default: null },
  meta_config: {
    page_id: { type: String, default: null },
    access_token: { type: String, default: null },
  },
});

export default mongoose.model<IOrganization>('Organization', OrganizationSchema);
