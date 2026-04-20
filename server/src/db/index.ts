import Database from 'better-sqlite3';
import { runMigrations } from './migrations';
import { seedCategories } from './seed';

let db: Database.Database;

export function initDb(dbPath: string): Database.Database {
  db = new Database(dbPath);
  runMigrations(db);
  seedCategories(db);

  // Register REGEXP function so "x REGEXP y" works in queries.
  // SQLite calls regexp(pattern, subject) for "subject REGEXP pattern".
  db.function('regexp', { deterministic: true }, (pattern: string, text: string | null) => {
    try {
      return new RegExp(pattern, 'i').test(text ?? '') ? 1 : 0;
    } catch {
      return 0; // invalid regex → no match
    }
  });

  return db;
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}
