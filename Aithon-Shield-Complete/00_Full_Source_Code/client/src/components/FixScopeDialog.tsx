import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileCode, ListChecks, AlertCircle } from "lucide-react";

interface FixScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  findingTitle: string;
  totalFindings: number;
  scanTypeName: string;
  onFixSingle: () => void;
  onFixAll: () => void;
}

export function FixScopeDialog({
  open,
  onOpenChange,
  findingTitle,
  totalFindings,
  scanTypeName,
  onFixSingle,
  onFixAll,
}: FixScopeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose Fix Scope</DialogTitle>
          <DialogDescription>
            Would you like to fix only this issue or all {totalFindings} issues found in the {scanTypeName}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="p-4 bg-muted/50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">Current Issue</p>
                <p className="text-sm text-muted-foreground">{findingTitle}</p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-6 hover-elevate cursor-pointer" onClick={onFixSingle} data-testid="card-fix-single">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileCode className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Fix This One</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Apply fix for this specific issue, validate the codebase, and upload to repository
                  </p>
                  <Button className="w-full" data-testid="button-fix-single">
                    Fix Single Issue
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover-elevate cursor-pointer" onClick={onFixAll} data-testid="card-fix-all">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <ListChecks className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Fix All Issues</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Resolve all {totalFindings} issues, validate the entire codebase, and upload to repository
                  </p>
                  <Button className="w-full" variant="default" data-testid="button-fix-all">
                    Fix All ({totalFindings})
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="bg-muted/30 p-4 rounded-lg text-sm space-y-2">
            <p className="font-medium">What happens next?</p>
            <ul className="space-y-1 text-muted-foreground ml-4">
              <li>1. Fixes will be applied to your codebase</li>
              <li>2. Comprehensive validation runs to ensure nothing breaks</li>
              <li>3. If validation passes, code uploads to repository</li>
              <li>4. You receive a success notification with results</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
