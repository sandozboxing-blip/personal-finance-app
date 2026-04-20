import { Router, Request, Response } from 'express';
import { getDb } from '../db/index';
import { Category } from '../types';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const categories = db.prepare('SELECT * FROM categories ORDER BY type, sort_order').all();
  res.json(categories);
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name, display_name, type, color, sort_order } = req.body as Partial<Category>;

  if (!name || !display_name || !type) {
    res.status(400).json({ error: 'name, display_name, and type are required' });
    return;
  }

  try {
    const result = db.prepare(
      'INSERT INTO categories (name, display_name, type, color, sort_order) VALUES (?, ?, ?, ?, ?)'
    ).run(name, display_name, type, color ?? '#71717a', sort_order ?? 0);

    const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE')) {
      res.status(409).json({ error: 'Category name already exists' });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = parseInt(req.params.id);
  const { display_name, color, is_active, sort_order } = req.body as Partial<Category>;

  db.prepare(
    'UPDATE categories SET display_name = COALESCE(?, display_name), color = COALESCE(?, color), is_active = COALESCE(?, is_active), sort_order = COALESCE(?, sort_order) WHERE id = ?'
  ).run(display_name ?? null, color ?? null, is_active ?? null, sort_order ?? null, id);

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  res.json(updated);
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = parseInt(req.params.id);

  const txCount = (db.prepare('SELECT COUNT(*) as c FROM transactions WHERE category_id = ?').get(id) as { c: number }).c;
  if (txCount > 0) {
    res.status(409).json({
      error: `${txCount} transaction(s) use this category. Reassign them first or use deactivate instead.`,
      count: txCount,
    });
    return;
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
