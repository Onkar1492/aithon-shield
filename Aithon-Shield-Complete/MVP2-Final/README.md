# MVP2-Final — Enterprise & deferred features archive

This folder holds **documentation and code snapshots** for capabilities that are **out of scope for consumer MVP1** (cloud SaaS: Free / Starter / Pro). Implement these when you bring back enterprise or air-gapped offerings.

## Contents

| Area | What lives here / in repo |
|------|---------------------------|
| White-label branding | `P6-I2-WHITE-LABEL-BRANDING-DEFERRED.md` |
| API security testing (archive) | `openapi-api-security-scan/` (also re-wire from main app when enabling Pro) |
| SSO SAML/OIDC | Source: `server/samlService.ts`, `server/oidcService.ts` — routes removed from `server/routes.ts` in MVP1 |
| Compliance evidence ZIP | `server/complianceEvidenceRoutes.ts` |
| VEX output | `server/vexRoutes.ts`, `server/services/vexGenerator.ts` |
| Webhooks / SIEM | `server/webhookRoutes.ts`, `server/webhookDispatchService.ts` |
| Self-hosted / air-gap | `Dockerfile`, `docker-compose.yml`, `scripts/build-airgap-bundle.sh` (P6-I3) |
| Immutable audit log UI | `client/src/pages/AuditLog.tsx` (page hidden in MVP1; API may still exist) |
| Attack path graph | `client/src/pages/AttackPathGraphPage.tsx` |
| Enterprise Settings UI | `client/src/components/SsoConfiguration.tsx`, webhooks card (removed from Settings in MVP1) |

## Consumer tiers (MVP1)

- **Free** — limited private repos / scans.
- **Starter** ($19.99/seat/mo) — unlimited scanning + core automation.
- **Pro** ($49.99/seat/mo) — AI + advanced scanners (see `shared/tierConfig.ts` in main codebase).

