import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  organization_id: mongoose.Types.ObjectId;
  name: string;
  location?: string;
  builder?: string;
  description?: string;
  configurations?: Array<{
    type: string;
    size?: string;
    price?: string;
  }>;
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

const ProjectSchema: Schema = new Schema({
  organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true },
  location: { type: String, default: null },
  builder: { type: String, default: null },
  description: { type: String, default: null },
  configurations: [{
    type: { type: String, required: true },
    size: { type: String, default: null },
    price: { type: String, default: null },
  }],
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Index for fast active-project lookups per org
ProjectSchema.index({ organization_id: 1, status: 1 });
// Ensure project names are unique per org
ProjectSchema.index({ organization_id: 1, name: 1 }, { unique: true });

export default mongoose.model<IProject>('Project', ProjectSchema);