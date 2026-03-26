# P5-H4 — In-App Learning Center

## Purpose

Transform the empty Learning Hub placeholder into a full-featured security knowledge base with structured learning modules, CWE vulnerability explainers, progress tracking, and integration with the findings table.

## User-facing summary

| What changed | Where |
|---|---|
| 6 structured learning modules with multi-section content | Learning Hub > Learning Modules tab |
| 8 CWE vulnerability explainers with code examples | Learning Hub > Vulnerability Explainers tab |
| Progress tracking (completed modules, read explainers) | Learning Hub summary cards + backend persistence |
| Module detail view with section navigation and progress bar | Click any module |
| Explainer detail view with vulnerable/secure code comparison | Click any explainer |
| CWE links in Findings table navigate to Learning Hub | Findings table > CWE column |

## Content included

### Learning Modules (6)
1. **Understanding the OWASP Top 10** (Beginner, 45 min, 5 sections)
2. **Secure Coding in JavaScript & TypeScript** (Intermediate, 60 min, 5 sections)
3. **Secrets Management Best Practices** (Intermediate, 30 min, 3 sections)
4. **Container Security Fundamentals** (Intermediate, 40 min, 3 sections)
5. **SCA & Dependency Security** (Beginner, 35 min, 3 sections)
6. **Infrastructure as Code Security** (Advanced, 50 min, 3 sections)

### Vulnerability Explainers (8)
1. **CWE-79: Cross-Site Scripting (XSS)** — HIGH
2. **CWE-89: SQL Injection** — CRITICAL
3. **CWE-798: Hardcoded Credentials** — CRITICAL
4. **CWE-22: Path Traversal** — HIGH
5. **CWE-352: Cross-Site Request Forgery (CSRF)** — MEDIUM
6. **CWE-502: Insecure Deserialization** — HIGH
7. **CWE-918: Server-Side Request Forgery (SSRF)** — HIGH
8. **CWE-287: Improper Authentication** — CRITICAL

Each explainer includes: summary, what is it, how it works, real-world breach example, how to detect, how to fix, vulnerable code example, secure code example, and external references.

## Technical implementation

### Shared content
**File:** `shared/learningContent.ts` — Defines `LearningModule` and `VulnerabilityExplainer` interfaces and all content data.

### Database
**Table:** `learning_progress` — Tracks per-user completion of modules and explainers.

| Column | Type | Description |
|---|---|---|
| id | VARCHAR (PK) | UUID |
| user_id | VARCHAR (FK) | References users |
| content_id | VARCHAR | Module or explainer ID |
| content_type | TEXT | "module" or "explainer" |
| completed | BOOLEAN | Whether the user finished it |
| completed_at | TIMESTAMP | When they finished |
| last_section_index | INTEGER | For modules: which section they last viewed |

### Backend API
| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/learning/content` | No | Returns all modules and explainers |
| `GET /api/learning/progress` | Yes | Returns the user's progress records |
| `POST /api/learning/progress` | Yes | Upserts a progress record (body: `{ contentId, contentType, completed?, lastSectionIndex? }`) |

### Frontend
**File:** `client/src/pages/Learn.tsx` — Complete rewrite with:
- Summary cards (completed count, modules done, explainers read, time remaining)
- Tabbed interface (Learning Modules / Vulnerability Explainers)
- Module list with level badges, categories, duration, and progress bars
- Explainer grid with CWE numbers, severity badges, and summaries
- Module detail view with section navigation, progress bar, and "Mark as Complete"
- Explainer detail view with all content sections, code comparison, and "Mark as Read"
- Lightweight markdown renderer for bold, bullets, code blocks, and tables

**File:** `client/src/components/FindingsTable.tsx` — CWE column values are now clickable links to `/learn?cwe=<number>`.

## Files changed / created

| File | Action |
|---|---|
| `shared/learningContent.ts` | **Created** — content data |
| `shared/schema.ts` | Modified — added `learning_progress` table |
| `server/storage.ts` | Modified — added `getLearningProgress`, `upsertLearningProgress` |
| `server/routes.ts` | Modified — added 3 learning API endpoints |
| `client/src/pages/Learn.tsx` | **Rewritten** — full Learning Hub UI |
| `client/src/components/FindingsTable.tsx` | Modified — CWE links |

## Manual testing

1. Click **Learning Hub** in the sidebar (Resources section)
2. You should see summary cards (0/14 completed, 0/6 modules, 0/8 explainers, 319m remaining)
3. Click on any module (e.g., "Understanding the OWASP Top 10")
4. Read through sections using the Next button
5. On the last section, click "Mark as Complete"
6. Go back — the module should show a green "Completed" badge
7. Switch to the "Vulnerability Explainers" tab
8. Click on any explainer (e.g., "SQL Injection")
9. Read the content and click "Mark as Read"
10. Go back — the summary cards should update
