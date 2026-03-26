# Feature: `P5-H2` — Dependency upgrade path planner

| Field | Value |
|-------|--------|
| **Feature ID** | `P5-H2` |
| **Phase** | Phase 5 — Scan engine depth and scale |
| **Category** | **Both** (API + UI) |
| **Status** | `implemented — pending user verification` |

---

## What it does (user-facing)

After an MVP code scan completes, you can open the **Upgrade Plan** page to see a
prioritized list of dependencies that have known vulnerabilities. Each entry shows:

- Package name, current version, and ecosystem (npm, pip, go, etc.)
- How urgent the upgrade is (critical / high / medium / low)
- The highest severity and CVSS score across all vulnerabilities for that package
- Whether the vulnerable code is actually imported in your project (reachability)
- A one-click-copy terminal command to perform the upgrade
- Links to the related CVEs and findings

Safe (non-vulnerable) dependencies are listed separately and can be expanded.

## How to reach it

1. Go to **All Scans** and click any completed MVP code scan.
2. On the scan details page, click the **Upgrade Plan** button in the header.
3. The upgrade plan page opens with the full analysis.

## Technical summary

| Layer | File | Purpose |
|-------|------|---------|
| Service | `server/services/dependencyUpgradePlannerService.ts` | Parses SBOM components + SCA findings, computes upgrade urgency, builds plan |
| API | `server/routes.ts` — `GET /api/mvp-scans/:id/upgrade-plan` | Returns the upgrade plan JSON for a given MVP scan |
| UI | `client/src/pages/DependencyUpgradePlan.tsx` | Renders the upgrade plan with search, sort, expand/collapse |
| Route | `client/src/App.tsx` — `/scans/mvp/:id/upgrade-plan` | Client-side route |
| Entry | `client/src/pages/ScanDetails.tsx` — "Upgrade Plan" button | Link from scan details (MVP only) |

### Data sources

- **SBOM** (CycloneDX JSON stored on the MVP scan row): provides the full flat list
  of dependencies with name, version, and purl.
- **SCA findings**: findings with category `Dependency Vulnerability` or
  `Known Exploited Vulnerability` whose `location` field follows the pattern
  `manifest:package@version`.

### Upgrade urgency logic

| Condition | Urgency |
|-----------|---------|
| Highest severity = CRITICAL | critical |
| Highest severity = HIGH and reachability = import_referenced | critical |
| Highest severity = HIGH | high |
| Highest severity = MEDIUM and 2+ vulnerabilities | high |
| Highest severity = MEDIUM | medium |
| Everything else | low |

## API contract

```
GET /api/mvp-scans/:id/upgrade-plan
Authorization: session cookie or Bearer API key

Response 200:
{
  scanId, projectName,
  totalDependencies, vulnerableDependencies,
  recommendations: [{ dependency, vulnerabilityCount, highestSeverity, highestCvss, cves, reachability, upgradeUrgency, upgradeCommand, findings }],
  safeDependencies: [{ name, currentVersion, ecosystem, purl, manifestFile }],
  summary: { criticalUpgrades, highUpgrades, mediumUpgrades, lowUpgrades }
}
```

---

## Category breakdown

- **Category 1 (Frontend):** `DependencyUpgradePlan.tsx` — upgrade plan page with summary cards, searchable/sortable recommendation list, expandable rows with upgrade commands and CVE links; `ScanDetails.tsx` — "Upgrade Plan" button for MVP scans; `App.tsx` — `/scans/mvp/:id/upgrade-plan` route.
- **Category 2 (Backend):** `dependencyUpgradePlannerService.ts` — SBOM parsing, SCA finding correlation, urgency computation (severity + reachability matrix), upgrade command generation; `routes.ts` — `GET /api/mvp-scans/:id/upgrade-plan` endpoint.

---

## Manual testing steps

1. Log in and navigate to All Scans.
2. Click a completed MVP scan to open scan details.
3. Click the "Upgrade Plan" button.
4. Verify the page loads with summary cards and either recommendations or a "no vulnerable dependencies" message.
5. If recommendations exist, click a row to expand it and verify the upgrade command, CVEs, and linked findings appear.
6. Test the search bar by typing a package name.
7. Test sorting by clicking the sort buttons (Urgency, Severity, Vuln count, Name).
8. Click "Copy" on an upgrade command and paste it somewhere to verify it copied.

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` in `00_Full_Source_Code` | **pass** |
| DB push | Not required (no schema change) | N/A |

---

## User verification (required before next feature)

- [ ] I followed the manual testing steps above
- [ ] Behavior matches the user-facing summary
- [ ] **Approved to proceed** — next feature in plan

**Verified by:** _name / date_
**Comments:**

---

## Rollback

Delete `server/services/dependencyUpgradePlannerService.ts`,
remove the route from `server/routes.ts`,
delete `client/src/pages/DependencyUpgradePlan.tsx`,
remove the route and import from `client/src/App.tsx`,
and remove the button from `client/src/pages/ScanDetails.tsx`.
