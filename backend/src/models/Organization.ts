import mongoose, { Schema, Document } from 'mongoose';

export interface IMetaPage {
  page_id: string;
  page_name: string;
  access_token: string;
  is_active?: boolean;
}

export interface IOrganization extends Document {
  name: string;
  status: 'active' | 'suspended';
  week_start_day: number; // 0=Sunday, 1=Monday, ..., 6=Saturday (default 1)
  timezone_offset: number; // minutes from UTC (default 330 = IST +5:30)
  created_at: Date;
  webhook_token: string | null;
  meta_config: {
    pages: IMetaPage[];
  };
}

const OrganizationSchema: Schema = new Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  week_start_day: { type: Number, default: 1 }, // 0=Sun, 1=Mon, ..., 6=Sat
  timezone_offset: { type: Number, default: 330 }, // minutes from UTC (330 = IST +5:30)
  created_at: { type: Date, default: Date.now },
  webhook_token: { type: String, default: null, unique: true, sparse: true },
  google_key: { type: String, default: null },
  meta_config: {
    pages: [
      {
        page_id: { type: String, required: true },
        page_name: { type: String, required: true },
        access_token: { type: String, required: true },
        is_active: { type: Boolean, default: true }
      }
    ]
  },
});

export default mongoose.model<IOrganization>('Organization', OrganizationSchema);
