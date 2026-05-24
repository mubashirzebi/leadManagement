import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from './src/models/Organization';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI as string);
  const orgs = await Organization.find({});
  for (const org of orgs) {
    console.log(`Org ID: ${org._id}, Name: ${org.name}`);
    console.log(`Meta Config:`, org.meta_config);
  }
  process.exit(0);
}
run();
