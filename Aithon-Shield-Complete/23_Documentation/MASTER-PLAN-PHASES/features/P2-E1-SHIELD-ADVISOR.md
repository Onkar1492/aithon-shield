# Feature: `P2-E1` — Shield Advisor (multi-model chat, scan context)

**Short overview:** [`P2-E1-OWNER-REFERENCE.md`](./P2-E1-OWNER-REFERENCE.md)

## Where this information lives

| What you need | Where to read it |
|---------------|------------------|
| **Category (1 / 2 / Both)** | This file and [`README.md`](../README.md) **Categories**. Phase index: [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md). |
| **Status** | [`_STATUS.md`](./_STATUS.md). |
| **Manual / automated testing** | Sections below. |
| **User verification gate** | **User verification** at the end. |

---

| Field | Value |
|-------|--------|
| **Feature ID** | `P2-E1` |
| **Phase** | Phase 2 — Shield Advisor and AI confidence |
| **Category** | **Both** — Category 1: floating chat + Settings provider. Category 2: API, LLM routing, persistence, audit. |
| **Status** | `implemented — pending user verification` |

---

### Category breakdown

- **Category 1 — Frontend:** [`SecurityChatbot.tsx`](../../../00_Full_Source_Code/client/src/components/SecurityChatbot.tsx) exports `ShieldAdvisorChat`, `ShieldAdvisorDock`, `FloatingChatButton`. [`App.tsx`](../../../00_Full_Source_Code/client/src/App.tsx) mounts `ShieldAdvisorDock` on desktop and mobile layouts. [`Settings.tsx`](../../../00_Full_Source_Code/client/src/pages/Settings.tsx) — **Shield Advisor** card: model provider `Select` (PATCH profile with `shieldAdvisorProvider`).
- **Category 2 — Backend:** [`shieldAdvisorService.ts`](../../../00_Full_Source_Code/server/services/shieldAdvisorService.ts) — system prompt from finding + optional scan summary; providers: OpenAI, Anthropic, Gemini, Mistral, Llama-compatible, Bedrock; **demo mode** skips external LLM calls. [`routes.ts`](../../../00_Full_Source_Code/server/routes.ts) — `POST /api/shield-advisor/chat`, `POST /api/chat` (alias), `GET /api/findings/:id`; audit `shield_advisor.chat`. Conversations persist via `storage.upsertShieldAdvisorConversation` (`shield_advisor_conversations`). [`shared/schema.ts`](../../../00_Full_Source_Code/shared/schema.ts) — `updateProfileSchema.shieldAdvisorProvider` optional. [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) — chat + findings id.

---

## User-facing summary

A **Shield Advisor** floating chat (bottom-right) answers security questions. **Settings → Shield Advisor** lets you pick a **model provider** (OpenAI, Anthropic, Gemini, Mistral, Llama-compatible, Bedrock). The server injects **finding** and **scan** context when available. In **demo mode**, replies are **canned** (no external API calls).

---

## Technical summary

| Area | Detail |
|------|--------|
| **User preference** | `users.shield_advisor_provider` (default `openai`). PATCH `/api/user/profile` with `shieldAdvisorProvider`. |
| **Chat API** | `POST /api/shield-advisor/chat` body: `message`, optional `findingId`, `scanType` (`mvp` \| `web` \| `mobile` \| `none`), `scanId`, `extraContext`. Returns `{ response, provider, conversation }`. |
| **Persistence** | `shield_advisor_conversations` keyed by `userId` + `findingId` + `scanType` + `scanId`; global chat uses `findingId=global`, `scanType=none`, `scanId=none`. |
| **Env (examples)** | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`, `MISTRAL_API_KEY`, `AITHON_LLAMA_BASE_URL`, `AWS_REGION`, `AITHON_BEDROCK_MODEL_ID`, etc. |

---

## Manual testing steps

1. **Settings:** Open **Shield Advisor**, change provider, confirm toast and value after refresh.  
2. **Floating chat:** Open the bot button, send a message. In **demo mode**, expect a canned reply mentioning demo.  
3. **API key (optional):** With a **write**-scoped key, `POST /api/shield-advisor/chat` with JSON body.  
4. **Finding context (optional):** Embed `ShieldAdvisorChat` with `findingId` + scan props in a future screen (exports are ready).

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` (in `00_Full_Source_Code`) | **pass** |
| DB push | No new tables | **not applicable** |

---

## User verification (required before next feature)

- [ ] Floating Shield Advisor opens and sends a reply (demo canned or real with keys)  
- [ ] Provider select saves in Settings  
- [ ] **Approved to proceed** — next feature: **`P2-E2`** (fix confidence + explainability) per [`00-PHASE-INDEX.md`](../00-PHASE-INDEX.md)

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / notes

- Disable UI: remove `ShieldAdvisorDock` from `App.tsx`.  
- Disable API: remove or guard routes in `routes.ts`.  
- Conversations remain in DB; no automatic purge.
