import { Router, Request, Response } from 'express';
import { getDb } from '../db/index';

const router = Router();

// GET /api/merchant-rules — all rules joined with category info
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const rules = db.prepare(`
    SELECT mr.*, c.display_name as category_display_name, c.color as category_color, c.type as category_type
    FROM merchant_rules mr
    LEFT JOIN categories c ON mr.category_id = c.id
    ORDER BY mr.created_at DESC
  `).all();
  res.json(rules);
});

// POST /api/merchant-rules — create a new rule
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { pattern, category_id, description_clean, match_amount, match_type = 'contains' } = req.body as {
    pattern: string;
    category_id: number;
    description_clean?: string;
    match_amount?: number | null;
    match_type?: 'contains' | 'regex';
  };

  if (!pattern || !category_id) {
    res.status(400).json({ error: 'pattern and category_id are required' });
    return;
  }

  try {
    const result = db.prepare(
      'INSERT INTO merchant_rules (pattern, category_id, description_clean, match_amount, match_type) VALUES (?, ?, ?, ?, ?)'
    ).run(pattern.trim(), category_id, description_clean?.trim() ?? null, match_amount ?? null, match_type);

    const created = db.prepare(`
      SELECT mr.*, c.display_name as category_display_name, c.color as category_color, c.type as category_type
      FROM merchant_rules mr
      LEFT JOIN categories c ON mr.category_id = c.id
      WHERE mr.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(created);
  } catch (err: any) {
    // UNIQUE constraint on pattern
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'A rule with this pattern already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// PUT /api/merchant-rules/:id — update an existing rule
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = parseInt(req.params.id);
  const { pattern, category_id, description_clean, match_amount, match_type } = req.body as {
    pattern?: string;
    category_id?: number;
    description_clean?: string;
    match_amount?: number | null;
    match_type?: 'contains' | 'regex';
  };

  try {
    db.prepare(`
      UPDATE merchant_rules SET
        pattern           = ?,
        category_id       = ?,
        description_clean = ?,
        match_amount      = ?,
        match_type        = ?
      WHERE id = ?
    `).run(
      pattern?.trim() ?? null,
      category_id ?? null,
      description_clean?.trim() ?? null,
      match_amount ?? null,
      match_type ?? 'contains',
      id
    );

    const updated = db.prepare(`
      SELECT mr.*, c.display_name as category_display_name, c.color as category_color, c.type as category_type
      FROM merchant_rules mr
      LEFT JOIN categories c ON mr.category_id = c.id
      WHERE mr.id = ?
    `).get(id);

    res.json(updated);
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'A rule with this pattern already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// DELETE /api/merchant-rules/:id
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM merchant_rules WHERE id = ?').run(parseInt(req.params.id));
  res.json({ success: true });
});

export default router;
