import { Router, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { getDb } from '../db/index';
import { computeBalances } from './months';

const router = Router();

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Section = 'transactions' | 'dashboard' | 'analytics';
type TypeFilter = 'all' | 'expense' | 'income';
type Format = 'xlsx' | 'pdf';

interface ExportOptions {
  format: Format;
  fromYear: number; fromMonth: number;
  toYear: number;   toMonth: number;
  sections: Section[];
  typeFilter: TypeFilter;
}

interface MonthRow { id: number; year: number; month: number; }
interface TxRow {
  id: number; date: string; description: string; amount: number;
  type: 'expense' | 'income' | 'transfer'; bank: string;
  category_display_name: string | null;
  month_id: number;
}
interface CategoryTotalRow {
  category_id: number; category_name: string; display_name: string;
  type: 'expense' | 'income'; color: string; total: number;
}
interface BudgetRow {
  category_id: number; display_name: string; category_type: 'expense' | 'income';
  planned: number; is_active: number;
}
interface MonthSummary {
  year: number; month: number; label: string;
  income: number; expenses: number; saved: number;
  start_balance: number; end_balance: number;
  byCategory: CategoryTotalRow[];
  budgets: BudgetRow[];
}

function monthKey(y: number, m: number) { return y * 100 + m; }
function fmtMonth(y: number, m: number) { return `${MONTH_NAMES[m - 1]} ${y}`; }
function fmtRange(o: ExportOptions) {
  const same = o.fromYear === o.toYear && o.fromMonth === o.toMonth;
  return same ? fmtMonth(o.fromYear, o.fromMonth) : `${fmtMonth(o.fromYear, o.fromMonth)} – ${fmtMonth(o.toYear, o.toMonth)}`;
}

function getMonthsInRange(db: ReturnType<typeof getDb>, opts: ExportOptions): MonthRow[] {
  const from = monthKey(opts.fromYear, opts.fromMonth);
  const to   = monthKey(opts.toYear,   opts.toMonth);
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  const rows = db.prepare('SELECT id, year, month FROM months ORDER BY year ASC, month ASC').all() as MonthRow[];
  return rows.filter(m => {
    const k = monthKey(m.year, m.month);
    return k >= lo && k <= hi;
  });
}

function getTransactions(db: ReturnType<typeof getDb>, monthIds: number[], typeFilter: TypeFilter): TxRow[] {
  if (monthIds.length === 0) return [];
  const placeholders = monthIds.map(() => '?').join(', ');
  const typeClause = typeFilter === 'all' ? '' : `AND t.type = '${typeFilter}'`;
  return db.prepare(`
    SELECT t.id, t.month_id, t.date, t.description, t.amount, t.type, t.bank,
           c.display_name AS category_display_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.month_id IN (${placeholders})
      ${typeClause}
    ORDER BY t.date ASC, t.id ASC
  `).all(...monthIds) as TxRow[];
}

function getMonthSummary(db: ReturnType<typeof getDb>, m: MonthRow): MonthSummary {
  const income = (db.prepare(
    "SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE month_id=? AND type='income'"
  ).get(m.id) as { total: number }).total;
  const expenses = (db.prepare(
    "SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE month_id=? AND type='expense'"
  ).get(m.id) as { total: number }).total;

  const byCategory = db.prepare(`
    SELECT c.id as category_id, c.name as category_name, c.display_name, c.type, c.color,
           COALESCE(SUM(t.amount), 0) as total
    FROM categories c
    LEFT JOIN transactions t ON t.category_id = c.id AND t.month_id = ?
    WHERE c.is_active = 1
    GROUP BY c.id
    ORDER BY c.type, c.sort_order
  `).all(m.id) as CategoryTotalRow[];

  const budgets = db.prepare(`
    SELECT b.category_id, b.planned, b.is_active,
           c.type as category_type, c.display_name
    FROM budgets b
    JOIN categories c ON b.category_id = c.id
    WHERE b.month_id = ? AND b.is_active = 1
    UNION ALL
    SELECT sb.category_id, sb.planned, sb.is_active,
           c.type as category_type, c.display_name
    FROM stable_budgets sb
    JOIN categories c ON sb.category_id = c.id
    WHERE sb.is_active = 1
      AND sb.category_id NOT IN (
        SELECT category_id FROM budgets WHERE month_id = ? AND is_active = 1
      )
  `).all(m.id, m.id) as BudgetRow[];

  const balances = computeBalances(db, m.year, m.month) ?? { start_balance: 0, end_balance: 0 };

  return {
    year: m.year, month: m.month,
    label: fmtMonth(m.year, m.month),
    income, expenses, saved: income - expenses,
    start_balance: balances.start_balance,
    end_balance: balances.end_balance,
    byCategory, budgets,
  };
}

function filterCategories(rows: CategoryTotalRow[], t: TypeFilter): CategoryTotalRow[] {
  if (t === 'all') return rows;
  return rows.filter(r => r.type === t);
}

function fmtAmount(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ─── Excel builder ─── */

async function buildExcel(opts: ExportOptions, months: MonthRow[]): Promise<Buffer> {
  const db = getDb();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Personal Finance';
  wb.created = new Date();

  const headerStyle: Partial<ExcelJS.Row['font']> = { bold: true };

  if (opts.sections.includes('transactions')) {
    const sheet = wb.addWorksheet('Transactions');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Bank', key: 'bank', width: 12 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Amount', key: 'amount', width: 12 },
    ];
    const txs = getTransactions(db, months.map(m => m.id), opts.typeFilter);
    for (const tx of txs) {
      sheet.addRow({
        date: tx.date,
        description: tx.description,
        category: tx.category_display_name ?? '',
        bank: tx.bank,
        type: tx.type,
        amount: tx.type === 'expense' ? -tx.amount : tx.amount,
      });
    }
    sheet.getRow(1).font = headerStyle as ExcelJS.Row['font'];
    // Totals row
    const total = txs.reduce((s, t) => s + (t.type === 'expense' ? -t.amount : t.amount), 0);
    const totalRow = sheet.addRow({ date: '', description: `Total (${txs.length} transactions)`, amount: total });
    totalRow.font = { bold: true };
  }

  if (opts.sections.includes('dashboard')) {
    const sheet = wb.addWorksheet('Dashboard');
    let row = 1;
    for (const m of months) {
      const s = getMonthSummary(db, m);
      sheet.getCell(row, 1).value = s.label;
      sheet.getCell(row, 1).font = { bold: true, size: 14 };
      row += 1;

      const summaryRows: Array<[string, number]> = [];
      if (opts.typeFilter !== 'expense') summaryRows.push(['Income', s.income]);
      if (opts.typeFilter !== 'income')  summaryRows.push(['Expenses', s.expenses]);
      summaryRows.push(['Saved', s.saved], ['Start Balance', s.start_balance], ['End Balance', s.end_balance]);
      for (const [label, val] of summaryRows) {
        sheet.getCell(row, 1).value = label;
        sheet.getCell(row, 2).value = val;
        sheet.getCell(row, 2).numFmt = '#,##0.00';
        row += 1;
      }
      row += 1;

      // By-category breakdown
      const cats = filterCategories(s.byCategory, opts.typeFilter);
      const budgetMap = new Map(s.budgets.map(b => [b.category_id, b.planned]));
      const headers = ['Category', 'Type', 'Planned', 'Actual', 'Diff'];
      headers.forEach((h, i) => {
        sheet.getCell(row, i + 1).value = h;
        sheet.getCell(row, i + 1).font = { bold: true };
      });
      row += 1;
      for (const c of cats) {
        const planned = budgetMap.get(c.category_id) ?? 0;
        sheet.getCell(row, 1).value = c.display_name;
        sheet.getCell(row, 2).value = c.type;
        sheet.getCell(row, 3).value = planned;
        sheet.getCell(row, 3).numFmt = '#,##0.00';
        sheet.getCell(row, 4).value = c.total;
        sheet.getCell(row, 4).numFmt = '#,##0.00';
        sheet.getCell(row, 5).value = c.total - planned;
        sheet.getCell(row, 5).numFmt = '#,##0.00';
        row += 1;
      }
      row += 2;
    }
    sheet.columns = [
      { width: 24 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
    ] as Partial<ExcelJS.Column>[];
  }

  if (opts.sections.includes('analytics')) {
    const sheet = wb.addWorksheet('Analytics');
    const cols: Array<{ header: string; key: string; width: number }> = [
      { header: 'Month', key: 'label', width: 16 },
    ];
    if (opts.typeFilter !== 'expense') cols.push({ header: 'Income', key: 'income', width: 14 });
    if (opts.typeFilter !== 'income')  cols.push({ header: 'Expenses', key: 'expenses', width: 14 });
    cols.push({ header: 'Saved', key: 'saved', width: 14 });
    sheet.columns = cols;
    for (const m of months) {
      const s = getMonthSummary(db, m);
      const row: Record<string, unknown> = { label: s.label, saved: s.saved };
      if (opts.typeFilter !== 'expense') row.income = s.income;
      if (opts.typeFilter !== 'income')  row.expenses = s.expenses;
      sheet.addRow(row);
    }
    sheet.getRow(1).font = headerStyle as ExcelJS.Row['font'];
    sheet.eachRow((r, idx) => {
      if (idx === 1) return;
      r.eachCell((cell, colNum) => {
        if (colNum > 1) cell.numFmt = '#,##0.00';
      });
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ─── PDF builder ─── */

function buildPdf(opts: ExportOptions, months: MonthRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const drawTitle = (txt: string, size = 18) => {
      doc.font('Helvetica-Bold').fontSize(size).fillColor('#111').text(txt);
      doc.moveDown(0.4);
    };
    const drawSubtitle = (txt: string) => {
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#222').text(txt);
      doc.moveDown(0.3);
    };
    const drawMeta = (txt: string) => {
      doc.font('Helvetica').fontSize(9).fillColor('#666').text(txt);
      doc.moveDown(0.6);
    };

    const drawTable = (headers: string[], rows: string[][], widths: number[], align: ('left' | 'right')[]) => {
      const startX = doc.page.margins.left;
      const rowH = 16;
      const headerH = 18;

      const ensureSpace = (need: number) => {
        if (doc.y + need > doc.page.height - doc.page.margins.bottom) doc.addPage();
      };

      const drawRow = (cells: string[], h: number, bold: boolean, fill?: string) => {
        ensureSpace(h);
        const y = doc.y;
        if (fill) {
          doc.rect(startX, y, pageWidth, h).fill(fill);
        }
        doc.fillColor('#111').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        let x = startX;
        for (let i = 0; i < cells.length; i++) {
          const w = widths[i];
          doc.text(cells[i], x + 4, y + 4, { width: w - 8, align: align[i], lineBreak: false, ellipsis: true });
          x += w;
        }
        doc.y = y + h;
      };

      drawRow(headers, headerH, true, '#eeeeee');
      for (let i = 0; i < rows.length; i++) {
        drawRow(rows[i], rowH, false, i % 2 === 1 ? '#fafafa' : undefined);
      }
      doc.moveDown(0.8);
    };

    // ─── Cover ───
    drawTitle('Personal Finance Report');
    drawMeta(`Period: ${fmtRange(opts)}    Type: ${opts.typeFilter === 'all' ? 'All' : opts.typeFilter === 'expense' ? 'Expenses only' : 'Income only'}    Generated: ${new Date().toISOString().slice(0, 10)}`);

    if (months.length === 0) {
      drawMeta('No data available for the selected period.');
    }

    // ─── Transactions ───
    if (opts.sections.includes('transactions')) {
      drawSubtitle('Transactions');
      const txs = getTransactions(db, months.map(m => m.id), opts.typeFilter);
      if (txs.length === 0) {
        drawMeta('No transactions match the selection.');
      } else {
        const widths = [70, 200, 100, 70, 75];
        const rows = txs.map(t => [
          t.date,
          t.description ?? '',
          t.category_display_name ?? '',
          t.bank,
          (t.type === 'expense' ? '-' : '') + fmtAmount(t.amount),
        ]);
        drawTable(['Date', 'Description', 'Category', 'Bank', 'Amount'], rows, widths, ['left', 'left', 'left', 'left', 'right']);
        const total = txs.reduce((s, t) => s + (t.type === 'expense' ? -t.amount : t.amount), 0);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#111')
           .text(`${txs.length} transactions    Total: ${fmtAmount(total)}`, { align: 'right' });
        doc.moveDown(0.8);
      }
    }

    // ─── Dashboard ───
    if (opts.sections.includes('dashboard')) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 100) doc.addPage();
      drawSubtitle('Dashboard');
      for (const m of months) {
        const s = getMonthSummary(db, m);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#111').text(s.label);
        doc.moveDown(0.3);

        const summaryRows: string[][] = [];
        if (opts.typeFilter !== 'expense') summaryRows.push(['Income', fmtAmount(s.income)]);
        if (opts.typeFilter !== 'income')  summaryRows.push(['Expenses', fmtAmount(s.expenses)]);
        summaryRows.push(['Saved', fmtAmount(s.saved)]);
        summaryRows.push(['Start Balance', fmtAmount(s.start_balance)]);
        summaryRows.push(['End Balance', fmtAmount(s.end_balance)]);
        drawTable(['Metric', 'Value'], summaryRows, [200, 120], ['left', 'right']);

        const cats = filterCategories(s.byCategory, opts.typeFilter);
        if (cats.length > 0) {
          const budgetMap = new Map(s.budgets.map(b => [b.category_id, b.planned]));
          const widths = [150, 70, 80, 80, 80];
          const rows = cats.map(c => {
            const planned = budgetMap.get(c.category_id) ?? 0;
            return [c.display_name, c.type, fmtAmount(planned), fmtAmount(c.total), fmtAmount(c.total - planned)];
          });
          drawTable(['Category', 'Type', 'Planned', 'Actual', 'Diff'], rows, widths, ['left', 'left', 'right', 'right', 'right']);
        }
        doc.moveDown(0.4);
      }
    }

    // ─── Analytics ───
    if (opts.sections.includes('analytics')) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 100) doc.addPage();
      drawSubtitle('Analytics');
      const headers = ['Month'];
      if (opts.typeFilter !== 'expense') headers.push('Income');
      if (opts.typeFilter !== 'income')  headers.push('Expenses');
      headers.push('Saved');
      const colCount = headers.length;
      const baseWidth = pageWidth / colCount;
      const widths = new Array(colCount).fill(baseWidth);
      const align: ('left' | 'right')[] = headers.map((_, i) => i === 0 ? 'left' : 'right');

      const rows = months.map(m => {
        const s = getMonthSummary(db, m);
        const row: string[] = [s.label];
        if (opts.typeFilter !== 'expense') row.push(fmtAmount(s.income));
        if (opts.typeFilter !== 'income')  row.push(fmtAmount(s.expenses));
        row.push(fmtAmount(s.saved));
        return row;
      });
      drawTable(headers, rows, widths, align);
    }

    doc.end();
  });
}

/* ─── Route ─── */

router.post('/', async (req: Request, res: Response) => {
  const opts = req.body as Partial<ExportOptions>;
  if (!opts || (opts.format !== 'xlsx' && opts.format !== 'pdf')) {
    res.status(400).json({ error: 'format must be xlsx or pdf' });
    return;
  }
  if (!Array.isArray(opts.sections) || opts.sections.length === 0) {
    res.status(400).json({ error: 'sections must be a non-empty array' });
    return;
  }
  if (!opts.fromYear || !opts.fromMonth || !opts.toYear || !opts.toMonth) {
    res.status(400).json({ error: 'fromYear/fromMonth/toYear/toMonth required' });
    return;
  }
  const typeFilter: TypeFilter = (opts.typeFilter === 'expense' || opts.typeFilter === 'income') ? opts.typeFilter : 'all';

  const normalized: ExportOptions = {
    format: opts.format,
    fromYear: opts.fromYear, fromMonth: opts.fromMonth,
    toYear: opts.toYear, toMonth: opts.toMonth,
    sections: opts.sections.filter((s): s is Section => s === 'transactions' || s === 'dashboard' || s === 'analytics'),
    typeFilter,
  };

  const db = getDb();
  const months = getMonthsInRange(db, normalized);

  const fromStr = `${normalized.fromYear}-${String(normalized.fromMonth).padStart(2, '0')}`;
  const toStr   = `${normalized.toYear}-${String(normalized.toMonth).padStart(2, '0')}`;
  const periodStr = fromStr === toStr ? fromStr : `${fromStr}_${toStr}`;

  try {
    if (normalized.format === 'xlsx') {
      const buf = await buildExcel(normalized, months);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="finance-${periodStr}.xlsx"`);
      res.send(buf);
    } else {
      const buf = await buildPdf(normalized, months);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="finance-${periodStr}.pdf"`);
      res.send(buf);
    }
  } catch (err) {
    console.error('Export failed:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

export default router;
