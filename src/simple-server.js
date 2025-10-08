// Ultra-simple server to guarantee disc add/list works for you.
// Run with: npm run simple
const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3001; // different port so it won't clash with the other server

// DB setup (same location as main app)
const DB_PATH = process.env.SQLITE_FILE || path.resolve(__dirname,'..','data','data.sqlite');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
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

app.use(express.json());
app.use(express.static(path.resolve(__dirname,'..','public')));

function basic(row){
  return {
    id: row.id,
    ownerName: row.owner_name,
    phoneNumber: row.phone_number,
    discType: row.disc_type,
    discColor: row.disc_color,
    binNumber: row.bin_number,
    dateFound: row.date_found,
    isReturned: !!row.is_returned,
    smsDelivered: !!row.sms_delivered
  };
}

app.get('/api/ping', (req,res)=> res.json({ok:true}));

app.get('/api/discs', (req,res) => {
  const rows = db.prepare('SELECT * FROM discs ORDER BY date_found DESC').all();
  res.json(rows.map(basic));
});

app.post('/api/discs', (req,res) => {
  const { discType, discColor, ownerName='', phoneNumber='', binNumber } = req.body || {};
  if(!discType || !discColor) return res.status(400).json({ error:'discType and discColor required' });
  const now = new Date().toISOString();
  const stmt = db.prepare(`INSERT INTO discs (owner_name, phone_number, disc_type, disc_color, bin_number, date_found, is_returned, sms_delivered)
    VALUES (?,?,?,?,?,?,0,0)`);
  const info = stmt.run(ownerName.trim(), phoneNumber.trim(), discType, discColor, binNumber? Number(binNumber): null, now);
  const row = db.prepare('SELECT * FROM discs WHERE id=?').get(info.lastInsertRowid);
  res.json({ success:true, disc: basic(row) });
});

// Fallback debug create via GET
app.get('/api/debug/add-disc', (req,res) => {
  const { discType, discColor } = req.query;
  if(!discType || !discColor) return res.status(400).json({ error:'discType and discColor required' });
  const now = new Date().toISOString();
  const stmt = db.prepare(`INSERT INTO discs (owner_name, phone_number, disc_type, disc_color, bin_number, date_found, is_returned, sms_delivered)
    VALUES ('','',?,?,?,?,0,0)`);
  const info = stmt.run(discType, discColor, null, now);
  const row = db.prepare('SELECT * FROM discs WHERE id=?').get(info.lastInsertRowid);
  res.json({ success:true, disc: basic(row) });
});

// Always send admin-basic.html directly if requested
app.get(['/admin-basic','/admin-basic.html','/manage'], (req,res) => {
  res.sendFile(path.resolve(__dirname,'..','public','admin-basic.html'));
});

app.get('/', (req,res) => {
  res.sendFile(path.resolve(__dirname,'..','public','index.html'));
});

app.listen(port, () => {
  console.log('Simple server running at http://localhost:'+port);
  console.log('Basic admin: http://localhost:'+port+'/admin-basic');
});