# P3-A3 — Plain-language reference (for the product owner)

Use this file for a quick read. Full detail: [`P3-A3-AITHONSHIELD-YML.md`](./P3-A3-AITHONSHIELD-YML.md).

---

## Categories

| **1** | Settings UI: paste YAML, validate, test the policy gate with fake finding counts. |
| **2** | Server parses YAML and applies **fail_on** rules; APIs for tools and CI. |
| **Both** | This feature. |

---

## What is this feature?

**P3-A3** adds **`.aithonshield.yml`** support:

1. A standard file shape for **scan options**, **policy limits** (how many critical/high/… findings are allowed), **suppressions**, and **compliance** labels.  
2. In **Settings**, you can **check** that your YAML is valid and **preview** whether a scan result would **pass or fail** the **fail_on** rules.

---

## Documentation list

| Document | Role |
|----------|------|
| [`P3-A3-AITHONSHIELD-YML.md`](./P3-A3-AITHONSHIELD-YML.md) | Full feature doc, testing, verification. |
| [`P3-A3-OWNER-REFERENCE.md`](./P3-A3-OWNER-REFERENCE.md) | This file. |
| [`_STATUS.md`](./_STATUS.md) | P3-A3 status row. |
| [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) | Policy endpoints. |

---

## Step-by-step: test in the app (no Terminal)

1. **Settings** → **Security as code**.  
2. **Validate YAML** → see parsed JSON.  
3. **Evaluate gate** with **6 high** findings → should **fail** (example allows 5).  
4. Lower **High** to **3** → **Evaluate** → **pass**.  

Typecheck and dependency installs are handled by the agent or CI — not by the product owner running shell commands.
