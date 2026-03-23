import { FindingCard } from "../FindingCard";

export default function FindingCardExample() {
  return (
    <div className="space-y-4 p-4 bg-background max-w-4xl">
      <FindingCard
        id="find_001"
        title="IDOR vulnerability on /api/orders/{id} endpoint"
        severity="CRITICAL"
        cwe="CWE-639"
        owasp={["A01-Broken Access Control"]}
        affectedAsset="/api/orders/*"
        status="OPEN"
        detectedDate="2 hours ago"
      />
      <FindingCard
        id="find_002"
        title="Missing Content-Security-Policy header"
        severity="MEDIUM"
        cwe="CWE-693"
        owasp={["A05-Security Misconfiguration"]}
        affectedAsset="https://app.example.com"
        status="IN_PROGRESS"
        detectedDate="1 day ago"
      />
    </div>
  );
}
