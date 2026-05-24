import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || '';

const yes = process.argv.includes('--yes');

const run = async () => {
  try {
    if (!MONGO_URI) {
      console.error('MONGO_URI not found in environment');
      process.exit(1);
    }

    if (!yes) {
      console.error('Refusing to run without --yes (this deletes CRM data).');
      process.exit(1);
    }

    // Safety: only allow flushing when DB name is exactly "crm"
    let dbName = '';
    try {
      const url = new URL(MONGO_URI);
      dbName = url.pathname.replace(/^\//, '');
    } catch {
      // mongodb+srv URIs are not always parseable by URL; fall back
      const match = MONGO_URI.match(/mongodb\+srv:\/\/[^/]+\/([^?]+)/i) || MONGO_URI.match(/mongodb:\/\/[^/]+\/([^?]+)/i);
      dbName = (match?.[1] || '').trim();
    }

    if (dbName !== 'crm') {
      console.error(`Refusing to flush because database is "${dbName}" (expected "crm").`);
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    if (!db) {
      console.error('Mongo connection established but db handle is unavailable.');
      process.exit(1);
    }
    console.log('Connected. Flushing collections in DB:', db.databaseName);

    const collectionsToDrop = [
      'users',
      'organizations',
      'leads',
      'activitylogs',
      'reminders',
    ];

    for (const name of collectionsToDrop) {
      const exists = await db.listCollections({ name }).hasNext();
      if (!exists) {
        console.log('Skip (not found):', name);
        continue;
      }
      await db.dropCollection(name);
      console.log('Dropped:', name);
    }

    console.log('Flush complete.');
    process.exit(0);
  } catch (err) {
    console.error('Flush failed:', err);
    process.exit(1);
  }
};

run();
