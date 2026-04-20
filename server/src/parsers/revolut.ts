import { RawTransaction } from '../types';

export function parseRevolut(csvText: string): RawTransaction[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]);
  const idx = {
    type: header.indexOf('Type'),
    completedDate: header.indexOf('Completed Date'),
    description: header.indexOf('Description'),
    amount: header.indexOf('Amount'),
    state: header.indexOf('State'),
  };

  const results: RawTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 5) continue;

    const state = cols[idx.state]?.trim();
    const type = cols[idx.type]?.trim();

    if (state !== 'COMPLETED') continue;
    if (type === 'Exchange') continue;

    const rawDesc = cols[idx.description]?.trim() ?? '';
    const amountStr = cols[idx.amount]?.trim() ?? '0';
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) continue;

    const rawDate = cols[idx.completedDate]?.trim() ?? '';
    const date = parseRevolutDate(rawDate);
    if (!date) continue;

    const txType: 'expense' | 'income' = amount < 0 ? 'expense' : 'income';

    results.push({
      date,
      amount: Math.abs(amount),
      description: rawDesc,
      raw_description: rawDesc,
      type: txType,
      bank: 'revolut',
    });
  }

  return results;
}

function parseRevolutDate(raw: string): string | null {
  // Format: "2024-01-15 14:30:00" or "2024-01-15"
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
