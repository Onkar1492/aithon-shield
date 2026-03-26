# Feature: `P5-C5` — Container image layer scanning (manifest-based)

| Field | Value |
|-------|--------|
| **Feature ID** | `P5-C5` |
| **Phase** | Phase 5 — Scan engine depth and scale |
| **Category** | **Both** (API + findings; optional UI already lists container scans) |
| **Status** | `implemented — pending user verification` |

---

## User-facing summary

Creating a **container scan** (`POST /api/container-scans`) now runs a **real** background job (no random mock findings). For **Docker Hub** and **custom** public OCI registries, the server:

- Fetches the image **manifest** (anonymous pull token for Docker Hub).
- Resolves **multi-arch** manifest lists to a concrete image (prefers `linux/arm64`, then `linux/amd64`).
- Emits findings with category **`Container Image`** describing **layer count**, **combined layer sizes** (from manifest metadata), **mutable tag** risks (`latest`, `stable`, `develop`), optional **high layer count** / **very large image** heuristics, or clear **errors** (token/manifest failure, unsupported registry type).

This is **not** full Trivy-style CVE scanning or tarball extraction — it is **registry metadata + policy** as a first slice of P5-C5.

---

## Technical summary

- **Code:** [`server/services/containerImageLayerService.ts`](../../../00_Full_Source_Code/server/services/containerImageLayerService.ts) — `analyzeContainerScanLayers`  
- **Route:** [`server/routes.ts`](../../../00_Full_Source_Code/server/routes.ts) — `runContainerImageLayerScanJob` replaces `setTimeout` mock  
- **Attack path:** [`shared/attackPathGraphModel.ts`](../../../00_Full_Source_Code/shared/attackPathGraphModel.ts) — container/manifest wording → initial phase  
- **OpenAPI:** [`public/openapi.json`](../../../00_Full_Source_Code/public/openapi.json) — `/api/container-scans`  

---

## Result parameters (output shape)

| Field / concept | Value |
|-----------------|--------|
| **Finding `source`** | `container-scan` |
| **Finding `scanType`** | `container` |
| **Finding `category`** | **`Container Image`** (all findings from this job) |
| **Finding `asset`** | `{imageName}:{imageTag}` from scan row |
| **Finding `location`** | e.g. `manifest:sha256:…`, `nginx:latest (tag)`, `registry:gcr` |
| **Severities used** | `LOW` (summary), `HIGH` (mutable tag / manifest failure / token failure), `MEDIUM` (unsupported registry, high layers, huge size), `CRITICAL` (unused in happy path today) |
| **Registry support** | **docker-hub** (full), **custom** + `registryUrl` (anonymous v2, best-effort), **gcr/ecr/acr** → single MEDIUM finding “not supported for live manifest pull” |

---

## Manual testing (detailed)

1. **Docker Hub — pinned tag (baseline)**  
   - Create scan: `registry: docker-hub`, `imageName: nginx`, `imageTag: 1.25-alpine` (or another real tag).  
   - Wait until scan status is **completed** (refresh container scan detail or list).  
   - Open **Findings**; filter or search for **`Container Image`**.  
   - Expect at least one **LOW** finding: **Container image layer summary (N layers)** with size text in description.  
   - Expect **no** “mutable tag” finding for this pinned tag.

2. **Docker Hub — `latest` (policy)**  
   - Create scan: same image, `imageTag: latest`.  
   - Expect **LOW** summary + **HIGH** **Container image uses a mutable tag**.

3. **Official image short name**  
   - `imageName: nginx` (no slash) should resolve to `library/nginx` internally.

4. **Namespaced image**  
   - e.g. `imageName: bitnami/redis`, `imageTag: latest` — expect manifest success or a clear **manifest fetch failed** finding if tag invalid.

5. **Unsupported registry**  
   - `registry: gcr` (or `ecr`) — expect **completed** with a **MEDIUM** finding explaining registry not wired, not a crash.

6. **Custom registry (optional)**  
   - If you have a **public** v2 registry: `registry: custom`, `registryUrl: https://…`, `imageName` as `namespace/repo` per that registry.

7. **Notifications**  
   - If enabled in user settings, scan **start** and **complete** push notifications should fire (same as other scan types).

8. **Attack path graph**  
   - With container findings present, open **Attack path graph** — nodes should map toward **Initial access** when titles/descriptions match container/manifest wording.

---

## Automated / agent testing performed

| Check | Command or action | Result |
|-------|-------------------|--------|
| Typecheck | `npm run check` in `00_Full_Source_Code` | **pass** |
| Registry smoke | `analyzeContainerScanLayers({ imageName: 'nginx', imageTag: '1.25-alpine', registry: 'docker-hub' })` | summary only |
| Registry smoke | same with `latest` | summary + mutable tag HIGH |
| Attack path model | `npx tsx cli/verifyAttackPathGraphModel.ts` | **pass** |

---

## User verification (required before next feature)

- [ ] I followed the manual testing steps above  
- [ ] Behavior matches the user-facing summary  
- [ ] **Approved to proceed** — next feature: `P5-C7` (after P5-C10 verification)

**Verified by:** _name / date_  
**Comments:**  

---

## Rollback / risks

- Requires outbound HTTPS to `auth.docker.io` and `registry-1.docker.io` (or custom registry).  
- Rate limits or corporate proxies may produce **manifest fetch failed** findings.  
- Private registries needing auth are **not** supported in this slice.
