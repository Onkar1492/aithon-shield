import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code, Download, Rocket, RefreshCw, ArrowRight, Sparkles, Shield } from "lucide-react";
import { NewAppWorkflowDialog } from "@/components/NewAppWorkflowDialog";
import { ExistingAppWorkflowDialog } from "@/components/ExistingAppWorkflowDialog";

interface ChooseWorkflowSectionProps {
  title?: string;
  description?: string;
  defaultAppType?: "mvp" | "mobile" | "web" | "container";
  hideTabs?: boolean;
}

export function ChooseWorkflowSection({ 
  title = "Choose Your Workflow",
  description = "Start with a new application or work with an existing one",
  defaultAppType,
  hideTabs = false
}: ChooseWorkflowSectionProps) {
  const [newAppWorkflowOpen, setNewAppWorkflowOpen] = useState(false);
  const [existingAppWorkflowOpen, setExistingAppWorkflowOpen] = useState(false);

  return (
    <>
      <Card className="p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 -mr-32 -mt-32 rounded-full bg-gradient-to-br from-primary/5 to-transparent opacity-50" />
        
        <div className="relative space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              <p className="text-sm text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="group h-auto p-6 justify-start hover-elevate active-elevate-2 transition-all duration-300 hover:border-primary/30"
              onClick={() => setNewAppWorkflowOpen(true)}
              data-testid="button-new-app-workflow"
            >
              <div className="flex items-start gap-4 w-full">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-cyan-500/10 transition-transform duration-300 group-hover:scale-110">
                  <Rocket className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base tracking-tight">New App</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    Scan code from repository and deploy securely
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <Sparkles className="w-3 h-3" />
                      <span>AI-Powered</span>
                    </div>
                    <span className="text-muted-foreground">|</span>
                    <span className="text-xs text-muted-foreground">Full security scan</span>
                  </div>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="group h-auto p-6 justify-start hover-elevate active-elevate-2 transition-all duration-300 hover:border-primary/30"
              onClick={() => setExistingAppWorkflowOpen(true)}
              data-testid="button-existing-app-workflow"
            >
              <div className="flex items-start gap-4 w-full">
                <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-primary/10 transition-transform duration-300 group-hover:scale-110">
                  <RefreshCw className="w-6 h-6 text-cyan-500" />
                </div>
                <div className="text-left flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base tracking-tight">Existing App</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    Download, scan, fix, and re-upload with patches
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex items-center gap-1 text-xs text-cyan-500">
                      <Download className="w-3 h-3" />
                      <span>Auto-Fetch</span>
                    </div>
                    <span className="text-muted-foreground">|</span>
                    <span className="text-xs text-muted-foreground">One-click fixes</span>
                  </div>
                </div>
              </div>
            </Button>
          </div>
        </div>
      </Card>

      <NewAppWorkflowDialog 
        open={newAppWorkflowOpen}
        onOpenChange={setNewAppWorkflowOpen}
        defaultAppType={defaultAppType}
        hideTabs={hideTabs}
      />
      <ExistingAppWorkflowDialog
        open={existingAppWorkflowOpen}
        onOpenChange={setExistingAppWorkflowOpen}
        defaultAppType={defaultAppType}
        hideTabs={hideTabs}
      />
    </>
  );
}
