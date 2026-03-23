import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, ArrowRight, Database, Server, Lock, User, Play, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const attackChains = [
  {
    id: "chain_001",
    name: "Account Takeover via IDOR",
    severity: "CRITICAL",
    steps: [
      {
        step: 1,
        action: "Attacker identifies IDOR vulnerability",
        target: "/api/orders/{id}",
        icon: User,
        impact: "Discovery",
      },
      {
        step: 2,
        action: "Enumerate valid order IDs",
        target: "Sequential ID testing",
        icon: Database,
        impact: "Information Disclosure",
      },
      {
        step: 3,
        action: "Access other users' orders",
        target: "Customer PII, Payment Info",
        icon: Lock,
        impact: "Data Breach",
      },
      {
        step: 4,
        action: "Modify order details",
        target: "Shipping address, payment method",
        icon: Server,
        impact: "Account Takeover",
      },
    ],
    likelihood: "High",
    businessImpact: "Severe - Customer data exposure, financial fraud, reputational damage",
  },
  {
    id: "chain_002",
    name: "Privilege Escalation Chain",
    severity: "HIGH",
    steps: [
      {
        step: 1,
        action: "Exploit XSS vulnerability",
        target: "/profile/bio field",
        icon: User,
        impact: "Code Injection",
      },
      {
        step: 2,
        action: "Steal admin session token",
        target: "localStorage/cookies",
        icon: Lock,
        impact: "Session Hijacking",
      },
      {
        step: 3,
        action: "Access admin dashboard",
        target: "/admin/*",
        icon: Server,
        impact: "Unauthorized Access",
      },
      {
        step: 4,
        action: "Modify user permissions",
        target: "User roles database",
        icon: Database,
        impact: "Privilege Escalation",
      },
    ],
    likelihood: "Medium",
    businessImpact: "High - System-wide compromise, data manipulation",
  },
];

export default function AttackSimulator() {
  const { toast } = useToast();
  const [simulationDialog, setSimulationDialog] = useState<{
    open: boolean;
    chain: typeof attackChains[0] | null;
    currentStep: number;
    isRunning: boolean;
  }>({
    open: false,
    chain: null,
    currentStep: 0,
    isRunning: false,
  });

  const runSimulation = (chain: typeof attackChains[0]) => {
    setSimulationDialog({
      open: true,
      chain,
      currentStep: 0,
      isRunning: true,
    });

    // Animate through steps
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step <= chain.steps.length) {
        setSimulationDialog((prev) => ({
          ...prev,
          currentStep: step,
        }));
      } else {
        clearInterval(interval);
        setSimulationDialog((prev) => ({
          ...prev,
          isRunning: false,
        }));
        toast({
          title: "Simulation Complete",
          description: `Attack chain "${chain.name}" successfully simulated. Review the results to understand potential impact.`,
        });
      }
    }, 1500);
  };

  const closeDialog = () => {
    setSimulationDialog({
      open: false,
      chain: null,
      currentStep: 0,
      isRunning: false,
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attack Simulator</h1>
        <p className="text-muted-foreground mt-1">
          Visualize how vulnerabilities can be chained into real attacks
        </p>
      </div>

      <Card className="p-6 bg-red-500/5 shadow-sm">
        <div className="flex items-start gap-4">
          <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-base mb-2">
              Potential Attack Vectors Identified
            </h3>
            <p className="text-sm text-muted-foreground">
              Based on your current findings, attackers could exploit the following attack chains.
              These simulations show the real-world impact of seemingly isolated vulnerabilities.
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        {attackChains.map((chain) => (
          <Card key={chain.id} className="p-6 shadow-sm" data-testid={`chain-${chain.id}`}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-lg">{chain.name}</h3>
                  <Badge
                    variant={chain.severity === "CRITICAL" ? "destructive" : "secondary"}
                  >
                    {chain.severity}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Likelihood: <span className="font-medium text-foreground">{chain.likelihood}</span>
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">
                    {chain.steps.length} steps
                  </span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => runSimulation(chain)}
                data-testid={`button-simulate-${chain.id}`}
              >
                <Play className="w-4 h-4 mr-2" />
                Run Simulation
              </Button>
            </div>

            <div className="space-y-4">
              {chain.steps.map((step, index) => (
                <div key={step.step} className="relative">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <step.icon className="h-5 w-5 text-red-500" />
                      </div>
                      {index < chain.steps.length - 1 && (
                        <div className="w-0.5 h-12 bg-red-500/20 my-2" />
                      )}
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-mono text-muted-foreground">
                          Step {step.step}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {step.impact}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-base mb-1">{step.action}</h4>
                      <p className="text-sm text-muted-foreground font-mono">
                        {step.target}
                      </p>
                    </div>
                    {index < chain.steps.length - 1 && (
                      <ArrowRight className="h-5 w-5 text-muted-foreground mt-2" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6">
              <div className="h-[1px] w-full bg-border -mt-6 mb-6" />
              <h4 className="font-semibold text-sm mb-2">Business Impact</h4>
              <p className="text-sm text-muted-foreground">{chain.businessImpact}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Simulation Dialog */}
      <Dialog open={simulationDialog.open} onOpenChange={closeDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-simulation">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              {simulationDialog.chain?.name}
            </DialogTitle>
            <DialogDescription>
              Attack simulation in progress - observe how vulnerabilities can be exploited step by step
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Simulation Progress</span>
                <span className="font-medium">
                  {simulationDialog.isRunning ? "Running..." : "Complete"}
                </span>
              </div>
              <Progress 
                value={(simulationDialog.currentStep / (simulationDialog.chain?.steps.length || 1)) * 100} 
                className="h-2"
              />
              <div className="text-xs text-muted-foreground text-right">
                Step {simulationDialog.currentStep} of {simulationDialog.chain?.steps.length || 0}
              </div>
            </div>

            {/* Attack Steps */}
            <div className="space-y-4">
              {simulationDialog.chain?.steps.map((step, index) => {
                const isActive = index + 1 === simulationDialog.currentStep;
                const isCompleted = index + 1 < simulationDialog.currentStep;
                const isPending = index + 1 > simulationDialog.currentStep;

                return (
                  <div
                    key={step.step}
                    className={`relative transition-all duration-500 ${
                      isActive ? "scale-105" : ""
                    }`}
                    data-testid={`simulation-step-${step.step}`}
                  >
                    <div className={`flex items-start gap-4 p-4 rounded-lg border ${
                      isActive 
                        ? "bg-red-500/10 border-red-500/50 shadow-lg" 
                        : isCompleted 
                        ? "bg-green-500/5 border-green-500/30" 
                        : "bg-muted/30 border-muted opacity-50"
                    }`}>
                      <div className="flex flex-col items-center">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          isCompleted 
                            ? "bg-green-500/20" 
                            : isActive 
                            ? "bg-red-500/20 animate-pulse" 
                            : "bg-muted"
                        }`}>
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <step.icon className={`h-5 w-5 ${
                              isActive ? "text-red-500" : "text-muted-foreground"
                            }`} />
                          )}
                        </div>
                        {index < (simulationDialog.chain?.steps.length || 0) - 1 && (
                          <div className={`w-0.5 h-12 my-2 ${
                            isCompleted ? "bg-green-500/50" : "bg-muted"
                          }`} />
                        )}
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-mono text-muted-foreground">
                            Step {step.step}
                          </span>
                          <Badge 
                            variant={isCompleted ? "outline" : isActive ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {step.impact}
                          </Badge>
                          {isActive && (
                            <Badge variant="default" className="text-xs animate-pulse">
                              In Progress
                            </Badge>
                          )}
                          {isCompleted && (
                            <Badge variant="outline" className="text-xs text-green-500 border-green-500">
                              Completed
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-semibold text-base mb-1">{step.action}</h4>
                        <p className="text-sm text-muted-foreground font-mono">
                          {step.target}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Business Impact */}
            {!simulationDialog.isRunning && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Business Impact Assessment
                </h4>
                <p className="text-sm text-muted-foreground">
                  {simulationDialog.chain?.businessImpact}
                </p>
              </div>
            )}

            {/* Action Button */}
            <div className="flex gap-2 pt-2">
              <Button 
                className="flex-1"
                onClick={closeDialog}
                disabled={simulationDialog.isRunning}
                data-testid="button-close-simulation"
              >
                {simulationDialog.isRunning ? "Simulation Running..." : "Close"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
