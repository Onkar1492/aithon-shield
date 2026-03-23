import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Video, FileText, ExternalLink, Trophy, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const learningModules: any[] = [];

const vulnerabilityExplainers: any[] = [];

export default function Learn() {
  const { toast } = useToast();

  const handleStartLearning = (moduleId: string, moduleTitle: string) => {
    toast({
      title: "Learning Module Opening",
      description: `Starting "${moduleTitle}"...`,
    });
    
    // In a real implementation, this would navigate to the learning module page
    // or open an external learning platform
    setTimeout(() => {
      toast({
        title: "Module Ready",
        description: "You can now start learning!",
      });
    }, 1000);
  };

  const handleViewExplainer = (explainerId: string, explainerTitle: string) => {
    toast({
      title: "Opening Explainer",
      description: `Loading "${explainerTitle}"...`,
    });
    
    // In a real implementation, this would open the explainer content
    setTimeout(() => {
      toast({
        title: "Content Loaded",
        description: "Explainer is now available!",
      });
    }, 1000);
  };

  return (
    <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Learning Hub</h1>
          <p className="text-muted-foreground mt-1">
            Master security concepts and best practices
          </p>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            <div>
              <div className="text-2xl font-bold">0/{learningModules.length}</div>
              <div className="text-sm text-muted-foreground">Modules Completed</div>
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">0h</div>
              <div className="text-sm text-muted-foreground">Learning Time Remaining</div>
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-8 w-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold">{learningModules.length + vulnerabilityExplainers.length}</div>
              <div className="text-sm text-muted-foreground">Resources Available</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Learning Paths</h2>
        <div className="grid grid-cols-1 gap-4">
          {learningModules.length === 0 ? (
            <Card className="p-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Learning Modules Available Yet</h3>
              <p className="text-muted-foreground text-sm">
                Learning content will be added soon to help you master security concepts and best practices.
              </p>
            </Card>
          ) : (
            learningModules.map((module) => (
            <Card
              key={module.id}
              className="p-6 hover-elevate"
              data-testid={`module-${module.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {module.completed ? (
                      <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <Trophy className="h-5 w-5 text-green-500" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-base">{module.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {module.category}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {module.level}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {module.duration}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {module.description}
                  </p>
                </div>
                <Button
                  variant={module.completed ? "outline" : "default"}
                  size="sm"
                  onClick={() => handleStartLearning(module.id, module.title)}
                  data-testid={`button-start-${module.id}`}
                >
                  {module.completed ? "Review" : "Start Learning"}
                </Button>
              </div>
            </Card>
          )))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Vulnerability Explainers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vulnerabilityExplainers.length === 0 ? (
            <Card className="p-12 text-center col-span-full">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Vulnerability Explainers Available Yet</h3>
              <p className="text-muted-foreground text-sm">
                Vulnerability explainers will be added soon to help you understand common security issues.
              </p>
            </Card>
          ) : (
            vulnerabilityExplainers.map((explainer) => (
            <Card
              key={explainer.id}
              className="p-4 hover-elevate"
              data-testid={`explainer-${explainer.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {explainer.type === "Video" ? (
                    <Video className="h-5 w-5 text-primary" />
                  ) : explainer.type === "Article" ? (
                    <FileText className="h-5 w-5 text-primary" />
                  ) : (
                    <ExternalLink className="h-5 w-5 text-primary" />
                  )}
                  <div>
                    <h3 className="font-medium text-sm">{explainer.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {explainer.type} · {explainer.readTime}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          explainer.severity === "CRITICAL"
                            ? "border-red-500/50 text-red-500"
                            : explainer.severity === "HIGH"
                            ? "border-orange-500/50 text-orange-500"
                            : "border-yellow-500/50 text-yellow-500"
                        }`}
                      >
                        {explainer.severity}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleViewExplainer(explainer.id, explainer.title)}
                  data-testid={`button-view-${explainer.id}`}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )))}
        </div>
      </div>
    </div>
  );
}
