import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type AcceptRiskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  findingId: string;
  findingTitle: string;
};

export function AcceptRiskDialog({
  open,
  onOpenChange,
  findingId,
  findingTitle,
}: AcceptRiskDialogProps) {
  const { toast } = useToast();
  const [justification, setJustification] = useState("");
  const [expiresLocal, setExpiresLocal] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setJustification("");
      setExpiresLocal("");
    }
  }, [open]);

  const handleSubmit = async () => {
    const j = justification.trim();
    if (!j) {
      toast({ title: "Justification required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      let expiresAt: string | null = null;
      if (expiresLocal.trim()) {
        const d = new Date(expiresLocal);
        if (Number.isNaN(d.getTime())) {
          toast({ title: "Invalid expiry date", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        expiresAt = d.toISOString();
      }
      const res = await apiRequest("POST", "/api/risk-exceptions", {
        findingId,
        justification: j,
        expiresAt,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? res.statusText);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/risk-exceptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sla/summary"] });
      toast({ title: "Risk accepted", description: "This finding is marked as accepted risk." });
      onOpenChange(false);
    } catch (e: unknown) {
      toast({
        title: "Could not accept risk",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-accept-risk">
        <DialogHeader>
          <DialogTitle>Accept risk</DialogTitle>
          <DialogDescription>
            Document why remediation is deferred for{" "}
            <span className="font-medium text-foreground">{findingTitle}</span>. Accepted findings are
            excluded from SLA breach lists while the exception is active.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="accept-risk-justification">Justification</Label>
            <Textarea
              id="accept-risk-justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="e.g. Compensating control in place until next release…"
              rows={4}
              data-testid="textarea-accept-risk-justification"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accept-risk-expires">Optional expiry (local time)</Label>
            <Input
              id="accept-risk-expires"
              type="datetime-local"
              value={expiresLocal}
              onChange={(e) => setExpiresLocal(e.target.value)}
              data-testid="input-accept-risk-expires"
            />
            <p className="text-xs text-muted-foreground">
              After expiry, the exception ends and the finding returns to open.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting} data-testid="button-accept-risk-submit">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept risk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
