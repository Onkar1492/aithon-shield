import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Shield, User, Settings, FileText, AlertTriangle, Database } from "lucide-react";

const auditLogs: any[] = [];

const getIconForType = (type: string) => {
  switch (type) {
    case "scan":
      return <Shield className="h-4 w-4" />;
    case "user":
      return <User className="h-4 w-4" />;
    case "settings":
      return <Settings className="h-4 w-4" />;
    case "report":
      return <FileText className="h-4 w-4" />;
    case "alert":
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Shield className="h-4 w-4" />;
  }
};

const getBadgeVariant = (type: string) => {
  switch (type) {
    case "alert":
      return "destructive";
    case "remediation":
      return "default";
    case "user":
    case "settings":
      return "secondary";
    default:
      return "outline";
  }
};

export default function AuditLog() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground mt-1">
          Complete history of all security actions and events
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search audit logs..."
          className="pl-10"
          data-testid="input-search-logs"
        />
      </div>

      <div className="space-y-3">
        {auditLogs.length === 0 ? (
          <Card className="p-12 text-center">
            <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No Audit Logs Yet</h3>
            <p className="text-muted-foreground text-sm">
              Audit logs will appear here as you perform security scans, manage findings, and use the platform.
            </p>
          </Card>
        ) : (
          auditLogs.map((log) => (
            <Card
              key={log.id}
              className="p-4 hover-elevate shadow-sm"
              data-testid={`log-${log.id}`}
            >
              <div className="flex items-start gap-4">
                <div className={`h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 ${
                  log.type === "alert" ? "bg-red-500/10" : ""
                }`}>
                  <div className={log.type === "alert" ? "text-red-500" : "text-primary"}>
                    {getIconForType(log.type)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-base">{log.action}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {log.details}
                      </p>
                    </div>
                    <Badge variant={getBadgeVariant(log.type)}>
                      {log.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>By: {log.user}</span>
                    <span>•</span>
                    <span>Target: {log.target}</span>
                    <span>•</span>
                    <span>{log.timestamp}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
