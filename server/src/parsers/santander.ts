import * as XLSX from 'xlsx';
import { RawTransaction } from '../types';

export function parseSantander(buffer: Buffer): RawTransaction[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as string[][];

  // Find header row containing "Transaction date"
  let headerRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && row.some(cell => typeof cell === 'string' && cell.includes('Transaction date'))) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) return [];

  const header = rows[headerRowIdx].map(h => (h ?? '').toString().trim());
  const idx = {
    date: header.findIndex(h => h.includes('Transaction date')),
    description: header.findIndex(h => h.includes('Description')),
    amount: header.findIndex(h => h === 'Amount' || h.includes('Amount')),
  };

  const results: RawTransaction[] = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[idx.date]) continue;

    const rawDate = (row[idx.date] ?? '').toString().trim();
    const date = parseSantanderDate(rawDate);
    if (!date) continue;

    const rawDesc = (row[idx.description] ?? '').toString().trim();
    const rawAmount = (row[idx.amount] ?? '').toString().trim();
    const amount = parseSantanderAmount(rawAmount);
    if (amount === null || isNaN(amount)) continue;

    const txType: 'expense' | 'income' = amount < 0 ? 'expense' : 'income';

    results.push({
      date,
      amount: Math.abs(amount),
      description: rawDesc,
      raw_description: rawDesc,
      type: txType,
      bank: 'santander',
    });
  }

  return results;
}

function parseSantanderAmount(raw: string): number | null {
  if (!raw) return null;

  // Replace Unicode minus U+2212 and strip whitespace
  let s = raw.replace(/\u2212/g, '-').replace(/\s/g, '');
  const negative = s.startsWith('-');
  if (negative) s = s.slice(1);

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');

  if (hasDot && hasComma) {
    // Determine which is the decimal separator by which comes last.
    // Spanish "1.800,00" → comma is last → dot=thousands, comma=decimal
    // English "1,800.00" → dot is last   → comma=thousands, dot=decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');   // Spanish
    } else {
      s = s.replace(/,/g, '');                       // English
    }
  } else if (hasComma && !hasDot) {
    // Could be "1.800" (no decimal) already handled above, or "1800,00" (decimal)
    // If exactly 1 or 2 digits follow the last comma → decimal separator
    const afterComma = s.split(',').pop() ?? '';
    s = afterComma.length <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  }
  // Only dots and no commas → already standard JS float format

  const val = parseFloat(s);
  if (isNaN(val)) return null;
  return negative ? -val : val;
}

function parseSantanderDate(raw: string): string | null {
  // Format: DD/MM/YYYY or DD-MM-YYYY
  const match = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;

  // Already ISO
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : null;
}
