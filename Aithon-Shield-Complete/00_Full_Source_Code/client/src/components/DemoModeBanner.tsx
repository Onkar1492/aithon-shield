import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

type AppConfig = {
  demoMode: boolean;
  demoStrictScanTargets?: boolean;
  demoBannerTitle: string | null;
  demoBannerBody: string | null;
  demoScanHint: string | null;
};

export function DemoModeBanner() {
  const { data } = useQuery<AppConfig>({
    queryKey: ["/api/app-config"],
    staleTime: 60_000,
  });

  if (!data?.demoMode || !data.demoBannerTitle) {
    return null;
  }

  return (
    <div
      role="status"
      className="shrink-0 border-b border-amber-500/40 bg-amber-500/15 px-4 py-3 text-amber-950 dark:text-amber-100"
      data-testid="banner-demo-mode"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          {data.demoBannerTitle}
        </div>
        <div className="text-sm opacity-95 space-y-1">
          {data.demoBannerBody && <p>{data.demoBannerBody}</p>}
          {data.demoScanHint && (
            <p className="font-medium text-amber-900 dark:text-amber-50">{data.demoScanHint}</p>
          )}
          <p className="text-xs opacity-90">
            Login: <code className="rounded bg-amber-500/20 px-1">demo@aithonshield.local</code> /{" "}
            <code className="rounded bg-amber-500/20 px-1">DemoMode1!</code>
            {" · "}
            Or <code className="rounded bg-amber-500/20 px-1">milan_demo</code> /{" "}
            <code className="rounded bg-amber-500/20 px-1">987654321</code>
          </p>
        </div>
      </div>
    </div>
  );
}
