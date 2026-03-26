/**
 * Centralized fetch helpers so "Failed to fetch" becomes an actionable message
 * (same-origin API; usually dev server stopped or wrong browser port vs server).
 */

export const API_UNREACHABLE_MESSAGE =
  "Cannot reach the API (no HTTP response). The dev server may not be running, or the page URL does not match the server port. In Cursor, approve an agent run to start the app server from 00_Full_Source_Code, then reload the exact URL the server prints (the page and /api share that origin).";

/** When HTML was served by Express dev, meta aithon-listen-port matches process.env.PORT. */
export function getApiPortMismatchHint(): string {
  if (typeof document === "undefined") return "";
  const meta = document.querySelector('meta[name="aithon-listen-port"]')?.getAttribute("content")?.trim();
  if (!meta) return "";
  const loc = window.location;
  const browserPort = loc.port;
  if (!browserPort) return "";
  if (meta !== browserPort) {
    return ` This tab is on port ${browserPort}, but this HTML came from a server process listening on port ${meta}. Open http://${loc.hostname}:${meta}${loc.pathname}${loc.search} so /api and the UI use the same origin.`;
  }
  return "";
}

export function rethrowIfUnreachableFetchError(e: unknown): never {
  if (e instanceof TypeError) {
    const m = e.message ?? "";
    if (m.includes("Failed to fetch") || m.includes("Load failed") || m.includes("NetworkError")) {
      throw new Error(API_UNREACHABLE_MESSAGE + getApiPortMismatchHint());
    }
  }
  throw e;
}

export async function fetchWithNetworkHint(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (e) {
    rethrowIfUnreachableFetchError(e);
  }
}
