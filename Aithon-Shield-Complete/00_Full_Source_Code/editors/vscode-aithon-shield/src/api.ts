/** HTTP client for Aithon Shield REST API (session cookie not available in VS Code — use API key). */

export interface ApiFinding {
  id: string;
  title: string;
  severity: string;
  category: string;
  status: string;
  scanType?: string | null;
  scanId?: string | null;
  location?: string | null;
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export async function fetchFindings(baseUrl: string, apiKey: string): Promise<ApiFinding[]> {
  const res = await fetch(joinUrl(baseUrl, "/api/findings"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(res.status === 401 ? "Unauthorized — check API key and base URL." : `${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("Unexpected findings response");
  }
  return data as ApiFinding[];
}

export async function patchFindingStatus(
  baseUrl: string,
  apiKey: string,
  findingId: string,
  status: string,
): Promise<void> {
  const res = await fetch(joinUrl(baseUrl, `/api/findings/${findingId}`), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
}

export function scanDetailUrl(baseUrl: string, scanType: string, scanId: string): string {
  const b = baseUrl.replace(/\/$/, "");
  return `${b}/scan-details/${encodeURIComponent(scanType)}/${encodeURIComponent(scanId)}`;
}
