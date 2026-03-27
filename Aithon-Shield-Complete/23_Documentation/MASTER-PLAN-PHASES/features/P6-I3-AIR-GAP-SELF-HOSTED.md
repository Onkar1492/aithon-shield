# P6-I3: Air-Gap / Self-Hosted Packaging

> **Status**: implemented — pending user verification
> **Category**: 2 (Backend + DevOps)
> **Date**: 2026-03-26

---

## Overview

Enables Aithon Shield to be deployed in fully air-gapped (no internet) environments using Docker containers. Includes a multi-stage Dockerfile, Docker Compose configuration with built-in Postgres, an environment template, an automated air-gap bundle builder script, and a live system status panel on the Settings page.

---

## What Was Created

### 1. `Dockerfile` — Multi-stage production build
- **Stage 1 (deps)**: Installs production-only npm dependencies
- **Stage 2 (build)**: Full npm install + `npm run build` (Vite + esbuild)
- **Stage 3 (runtime)**: Minimal Node 20 slim image, non-root user (`aithon`), health check on `/api/health`

### 2. `docker-compose.yml` — Full-stack deployment
- **`db` service**: Postgres 16 Alpine with persistent volume, health check
- **`app` service**: Aithon Shield container, depends on healthy DB, auto-constructs `DATABASE_URL`, sets `AITHON_SELF_HOSTED=true`

### 3. `.env.example` — Environment variable template
- All required and optional variables documented with comments
- Sections: Database, Application, Self-hosted flag, AI providers, Git, Stripe, Push notifications, SSO/OIDC

### 4. `.dockerignore` — Build optimization
- Excludes `node_modules`, `dist`, `.git`, `.env`, logs, IDE files

### 5. `scripts/build-airgap-bundle.sh` — Offline bundle builder
- Builds Docker images, exports them to a tarball
- Packages `docker-compose.yml`, `.env.example`, `Dockerfile`, and a README
- Creates a single `.tar.gz` archive for physical transfer to air-gapped networks

### 6. `GET /api/self-hosted/status` — System status API
Returns real-time deployment information:
- App version, Node.js version, platform, architecture, uptime, memory usage
- Database connection status
- Feature module status (AI, Git, Billing, SSO, Push)
- Docker config file inventory

### 7. Settings UI — "Self-Hosted Deployment" card
- System stats grid (version, env, uptime, memory, node, platform, DB status, host)
- Feature modules checklist with green/grey status indicators
- Docker & Air-Gap section with copy-paste deployment commands
- Config file badges listing all packaging artifacts

---

## Files Modified

| File | Change |
|------|--------|
| `Dockerfile` | **New** — multi-stage production build |
| `docker-compose.yml` | **New** — app + Postgres stack |
| `.env.example` | **New** — environment variable template |
| `.dockerignore` | **New** — build context exclusions |
| `scripts/build-airgap-bundle.sh` | **New** — air-gap archive builder |
| `server/routes.ts` | Added `GET /api/self-hosted/status` endpoint |
| `client/src/pages/Settings.tsx` | Added `SelfHostedDeploymentCard` component |

---

## Verification Steps

### 1. Check the API endpoint
Navigate to: `http://localhost:5001/api/self-hosted/status`
You should see JSON with version, uptime, memory, features, etc.

### 2. Check the Settings UI
1. Go to Settings (`http://localhost:5001/settings`)
2. Scroll to the bottom — look for "Self-Hosted Deployment"
3. Verify you see: Version, Environment, Uptime, Memory, Node.js, Platform, Database
4. Verify "Feature Modules" shows status for 5 integrations
5. Verify "Docker & Air-Gap Packaging" shows deployment commands

### 3. Check Docker files exist
The following files should exist at the project root:
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `.dockerignore`
- `scripts/build-airgap-bundle.sh`

### 4. (Optional) Test Docker build
```bash
docker compose build
docker compose up -d
# Open http://localhost:5001
```

### 5. (Optional) Test air-gap bundle
```bash
chmod +x scripts/build-airgap-bundle.sh
./scripts/build-airgap-bundle.sh
ls -la aithon-shield-airgap-*.tar.gz
```

---

## Architecture Notes

- The `AITHON_SELF_HOSTED=true` env var is set automatically by Docker Compose
- When self-hosted, the Settings card shows a green "Self-Hosted" badge; otherwise "Cloud"
- The air-gap bundle is a single tarball containing Docker images + config files
- No internet is needed after loading the images on the target host
- The Postgres data persists in a Docker volume (`pgdata`) across restarts
