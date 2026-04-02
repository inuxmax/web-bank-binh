import fs from 'fs';

function loadEnvFile(fileName: string) {
  if (!fs.existsSync(fileName)) return;
  const txt = fs.readFileSync(fileName, 'utf8');
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');
  const { createMongoBackupToProject } = await import('../src/lib/server/mongo-backup');
  const result = await createMongoBackupToProject();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
