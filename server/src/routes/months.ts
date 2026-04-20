import { Router, Request, Response } from 'express';
import { getDb } from '../db/index';
import { Month } from '../types';

const router = Router();

const LIVING_CATEGORIES = ['groceries', 'home_products', 'rent', 'water_heating', 'electricity', 'phone_internet', 'subscriptions'];
const EXTRA_CATEGORIES = ['transportation', 'restaurants', 'misc_purchases', 'other'];

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const months = db.prepare('SELECT * FROM months ORDER BY year DESC, month DESC').all();
  res.json(months);
});

router.get('/:year/:month', (req: Request, res: Response) => {
  const db = getDb();
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month);

  db.prepare('INSERT OR IGNORE INTO months (year, month) VALUES (?, ?)').run(year, month);
  const record = db.prepare('SELECT * FROM months WHERE year = ? AND month = ?').get(year, month);
  res.json(record);
});

router.put('/:year/:month', (req: Request, res: Response) => {
  const db = getDb();
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month);
  const { start_balance, end_balance, status } = req.body as Partial<Month>;

  db.prepare(
    'UPDATE months SET start_balance = COALESCE(?, start_balance), end_balance = COALESCE(?, end_balance), status = COALESCE(?, status) WHERE year = ? AND month = ?'
  ).run(start_balance ?? null, end_balance ?? null, status ?? null, year, month);

  const updated = db.prepare('SELECT * FROM months WHERE year = ? AND month = ?').get(year, month);
  res.json(updated);
});

router.get('/:year/:month/summary', (req: Request, res: Response) => {
  const db = getDb();
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month);

  const monthRecord = db.prepare('SELECT * FROM months WHERE year = ? AND month = ?').get(year, month) as Month | undefined;
  if (!monthRecord) {
    res.json({ income: 0, expenses: 0, saved: 0, start_balance: 0, end_balance: 0, byCategory: [] });
    return;
  }

  const income = (db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE month_id = ? AND type = 'income'"
  ).get(monthRecord.id) as { total: number }).total;

  const expenses = (db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE month_id = ? AND type = 'expense'"
  ).get(monthRecord.id) as { total: number }).total;

  const byCategory = db.prepare(`
    SELECT c.id as category_id, c.name as category_name, c.display_name, c.type, c.color, COALESCE(SUM(t.amount), 0) as total
    FROM categories c
    LEFT JOIN transactions t ON t.category_id = c.id AND t.month_id = ?
    WHERE c.is_active = 1
    GROUP BY c.id
    ORDER BY c.type, c.sort_order
  `).all(monthRecord.id);

  const budgets = db.prepare('SELECT * FROM budgets WHERE month_id = ?').all(monthRecord.id);

  res.json({
    income,
    expenses,
    saved: income - expenses,
    start_balance: monthRecord.start_balance,
    end_balance: monthRecord.end_balance,
    byCategory,
    budgets,
  });
});

router.get('/:year/:month/allocation', (req: Request, res: Response) => {
  const db = getDb();
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month);

  const monthRecord = db.prepare('SELECT * FROM months WHERE year = ? AND month = ?').get(year, month) as Month | undefined;

  const emptyAllocation = { living_costs: 0, extra_costs: 0, necessary_allowance: 0, allowance_f: 0, difference: 0 };

  if (!monthRecord) {
    res.json({ current: emptyAllocation, previous: emptyAllocation });
    return;
  }

  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevRecord = db.prepare('SELECT * FROM months WHERE year = ? AND month = ?').get(prevYear, prevMonth) as Month | undefined;

  res.json({
    current: computeAllocation(db, monthRecord.id),
    previous: prevRecord ? computeAllocation(db, prevRecord.id) : emptyAllocation,
  });
});

function computeAllocation(db: ReturnType<typeof getDb>, monthId: number) {
  const placeholders = (arr: string[]) => arr.map(() => '?').join(', ');

  const livingQuery = db.prepare(`
    SELECT COALESCE(SUM(t.amount), 0) as total
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.month_id = ? AND t.type = 'expense' AND c.name IN (${placeholders(LIVING_CATEGORIES)})
  `);
  const living_costs = (livingQuery.get(monthId, ...LIVING_CATEGORIES) as { total: number }).total;

  const extraQuery = db.prepare(`
    SELECT COALESCE(SUM(t.amount), 0) as total
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.month_id = ? AND t.type = 'expense' AND c.name IN (${placeholders(EXTRA_CATEGORIES)})
  `);
  const extra_costs = (extraQuery.get(monthId, ...EXTRA_CATEGORIES) as { total: number }).total;

  const allowance_f = (db.prepare(`
    SELECT COALESCE(SUM(t.amount), 0) as total
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.month_id = ? AND t.type = 'income' AND c.name = 'allowance_f'
  `).get(monthId) as { total: number }).total;

  return {
    living_costs,
    extra_costs,
    necessary_allowance: living_costs,
    allowance_f,
    difference: allowance_f - living_costs,
  };
}

export { computeAllocation };
export default router;
