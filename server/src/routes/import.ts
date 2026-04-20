import { Router, Request, Response } from 'express';
import multer from 'multer';
import { getDb } from '../db/index';
import { parseRevolut } from '../parsers/revolut';
import { parseSantander } from '../parsers/santander';
import { parseFibank } from '../parsers/fibank';
import { categorize } from '../categorizer';
import { CategorizedTransaction, Month } from '../types';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/parse', upload.single('file'), async (req: Request, res: Response) => {
  const db = getDb();

  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const bank = req.body.bank as string;
  if (!bank || !['revolut', 'santander', 'fibank'].includes(bank)) {
    res.status(400).json({ error: 'bank must be revolut, santander, or fibank' });
    return;
  }

  try {
    let rawTransactions;

    if (bank === 'revolut') {
      rawTransactions = parseRevolut(req.file.buffer.toString('utf-8'));
    } else if (bank === 'santander') {
      rawTransactions = parseSantander(req.file.buffer);
    } else {
      rawTransactions = parseFibank(req.file.buffer);
    }

    const categorized = await categorize(rawTransactions, db);
    res.json({ transactions: categorized, count: categorized.length });
  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Parse failed' });
  }
});

router.post('/confirm', (req: Request, res: Response) => {
  const db = getDb();
  const { transactions, year, month } = req.body as {
    transactions: CategorizedTransaction[];
    year: number;
    month: number;
  };

  if (!transactions || !Array.isArray(transactions)) {
    res.status(400).json({ error: 'transactions array is required' });
    return;
  }

  // Get or create month
  db.prepare('INSERT OR IGNORE INTO months (year, month) VALUES (?, ?)').run(year, month);
  const monthRecord = db.prepare('SELECT * FROM months WHERE year = ? AND month = ?').get(year, month) as Month;

  const insert = db.prepare(`
    INSERT INTO transactions (month_id, date, amount, description, raw_description, type, category_id, bank, manually_reviewed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const insertAll = db.transaction(() => {
    for (const tx of transactions) {
      insert.run(
        monthRecord.id,
        tx.date,
        tx.amount,
        tx.description,
        tx.raw_description,
        tx.type,
        tx.category_id ?? null,
        tx.bank
      );
    }
  });

  insertAll();
  res.json({ imported: transactions.length });
});

export default router;
