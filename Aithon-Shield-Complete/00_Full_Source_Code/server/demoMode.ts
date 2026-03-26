/**
 * Demo mode: UI + API exploration.
 * Set AITHON_DEMO_MODE=true (or 1) with NODE_ENV=development.
 * Sign-up is disabled; use seeded demo accounts. API keys can be created for local MCP/scripts testing.
 *
 * Optional **strict demo hints** (repository URL, web URL, mobile app id):
 * Set AITHON_DEMO_STRICT_SCAN_TARGETS=true to show stronger dummy-URL suggestions in the UI.
 * The API never rejects scan creates on that basis. Default is **off**.
 */

const truthy = (v: string | undefined) =>
  v === "1" || v?.toLowerCase() === "true" || v?.toLowerCase() === "yes";

export function isDemoMode(): boolean {
  return truthy(process.env.AITHON_DEMO_MODE) && process.env.NODE_ENV === "development";
}

/**
 * MVP code scans: use deterministic demo results (no git clone / no live analysis).
 * - Always when {@link isDemoMode} is true (full demo mode).
 * - Whenever **not** production — local runs often omit or override NODE_ENV; only `production`
 *   opts into real `git clone` by default.
 *   Set **AITHON_LIVE_MVP_SCANS=true** to run a real clone + full pipeline in any environment.
 */
export function shouldUseMvpDeterministicScan(): boolean {
  if (isDemoMode()) return true;
  if (truthy(process.env.AITHON_LIVE_MVP_SCANS)) return false;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

/**
 * When true (and demo mode), the UI may show optional “use dummy targets” hints (see client
 * `demoStrictScanTargets`). The API does **not** reject scan creates — local/demo trial runs
 * need arbitrary URLs/IDs for functional testing.
 */
export function isDemoStrictScanTargets(): boolean {
  return isDemoMode() && truthy(process.env.AITHON_DEMO_STRICT_SCAN_TARGETS);
}

export function getAppConfigPayload() {
  const demo = isDemoMode();
  const strict = isDemoStrictScanTargets();
  return {
    demoMode: demo,
    /** True only when AITHON_DEMO_STRICT_SCAN_TARGETS is set in dev demo — UI may show dummy-URL hints */
    demoStrictScanTargets: strict,
    demoBannerTitle: demo ? "Demo mode" : null,
    demoBannerBody: demo
      ? strict
        ? "New registration is off. You can create API keys and run scans for local testing. Optional dummy-URL hints may appear; you can still enter any URL/ID. Data uses your local database—use a disposable DB for true isolation."
        : "New registration is off. You can create API keys and run scans for local testing. Scan targets are unrestricted. Data uses your local database—use a disposable DB for true isolation."
      : null,
    demoSignupDisabled: demo,
    /** False in demo: keys are allowed so you can test Settings and agents locally */
    demoApiKeysDisabled: false,
    demoScanHint: demo && strict
      ? "Strict demo: MVP/Web use example.com, localhost, github.com/octocat, or “demo”. Mobile: com.demo.* or com.example.*."
      : null,
  };
}
