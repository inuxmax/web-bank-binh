import 'server-only';

import * as db from '@/lib/server/db';

const POLLER_KEY = '__mongoBackupPollerStarted' as const;
const POLLER_STATUS_KEY = '__mongoBackupPollerStatus' as const;

type MongoBackupStatus = {
  running: boolean;
  lastRunAt: number;
  lastDurationMs: number;
  lastFileName: string;
  lastError: string;
};

function readIntervalMinutesFromEnv() {
  const raw = Number(process.env.MONGO_BACKUP_INTERVAL_MINUTES || 360);
  if (!Number.isFinite(raw)) return 360;
  return Math.max(10, Math.min(10080, Math.floor(raw)));
}

function getStatusStore(): MongoBackupStatus {
  const g = globalThis as typeof globalThis & { [POLLER_STATUS_KEY]?: MongoBackupStatus };
  if (!g[POLLER_STATUS_KEY]) {
    g[POLLER_STATUS_KEY] = {
      running: false,
      lastRunAt: 0,
      lastDurationMs: 0,
      lastFileName: '',
      lastError: '',
    };
  }
  return g[POLLER_STATUS_KEY]!;
}

async function runBackupIfDue() {
  const cfg = await db.getConfig();
  const enabled = Boolean((cfg as { mongoBackupAutoEnabled?: boolean }).mongoBackupAutoEnabled);
  if (!enabled) return;

  const intervalMinutes = Math.max(
    10,
    Number((cfg as { mongoBackupIntervalMinutes?: number }).mongoBackupIntervalMinutes || readIntervalMinutesFromEnv()) || 360,
  );
  const keepFiles = Math.max(1, Number((cfg as { mongoBackupKeepFiles?: number }).mongoBackupKeepFiles || 20) || 20);
  const lastRunAt = Number((cfg as { mongoBackupLastRunAt?: number }).mongoBackupLastRunAt || 0) || 0;
  const dueAt = lastRunAt + intervalMinutes * 60 * 1000;
  if (Date.now() < dueAt) return;

  const { createMongoBackupToProject, cleanupMongoBackups } = await import('./mongo-backup');
  const snapshot = await createMongoBackupToProject();
  await cleanupMongoBackups(keepFiles);
  await db.updateConfig({ mongoBackupLastRunAt: Date.now() });
  const status = getStatusStore();
  status.lastFileName = snapshot.fileName;
}

export function startMongoBackupPoller() {
  const g = globalThis as typeof globalThis & { [POLLER_KEY]?: boolean };
  if (g[POLLER_KEY]) return;
  g[POLLER_KEY] = true;

  let running = false;
  const status = getStatusStore();
  const tick = async () => {
    if (running) return;
    running = true;
    const started = Date.now();
    status.running = true;
    status.lastError = '';
    try {
      await runBackupIfDue();
      status.lastRunAt = Date.now();
    } catch (e) {
      status.lastError = e instanceof Error ? e.message : String(e);
      console.error('[MONGO_BACKUP_POLLER] error:', e);
    } finally {
      running = false;
      status.running = false;
      status.lastDurationMs = Date.now() - started;
    }
  };

  void tick();
  setInterval(() => {
    void tick();
  }, 60 * 1000);
}

export function getMongoBackupPollerStatus() {
  return getStatusStore();
}
