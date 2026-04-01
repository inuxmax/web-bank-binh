export type BankRow = { code: string; name: string };

/** Danh sách ngân hàng (mã ISO gần giống bot — dùng tìm kiếm / rút tiền) */
export const IBFT_BANKS: BankRow[] = [
  { code: 'ABB', name: 'ABBank' },
  { code: 'ACB', name: 'ACB' },
  { code: 'AGB', name: 'Agribank' },
  { code: 'BAB', name: 'Bac A Bank' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'BVB', name: 'BaoViet Bank' },
  { code: 'CBB', name: 'CBBank' },
  { code: 'CIMB', name: 'CIMB Bank' },
  { code: 'DAB', name: 'DongA Bank' },
  { code: 'EXB', name: 'Eximbank' },
  { code: 'HDB', name: 'HDBank' },
  { code: 'HSBC', name: 'HSBC' },
  { code: 'ICB', name: 'VietinBank' },
  { code: 'KLB', name: 'KienLongBank' },
  { code: 'LVB', name: 'LPBank' },
  { code: 'MB', name: 'MBBank' },
  { code: 'MSB', name: 'MSB' },
  { code: 'NAB', name: 'Nam A Bank' },
  { code: 'NVB', name: 'NCB' },
  { code: 'OCB', name: 'OCB' },
  { code: 'OJB', name: 'OceanBank' },
  { code: 'PGB', name: 'PG Bank' },
  { code: 'PVCB', name: 'PVcomBank' },
  { code: 'SCB', name: 'SCB' },
  { code: 'SEA', name: 'SeABank' },
  { code: 'SGB', name: 'Saigonbank' },
  { code: 'SHB', name: 'SHB' },
  { code: 'STB', name: 'Sacombank' },
  { code: 'TCB', name: 'Techcombank' },
  { code: 'TPB', name: 'TPBank' },
  { code: 'VAB', name: 'VietABank' },
  { code: 'VB', name: 'VietBank' },
  { code: 'VCB', name: 'Vietcombank' },
  { code: 'VIB', name: 'VIB' },
  { code: 'VPB', name: 'VPBank' },
  { code: 'VRB', name: 'VRB' },
  { code: 'UOB', name: 'UOB' },
  { code: 'TIMOB', name: 'Timo by Ban Viet Bank' },
];

export const IBFT_BANK_PICK_CODES = [
  'BIDV', 'VCB', 'ICB', 'TCB', 'MB', 'ACB', 'VPB', 'TPB', 'STB', 'HDB', 'AGB', 'SHB',
  'VIB', 'DAB', 'VAB', 'MSB', 'EXB', 'ABB', 'NAB', 'OJB', 'SEA', 'BAB', 'NVB', 'SGB',
  'PVCB', 'KLB', 'SCB', 'HSBC', 'CIMB', 'UOB', 'VB', 'VRB', 'OCB', 'TIMOB',
].filter((c) => IBFT_BANKS.some((b) => b.code === c));

const LABEL_OVERRIDES: Record<string, string> = {
  ICB: 'Vietinbank',
  AGB: 'Agribank',
  NVB: 'NCB',
  TIMOB: 'Timo',
  CIMB: 'CIMB Vietnam',
};

export function getIbftBankLabel(code: string) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return '';
  if (LABEL_OVERRIDES[c]) return LABEL_OVERRIDES[c];
  const found = IBFT_BANKS.find((b) => b.code === c);
  return found ? found.name : c;
}

function normalizeSearch(s: string) {
  return String(s || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function findIbftBanks(query: string, limit = 12) {
  const q = normalizeSearch(query);
  if (!q) return [];
  const scored: (BankRow & { score: number })[] = [];
  for (const b of IBFT_BANKS) {
    const c = normalizeSearch(b.code);
    const n = normalizeSearch(b.name);
    let score = -1;
    if (c === q) score = 100;
    else if (c.startsWith(q)) score = 80;
    else if (c.includes(q)) score = 60;
    else if (n.includes(q)) score = 40;
    if (score >= 0) scored.push({ ...b, score });
  }
  scored.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  return scored.slice(0, limit);
}
