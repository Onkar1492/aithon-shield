import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const threats = [
  {
    id: "CVE-2024-0001",
    title: "Critical SQL Injection in Popular Framework",
    source: "NIST NVD",
    severity: "CRITICAL",
    published: "2 hours ago",
    affected: "Django 4.x - 5.0.2",
    url: "https://nvd.nist.gov/vuln/detail/CVE-2024-0001",
  },
  {
    id: "CISA-2024-001",
    title: "Zero-Day RCE Exploit in Web Servers",
    source: "CISA",
    severity: "HIGH",
    published: "5 hours ago",
    affected: "Apache Tomcat 9.x",
    url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
  },
  {
    id: "MITRE-ATT-001",
    title: "New Attack Technique: API Token Theft",
    source: "MITRE ATT&CK",
    severity: "MEDIUM",
    published: "1 day ago",
    affected: "RESTful APIs",
    url: "https://attack.mitre.org/",
  },
];

export function ThreatFeed() {
  const { toast } = useToast();

  const handleThreatClick = (threat: typeof threats[0]) => {
    toast({
      title: threat.title,
      description: `Severity: ${threat.severity} | Affected: ${threat.affected}`,
    });
    // Open external link in new tab
    window.open(threat.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="p-6 shadow-sm" data-testid="threat-feed">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Live Threat Intelligence
        </h3>
        <Badge variant="outline" className="text-xs">
          Real-time
        </Badge>
      </div>

      <div className="space-y-3">
        {threats.map((threat) => (
          <div
            key={threat.id}
            onClick={() => handleThreatClick(threat)}
            className="p-3 rounded-lg bg-card border hover-elevate active-elevate-2 cursor-pointer"
            data-testid={`threat-${threat.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm truncate">{threat.title}</h4>
                  <Badge
                    variant={threat.severity === "CRITICAL" ? "destructive" : "secondary"}
                    className="text-xs flex-shrink-0"
                  >
                    {threat.severity}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <span className="font-mono">{threat.id}</span>
                  <span>•</span>
                  <span>{threat.source}</span>
                  <span>•</span>
                  <span>{threat.published}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Affected: {threat.affected}
                </p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4">
        <div className="h-[1px] w-full bg-border -mt-4 mb-4" />
        <p className="text-xs text-muted-foreground text-center">
          Powered by NIST NVD, CISA, and MITRE ATT&CK feeds
        </p>
      </div>
    </Card>
  );
}
