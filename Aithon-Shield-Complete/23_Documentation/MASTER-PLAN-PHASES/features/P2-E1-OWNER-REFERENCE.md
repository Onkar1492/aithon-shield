# P2-E1 — Plain-language reference (for the product owner)

Use this file for a quick read. Full detail: [`P2-E1-SHIELD-ADVISOR.md`](./P2-E1-SHIELD-ADVISOR.md).

---

## What is this feature?

**P2-E1 — Shield Advisor** is the **in-app security chat** that can use **multiple LLM backends** (OpenAI, Anthropic, Google Gemini, Mistral, Llama-compatible APIs, AWS Bedrock). It can include **context from a finding and/or a scan** (MVP, web, or mobile) when the client sends those IDs. The server **stores chat history** per conversation key so follow-up messages stay coherent.

---

## What was implemented?

| Area | What you get |
|------|----------------|
| **Server** | `POST /api/shield-advisor/chat` (and alias `POST /api/chat`) with message + optional finding/scan ids; builds a system prompt from finding + scan; calls the user’s selected provider; saves messages in `shield_advisor_conversations`. **Demo mode** returns a **canned** answer (no paid API calls). `GET /api/findings/:id` for the chat UI to load a finding. |
| **Settings** | New **Shield Advisor** section: dropdown to choose the **model provider** (saved on the user profile). |
| **App shell** | **Floating button** bottom-right opens the chat on every main app screen (desktop + mobile layout). |

---

## Category: 1, 2, or both?

**Both.**

- **Category 1 (frontend):** Floating chat, Settings provider dropdown.  
- **Category 2 (backend):** Chat routes, LLM integration, persistence, audit events.

---

## Documentation list

| Document | Role |
|----------|------|
| [`P2-E1-SHIELD-ADVISOR.md`](./P2-E1-SHIELD-ADVISOR.md) | Full feature doc, categories, testing, verification. |
| [`P2-E1-OWNER-REFERENCE.md`](./P2-E1-OWNER-REFERENCE.md) | This file (overview + UI test steps). |
| [`_STATUS.md`](./_STATUS.md) | P2-E1 status row. |
| [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) | Chat + findings id endpoints. |

---

## Testing after future features

When you add new features, the agent should run **`npm run check`**. If work touches **Shield Advisor**, chat routes, **Settings**, or **users.shield_advisor_provider**, re-run the **UI steps** below.

---

## Step-by-step: test the frontend only

1. **Sign in** to the app.  
2. Open **Settings** and find **Shield Advisor**.  
3. Change **Model provider** (e.g. OpenAI → Anthropic); confirm a success toast and that the selection **stays** after refresh.  
4. Go to **Dashboard** (or any main page). Click the **round bot button** bottom-right.  
5. Type a short question and **Send**. You should get a reply (in **demo mode**, text that mentions demo / canned behavior).  
6. **Close** the panel with the X; confirm the **floating button** returns.

---

## Optional: real LLM (non-demo)

Run the server **without** demo mode and set **`OPENAI_API_KEY`** (or another provider’s key per [`P2-E1-SHIELD-ADVISOR.md`](./P2-E1-SHIELD-ADVISOR.md)). Choose that provider in Settings and repeat step 5.
