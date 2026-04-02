import mongoose from 'mongoose';
import { connectMongo } from './mongo-connection';

type BackupPayload = {
  createdAt: string;
  createdAtTs: number;
  dbName: string;
  collections: Record<string, unknown[]>;
};

export type BackupFileMeta = {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  modifiedAtTs: number;
};

function tsName() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function stringifySafe(v: unknown) {
  return JSON.stringify(v, (_k, value) => {
    if (!value) return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'bigint') return value.toString();
    if (value && typeof value === 'object') {
      const obj = value as { _bsontype?: string; toString?: () => string };
      if (obj._bsontype === 'ObjectId' && typeof obj.toString === 'function') return obj.toString();
    }
    return value;
  });
}

type FsPromisesLike = {
  mkdir: (path: string, options?: { recursive?: boolean }) => Promise<unknown>;
  readFile: (path: string, encoding: string) => Promise<string>;
  readdir: (
    path: string,
    options?: { withFileTypes?: boolean },
  ) => Promise<{ isFile: () => boolean; name: string }[]>;
  stat: (path: string) => Promise<{ size: number; mtimeMs: number }>;
  writeFile: (path: string, data: string, encoding: string) => Promise<unknown>;
  unlink: (path: string) => Promise<unknown>;
};

type PathLike = {
  join: (...parts: string[]) => string;
};

async function getRuntimeDeps(): Promise<{ fs: FsPromisesLike; path: PathLike }> {
  const [fsMod, pathMod] = await Promise.all([import('fs/promises'), import('path')]);
  const fs = (fsMod.default || fsMod) as FsPromisesLike;
  const path = (pathMod.default || pathMod) as PathLike;
  return { fs, path };
}

function getBackupDir(path: PathLike) {
  return path.join(process.cwd(), 'backups', 'mongo');
}

function isValidBackupFileName(fileName: string) {
  return /^mongo-backup-\d{8}-\d{6}\.json$/i.test(String(fileName || '').trim());
}

async function ensureBackupDir() {
  const { fs, path } = await getRuntimeDeps();
  const dir = getBackupDir(path);
  await fs.mkdir(dir, { recursive: true });
  return { dir, fs, path };
}

async function readBackupPayload(filePath: string): Promise<BackupPayload> {
  const { fs } = await getRuntimeDeps();
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as BackupPayload;
  if (!parsed || typeof parsed !== 'object' || !parsed.collections || typeof parsed.collections !== 'object') {
    throw new Error('File backup không hợp lệ');
  }
  return parsed;
}

export async function listMongoBackupFiles(): Promise<BackupFileMeta[]> {
  const { dir, fs, path } = await ensureBackupDir();
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = entries.filter(
    (e) => e.isFile() && e.name.toLowerCase().endsWith('.json'),
  );
  const metas: BackupFileMeta[] = [];
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    const st = await fs.stat(filePath).catch(() => null);
    if (!st) continue;
    metas.push({
      fileName: file.name,
      filePath,
      sizeBytes: Number(st.size || 0),
      modifiedAtTs: Number(st.mtimeMs || 0),
    });
  }
  metas.sort((a, b) => b.modifiedAtTs - a.modifiedAtTs);
  return metas;
}

export async function createMongoBackupToProject(): Promise<{
  filePath: string;
  fileName: string;
  collectionCount: number;
}> {
  await connectMongo();
  const db = mongoose.connection.db;
  if (!db) throw new Error('Mongo connection is not ready');

  const collectionInfos = await db.listCollections({}, { nameOnly: true }).toArray();
  const names = collectionInfos
    .map((c) => String(c.name || ''))
    .filter((x) => x && !x.startsWith('system.'));
  const collections: Record<string, unknown[]> = {};

  for (const name of names) {
    const rows = await db.collection(name).find({}).toArray();
    collections[name] = rows as unknown[];
  }

  const payload: BackupPayload = {
    createdAt: new Date().toISOString(),
    createdAtTs: Date.now(),
    dbName: db.databaseName,
    collections,
  };

  const { dir, fs, path } = await ensureBackupDir();
  const fileName = `mongo-backup-${tsName()}.json`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, stringifySafe(payload), 'utf8');

  return {
    filePath,
    fileName,
    collectionCount: names.length,
  };
}

export async function cleanupMongoBackups(keepLatest = 20): Promise<{ removed: number }> {
  const files = await listMongoBackupFiles();
  const { fs } = await getRuntimeDeps();
  const keep = Math.max(1, Math.min(500, Math.floor(Number(keepLatest) || 20)));
  const outdated = files.slice(keep);
  let removed = 0;
  for (const f of outdated) {
    await fs.unlink(f.filePath).catch(() => undefined);
    removed += 1;
  }
  return { removed };
}

export async function restoreMongoBackupFromProject(fileName: string): Promise<{
  restoredCollections: number;
  restoredDocuments: number;
}> {
  const chosen = String(fileName || '').trim();
  if (!isValidBackupFileName(chosen)) {
    throw new Error('Tên file backup không hợp lệ');
  }
  const { dir, path } = await ensureBackupDir();
  const filePath = path.join(dir, chosen);
  const payload = await readBackupPayload(filePath);

  await connectMongo();
  const db = mongoose.connection.db;
  if (!db) throw new Error('Mongo connection is not ready');

  const names = Object.keys(payload.collections || {}).filter((x) => x && !x.startsWith('system.'));
  let restoredDocuments = 0;
  for (const name of names) {
    const docs = Array.isArray(payload.collections[name]) ? payload.collections[name] : [];
    await db.collection(name).deleteMany({});
    if (docs.length > 0) {
      await db.collection(name).insertMany(docs as Record<string, unknown>[], { ordered: false });
      restoredDocuments += docs.length;
    }
  }

  return {
    restoredCollections: names.length,
    restoredDocuments,
  };
}
