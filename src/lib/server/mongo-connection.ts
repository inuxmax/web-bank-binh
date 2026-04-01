import 'server-only';

import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI?.trim();

export async function connectMongo(): Promise<void> {
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Khai báo trong .env.local (ví dụ mongodb://127.0.0.1:27017/hpay_web).',
    );
  }
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });
}
