import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from '@jest/globals';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});
