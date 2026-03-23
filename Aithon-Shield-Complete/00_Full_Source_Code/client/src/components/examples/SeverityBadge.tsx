import { SeverityBadge } from "../SeverityBadge";

export default function SeverityBadgeExample() {
  return (
    <div className="flex gap-2 p-4 bg-background">
      <SeverityBadge severity="CRITICAL" />
      <SeverityBadge severity="HIGH" />
      <SeverityBadge severity="MEDIUM" />
      <SeverityBadge severity="LOW" />
    </div>
  );
}
