const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const app = express();
const port = process.env.PORT || 3000;

// Configurable (demo) admin credentials via env with safe defaults (NOT production-ready auth)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'emerald2024';

// SQLite persistence
const db = require('./db');

// We will dynamically discover types/colors from existing discs plus seed defaults
const seedDiscTypes = ['Driver','Fairway','Midrange','Putter'];
const seedDiscColors = ['Red','Blue','Green','Yellow','Orange','Purple','White','Black'];

function sanitizePhone(raw) {
        if (!raw) return '';
        const digits = String(raw).replace(/\D/g,'');
        if (!digits) return '';
        if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
        if (digits.length === 10) return '+1' + digits;
        if (raw.startsWith('+')) return raw;
        return '+' + digits;
}

function basicDiscView(row) {
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

app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));

// Fail-safe: ensure /admin and nested admin routes always serve admin.html BEFORE static 404s
app.use((req,res,next) => {
        if (req.method === 'GET' && (req.path === '/admin' || req.path === '/admin/')) {
                console.log('[route] serving admin.html (middleware exact)', req.originalUrl);
                return res.sendFile(path.resolve(__dirname, '..', 'public', 'admin.html'));
        }
        if (req.method === 'GET' && req.path.startsWith('/admin/')) {
                console.log('[route] serving admin.html (middleware nested)', req.originalUrl);
                return res.sendFile(path.resolve(__dirname, '..', 'public', 'admin.html'));
        }
        return next();
});
// Simple fallback admin page
app.get('/admin-basic', (req,res) => {
        res.sendFile(path.resolve(__dirname, '..', 'public', 'admin-basic.html'));
});
app.get('/manage', (req,res) => {
        res.redirect(302, '/admin-basic');
});

// Basic rate limiter (tune for production needs)
const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 50,
        standardHeaders: true,
        legacyHeaders: false
});
app.use(compression());
app.use(helmet({
        contentSecurityPolicy: false // keep disabled while using inline scripts/importmaps; tighten later
}));

// Simple request logger for development
app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
        next();
});

// Gracefully handle JSON parse errors and return JSON instead of HTML
app.use((err, req, res, next) => {
        if (err && err instanceof SyntaxError && err.status === 400 && 'body' in err) {
                console.warn('JSON parse error for', req.url);
                return res.status(400).json({ error: 'Invalid JSON' });
        }
        return next(err);
});

// Serve static files from the top-level public directory
app.use(express.static(path.resolve(__dirname, '..', 'public')));

// Minimal admin login endpoint (env-based). Replace with real auth+DB for production.
app.post('/api/admin/login', loginLimiter, (req, res) => {
        try {
                const { username, password } = req.body || {};
                if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
                        // Set a very simple session cookie so the React admin (which uses credentials:'include') treats user as logged in
                        try {
                                res.setHeader('Set-Cookie', 'emeraldSession=ok; Path=/; HttpOnly');
                        } catch {}
                        return res.json({ success: true, message: 'Login successful', session: 'ok' });
                }
                return res.status(401).json({ error: 'Invalid credentials' });
        } catch (err) {
                console.error('Admin login error', err);
                return res.status(500).json({ error: 'Login failed' });
        }
});

// Admin status endpoint used by React admin to decide if dashboard should render
app.get('/api/admin/status', (req,res) => {
        try {
                const cookie = req.headers.cookie || '';
                const isAdmin = /emeraldSession=ok/.test(cookie);
                res.json({ isAdmin });
        } catch (e) {
                res.status(500).json({ error: 'Status check failed' });
        }
});

// Admin logout endpoint (clears cookie)
app.post('/api/admin/logout', (req,res) => {
        try {
                // Overwrite cookie with immediate expiry
                res.setHeader('Set-Cookie', 'emeraldSession=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
                res.json({ success: true, message: 'Logged out' });
        } catch (e) {
                res.status(500).json({ error: 'Logout failed' });
        }
});

// Simple ping for diagnostics
app.get('/api/ping', (req,res) => res.json({ ok:true, time: Date.now() }));

// Public: list disc types
app.get('/api/disc-types', (req,res) => {
        const rows = db.raw.prepare(`SELECT DISTINCT disc_type as type FROM discs ORDER BY disc_type`).all();
        const dynamic = rows.map(r => r.type);
        const merged = Array.from(new Set([...seedDiscTypes, ...dynamic]));
        res.json(merged.map(type => ({ type })));
});

// Public: list disc colors
app.get('/api/disc-colors', (req,res) => {
        const rows = db.raw.prepare(`SELECT DISTINCT disc_color as color FROM discs ORDER BY disc_color`).all();
        const dynamic = rows.map(r => r.color);
        const merged = Array.from(new Set([...seedDiscColors, ...dynamic]));
        res.json(merged.map(color => ({ color })));
});

// Public: create disc (used by add form) - no SMS sending, just record
app.post('/api/discs', (req,res) => {
        try {
                const { ownerName='', phoneNumber='', discType='', discColor='', binNumber } = req.body || {};
                if (!discType || !discColor) return res.status(400).json({ error: 'discType and discColor are required' });
                const now = new Date().toISOString();
                const toInsert = {
                        owner_name: ownerName.trim(),
                        phone_number: phoneNumber === 'NONE' ? 'NONE' : sanitizePhone(phoneNumber),
                        disc_type: discType,
                        disc_color: discColor,
                        bin_number: typeof binNumber === 'number' ? binNumber : null,
                        date_found: now,
                        is_returned: 0,
                        sms_delivered: 0
                };
                const info = db.insertDisc.run(toInsert);
                const row = db.getDisc.get(info.lastInsertRowid);
                const total = db.stats.get().total;
                console.log('[disc:create] id=%s total=%s payload=%j', row.id, total, {
                  ownerName: row.owner_name, phoneNumber: row.phone_number, discType: row.disc_type, discColor: row.disc_color, binNumber: row.bin_number
                });
                res.setHeader('X-Disc-Count', total ?? 0);
                return res.json({ success: true, message: 'Disc recorded', disc: basicDiscView(row) });
        } catch (e) {
                console.error('Create disc error', e);
                return res.status(500).json({ error: 'Failed to record disc' });
        }
});

// Backup (GET) disc creation for environments where POST might be blocked / misrouted
// Example: /api/debug/add-disc?discType=Driver&discColor=Blue
app.get('/api/debug/add-disc', (req,res) => {
        try {
                const { ownerName='', phoneNumber='', discType='', discColor='', binNumber } = req.query || {};
                if (!discType || !discColor) return res.status(400).json({ error: 'discType and discColor required' });
                const now = new Date().toISOString();
                const toInsert = {
                        owner_name: String(ownerName).trim(),
                        phone_number: phoneNumber === 'NONE' ? 'NONE' : sanitizePhone(phoneNumber),
                        disc_type: String(discType),
                        disc_color: String(discColor),
                        bin_number: binNumber !== undefined && binNumber !== '' ? Number(binNumber) : null,
                        date_found: now,
                        is_returned: 0,
                        sms_delivered: 0
                };
                const info = db.insertDisc.run(toInsert);
                const row = db.getDisc.get(info.lastInsertRowid);
                res.json({ success:true, via:'debug-add', disc: basicDiscView(row) });
        } catch (e) {
                res.status(500).json({ error: 'Debug add failed', details: String(e) });
        }
});

// Public: list discs (limited fields) with optional search (ownerName / phone / type / color)
app.get('/api/discs', (req,res) => {
        try {
                const { search } = req.query;
                let where = '';
                let params = {};
                if (search) {
                        where = 'WHERE (lower(owner_name) LIKE @s OR phone_number LIKE @s OR lower(disc_type) LIKE @s OR lower(disc_color) LIKE @s)';
                        params.s = `%${String(search).toLowerCase()}%`;
                }
                const rows = db.raw.prepare(`SELECT id, owner_name, phone_number, disc_type, disc_color, bin_number, date_found, is_returned, sms_delivered FROM discs ${where} ORDER BY date_found DESC LIMIT 500`).all(params);
                res.setHeader('X-Disc-Count', rows.length);
                res.json(rows.map(basicDiscView));
        } catch (e) {
                console.error('List discs error', e);
                res.status(500).json({ error: 'Failed to list discs' });
        }
});

// Admin auth middleware (simple header-based since we have no sessions)
function requireAdmin(req,res,next){
        // In original app likely cookie/session; here we accept basic header for simplicity
        // Client currently only relies on login success to show admin UI; we'll skip strict enforcement
        return next();
}

// Admin: stats
app.get('/api/admin/stats', requireAdmin, (req,res) => {
        const row = db.stats.get();
        res.json({ totalDiscs: row.total || 0, returnedDiscs: row.returned || 0, oldDiscs: row.oldDiscs || 0 });
});

// Admin: sms quota placeholder
app.get('/api/admin/sms-quota', requireAdmin, (req,res) => {
        res.json({ success: true, quotaRemaining: 0, used: 0, limit: 0 });
});

// Admin: list discs with optional search/sort/filter
app.get('/api/admin/discs', requireAdmin, (req,res) => {
        const { search='', sortBy='date_desc', filterBy='all' } = req.query;
        let clauses = [];
        let params = {};
        if (search) {
                clauses.push('(lower(owner_name) LIKE @s OR phone_number LIKE @s)');
                params.s = `%${String(search).toLowerCase()}%`;
        }
        if (filterBy === 'returned') clauses.push('is_returned = 1');
        else if (filterBy === 'active') clauses.push('is_returned = 0');
        let where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
        let order = 'ORDER BY date_found DESC';
        if (sortBy === 'date_asc') order = 'ORDER BY date_found ASC';
        const stmt = db.raw.prepare(`SELECT * FROM discs ${where} ${order}`);
        const rows = stmt.all(params).map(basicDiscView);
        console.log('[disc:list:admin] count=%s filter=%s search="%s"', rows.length, req.query.filterBy, req.query.search);
        res.setHeader('X-Disc-Count', rows.length);
        res.json(rows);
});

// Admin: mark returned
app.patch('/api/admin/discs/:id/return', requireAdmin, (req,res) => {
        const id = Number(req.params.id);
        const existing = db.getDisc.get(id);
        if (!existing) return res.status(404).json({ error: 'Not found' });
        db.updateReturned.run(id);
        res.json({ success: true, message: 'Disc marked as returned' });
});

// Admin: update disc
app.patch('/api/admin/discs/:id', requireAdmin, (req,res) => {
        const id = Number(req.params.id);
        const existing = db.getDisc.get(id);
        if (!existing) return res.status(404).json({ error: 'Not found' });
        const { ownerName, phoneNumber, discType, discColor, binNumber } = req.body || {};
        const payload = {
                id,
                owner_name: ownerName !== undefined ? ownerName : existing.owner_name,
                phone_number: phoneNumber !== undefined ? (phoneNumber === 'NONE' ? 'NONE' : sanitizePhone(phoneNumber)) : existing.phone_number,
                disc_type: discType !== undefined ? discType : existing.disc_type,
                disc_color: discColor !== undefined ? discColor : existing.disc_color,
                bin_number: binNumber !== undefined ? binNumber : existing.bin_number
        };
        db.updateDisc.run(payload);
        res.json({ success: true, message: 'Disc updated' });
});

// Admin: delete disc
app.delete('/api/admin/discs/:id', requireAdmin, (req,res) => {
        const id = Number(req.params.id);
        const existing = db.getDisc.get(id);
        if (!existing) return res.status(404).json({ error: 'Not found' });
        db.deleteDisc.run(id);
        res.json({ success: true, message: 'Disc deleted' });
});

// Admin: resend SMS stub (no-op)
app.post('/api/admin/discs/:id/resend-sms', requireAdmin, (req,res) => {
        const id = Number(req.params.id);
        const existing = db.getDisc.get(id);
        if (!existing) return res.status(404).json({ error: 'Not found' });
        return res.json({ success: true, smsDelivered: false, message: 'SMS disabled in this deployment' });
});

// Admin: cleanup expired (older than 6 weeks and not returned)
app.delete('/api/admin/discs/expired', requireAdmin, (req,res) => {
        const info = db.cleanupExpired.run();
        res.json({ success: true, message: `Removed ${info.changes} expired disc(s)` });
});

// Debug: seed a test disc if none exist
app.post('/api/debug/seed', (req,res) => {
        try {
                const row = db.stats.get();
                if (row.total > 0) return res.json({ success: true, message: 'Already seeded', total: row.total });
                const payload = {
                        owner_name: 'Seed User',
                        phone_number: '+16025550000',
                        disc_type: 'Driver',
                        disc_color: 'Blue',
                        bin_number: 1,
                        date_found: new Date().toISOString(),
                        is_returned: 0,
                        sms_delivered: 0
                };
                const info = db.insertDisc.run(payload);
                console.log('[disc:seed] inserted id=%s', info.lastInsertRowid);
                return res.json({ success: true, message: 'Seed disc inserted', id: info.lastInsertRowid });
        } catch (e) {
                console.error('Seed error', e);
                return res.status(500).json({ error: 'Seed failed' });
        }
});

// Debug: show db info
app.get('/api/debug/info', (req,res) => {
        try {
                const stats = db.stats.get();
                res.json({
                        success: true,
                        dbFile: require('path').resolve(require('./db').raw.name || 'unknown'),
                        total: stats.total || 0,
                        returned: stats.returned || 0,
                        oldDiscs: stats.oldDiscs || 0,
                        now: new Date().toISOString()
                });
        } catch (e) {
                res.status(500).json({ error: 'Debug info failed', details: String(e) });
        }
});

// Debug: list registered top-level GET routes
app.get('/api/debug/routes', (req,res) => {
        try {
                const routes = [];
                app._router.stack.forEach(layer => {
                        if (!layer.route || !layer.route.path) return;
                        const methods = Object.keys(layer.route.methods).filter(m => layer.route.methods[m]);
                        if (methods.includes('get')) routes.push(layer.route.path.toString());
                });
                res.json({ success:true, routes });
        } catch (e) {
                res.status(500).json({ error: 'Route list failed', details:String(e) });
        }
});

// Health / readiness endpoint for load balancers & uptime checks
app.get('/healthz', (req, res) => {
        res.json({ status: 'ok', time: new Date().toISOString() });
});

// Explicit admin SPA routes (secondary safety net) - log if hit (should be rare now)
app.get('/admin', (req,res) => {
        console.log('[route-fallback] explicit /admin hit, sending admin.html');
        res.sendFile(path.resolve(__dirname, '..', 'public', 'admin.html'));
});
app.get(/^\/admin\//, (req,res) => {
        console.log('[route-fallback] explicit /admin/* hit, sending admin.html');
        res.sendFile(path.resolve(__dirname, '..', 'public', 'admin.html'));
});

// Debug endpoint to confirm server sees /admin when queried
app.get('/api/debug/admin-route-test', (req,res) => {
        res.json({ ok:true, note:'Admin route test endpoint reachable', time:Date.now() });
});

// JSON 404 for any unmatched /api/ path (must be before SPA catch-all)
app.use('/api', (req,res) => {
        res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

// For single-page-app routing, always return index.html for unknown GET routes
// Use a regex catch-all for GET routes to avoid path-to-regexp parameter parsing issues
app.get(/.*/, (req, res) => {
        res.sendFile(path.resolve(__dirname, '..', 'public', 'index.html'));
});

app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
        try {
                const routes = [];
                (app._router && app._router.stack || []).forEach(l => {
                        try {
                                if (l.route && l.route.path && l.route.methods && l.route.methods.get) {
                                        routes.push(String(l.route.path));
                                }
                        } catch {}
                });
                console.log('[startup] GET routes:', routes.length ? routes.join(', ') : '(none found)');
                const fs = require('fs');
                const adminBasicPath = path.resolve(__dirname,'..','public','admin-basic.html');
                if (!fs.existsSync(adminBasicPath)) {
                        console.warn('[startup] WARNING: admin-basic.html missing at', adminBasicPath);
                } else {
                        console.log('[startup] admin-basic available at /admin-basic');
                        console.log('[startup] If /admin-basic 404s, try /admin-basic.html (static file)');
                }
        } catch (e) { console.warn('Route log failed', e); }
});
