import Database from 'better-sqlite3';

const EXPENSE_CATEGORIES = [
  { name: 'groceries', display_name: 'Groceries', color: '#22c55e', sort_order: 1 },
  { name: 'restaurants', display_name: 'Restaurants, snacks', color: '#f97316', sort_order: 2 },
  { name: 'home_products', display_name: 'Home products', color: '#06b6d4', sort_order: 3 },
  { name: 'rent', display_name: 'Rent', color: '#8b5cf6', sort_order: 4 },
  { name: 'water_heating', display_name: 'Water, heating, cooling', color: '#3b82f6', sort_order: 5 },
  { name: 'electricity', display_name: 'Electricity', color: '#eab308', sort_order: 6 },
  { name: 'phone_internet', display_name: 'Phone & Internet', color: '#14b8a6', sort_order: 7 },
  { name: 'subscriptions', display_name: 'Subscriptions', color: '#a855f7', sort_order: 8 },
  { name: 'misc_purchases', display_name: 'Misc. Purchases', color: '#6b7280', sort_order: 9 },
  { name: 'transportation', display_name: 'Transportation', color: '#f59e0b', sort_order: 10 },
  { name: 'other', display_name: 'Other', color: '#71717a', sort_order: 11 },
];

const INCOME_CATEGORIES = [
  { name: 'vigalex', display_name: 'Vigalex', color: '#10b981', sort_order: 1 },
  { name: 'allowance_f', display_name: 'Allowance (f)', color: '#34d399', sort_order: 2 },
  { name: 'allowance_m', display_name: 'Allowance (m)', color: '#6ee7b7', sort_order: 3 },
  { name: 'extra', display_name: 'Extra', color: '#a7f3d0', sort_order: 4 },
];

export function seedCategories(db: Database.Database): void {
  const count = (db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }).c;
  if (count > 0) return;

  const insert = db.prepare(
    'INSERT OR IGNORE INTO categories (name, display_name, type, color, sort_order) VALUES (?, ?, ?, ?, ?)'
  );

  const insertMany = db.transaction(() => {
    for (const cat of EXPENSE_CATEGORIES) {
      insert.run(cat.name, cat.display_name, 'expense', cat.color, cat.sort_order);
    }
    for (const cat of INCOME_CATEGORIES) {
      insert.run(cat.name, cat.display_name, 'income', cat.color, cat.sort_order);
    }
  });

  insertMany();
}
