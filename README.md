# Emerald Lost and Found

This repository contains a static-built React app in `public/` and a minimal Express server in `src/index.js` that serves the app.

Quick start (Windows / PowerShell):

1. Install dependencies:

```powershell
npm install
```

2. Run in development (auto-restarts on server file changes):

```powershell
npm run dev
```

3. Run production:

```powershell
npm start
```

The app will be available at http://localhost:3000 . The client contains an admin login form; for local/demo testing the credentials are:

- Username: `admin`
- Password: `emerald2024`

Notes:
- The repository currently includes browser shims under `public/shims/` to satisfy server-only imports that were present when the client was built. This is a development convenience. For a production-ready app you should rebuild the client so server-only modules are excluded or guarded at build time, and replace the demo login with a proper auth flow.

## Deployment

### Docker (recommended single-step deploy)

Build image:

```bash
docker build -t emerald-lost-and-found:latest .
```

Run container (mapping host port 8080 -> container 3000):

```bash
docker run -p 8080:3000 --env-file .env --name emerald emerald-lost-and-found:latest
```

Visit: http://localhost:8080

Override admin credential (example):

```bash
docker run -p 8080:3000 -e ADMIN_USERNAME=owner -e ADMIN_PASSWORD='ReplaceMe!' emerald-lost-and-found:latest
```

### Render / Railway / Fly.io / Heroku
All of these detect a Node app automatically.

1. Push this repository to GitHub.
2. Create a new web service on the platform.
3. Set build command: (leave empty – no build step required unless you later reintroduce a client build)
4. Set start command: `npm start`
5. Add environment variables (at minimum): `PORT`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
6. Deploy.

### Static + Server split (optional future improvement)
If you later rebuild the client from original TypeScript sources:
1. Move source under `client/`, run Vite build -> outputs to `public/`.
2. Keep Express only for API + static serving (or host static assets on a CDN / Netlify and expose an API separately).

### Hardening Checklist (do before real users)
- Replace demo admin login with proper authentication (session or JWT + hashed password storage).
- Rebuild client and remove runtime shims.
- Enable Helmet CSP (remove `contentSecurityPolicy: false`) and add hashes/nonces for inline scripts (or externalize them).
- Add rate limiting (e.g., `express-rate-limit`) to `/api/admin/login`.
- Add persistent logging & monitoring (e.g., to stdout -> platform logs, plus health checks hitting `/healthz`).
- Add error boundary UI on client.
- Add real database (PostgreSQL/SQLite) for items & users.

### Health Check
Deployed services can use: `GET /healthz` (returns `{ status: 'ok' }`).

---
Feel free to ask for help implementing the real auth/database or removing shims—just let me know the direction you want next.

