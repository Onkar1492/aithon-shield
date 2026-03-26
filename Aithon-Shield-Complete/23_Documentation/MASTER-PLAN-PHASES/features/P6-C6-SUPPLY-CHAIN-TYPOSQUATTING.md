# P6-C6 — Supply-Chain Tampering / Typosquatting Detection

**Phase:** 6  
**Category:** 2 (Competitive gap — strengthens position)  
**Status:** implemented — pending user verification

---

## What it does

Detects three classes of software supply-chain risk during SCA (Software Composition Analysis) scans:

| Detection | Severity | Technique |
|-----------|----------|-----------|
| **Typosquatting** | HIGH | Levenshtein distance + separator/suffix heuristics against a curated list of popular npm and pip packages |
| **Dependency confusion** | MEDIUM | Identifies scoped npm packages (`@org/pkg`) whose scope matches internal/private naming patterns |
| **Suspicious package names** | LOW | Flags auto-generated, extremely short, or placeholder-pattern package names |

All detections use CWE-1357 (Reliance on Insufficiently Trustworthy Component).

---

## Files changed / created

| File | Change |
|------|--------|
| `server/services/supplyChainRiskService.ts` | **New** — core detection engine with Levenshtein distance, typosquatting heuristics, dependency confusion detection, and suspicious name patterns |
| `server/services/scaAnalyzer.ts` | Integrated supply-chain analysis into `performSCAScan()` after CVE/KEV checks and before reachability annotation |
| `server/demoScanResults.ts` | Added 2 demo supply-chain findings (typosquatting + dependency confusion) to MVP demo results |
| `client/src/components/FindingsTable.tsx` | Added orange "Supply Chain" badge in the SCA reach column for findings with `category === "Supply Chain Risk"` |
| `client/src/pages/ScanDetails.tsx` | Added a "Supply-Chain Risk Detected" summary card showing counts by type (Typosquatting, Dependency Confusion, Suspicious Package) |

---

## How it works

### Detection engine (`supplyChainRiskService.ts`)

1. **Typosquatting detection** — For each dependency parsed from manifests:
   - Strips npm scopes (`@org/name` → `name`)
   - Computes Levenshtein distance against ~100 popular npm packages and ~40 popular pip packages
   - Flags packages with distance = 1 (single char edit) when name length ≥ 4
   - Also detects separator confusion (dash/underscore/dot swaps), suffix padding (`lodash` → `lodashs`, `lodashjs`), and separator removal

2. **Dependency confusion detection** — For scoped npm packages:
   - Checks if the scope matches internal/private naming patterns (e.g., `@internal-*`, `@corp-*`, `@private-*`)
   - Flags as MEDIUM risk since an attacker could publish a same-named package on the public registry

3. **Suspicious name detection** — Flags:
   - Auto-generated names (short prefix + numbers like `ab123`)
   - Extremely short names (≤ 2 chars for npm)
   - Placeholder/test naming patterns (`test-*`, `foo-*`, `tmp-*`)

### Integration into SCA flow

The `analyzeSupplyChainRisks()` function is called inside `performSCAScan()` after dependency parsing and CVE/KEV checks, but before reachability annotation. Supply-chain findings are merged into the same `Vulnerability[]` array and persisted as regular findings with `category: "Supply Chain Risk"`.

### UI indicators

- **Scan Details page** — An orange summary card appears when supply-chain risks are detected, showing badge counts by type
- **Findings table** — The SCA reach column shows an orange "Supply Chain" badge with a warning icon for supply-chain findings
- **Finding details** — Full description, remediation guidance, and AI suggestions are available when clicking into any supply-chain finding

---

## API

No new endpoints. Supply-chain findings are standard findings returned by `GET /api/findings` with `category: "Supply Chain Risk"` and `cwe: "1357"`.

---

## Testing

### API test

```bash
# After running a scan, filter findings by category
curl -b cookie.txt http://localhost:5001/api/findings | \
  python3 -c "import json,sys; [print(f['title']) for f in json.load(sys.stdin) if f['category']=='Supply Chain Risk']"
```

### Browser test

1. Navigate to any completed MVP scan's details page
2. Verify the "Supply-Chain Risk Detected" card appears with type badges
3. Scroll to findings list — supply-chain findings show "Supply Chain Risk" category
4. Go to Findings page → search "typosquat" or "dependency confusion" → verify "Supply Chain" badge in SCA reach column

---

## Remaining work

- Registry lookup (npm API / PyPI API) for download counts, age, and maintainer reputation
- Install-script detection (preinstall/postinstall hooks)
- Expanded popular package lists for Go, Maven, Cargo, Gem, Composer ecosystems
- ML-based detection using package metadata features
