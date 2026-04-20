import { load, type CheerioAPI } from 'cheerio';
import { RawTransaction } from '../types';

const SKIP_ROWS = [
  'натрупани обороти',
  'старо салдо',
  'ново салдо',
  'оборот за периода',
  'натрупан оборот',
];

export function parseFibank(htmlBuffer: Buffer): RawTransaction[] {
  const html = htmlBuffer.toString('utf8');
  const $: CheerioAPI = load(html);

  // Find the table with the expected Cyrillic headers
  let targetTableEl: ReturnType<CheerioAPI> | null = null;

  $('table').each((_, table) => {
    const text = $(table).text();
    if (text.includes('Дата') && (text.includes('Дебит') || text.includes('Кредит'))) {
      targetTableEl = $(table);
      return false; // break
    }
  });

  if (!targetTableEl) return [];

  const rows = (targetTableEl as ReturnType<CheerioAPI>).find('tr').toArray();
  if (rows.length < 2) return [];

  // Find header row to determine column indices
  let headerIdx = -1;
  let colDate = -1;
  let colDesc = -1;
  let colDebit = -1;
  let colCredit = -1;

  for (let i = 0; i < rows.length; i++) {
    // Use children() not find() to avoid recursing into nested tables inside cells
    const cells = $(rows[i]).children('td, th').toArray().map(c => $(c).text().trim());
    const dateCol = cells.findIndex(c => c === 'Дата');
    const descCol = cells.findIndex(c => c === 'Основание');
    const debitCol = cells.findIndex(c => c === 'Дебит');
    const creditCol = cells.findIndex(c => c === 'Кредит');

    if (dateCol !== -1 && debitCol !== -1) {
      headerIdx = i;
      colDate = dateCol;
      colDesc = descCol;
      colDebit = debitCol;
      colCredit = creditCol;
      break;
    }
  }

  if (headerIdx === -1) return [];

  const results: RawTransaction[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    // Use children() to get only direct <td> cells, not nested table cells
    const cells = $(rows[i]).children('td').toArray().map(c => $(c).text().trim());
    if (cells.length === 0) continue;

    // Skip summary rows — check the description column, not the date column
    // Normalise whitespace so "Натрупани\nобороти" matches "натрупани обороти"
    const descCell = (colDesc >= 0 ? (cells[colDesc] ?? '') : (cells[1] ?? '')).toLowerCase().replace(/\s+/g, ' ');
    if (SKIP_ROWS.some(skip => descCell.includes(skip))) continue;

    const rawDate = colDate >= 0 ? cells[colDate] ?? '' : '';
    if (!rawDate) continue;

    const date = parseFibankDate(rawDate);
    if (!date) continue;

    const rawDesc = colDesc >= 0 ? cells[colDesc] ?? '' : '';
    const debitCell = colDebit >= 0 ? cells[colDebit] ?? '' : '';
    const creditCell = colCredit >= 0 ? cells[colCredit] ?? '' : '';

    const debitAmount = extractEurAmount(debitCell);
    const creditAmount = extractEurAmount(creditCell);

    if (debitAmount === null && creditAmount === null) continue;

    const amount = debitAmount !== null ? debitAmount : creditAmount!;
    const txType_raw: 'expense' | 'income' = debitAmount !== null ? 'expense' : 'income';

    // Clean description
    let description = rawDesc;
    const descIdx = description.indexOf('Описание:');
    if (descIdx !== -1) {
      description = description.slice(descIdx + 'Описание:'.length).trim();
    }
    if (description.startsWith('Плащане ПОС ')) {
      description = description.slice('Плащане ПОС '.length).trim();
    }

    results.push({
      date,
      amount,
      description,
      raw_description: rawDesc,
      type: txType_raw,
      bank: 'fibank',
    });
  }

  return results;
}

function extractEurAmount(cell: string): number | null {
  if (!cell) return null;
  // Format: "5.14 EUR\n10.05 BGN" — grab the first number before EUR
  const match = cell.match(/([\d.,]+)\s*EUR/);
  if (!match) return null;
  const raw = match[1].trim();
  // If there's a comma, assume European notation: 1.234,56 → remove . keep ,→.
  // If no comma, the dot is the decimal separator — parse as-is
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const val = parseFloat(normalized);
  return isNaN(val) || val === 0 ? null : val;
}

function parseFibankDate(raw: string): string | null {
  // Format: DD.MM.YYYY
  const match = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}
