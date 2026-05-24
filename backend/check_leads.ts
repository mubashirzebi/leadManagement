import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Lead from './src/models/Lead';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log('Querying latest 10 leads...');
  const leads = await Lead.find({}).sort({ created_at: -1 }).limit(10);
  if (leads.length === 0) {
    console.log('No leads found in database.');
  } else {
    leads.forEach((l, index) => {
      console.log(`[${index + 1}] Name: ${l.name}, Mobile: ${l.mobile}, Source: ${l.source}, Status: ${l.status}, CreatedAt: ${l.created_at}`);
    });
  }
  process.exit(0);
}
run();
