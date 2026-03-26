import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  FileText,
  Trophy,
  Clock,
  Shield,
  Code,
  Key,
  Container,
  Package,
  Cloud,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Loader2,
  GraduationCap,
} from "lucide-react";
import type {
  LearningModule,
  VulnerabilityExplainer,
} from "@shared/learningContent";
import type { LearningProgress } from "@shared/schema";

interface ContentResponse {
  modules: LearningModule[];
  explainers: VulnerabilityExplainer[];
}

interface ProgressResponse {
  progress: LearningProgress[];
}

const moduleIcons: Record<string, React.ReactNode> = {
  shield: <Shield className="h-5 w-5" />,
  code: <Code className="h-5 w-5" />,
  key: <Key className="h-5 w-5" />,
  container: <Container className="h-5 w-5" />,
  package: <Package className="h-5 w-5" />,
  cloud: <Cloud className="h-5 w-5" />,
};

const levelColors: Record<string, string> = {
  Beginner: "bg-green-500/10 text-green-500 border-green-500/30",
  Intermediate: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  Advanced: "bg-red-500/10 text-red-500 border-red-500/30",
};

const severityColors: Record<string, string> = {
  CRITICAL: "border-red-500/50 text-red-500",
  HIGH: "border-orange-500/50 text-orange-500",
  MEDIUM: "border-yellow-500/50 text-yellow-500",
  LOW: "border-blue-500/50 text-blue-500",
};

function renderMarkdownLite(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      elements.push(
        <pre key={`code-${i}`} className="bg-muted/50 border rounded-md p-3 text-xs font-mono overflow-x-auto my-2">
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (line.startsWith("| ") && line.includes("|")) {
      const tableLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const headerCells = tableLines[0].split("|").filter(Boolean).map((c) => c.trim());
      const dataRows = tableLines.slice(2);
      elements.push(
        <div key={`table-${i}`} className="my-2 rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {headerCells.map((c, ci) => (
                  <th key={ci} className="px-3 py-2 text-left font-medium">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => {
                const cells = row.split("|").filter(Boolean).map((c) => c.trim());
                return (
                  <tr key={ri} className="border-b last:border-0">
                    {cells.map((c, ci) => (
                      <td key={ci} className="px-3 py-2">{c}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (line.trim() === "") {
      elements.push(<div key={`br-${i}`} className="h-2" />);
      i++;
      continue;
    }

    let html = line
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, '<code class="bg-muted/50 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');

    if (line.startsWith("- ")) {
      html = html.slice(2);
      elements.push(
        <li key={`li-${i}`} className="ml-4 list-disc text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />,
      );
    } else {
      elements.push(
        <p key={`p-${i}`} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />,
      );
    }
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
}

function ModuleDetailView({
  module,
  progress,
  onBack,
  onUpdateProgress,
}: {
  module: LearningModule;
  progress?: LearningProgress;
  onBack: () => void;
  onUpdateProgress: (contentId: string, contentType: string, updates: { completed?: boolean; lastSectionIndex?: number }) => void;
}) {
  const [sectionIdx, setSectionIdx] = useState(progress?.lastSectionIndex ?? 0);
  const section = module.sections[sectionIdx];
  const isLastSection = sectionIdx === module.sections.length - 1;
  const isCompleted = progress?.completed ?? false;

  const goToSection = (idx: number) => {
    setSectionIdx(idx);
    onUpdateProgress(module.id, "module", { lastSectionIndex: idx });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{module.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={levelColors[module.level]}>{module.level}</Badge>
            <Badge variant="outline">{module.category}</Badge>
            <span className="text-xs text-muted-foreground">{module.duration}</span>
          </div>
        </div>
        {isCompleted && (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Completed
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Progress value={((sectionIdx + 1) / module.sections.length) * 100} className="flex-1 h-2" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {sectionIdx + 1} / {module.sections.length}
        </span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {module.sections.map((s, idx) => (
          <Button
            key={idx}
            variant={idx === sectionIdx ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => goToSection(idx)}
          >
            {idx + 1}. {s.title.length > 25 ? s.title.slice(0, 25) + "..." : s.title}
          </Button>
        ))}
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">{section.title}</h3>
        {renderMarkdownLite(section.content)}
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={sectionIdx === 0}
          onClick={() => goToSection(sectionIdx - 1)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        {isLastSection ? (
          <Button
            onClick={() => onUpdateProgress(module.id, "module", { completed: true, lastSectionIndex: sectionIdx })}
            disabled={isCompleted}
          >
            {isCompleted ? (
              <><CheckCircle2 className="h-4 w-4 mr-1" /> Already Completed</>
            ) : (
              <><Trophy className="h-4 w-4 mr-1" /> Mark as Complete</>
            )}
          </Button>
        ) : (
          <Button onClick={() => goToSection(sectionIdx + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

function ExplainerDetailView({
  explainer,
  progress,
  onBack,
  onUpdateProgress,
}: {
  explainer: VulnerabilityExplainer;
  progress?: LearningProgress;
  onBack: () => void;
  onUpdateProgress: (contentId: string, contentType: string, updates: { completed?: boolean }) => void;
}) {
  const isCompleted = progress?.completed ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{explainer.cwe}: {explainer.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={severityColors[explainer.severity]}>{explainer.severity}</Badge>
            <span className="text-xs text-muted-foreground">{explainer.readTime} read</span>
          </div>
        </div>
        {isCompleted ? (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Read
          </Badge>
        ) : (
          <Button
            size="sm"
            onClick={() => onUpdateProgress(explainer.id, "explainer", { completed: true })}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" /> Mark as Read
          </Button>
        )}
      </div>

      <Card className="p-5 bg-muted/30">
        <p className="text-sm leading-relaxed">{explainer.summary}</p>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-3">What is it?</h3>
        {renderMarkdownLite(explainer.whatIsIt)}
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-3">How it works</h3>
        {renderMarkdownLite(explainer.howItWorks)}
      </Card>

      <Card className="p-6 border-orange-500/20">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" /> Real-world example
        </h3>
        {renderMarkdownLite(explainer.realWorldExample)}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-3">How to detect</h3>
          {renderMarkdownLite(explainer.howToDetect)}
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-3">How to fix</h3>
          {renderMarkdownLite(explainer.howToFix)}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 border-red-500/20">
          <h3 className="text-sm font-semibold mb-2 text-red-400">Vulnerable code</h3>
          <pre className="bg-muted/50 border rounded-md p-3 text-xs font-mono overflow-x-auto">
            <code>{explainer.codeExampleBad}</code>
          </pre>
        </Card>
        <Card className="p-6 border-green-500/20">
          <h3 className="text-sm font-semibold mb-2 text-green-400">Secure code</h3>
          <pre className="bg-muted/50 border rounded-md p-3 text-xs font-mono overflow-x-auto">
            <code>{explainer.codeExampleGood}</code>
          </pre>
        </Card>
      </div>

      {explainer.references.length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-2">References</h3>
          <ul className="space-y-1">
            {explainer.references.map((ref, i) => (
              <li key={i}>
                <a href={ref} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> {ref}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export default function Learn() {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<
    | { type: "list" }
    | { type: "module"; id: string }
    | { type: "explainer"; id: string }
  >({ type: "list" });

  const { data: contentData, isLoading: contentLoading } = useQuery<ContentResponse>({
    queryKey: ["/api/learning/content"],
  });

  const { data: progressData } = useQuery<ProgressResponse>({
    queryKey: ["/api/learning/progress"],
  });

  const progressMutation = useMutation({
    mutationFn: async (body: { contentId: string; contentType: string; completed?: boolean; lastSectionIndex?: number }) => {
      const res = await apiRequest("POST", "/api/learning/progress", body);
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning/progress"] });
      if (vars.completed) {
        toast({ title: "Progress saved", description: vars.contentType === "module" ? "Module completed!" : "Marked as read!" });
      }
    },
  });

  const modules = contentData?.modules ?? [];
  const explainers = contentData?.explainers ?? [];
  const progressList = progressData?.progress ?? [];

  const getProgress = (contentId: string, contentType: string) =>
    progressList.find((p) => p.contentId === contentId && p.contentType === contentType);

  const completedModules = modules.filter((m) => getProgress(m.id, "module")?.completed).length;
  const completedExplainers = explainers.filter((e) => getProgress(e.id, "explainer")?.completed).length;
  const totalCompleted = completedModules + completedExplainers;
  const totalContent = modules.length + explainers.length;
  const totalMinutes = modules.reduce((s, m) => s + m.durationMinutes, 0) + explainers.reduce((s, e) => s + e.readTimeMinutes, 0);
  const completedMinutes =
    modules.filter((m) => getProgress(m.id, "module")?.completed).reduce((s, m) => s + m.durationMinutes, 0) +
    explainers.filter((e) => getProgress(e.id, "explainer")?.completed).reduce((s, e) => s + e.readTimeMinutes, 0);

  const handleUpdateProgress = (contentId: string, contentType: string, updates: { completed?: boolean; lastSectionIndex?: number }) => {
    progressMutation.mutate({ contentId, contentType, ...updates });
  };

  if (contentLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (activeView.type === "module") {
    const mod = modules.find((m) => m.id === activeView.id);
    if (!mod) return null;
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <ModuleDetailView
          module={mod}
          progress={getProgress(mod.id, "module") as LearningProgress | undefined}
          onBack={() => setActiveView({ type: "list" })}
          onUpdateProgress={handleUpdateProgress}
        />
      </div>
    );
  }

  if (activeView.type === "explainer") {
    const exp = explainers.find((e) => e.id === activeView.id);
    if (!exp) return null;
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <ExplainerDetailView
          explainer={exp}
          progress={getProgress(exp.id, "explainer") as LearningProgress | undefined}
          onBack={() => setActiveView({ type: "list" })}
          onUpdateProgress={handleUpdateProgress}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <GraduationCap className="h-8 w-8 text-primary" />
          Security Learning Hub
        </h1>
        <p className="text-muted-foreground mt-1">
          Master security concepts, understand vulnerabilities, and learn secure coding practices
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalCompleted}/{totalContent}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
          </div>
          <Progress value={totalContent > 0 ? (totalCompleted / totalContent) * 100 : 0} className="mt-3 h-1.5" />
        </Card>
        <Card className="p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{completedModules}/{modules.length}</div>
              <div className="text-xs text-muted-foreground">Modules Done</div>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{completedExplainers}/{explainers.length}</div>
              <div className="text-xs text-muted-foreground">Explainers Read</div>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalMinutes - completedMinutes}m</div>
              <div className="text-xs text-muted-foreground">Time Remaining</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="modules">
        <TabsList>
          <TabsTrigger value="modules">
            <BookOpen className="h-4 w-4 mr-1.5" /> Learning Modules ({modules.length})
          </TabsTrigger>
          <TabsTrigger value="explainers">
            <FileText className="h-4 w-4 mr-1.5" /> Vulnerability Explainers ({explainers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="space-y-4 mt-4">
          {modules.map((mod) => {
            const prog = getProgress(mod.id, "module");
            const isCompleted = prog?.completed ?? false;
            const sectionProgress = prog ? ((prog.lastSectionIndex + 1) / mod.sections.length) * 100 : 0;

            return (
              <Card
                key={mod.id}
                className={`p-5 cursor-pointer transition-all hover:ring-1 hover:ring-primary/50 ${isCompleted ? "border-green-500/30" : ""}`}
                onClick={() => setActiveView({ type: "module", id: mod.id })}
                data-testid={`module-${mod.id}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${isCompleted ? "bg-green-500/10 text-green-500" : "bg-primary/10 text-primary"}`}>
                    {isCompleted ? <CheckCircle2 className="h-6 w-6" /> : (moduleIcons[mod.icon] ?? <BookOpen className="h-6 w-6" />)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{mod.title}</h3>
                      {isCompleted && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Completed</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{mod.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <Badge variant="outline" className={levelColors[mod.level] + " text-xs"}>{mod.level}</Badge>
                      <Badge variant="outline" className="text-xs">{mod.category}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {mod.duration}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {mod.sections.length} sections
                      </span>
                    </div>
                    {prog && !isCompleted && (
                      <Progress value={sectionProgress} className="mt-2 h-1" />
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                </div>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="explainers" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {explainers.map((exp) => {
              const prog = getProgress(exp.id, "explainer");
              const isCompleted = prog?.completed ?? false;

              return (
                <Card
                  key={exp.id}
                  className={`p-4 cursor-pointer transition-all hover:ring-1 hover:ring-primary/50 ${isCompleted ? "border-green-500/30" : ""}`}
                  onClick={() => setActiveView({ type: "explainer", id: exp.id })}
                  data-testid={`explainer-${exp.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${isCompleted ? "bg-green-500/10 text-green-500" : "bg-muted"}`}>
                      {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5 text-orange-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-sm">{exp.title}</h3>
                        {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs font-mono">{exp.cwe}</Badge>
                        <Badge variant="outline" className={`text-xs ${severityColors[exp.severity]}`}>{exp.severity}</Badge>
                        <span className="text-xs text-muted-foreground">{exp.readTime}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{exp.summary}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
