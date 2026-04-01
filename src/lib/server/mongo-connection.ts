import 'server-only';

import mongoose from 'mongoose';

function normalizeMongoUri(raw: string | undefined): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

const uri = normalizeMongoUri(process.env.MONGODB_URI);

export async function connectMongo(): Promise<void> {
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Khai báo trong .env/.env.local (ví dụ mongodb://127.0.0.1:27017/hpay_web).',
    );
  }
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });
}
