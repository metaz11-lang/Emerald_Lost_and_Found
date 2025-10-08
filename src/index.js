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

app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));

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
                        return res.json({ success: true, message: 'Login successful' });
                }
                return res.status(401).json({ error: 'Invalid credentials' });
        } catch (err) {
                console.error('Admin login error', err);
                return res.status(500).json({ error: 'Login failed' });
        }
});

// Health / readiness endpoint for load balancers & uptime checks
app.get('/healthz', (req, res) => {
        res.json({ status: 'ok', time: new Date().toISOString() });
});

// For single-page-app routing, always return index.html for unknown GET routes
// Use a regex catch-all for GET routes to avoid path-to-regexp parameter parsing issues
app.get(/.*/, (req, res) => {
        res.sendFile(path.resolve(__dirname, '..', 'public', 'index.html'));
});

app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
});
