const Database = require('better-sqlite3');
const path = require('path');

// Use file in project root (can be overridden)
const DEFAULT_FILE = path.resolve(__dirname, '..', 'data', 'data.sqlite');
const DB_PATH = process.env.SQLITE_FILE || DEFAULT_FILE;

// Ensure directory exists
const dir = path.dirname(DB_PATH);
try {
  require('fs').mkdirSync(dir, { recursive: true });
} catch {}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS discs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_name TEXT,
  phone_number TEXT,
  disc_type TEXT NOT NULL,
  disc_color TEXT NOT NULL,
  bin_number INTEGER,
  date_found TEXT NOT NULL,
  is_returned INTEGER NOT NULL DEFAULT 0,
  sms_delivered INTEGER NOT NULL DEFAULT 0
);`);

// Derived reference tables (optional) — we won't enforce, but we can extract from discs

module.exports = {
  insertDisc: db.prepare(`INSERT INTO discs (owner_name, phone_number, disc_type, disc_color, bin_number, date_found, is_returned, sms_delivered)
    VALUES (@owner_name, @phone_number, @disc_type, @disc_color, @bin_number, @date_found, @is_returned, @sms_delivered)`),
  listDiscs: db.prepare(`SELECT * FROM discs`),
  getDisc: db.prepare(`SELECT * FROM discs WHERE id = ?`),
  updateReturned: db.prepare(`UPDATE discs SET is_returned = 1 WHERE id = ?`),
  updateDisc: db.prepare(`UPDATE discs SET owner_name=@owner_name, phone_number=@phone_number, disc_type=@disc_type, disc_color=@disc_color, bin_number=@bin_number WHERE id=@id`),
  deleteDisc: db.prepare(`DELETE FROM discs WHERE id = ?`),
  cleanupExpired: db.prepare(`DELETE FROM discs WHERE is_returned = 0 AND date(date_found) < date('now','-42 day')`),
  stats: db.prepare(`SELECT
    COUNT(*) as total,
    SUM(CASE WHEN is_returned=1 THEN 1 ELSE 0 END) as returned,
    SUM(CASE WHEN is_returned=0 AND date(date_found) < date('now','-42 day') THEN 1 ELSE 0 END) as oldDiscs
    FROM discs`),
  // dynamic queries built in code for filtering/sorting
  raw: db
};
