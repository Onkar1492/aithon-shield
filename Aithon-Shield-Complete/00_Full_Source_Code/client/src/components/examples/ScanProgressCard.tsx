import { ScanProgressCard } from "../ScanProgressCard";

export default function ScanProgressCardExample() {
  return (
    <div className="space-y-4 p-4 bg-background max-w-2xl">
      <ScanProgressCard
        projectName="E-Commerce API"
        status="running"
        progress={67}
        currentPhase="Running DAST tests..."
        startedAt="10 minutes ago"
      />
      <ScanProgressCard
        projectName="Mobile App (iOS)"
        status="completed"
        progress={100}
        currentPhase="Scan completed"
        startedAt="2 hours ago"
      />
    </div>
  );
}
