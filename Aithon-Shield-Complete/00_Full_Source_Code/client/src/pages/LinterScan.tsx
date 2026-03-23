import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  FileCode2,
  Code2,
  GitBranch,
  Rocket,
  ArrowRight,
  Sparkles,
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  Info,
  Bug,
  Zap,
  Layers,
  RefreshCw,
  ChevronRight,
  Eye,
  FolderOpen,
  FolderSearch,
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  WrenchIcon,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { InfoTooltip } from "@/components/InfoTooltip";
import type { LinterScan } from "@shared/schema";
import { useRoute } from "wouter";

const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "go", label: "Go" },
  { value: "mixed", label: "Mixed / Auto-detect" },
];

const STEP_LABELS_NEW = [
  "Project Details",
  "Linter Configuration",
  "Review & Scan",
];

const STEP_LABELS_EXISTING = [
  "Repository Details",
  "Scan Configuration",
  "Review & Scan",
];

const STEP_LABELS_FOLDER = [
  "Folder Details",
  "Scan Configuration",
  "Review & Scan",
];

function NewLinterScanDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [lintRules, setLintRules] = useState<string[]>(["security", "hygiene", "best-practices"]);

  const resetState = () => {
    setStep(0);
    setRepositoryUrl("");
    setProjectName("");
    setLanguage("typescript");
    setLintRules(["security", "hygiene", "best-practices"]);
  };

  useEffect(() => {
    if (!open) resetState();
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/linter-scans", {
        repositoryUrl,
        projectName,
        language,
        scanStatus: "pending",
      });
      return await res.json();
    },
    onSuccess: (scan: LinterScan) => {
      queryClient.invalidateQueries({ queryKey: ["/api/linter-scans"] });
      toast({ title: "Linter scan created", description: "Starting code quality analysis..." });
      onCreated(scan.id);
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: "Failed to create scan", description: e.message, variant: "destructive" });
    },
  });

  const canProceed = () => {
    if (step === 0) return repositoryUrl.trim().length > 0 && projectName.trim().length > 0;
    if (step === 1) return language !== "";
    return true;
  };

  const toggleRule = (rule: string) => {
    setLintRules((prev) =>
      prev.includes(rule) ? prev.filter((r) => r !== rule) : [...prev, rule]
    );
  };

  const ruleOptions = [
    { id: "security", label: "Security Rules", desc: "Detect insecure patterns and vulnerabilities", icon: Shield },
    { id: "hygiene", label: "Code Hygiene", desc: "Unused variables, dead code, formatting", icon: Layers },
    { id: "best-practices", label: "Best Practices", desc: "Deprecated APIs, complexity, standards", icon: Zap },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-labelledby="new-linter-dialog-title">
        <DialogHeader>
          <DialogTitle id="new-linter-dialog-title" className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            New Code Linter Scan
          </DialogTitle>
          <DialogDescription>
            Scan a new code repository for linting issues, security vulnerabilities, and code quality problems.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4" aria-label="Workflow steps">
          {STEP_LABELS_NEW.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={`text-xs truncate ${i === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
              {i < STEP_LABELS_NEW.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="new-repo-url">Repository URL</Label>
                <InfoTooltip content="Enter the URL of your code repository (e.g., https://github.com/org/repo)" />
              </div>
              <Input
                id="new-repo-url"
                placeholder="https://github.com/your-org/your-repo"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
                data-testid="input-new-linter-repo-url"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="new-project-name">Project Name</Label>
                <InfoTooltip content="A descriptive name for this project to identify it in your scan list" />
              </div>
              <Input
                id="new-project-name"
                placeholder="e.g., My API Service"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                data-testid="input-new-linter-project-name"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="new-language">Primary Language</Label>
                <InfoTooltip content="The main programming language of your codebase. Choose 'Mixed' to auto-detect multiple languages." />
              </div>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="new-language" data-testid="select-new-linter-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label>Lint Rule Categories</Label>
                <InfoTooltip content="Select which categories of issues to scan for. All categories are recommended for comprehensive coverage." />
              </div>
              <div className="space-y-2">
                {ruleOptions.map(({ id, label, desc, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleRule(id)}
                    className={`w-full flex items-start gap-3 p-3 rounded-md border text-left transition-colors hover-elevate ${lintRules.includes(id) ? "border-primary/50 bg-primary/5" : "border-border"}`}
                    data-testid={`button-rule-${id}`}
                  >
                    <div className={`mt-0.5 p-1.5 rounded ${lintRules.includes(id) ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{label}</span>
                        {lintRules.includes(id) && <CheckCircle className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/40 border space-y-3" data-testid="summary-new-linter-scan">
              <p className="text-sm font-semibold">Scan Summary</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Project</span>
                <span className="font-medium truncate">{projectName}</span>
                <span className="text-muted-foreground">Repository</span>
                <span className="font-medium truncate text-xs">{repositoryUrl}</span>
                <span className="text-muted-foreground">Language</span>
                <span className="font-medium">{LANGUAGES.find((l) => l.value === language)?.label}</span>
                <span className="text-muted-foreground">Rule Categories</span>
                <span className="font-medium">{lintRules.length} selected</span>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                The scan will analyze your code for security vulnerabilities, code quality issues, and best practice violations. Results are available within seconds.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} data-testid="button-linter-back">
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-linter-cancel">
            Cancel
          </Button>
          {step < STEP_LABELS_NEW.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} data-testid="button-linter-next">
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              data-testid="button-linter-start-scan"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
              Start Scan
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExistingLinterScanDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [branch, setBranch] = useState("main");

  const resetState = () => {
    setStep(0);
    setRepositoryUrl("");
    setProjectName("");
    setLanguage("typescript");
    setBranch("main");
  };

  useEffect(() => {
    if (!open) resetState();
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/linter-scans", {
        repositoryUrl,
        projectName,
        language,
        scanStatus: "pending",
      });
      return await res.json();
    },
    onSuccess: (scan: LinterScan) => {
      queryClient.invalidateQueries({ queryKey: ["/api/linter-scans"] });
      toast({ title: "Linter scan created", description: "Starting code quality analysis..." });
      onCreated(scan.id);
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: "Failed to create scan", description: e.message, variant: "destructive" });
    },
  });

  const canProceed = () => {
    if (step === 0) return repositoryUrl.trim().length > 0 && projectName.trim().length > 0 && branch.trim().length > 0;
    if (step === 1) return language !== "";
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-labelledby="existing-linter-dialog-title">
        <DialogHeader>
          <DialogTitle id="existing-linter-dialog-title" className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-cyan-500" />
            Existing App Linter Scan
          </DialogTitle>
          <DialogDescription>
            Run a linter scan on an existing repository to detect code quality issues and apply targeted fixes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4" aria-label="Workflow steps">
          {STEP_LABELS_EXISTING.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${i <= step ? "bg-cyan-500 text-white" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={`text-xs truncate ${i === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
              {i < STEP_LABELS_EXISTING.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="existing-repo-url">Repository URL</Label>
                <InfoTooltip content="URL of the existing repository to scan for linting issues" />
              </div>
              <Input
                id="existing-repo-url"
                placeholder="https://github.com/your-org/your-repo"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
                data-testid="input-existing-linter-repo-url"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="existing-project-name">Project Name</Label>
                <InfoTooltip content="A name to identify this project in your scan history" />
              </div>
              <Input
                id="existing-project-name"
                placeholder="e.g., Production API"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                data-testid="input-existing-linter-project-name"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="existing-branch">Branch</Label>
                <InfoTooltip content="The branch to scan. Defaults to 'main'. You can scan feature branches before merging." />
              </div>
              <Input
                id="existing-branch"
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                data-testid="input-existing-linter-branch"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="existing-language">Primary Language</Label>
                <InfoTooltip content="The primary programming language of the existing codebase" />
              </div>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="existing-language" data-testid="select-existing-linter-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/40 border">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Existing App Workflow</p>
                <p className="text-xs text-muted-foreground">
                  The scanner will connect to your existing repository, analyze the current codebase, detect linting issues, and provide detailed fix suggestions with file locations for each issue found.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/40 border space-y-3" data-testid="summary-existing-linter-scan">
              <p className="text-sm font-semibold">Scan Summary</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Project</span>
                <span className="font-medium truncate">{projectName}</span>
                <span className="text-muted-foreground">Repository</span>
                <span className="font-medium truncate text-xs">{repositoryUrl}</span>
                <span className="text-muted-foreground">Branch</span>
                <span className="font-medium">{branch}</span>
                <span className="text-muted-foreground">Language</span>
                <span className="font-medium">{LANGUAGES.find((l) => l.value === language)?.label}</span>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
              <Eye className="h-4 w-4 text-cyan-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Issues will be detected with exact file paths, line numbers, and AI-powered fix suggestions so you can review and apply changes directly.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} data-testid="button-existing-linter-back">
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-existing-linter-cancel">
            Cancel
          </Button>
          {step < STEP_LABELS_EXISTING.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} data-testid="button-existing-linter-next">
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              data-testid="button-existing-linter-start-scan"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitBranch className="h-4 w-4 mr-2" />}
              Start Scan
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditLinterScanDialog({
  scan,
  open,
  onOpenChange,
}: {
  scan: LinterScan;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [projectName, setProjectName] = useState(scan.projectName);
  const [repositoryUrl, setRepositoryUrl] = useState(scan.repositoryUrl);
  const [language, setLanguage] = useState(scan.language);

  useEffect(() => {
    if (open) {
      setProjectName(scan.projectName);
      setRepositoryUrl(scan.repositoryUrl);
      setLanguage(scan.language);
    }
  }, [open, scan]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/linter-scans/${scan.id}`, {
        projectName,
        repositoryUrl,
        language,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/linter-scans"] });
      toast({ title: "Scan updated" });
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-labelledby="edit-linter-dialog-title">
        <DialogHeader>
          <DialogTitle id="edit-linter-dialog-title">Edit Linter Scan</DialogTitle>
          <DialogDescription>Update the details for this linter scan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-project-name">Project Name</Label>
            <Input
              id="edit-project-name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              data-testid="input-edit-linter-project-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-repo-url">Repository URL</Label>
            <Input
              id="edit-repo-url"
              value={repositoryUrl}
              onChange={(e) => setRepositoryUrl(e.target.value)}
              data-testid="input-edit-linter-repo-url"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-language">Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="edit-language" data-testid="select-edit-linter-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !projectName.trim() || !repositoryUrl.trim()}
            data-testid="button-save-linter-edit"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const SCAN_DEPTH_OPTIONS = [
  { value: "shallow", label: "Shallow (2 levels)", desc: "Top-level and immediate subdirectories only" },
  { value: "standard", label: "Standard (3 levels)", desc: "Recommended for most projects" },
  { value: "deep", label: "Deep (5+ levels)", desc: "Full recursive scan of all subdirectories" },
];

const FILE_TYPE_OPTIONS = [
  { value: "js", label: ".js", desc: "JavaScript" },
  { value: "jsx", label: ".jsx", desc: "React JSX" },
  { value: "ts", label: ".ts", desc: "TypeScript" },
  { value: "tsx", label: ".tsx", desc: "React TSX" },
  { value: "py", label: ".py", desc: "Python" },
  { value: "java", label: ".java", desc: "Java" },
  { value: "go", label: ".go", desc: "Go" },
];

type FolderScanMode = "folder" | "files" | "snippet";

function FolderScanDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [scanMode, setScanMode] = useState<FolderScanMode>("folder");
  // shared
  const [projectName, setProjectName] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [enableSecurity, setEnableSecurity] = useState(true);
  const [enableHygiene, setEnableHygiene] = useState(true);
  const [enableBestPractices, setEnableBestPractices] = useState(true);
  // folder mode
  const [folderPath, setFolderPath] = useState("");
  const [scanDepth, setScanDepth] = useState("standard");
  const [fileTypes, setFileTypes] = useState<string[]>(["ts", "tsx"]);
  // specific files mode
  const [baseFolderPath, setBaseFolderPath] = useState("");
  const [filePaths, setFilePaths] = useState("");
  const [uploadedFileContents, setUploadedFileContents] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // snippet mode
  const [codeSnippet, setCodeSnippet] = useState("");
  const [snippetFilename, setSnippetFilename] = useState("");

  const resetState = () => {
    setStep(0);
    setScanMode("folder");
    setProjectName("");
    setLanguage("typescript");
    setEnableSecurity(true);
    setEnableHygiene(true);
    setEnableBestPractices(true);
    setFolderPath("");
    setScanDepth("standard");
    setFileTypes(["ts", "tsx"]);
    setBaseFolderPath("");
    setFilePaths("");
    setUploadedFileContents({});
    setIsDragging(false);
    setCodeSnippet("");
    setSnippetFilename("");
  };

  const handleFileUpload = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    let remaining = files.length;
    const newContents: Record<string, string> = {};

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        newContents[file.name] = content;
        remaining--;
        if (remaining === 0) {
          setUploadedFileContents((prev) => ({ ...prev, ...newContents }));
          setFilePaths((prev) => {
            const existing = prev.split("\n").map((l) => l.trim()).filter(Boolean);
            const toAdd = files.map((f) => f.name).filter((n) => !existing.includes(n));
            return [...existing, ...toAdd].join("\n");
          });
          toast({ title: `${files.length} file${files.length !== 1 ? "s" : ""} uploaded`, description: "File content loaded and ready to scan." });
        }
      };
      reader.onerror = () => {
        remaining--;
        toast({ title: `Could not read ${file.name}`, variant: "destructive" });
      };
      reader.readAsText(file);
    });
  };

  const removeUploadedFile = (filename: string) => {
    setUploadedFileContents((prev) => {
      const next = { ...prev };
      delete next[filename];
      return next;
    });
    setFilePaths((prev) =>
      prev.split("\n").map((l) => l.trim()).filter((l) => l && l !== filename).join("\n")
    );
  };

  useEffect(() => {
    if (!open) resetState();
  }, [open]);

  const folderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/linter-scans/folder-scan", {
        folderPath, projectName, language, scanDepth, fileTypes,
        enableSecurity, enableHygiene, enableBestPractices,
      });
      return await res.json();
    },
    onSuccess: (scan: LinterScan) => {
      queryClient.invalidateQueries({ queryKey: ["/api/linter-scans"] });
      toast({ title: "Folder scan started", description: "Scanning your folder for code issues..." });
      onCreated(scan.id); onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const filesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/linter-scans/specific-files", {
        folderPath: baseFolderPath,
        filePaths: filePaths.split("\n").map((l) => l.trim()).filter(Boolean),
        fileContents: Object.keys(uploadedFileContents).length > 0 ? uploadedFileContents : undefined,
        projectName, language, enableSecurity, enableHygiene, enableBestPractices,
      });
      return await res.json();
    },
    onSuccess: (scan: LinterScan) => {
      queryClient.invalidateQueries({ queryKey: ["/api/linter-scans"] });
      toast({ title: "Files scan started", description: "Scanning selected files..." });
      onCreated(scan.id); onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const snippetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/linter-scans/code-snippet", {
        code: codeSnippet, projectName, language, filename: snippetFilename || undefined,
        enableSecurity, enableHygiene, enableBestPractices,
      });
      return await res.json();
    },
    onSuccess: (scan: LinterScan) => {
      queryClient.invalidateQueries({ queryKey: ["/api/linter-scans"] });
      toast({ title: "Snippet scan started", description: "Analyzing pasted code for vulnerabilities..." });
      onCreated(scan.id); onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const isPending = folderMutation.isPending || filesMutation.isPending || snippetMutation.isPending;

  const toggleFileType = (ext: string) =>
    setFileTypes((prev) => prev.includes(ext) ? prev.filter((t) => t !== ext) : [...prev, ext]);

  const canProceed = () => {
    if (step === 0) return true; // mode select always ok
    if (step === 1) {
      if (!projectName.trim()) return false;
      if (scanMode === "folder") return folderPath.trim().length > 0;
      if (scanMode === "files") return filePaths.trim().length > 0;
      if (scanMode === "snippet") return codeSnippet.trim().length > 0;
    }
    if (step === 2) return enableSecurity || enableHygiene || enableBestPractices;
    return true;
  };

  const handleSubmit = () => {
    if (scanMode === "folder") folderMutation.mutate();
    else if (scanMode === "files") filesMutation.mutate();
    else snippetMutation.mutate();
  };

  const stepLabels = ["Scan Type", "Details", "Rules", "Review"];
  const accentClass = "border-orange-500/40 bg-orange-500/5";

  const ruleToggles = [
    { id: "security", label: "Security Rules", desc: "SQL injection, secrets, XSS, auth flaws", icon: Shield, enabled: enableSecurity, setEnabled: setEnableSecurity, color: "text-red-500 bg-red-500/10" },
    { id: "hygiene", label: "Code Hygiene", desc: "Dead code, unused vars, naming conventions", icon: Layers, enabled: enableHygiene, setEnabled: setEnableHygiene, color: "text-yellow-500 bg-yellow-500/10" },
    { id: "bestPractices", label: "Best Practices", desc: "Deprecated APIs, complexity, error handling", icon: Zap, enabled: enableBestPractices, setEnabled: setEnableBestPractices, color: "text-blue-500 bg-blue-500/10" },
  ];

  const modeOptions: { mode: FolderScanMode; icon: typeof FolderOpen; label: string; desc: string; color: string }[] = [
    { mode: "folder", icon: FolderOpen, label: "Full Folder Scan", desc: "Recursively scan all files in a folder path for issues and security vulnerabilities", color: "text-orange-500" },
    { mode: "files", icon: FileText, label: "Specific Files", desc: "Provide a list of individual file paths within a folder to scan for compliance issues", color: "text-cyan-500" },
    { mode: "snippet", icon: Code2, label: "Code Snippet", desc: "Paste a piece of code directly and get an instant vulnerability analysis report", color: "text-purple-500" },
  ];

  const summaryRows = () => {
    const base = [
      ["Project", projectName],
      ["Language", LANGUAGES.find((l) => l.value === language)?.label || language],
      ["Rules", [enableSecurity && "Security", enableHygiene && "Hygiene", enableBestPractices && "Best Practices"].filter(Boolean).join(", ")],
    ];
    if (scanMode === "folder") return [
      ["Type", "Full Folder Scan"],
      ["Folder Path", folderPath],
      ["Depth", SCAN_DEPTH_OPTIONS.find((d) => d.value === scanDepth)?.label || scanDepth],
      ["File Types", fileTypes.map((t) => `.${t}`).join(", ") || "All"],
      ...base,
    ];
    if (scanMode === "files") return [
      ["Type", "Specific Files"],
      ["Base Folder", baseFolderPath || "(none)"],
      ["Files", `${filePaths.split("\n").filter((l) => l.trim()).length} file(s)`],
      ...base,
    ];
    return [
      ["Type", "Code Snippet"],
      ["Filename", snippetFilename || "(auto)"],
      ["Lines", `${codeSnippet.split("\n").length}`],
      ...base,
    ];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" aria-labelledby="folder-scan-dialog-title">
        <DialogHeader>
          <DialogTitle id="folder-scan-dialog-title" className="flex items-center gap-2">
            <FolderSearch className="h-5 w-5 text-orange-500" />
            Folder &amp; Code Scan
          </DialogTitle>
          <DialogDescription>
            Scan a folder, select specific files, or paste a code snippet to find security vulnerabilities and quality issues.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-2" aria-label="Workflow steps">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex items-center gap-1.5 flex-1">
              <div className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0 ${i <= step ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <CheckCircle className="h-3 w-3" /> : i + 1}
              </div>
              <span className={`text-xs truncate ${i === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
              {i < stepLabels.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>

        {/* Step 0: Mode Selection */}
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Choose how you want to scan your code:</p>
            {modeOptions.map(({ mode, icon: Icon, label, desc, color }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setScanMode(mode)}
                className={`w-full flex items-start gap-3 p-4 rounded-md border text-left transition-colors hover-elevate ${scanMode === mode ? accentClass + " border-orange-500/30" : "border-border"}`}
                data-testid={`button-scan-mode-${mode}`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${scanMode === mode ? "bg-orange-500/15" : "bg-muted"}`}>
                  <Icon className={`h-4 w-4 ${scanMode === mode ? "text-orange-500" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{label}</span>
                    {scanMode === mode && <CheckCircle className="h-4 w-4 text-orange-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 1: Mode-specific details */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="fs-project-name">Project Name</Label>
                <InfoTooltip content="A descriptive name to identify this scan in your results list" />
              </div>
              <Input id="fs-project-name" placeholder="e.g. My Frontend Components" value={projectName}
                onChange={(e) => setProjectName(e.target.value)} data-testid="input-fs-project-name" />
            </div>

            {scanMode === "folder" && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="fs-folder-path">Folder Path</Label>
                    <InfoTooltip content="Full or relative path to the folder you want to scan, e.g. /home/user/src or ./src" />
                  </div>
                  <Input id="fs-folder-path" placeholder="/home/user/project/src or ./src"
                    value={folderPath} onChange={(e) => setFolderPath(e.target.value)} data-testid="input-fs-folder-path" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="fs-depth">Scan Depth</Label>
                      <InfoTooltip content="How many subdirectory levels to traverse." />
                    </div>
                    <Select value={scanDepth} onValueChange={setScanDepth}>
                      <SelectTrigger id="fs-depth" data-testid="select-fs-depth"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SCAN_DEPTH_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="fs-lang">Language</Label>
                      <InfoTooltip content="Primary language for rule selection." />
                    </div>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger id="fs-lang" data-testid="select-fs-lang"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label>File Types to Include</Label>
                    <InfoTooltip content="Toggle which file extensions to include in the scan." />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {FILE_TYPE_OPTIONS.map(({ value, label }) => (
                      <button key={value} type="button" onClick={() => toggleFileType(value)}
                        className={`px-3 py-1.5 rounded-md border text-xs font-mono hover-elevate transition-colors ${fileTypes.includes(value) ? "border-orange-500/40 bg-orange-500/10 text-orange-500" : "border-border text-muted-foreground"}`}
                        data-testid={`button-fs-filetype-${value}`}>{label}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {scanMode === "files" && (
              <>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".ts,.tsx,.js,.jsx,.py,.java,.go,.rs,.php,.rb,.cs,.cpp,.c,.h,.json,.yaml,.yml,.env,.sh,.sql,.html,.css"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  data-testid="input-fs-file-upload"
                />

                {/* Drag & Drop Upload Zone */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label>Upload Files</Label>
                    <InfoTooltip content="Upload files from your computer to scan. Their content will be analyzed directly for vulnerabilities." />
                  </div>
                  <div
                    className={`relative flex flex-col items-center justify-center gap-2 p-5 rounded-md border-2 border-dashed cursor-pointer transition-colors ${
                      isDragging
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-border hover:border-cyan-500/50 hover:bg-muted/40"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      handleFileUpload(e.dataTransfer.files);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Upload files for scanning"
                    onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                    data-testid="dropzone-fs-files"
                  >
                    <div className="p-3 rounded-full bg-cyan-500/10">
                      <FileText className="h-5 w-5 text-cyan-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">
                        {isDragging ? "Drop files here" : "Click to browse or drag files here"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        .ts .js .py .java .go .rs and more — content read directly in browser
                      </p>
                    </div>
                  </div>

                  {/* Uploaded file list */}
                  {Object.keys(uploadedFileContents).length > 0 && (
                    <div className="space-y-1 mt-2">
                      <p className="text-xs text-muted-foreground font-medium">
                        {Object.keys(uploadedFileContents).length} file{Object.keys(uploadedFileContents).length !== 1 ? "s" : ""} uploaded — content will be scanned directly
                      </p>
                      <div className="max-h-28 overflow-y-auto space-y-1" role="list" aria-label="Uploaded files">
                        {Object.entries(uploadedFileContents).map(([name, content]) => (
                          <div key={name} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-md bg-cyan-500/5 border border-cyan-500/20" role="listitem">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                              <span className="text-xs font-mono truncate">{name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {content.split("\n").length} lines
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); removeUploadedFile(name); }}
                              className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`Remove ${name}`}
                              data-testid={`button-remove-file-${name}`}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or type paths manually</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="fs-base-folder">Base Folder (optional)</Label>
                    <InfoTooltip content="Root folder that contains the files, used for display context." />
                  </div>
                  <Input id="fs-base-folder" placeholder="/home/user/project (optional)"
                    value={baseFolderPath} onChange={(e) => setBaseFolderPath(e.target.value)} data-testid="input-fs-base-folder" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="fs-file-paths">File Paths</Label>
                    <InfoTooltip content="One file path per line. Populated automatically when you upload files above, or type paths manually." />
                  </div>
                  <Textarea id="fs-file-paths" placeholder={"src/auth/login.ts\nsrc/api/users.ts\nsrc/utils/db.ts"}
                    value={filePaths} onChange={(e) => setFilePaths(e.target.value)}
                    className="font-mono text-xs min-h-[80px] resize-y" data-testid="textarea-fs-file-paths" />
                  <p className="text-xs text-muted-foreground">
                    {filePaths.split("\n").filter((l) => l.trim()).length} file{filePaths.split("\n").filter((l) => l.trim()).length !== 1 ? "s" : ""} listed
                    {Object.keys(uploadedFileContents).length > 0 && (
                      <span className="ml-1 text-cyan-500">
                        · {Object.keys(uploadedFileContents).length} with uploaded content
                      </span>
                    )}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="fs-files-lang">Language</Label>
                    <InfoTooltip content="Primary language for rule selection." />
                  </div>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="fs-files-lang" data-testid="select-fs-files-lang"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {scanMode === "snippet" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="fs-snippet-lang">Language</Label>
                      <InfoTooltip content="Language of the pasted code. Used to select appropriate linting rules." />
                    </div>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger id="fs-snippet-lang" data-testid="select-fs-snippet-lang"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="fs-snippet-filename">Filename (optional)</Label>
                      <InfoTooltip content="A filename to label this code in the results, e.g. auth.ts or utils.py" />
                    </div>
                    <Input id="fs-snippet-filename" placeholder="e.g. auth.ts"
                      value={snippetFilename} onChange={(e) => setSnippetFilename(e.target.value)}
                      data-testid="input-fs-snippet-filename" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="fs-code-snippet">Paste Your Code</Label>
                    <InfoTooltip content="Paste the code you want analyzed. The scanner will check for vulnerabilities, code quality issues, and best practice violations." />
                  </div>
                  <Textarea id="fs-code-snippet"
                    placeholder={"// Paste your code here...\nconst query = `SELECT * FROM users WHERE id = ${userId}`;\nconst apiKey = 'sk-hardcoded-key';"}
                    value={codeSnippet} onChange={(e) => setCodeSnippet(e.target.value)}
                    className="font-mono text-xs min-h-[200px] resize-y" data-testid="textarea-fs-code-snippet" />
                  <p className="text-xs text-muted-foreground">
                    {codeSnippet.split("\n").length} line{codeSnippet.split("\n").length !== 1 ? "s" : ""} &bull; The scanner analyzes the code for common vulnerability patterns
                  </p>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                  <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    The AI scanner looks for SQL injection, hardcoded secrets, XSS vectors, eval() misuse, sensitive data in logs, unhandled async operations, and more based on your code.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2: Rules */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Choose which issue categories to scan for:</p>
            {ruleToggles.map(({ id, label, desc, icon: Icon, enabled, setEnabled, color }) => (
              <button key={id} type="button" onClick={() => setEnabled(!enabled)}
                className={`w-full flex items-start gap-3 p-3 rounded-md border text-left hover-elevate transition-colors ${enabled ? accentClass + " border-orange-500/25" : "border-border"}`}
                data-testid={`button-fs-rule-${id}`}>
                <div className={`mt-0.5 p-1.5 rounded shrink-0 ${enabled ? color : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{label}</span>
                    {enabled && <CheckCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/40 border space-y-3" data-testid="summary-folder-scan">
              <p className="text-sm font-semibold">Scan Summary</p>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                {summaryRows().map(([k, v]) => (
                  <>
                    <span key={`k-${k}`} className="text-muted-foreground text-xs">{k}</span>
                    <span key={`v-${k}`} className="font-medium text-xs truncate">{v}</span>
                  </>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
              <Info className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {scanMode === "snippet"
                  ? "The scanner will analyze your pasted code against common vulnerability patterns and produce a report with exact line numbers and before/after fix suggestions."
                  : scanMode === "files"
                  ? "Each listed file will be analyzed individually. Results show exact line numbers, issue descriptions, and recommended code changes."
                  : "The scanner will traverse your folder, analyze each matching file, and report issues with exact file locations, line numbers, and fix recommendations."}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} data-testid="button-fs-back">Back</Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-fs-cancel">Cancel</Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} data-testid="button-fs-next">
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isPending}
              className="bg-orange-500 hover:bg-orange-500" data-testid="button-fs-start">
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FolderSearch className="h-4 w-4 mr-2" />}
              {scanMode === "snippet" ? "Scan Snippet" : scanMode === "files" ? "Scan Files" : "Start Folder Scan"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SeverityChip({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    CRITICAL: "bg-red-500/15 text-red-500 border-red-500/25",
    HIGH: "bg-orange-500/15 text-orange-500 border-orange-500/25",
    MEDIUM: "bg-yellow-500/15 text-yellow-600 border-yellow-500/25",
    LOW: "bg-blue-500/15 text-blue-500 border-blue-500/25",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${map[severity] || "bg-muted text-muted-foreground border-border"}`}>
      {severity}
    </span>
  );
}

// ─── Finding classification helpers ─────────────────────────────────────────

const OVERLAP_KEYWORDS = [
  "sql injection",
  "eval(",
  "hardcoded",
  "innerhtml",
  "xss",
  "cross-site scripting",
  "sensitive data in log",
  "path traversal",
  "command injection",
  "empty catch",
  "missing error handling",
  "insecure function",
  "dangerous eval",
  "dangerous function",
  "cleartext",
  "weak cipher",
  "deprecated crypto",
  "console.log with",
];

function classifyFinding(f: any): { isCodeError: boolean; isSecurity: boolean; isOverlap: boolean } {
  const titleLower = (f.title || "").toLowerCase();
  const matchesOverlap = OVERLAP_KEYWORDS.some((kw) => titleLower.includes(kw));
  const isCodeCategory = f.category === "Code Hygiene" || f.category === "Code Quality";
  const isSecurityCategory = f.category === "Code Security";
  const isCodeError = isCodeCategory || (isSecurityCategory && matchesOverlap);
  const isSecurity = isSecurityCategory || (isCodeCategory && matchesOverlap);
  const isOverlap = isCodeError && isSecurity;
  return { isCodeError, isSecurity, isOverlap };
}

// ─── Shared finding item used in both sections ────────────────────────────────

function FindingAccordionItem({
  finding,
  idx,
  overlapBadge,
  getSeverityIcon,
}: {
  finding: any;
  idx: number;
  overlapBadge?: "security" | "code";
  getSeverityIcon: (s: string) => JSX.Element;
}) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() =>
      toast({ title: "Copied to clipboard", description: `${label} copied.` })
    );
  };

  const location = finding.location || "";
  const lineCol = location.includes(":") ? location.split(":").slice(1).join(":") : "";

  return (
    <div className="border rounded-md" data-testid={`finding-item-${finding.id || idx}`}>
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 p-3 text-left hover-elevate"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        data-testid={`button-expand-finding-${finding.id || idx}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {getSeverityIcon(finding.severity)}
          <span className="text-sm font-semibold truncate">{finding.title}</span>
          {overlapBadge === "security" && (
            <Badge variant="outline" className="text-xs text-red-500 border-red-500/40 shrink-0">
              Also a security risk
            </Badge>
          )}
          {overlapBadge === "code" && (
            <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500/40 shrink-0">
              Also a code error
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SeverityChip severity={finding.severity} />
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t p-4 space-y-3">
          {lineCol && (
            <p className="text-xs font-mono text-muted-foreground">
              {location.split(":")[0]} — Line {lineCol}
            </p>
          )}

          <p className="text-xs text-muted-foreground leading-relaxed">{finding.description}</p>

          <div className="space-y-1">
            <p className="text-xs font-semibold flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" /> Recommended Fix
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">{finding.remediation}</p>
          </div>

          {finding.aiSuggestion && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" /> AI Code Suggestion
                </p>
                <button
                  type="button"
                  onClick={() => copyToClipboard(finding.aiSuggestion, "Code suggestion")}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  data-testid={`button-copy-ai-${finding.id || idx}`}
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
              <pre className="text-xs bg-muted/50 rounded p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap font-mono">
                {finding.aiSuggestion}
              </pre>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {finding.cwe && (
              <Badge variant="outline" className="text-xs">CWE-{finding.cwe}</Badge>
            )}
            {finding.category && (
              <Badge variant="outline" className="text-xs">{finding.category}</Badge>
            )}
            {overlapBadge && (
              <Badge variant="outline" className="text-xs text-purple-500 border-purple-500/40">Dual Issue</Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Two-Section Findings Display ────────────────────────────────────────────

function TwoSectionFindingsDisplay({ findings }: { findings: any[] }) {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
      case "HIGH": return <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
      case "MEDIUM": return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />;
      default: return <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    }
  };

  const classified = findings.map((f) => ({ f, cls: classifyFinding(f) }));
  const codeErrors = classified.filter(({ cls }) => cls.isCodeError);
  const securityVulns = classified.filter(({ cls }) => cls.isSecurity);

  const severityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const sortBySeverity = (arr: typeof classified) =>
    [...arr].sort((a, b) => severityOrder.indexOf(a.f.severity) - severityOrder.indexOf(b.f.severity));

  const sortedCodeErrors = sortBySeverity(codeErrors);
  const sortedSecurityVulns = sortBySeverity(securityVulns);

  if (findings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No findings to display.
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="two-section-findings">
      {/* Section 1 — Code Errors & Mistakes */}
      <div data-testid="section-code-errors">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded bg-yellow-500/10">
            <Bug className="h-4 w-4 text-yellow-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Code Errors &amp; Mistakes
              <Badge variant="outline" className="text-xs" data-testid="badge-code-error-count">
                {codeErrors.length}
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bugs, anti-patterns, hygiene issues, and bad practices that need to be corrected in your code.
              Items marked <span className="text-red-500 font-medium">Also a security risk</span> overlap with the Security section below.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {sortedCodeErrors.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No code errors detected.</p>
          ) : (
            sortedCodeErrors.map(({ f, cls }, idx) => (
              <FindingAccordionItem
                key={f.id || idx}
                finding={f}
                idx={idx}
                overlapBadge={cls.isOverlap ? "security" : undefined}
                getSeverityIcon={getSeverityIcon}
              />
            ))
          )}
        </div>
      </div>

      <div className="border-t" />

      {/* Section 2 — Security Vulnerabilities */}
      <div data-testid="section-security-vulns">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded bg-red-500/10">
            <Shield className="h-4 w-4 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Security Vulnerabilities
              <Badge variant="outline" className="text-xs" data-testid="badge-security-count">
                {securityVulns.length}
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Code patterns that expose your application to attacks. Items marked{" "}
              <span className="text-yellow-600 font-medium">Also a code error</span> also appear in the Code Errors section above.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {sortedSecurityVulns.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No security vulnerabilities detected.</p>
          ) : (
            sortedSecurityVulns.map(({ f, cls }, idx) => (
              <FindingAccordionItem
                key={f.id || idx}
                finding={f}
                idx={idx}
                overlapBadge={cls.isOverlap ? "code" : undefined}
                getSeverityIcon={getSeverityIcon}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Folder / Files / Snippet scan results panel ────────────────────────────

function FolderScanResultsPanel({
  findings,
  folderPath,
  repositoryUrl,
}: {
  findings: any[];
  folderPath: string;
  repositoryUrl?: string;
}) {
  const { toast } = useToast();
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  // Group findings by file (using `asset` or `location` field)
  const fileMap = new Map<string, any[]>();
  for (const f of findings) {
    const file = f.asset || f.location?.split(":")[0] || "unknown";
    if (!fileMap.has(file)) fileMap.set(file, []);
    fileMap.get(file)!.push(f);
  }

  const filteredMap = new Map<string, any[]>();
  for (const [file, items] of Array.from(fileMap.entries())) {
    const filtered = severityFilter === "ALL" ? items : items.filter((i: any) => i.severity === severityFilter);
    if (filtered.length > 0) filteredMap.set(file, filtered);
  }

  const toggleFile = (file: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied to clipboard", description: `${label} copied.` });
    });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      case "HIGH": return <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />;
      case "MEDIUM": return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
      default: return <Info className="h-3.5 w-3.5 text-blue-500" />;
    }
  };

  const totalShown = Array.from(filteredMap.values()).reduce((s, a) => s + a.length, 0);
  const scanTypeLabel = repositoryUrl?.startsWith("snippet://")
    ? "Code Snippet"
    : repositoryUrl?.startsWith("files://")
    ? "Specific Files"
    : "Folder Scan";

  return (
    <Card data-testid="card-folder-scan-results">
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              {repositoryUrl?.startsWith("snippet://") ? (
                <Code2 className="h-5 w-5 text-purple-500" />
              ) : repositoryUrl?.startsWith("files://") ? (
                <FileText className="h-5 w-5 text-cyan-500" />
              ) : (
                <FolderOpen className="h-5 w-5 text-orange-500" />
              )}
              {scanTypeLabel} — Analysis Results
            </CardTitle>
            <CardDescription className="mt-1">
              <span className="font-mono text-xs">{folderPath}</span> &bull; {findings.length} total issue{findings.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="by-type" data-testid="tabs-folder-results">
          <TabsList className="mb-4" data-testid="tablist-folder-results">
            <TabsTrigger value="by-type" data-testid="tab-by-type">
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              By Category
            </TabsTrigger>
            <TabsTrigger value="by-file" data-testid="tab-by-file">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              By File
            </TabsTrigger>
          </TabsList>

          {/* ── By Category tab (two-section view) ── */}
          <TabsContent value="by-type" data-testid="tabcontent-by-type">
            <TwoSectionFindingsDisplay findings={findings} />
          </TabsContent>

          {/* ── By File tab (file-by-file view) ── */}
          <TabsContent value="by-file" data-testid="tabcontent-by-file">
            <div className="flex items-center justify-between gap-2 mb-4">
              <p className="text-xs text-muted-foreground">
                {totalShown} issue{totalShown !== 1 ? "s" : ""} across {filteredMap.size} file{filteredMap.size !== 1 ? "s" : ""}
              </p>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-36" data-testid="select-severity-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Severities</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              {filteredMap.size === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No issues match the selected filter.</div>
              ) : (
                Array.from(filteredMap.entries()).map(([file, issues]) => {
                  const isExpanded = expandedFiles.has(file);
                  const critCount = issues.filter((i) => i.severity === "CRITICAL").length;
                  const highCount = issues.filter((i) => i.severity === "HIGH").length;
                  const { isOverlap: fileHasOverlap } = { isOverlap: issues.some((i) => classifyFinding(i).isOverlap) };
                  return (
                    <div key={file} className="border rounded-md" data-testid={`card-file-${file.replace(/\//g, "-")}`}>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between gap-3 p-3 text-left hover-elevate"
                        onClick={() => toggleFile(file)}
                        aria-expanded={isExpanded}
                        data-testid={`button-expand-file-${file.replace(/\//g, "-")}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-orange-500 shrink-0" />
                          <span className="font-mono text-sm truncate">{file}</span>
                          {fileHasOverlap && (
                            <Badge variant="outline" className="text-xs text-purple-500 border-purple-500/40 shrink-0">Dual issues</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {critCount > 0 && (
                            <span className="text-xs font-semibold text-red-500">{critCount} critical</span>
                          )}
                          {highCount > 0 && (
                            <span className="text-xs font-semibold text-orange-500">{highCount} high</span>
                          )}
                          <Badge variant="outline" className="text-xs">{issues.length} issue{issues.length !== 1 ? "s" : ""}</Badge>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t divide-y">
                          {issues.map((finding, idx) => {
                            const location = finding.location || "";
                            const lineCol = location.includes(":") ? location.split(":").slice(1).join(":") : "";
                            const { isOverlap } = classifyFinding(finding);
                            return (
                              <div key={idx} className="p-4 space-y-3" data-testid={`finding-row-${finding.id || idx}`}>
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                  <div className="flex items-start gap-2">
                                    {getSeverityIcon(finding.severity)}
                                    <div>
                                      <p className="text-sm font-semibold">{finding.title}</p>
                                      {lineCol && (
                                        <p className="text-xs font-mono text-muted-foreground">Line {lineCol}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {isOverlap && (
                                      <Badge variant="outline" className="text-xs text-purple-500 border-purple-500/40">Dual Issue</Badge>
                                    )}
                                    <SeverityChip severity={finding.severity} />
                                  </div>
                                </div>

                                <p className="text-xs text-muted-foreground">{finding.description}</p>

                                <div className="space-y-1">
                                  <p className="text-xs font-semibold flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3 text-green-500" /> Recommendation
                                  </p>
                                  <p className="text-xs text-muted-foreground">{finding.remediation}</p>
                                </div>

                                {finding.aiSuggestion && (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-semibold flex items-center gap-1">
                                        <Sparkles className="h-3 w-3 text-primary" /> Code Change
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(finding.aiSuggestion, "Code suggestion")}
                                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                                        data-testid={`button-copy-suggestion-${finding.id || idx}`}
                                      >
                                        <Copy className="h-3 w-3" />
                                        Copy
                                      </button>
                                    </div>
                                    <pre className="text-xs bg-muted/50 rounded p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap font-mono" data-testid={`code-suggestion-${finding.id || idx}`}>
                                      {finding.aiSuggestion}
                                    </pre>
                                  </div>
                                )}

                                {finding.cwe && (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-xs">CWE-{finding.cwe}</Badge>
                                    {finding.category && (
                                      <Badge variant="outline" className="text-xs">{finding.category}</Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default function LinterScanPage() {
  const { toast } = useToast();
  const [, routeParams] = useRoute("/linter-scans/:id");
  const [selectedScanId, setSelectedScanId] = useState<string | null>(routeParams?.id || null);
  const [newScanOpen, setNewScanOpen] = useState(false);
  const [existingScanOpen, setExistingScanOpen] = useState(false);
  const [folderScanOpen, setFolderScanOpen] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showFixDialog, setShowFixDialog] = useState(false);
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);
  const [showFixedOutput, setShowFixedOutput] = useState(false);
  const [fixedCodeData, setFixedCodeData] = useState<{ originalCode: string | null; fixedCode: string | null; fixes: any[] } | null>(null);
  const [singleFixingId, setSingleFixingId] = useState<string | null>(null);

  const parseFixSuggestion = (aiSuggestion: string | null | undefined) => {
    if (!aiSuggestion) return { description: "", before: null, after: null };
    const fixedIdx = aiSuggestion.indexOf("FIXED");
    const description = fixedIdx > -1 ? aiSuggestion.slice(0, fixedIdx).trim() : aiSuggestion.trim();
    const fixPart = fixedIdx > -1 ? aiSuggestion.slice(fixedIdx) : "";
    const beforeMatch = fixPart.match(/(?:\/\/|#)\s*BEFORE[^:\n]*:\n([\s\S]*?)(?=\n\s*(?:\/\/|#)\s*AFTER)/i);
    const afterMatch = fixPart.match(/(?:\/\/|#)\s*AFTER[^:\n]*:\n([\s\S]*?)(?=\n\s*(?:\/\/|#)\s*AFTER|\n\s*(?:\/\/|#)\s*[A-Z]{3}|$)/i);
    return {
      description,
      before: beforeMatch ? beforeMatch[1].trim() : null,
      after: afterMatch ? afterMatch[1].trim() : null,
    };
  };

  const downloadCode = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (routeParams?.id) setSelectedScanId(routeParams.id);
  }, [routeParams?.id]);

  const { data: scans = [], isLoading } = useQuery<LinterScan[]>({
    queryKey: ["/api/linter-scans"],
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.some((s) => s.scanStatus === "scanning" || s.scanStatus === "pending")) return 2000;
      return false;
    },
  });

  const { data: selectedScan } = useQuery<LinterScan>({
    queryKey: ["/api/linter-scans", selectedScanId],
    enabled: !!selectedScanId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.scanStatus === "scanning" || data?.scanStatus === "pending") return 1000;
      return false;
    },
  });

  const isFolderScan = selectedScan?.repositoryUrl?.startsWith("folder://")
    || selectedScan?.repositoryUrl?.startsWith("snippet://")
    || selectedScan?.repositoryUrl?.startsWith("files://");

  const { data: scanFindings = [] } = useQuery<any[]>({
    queryKey: ["/api/findings", selectedScanId, "linter"],
    queryFn: async () => {
      const res = await fetch(`/api/findings?scanId=${selectedScanId}&scanType=linter`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch findings");
      return res.json();
    },
    enabled: !!selectedScanId && selectedScan?.scanStatus === "completed",
  });

  const folderFindings = scanFindings;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/linter-scans/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/linter-scans"] });
      setSelectedScanId(null);
      setShowDeleteConfirmation(false);
      toast({ title: "Scan deleted", description: "Scan and all findings have been removed." });
    },
    onError: (e: any) => {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    },
  });

  const fixMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/linter-scans/${id}/fix`, { mode: "all" });
      return await res.json();
    },
    onSuccess: async (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/linter-scans"] });
      try {
        const res = await fetch(`/api/linter-scans/${id}/fixed-code`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setFixedCodeData(data);
          setShowFixedOutput(true);
        }
      } catch (_) {}
    },
    onError: (e: any) => {
      toast({ title: "Fix failed", description: e.message, variant: "destructive" });
    },
  });

  const singleFixMutation = useMutation({
    mutationFn: async ({ scanId, findingId }: { scanId: string; findingId: string }) => {
      setSingleFixingId(findingId);
      const res = await apiRequest("POST", `/api/linter-scans/${scanId}/fix`, { findingId });
      return await res.json();
    },
    onSuccess: async (_data, { scanId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/linter-scans"] });
      toast({ title: "Fix applied", description: "The issue has been fixed." });
      setSingleFixingId(null);
      try {
        const res = await fetch(`/api/linter-scans/${scanId}/fixed-code`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setFixedCodeData(data);
          setShowFixedOutput(true);
        }
      } catch (_) {}
    },
    onError: (e: any) => {
      setSingleFixingId(null);
      toast({ title: "Fix failed", description: e.message, variant: "destructive" });
    },
  });

  const getScanStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" data-testid="badge-scan-pending">Pending</Badge>;
      case "scanning":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20" data-testid="badge-scan-scanning"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Scanning</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20" data-testid="badge-scan-completed">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive" data-testid="badge-scan-failed">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const sortedScans = [...scans].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <main className="container mx-auto p-6 max-w-7xl space-y-6" id="main-content">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-linter-scan">
          Code Linter Scan
        </h1>
        <p className="text-muted-foreground mt-2" data-testid="text-linter-scan-description">
          Detect code quality issues, security vulnerabilities, hygiene problems, and best practice violations across your codebase
        </p>
      </div>

      {/* Workflow Choice Section */}
      <Card className="p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 -mr-32 -mt-32 rounded-full bg-gradient-to-br from-primary/5 to-transparent opacity-50" />
        <div className="relative space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileCode2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Start Code Linter Scan</h2>
              <p className="text-sm text-muted-foreground">
                Choose your workflow — scan a repository, existing app, or a local code folder
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Folder Scan — first position */}
            <Button
              variant="outline"
              className="group h-auto w-full p-6 justify-start hover-elevate active-elevate-2 transition-all duration-300 hover:border-orange-500/30"
              onClick={() => setFolderScanOpen(true)}
              data-testid="button-folder-scan-workflow"
            >
              <div className="flex items-start gap-4 w-full min-w-0 whitespace-normal">
                <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-400/10 transition-transform duration-300 group-hover:scale-110 shrink-0">
                  <FolderSearch className="w-6 h-6 text-orange-500" />
                </div>
                <div className="text-left flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base tracking-tight">Code Scan</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 shrink-0" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1.5 whitespace-normal break-words">
                    Scan a local code folder, specific files, or paste a code snippet
                  </p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <div className="flex items-center gap-1 text-xs text-orange-500">
                      <FolderOpen className="w-3 h-3 shrink-0" />
                      <span>File-by-File Report</span>
                    </div>
                    <span className="text-muted-foreground text-xs">|</span>
                    <span className="text-xs text-muted-foreground">Exact line &amp; column</span>
                  </div>
                </div>
              </div>
            </Button>

            {/* New App */}
            <Button
              variant="outline"
              className="group h-auto w-full p-6 justify-start hover-elevate active-elevate-2 transition-all duration-300 hover:border-primary/30"
              onClick={() => setNewScanOpen(true)}
              data-testid="button-new-linter-scan-workflow"
            >
              <div className="flex items-start gap-4 w-full min-w-0 whitespace-normal">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-cyan-500/10 transition-transform duration-300 group-hover:scale-110 shrink-0">
                  <Rocket className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base tracking-tight">New App</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 shrink-0" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1.5 whitespace-normal break-words">
                    Scan code from a new repository before deployment
                  </p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <Sparkles className="w-3 h-3 shrink-0" />
                      <span>AI-Powered Fixes</span>
                    </div>
                    <span className="text-muted-foreground text-xs">|</span>
                    <span className="text-xs text-muted-foreground">Full lint scan</span>
                  </div>
                </div>
              </div>
            </Button>

            {/* Existing App */}
            <Button
              variant="outline"
              className="group h-auto w-full p-6 justify-start hover-elevate active-elevate-2 transition-all duration-300 hover:border-primary/30"
              onClick={() => setExistingScanOpen(true)}
              data-testid="button-existing-linter-scan-workflow"
            >
              <div className="flex items-start gap-4 w-full min-w-0 whitespace-normal">
                <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-primary/10 transition-transform duration-300 group-hover:scale-110 shrink-0">
                  <GitBranch className="w-6 h-6 text-cyan-500" />
                </div>
                <div className="text-left flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base tracking-tight">Existing App</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 shrink-0" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1.5 whitespace-normal break-words">
                    Connect to an existing repository and scan for issues
                  </p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <div className="flex items-center gap-1 text-xs text-cyan-500">
                      <Eye className="w-3 h-3 shrink-0" />
                      <span>Full History</span>
                    </div>
                    <span className="text-muted-foreground text-xs">|</span>
                    <span className="text-xs text-muted-foreground">Targeted fixes</span>
                  </div>
                </div>
              </div>
            </Button>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Shield, label: "Security Rules", desc: "CWE-mapped vulnerability detection" },
              { icon: Layers, label: "Code Hygiene", desc: "Dead code, unused variables, formatting" },
              { icon: Zap, label: "Best Practices", desc: "Deprecated APIs, complexity, standards" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
                <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Selected Scan Details */}
      {selectedScan && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card data-testid={`card-scan-details-${selectedScan.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <CardTitle className="flex items-center gap-2 truncate" data-testid={`heading-scan-${selectedScan.id}`}>
                    {selectedScan.repositoryUrl?.startsWith("snippet://") ? (
                      <Code2 className="h-5 w-5 text-purple-500 shrink-0" />
                    ) : selectedScan.repositoryUrl?.startsWith("files://") ? (
                      <FileText className="h-5 w-5 text-cyan-500 shrink-0" />
                    ) : selectedScan.repositoryUrl?.startsWith("folder://") ? (
                      <FolderOpen className="h-5 w-5 text-orange-500 shrink-0" />
                    ) : (
                      <Code2 className="h-5 w-5 shrink-0" />
                    )}
                    <span className="truncate">{selectedScan.projectName}</span>
                  </CardTitle>
                  <CardDescription className="mt-1 truncate" data-testid={`text-scan-details-${selectedScan.id}`}>
                    {LANGUAGES.find((l) => l.value === selectedScan.language)?.label || selectedScan.language}
                    {" \u2022 "}
                    <span className="font-mono text-xs">
                      {selectedScan.repositoryUrl?.replace(/^(folder|snippet|files):\/\//, "") || selectedScan.repositoryUrl}
                    </span>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowEditDialog(true)}
                    data-testid={`button-edit-scan-${selectedScan.id}`}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowDeleteConfirmation(true)}
                    data-testid={`button-delete-scan-${selectedScan.id}`}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Scan Status</p>
                  {getScanStatusBadge(selectedScan.scanStatus)}
                </div>
              </div>

              {selectedScan.scanStatus === "scanning" && (
                <div className="space-y-2">
                  <Progress value={60} className="h-2" data-testid={`progress-scan-${selectedScan.id}`} />
                  <p className="text-sm text-muted-foreground">
                    {isFolderScan
                      ? "Traversing folder structure and analyzing files for errors and improvements..."
                      : "Analyzing code quality and security patterns..."}
                  </p>
                </div>
              )}

              {selectedScan.scanStatus === "completed" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-muted/30 space-y-1">
                      <p className="text-xs text-muted-foreground">Total Issues</p>
                      <p className="text-2xl font-bold" data-testid={`text-total-issues-${selectedScan.id}`}>{selectedScan.issuesCount}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Shield className="h-3 w-3 text-red-500" /> Security
                      </p>
                      <p className="text-2xl font-bold text-red-500" data-testid={`text-security-issues-${selectedScan.id}`}>{selectedScan.securityIssuesCount}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10 space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Layers className="h-3 w-3 text-yellow-500" /> Hygiene
                      </p>
                      <p className="text-2xl font-bold text-yellow-600" data-testid={`text-hygiene-issues-${selectedScan.id}`}>{selectedScan.hygieneIssuesCount}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Zap className="h-3 w-3 text-blue-500" /> Best Practices
                      </p>
                      <p className="text-2xl font-bold text-blue-500" data-testid={`text-best-practice-issues-${selectedScan.id}`}>{selectedScan.bestPracticeIssuesCount}</p>
                    </div>
                  </div>

                  {selectedScan.issuesCount > 0 && !selectedScan.fixesApplied && (
                    <div className="space-y-2 border-t pt-4">
                      <p className="text-sm font-medium">Fix Issues</p>
                      <p className="text-xs text-muted-foreground">
                        AI-powered fixes are applied per-scan at no cost. Each fix includes before/after code snippets.
                      </p>
                      <Button
                        className="w-full gap-2"
                        onClick={() => setShowFixDialog(true)}
                        data-testid={`button-fix-issues-${selectedScan.id}`}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Review & Fix Issues (Free)
                      </Button>
                    </div>
                  )}

                  {selectedScan.fixesApplied && (
                    <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20" data-testid={`alert-fixes-applied-${selectedScan.id}`}>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="text-sm font-medium text-green-500">Fixes Applied</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedScan.lastUploadStatus === "success" ? "Changes pushed to repository" : "Ready to upload to repository"}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedScan.fixesApplied && selectedScan.lastUploadStatus !== "success" && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => fixMutation.mutate(selectedScan.id)}
                      disabled={fixMutation.isPending}
                      data-testid={`button-upload-fixes-${selectedScan.id}`}
                    >
                      <Upload className="h-4 w-4" />
                      Push Fixes to Repository
                    </Button>
                  )}
                </div>
              )}

              {selectedScan.scanStatus === "pending" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20" data-testid={`status-pending-${selectedScan.id}`}>
                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
                  <p className="text-sm text-muted-foreground">Scan is queued and will start automatically...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right column: findings display or info card */}
          {selectedScan?.scanStatus === "completed" && scanFindings.length > 0 && !isFolderScan ? (
            <Card data-testid="card-scan-findings-panel">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Findings Breakdown
                </CardTitle>
                <CardDescription>
                  {scanFindings.length} issue{scanFindings.length !== 1 ? "s" : ""} detected — categorised below
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TwoSectionFindingsDisplay findings={scanFindings} />
              </CardContent>
            </Card>
          ) : (
            <Card className="h-fit" data-testid="card-linter-info">
              <CardHeader>
                <CardTitle className="text-base">Issue Categories</CardTitle>
                <CardDescription>What the linter scan checks for in your codebase</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  {
                    icon: Shield,
                    color: "text-red-500",
                    bg: "bg-red-500/10",
                    title: "Security Vulnerabilities",
                    items: ["SQL injection patterns", "XSS via innerHTML", "Insecure function usage", "Hardcoded secrets"],
                  },
                  {
                    icon: Bug,
                    color: "text-yellow-500",
                    bg: "bg-yellow-500/10",
                    title: "Code Errors & Mistakes",
                    items: ["Unused variables", "Dead code blocks", "Empty catch blocks", "Missing error handling"],
                  },
                  {
                    icon: Zap,
                    color: "text-blue-500",
                    bg: "bg-blue-500/10",
                    title: "Dual Issues (Overlap)",
                    items: ["SQL injection = code mistake + security risk", "eval() = bad practice + vulnerability", "Hardcoded passwords = both"],
                  },
                ].map(({ icon: Icon, color, bg, title, items }) => (
                  <div key={title} className="flex items-start gap-3">
                    <div className={`p-1.5 rounded ${bg} shrink-0`}>
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{title}</p>
                      <ul className="mt-1 space-y-0.5">
                        {items.map((item) => (
                          <li key={item} className="text-xs text-muted-foreground flex items-center gap-1">
                            <ChevronRight className="h-3 w-3 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* All Scans */}
      <Card data-testid="card-all-linter-scans">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle data-testid="heading-all-linter-scans">All Linter Scans</CardTitle>
              <CardDescription>View and manage your code linter security scans</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNewScanOpen(true)}
              data-testid="button-new-scan-shortcut"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              New Scan
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8" data-testid="loading-scans">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : sortedScans.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-scans">
              <FileCode2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No linter scans yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a scan above to start analyzing your code
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedScans.map((scan) => (
                <button
                  key={scan.id}
                  className={`w-full flex items-center justify-between gap-4 p-4 rounded-lg border text-left transition-colors hover-elevate ${selectedScanId === scan.id ? "border-primary/50 bg-primary/5" : "border-border"}`}
                  onClick={() => setSelectedScanId(scan.id)}
                  data-testid={`card-scan-${scan.id}`}
                  aria-pressed={selectedScanId === scan.id}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                        scan.repositoryUrl?.startsWith("folder://") ? "bg-orange-500/10" :
                        scan.repositoryUrl?.startsWith("snippet://") ? "bg-purple-500/10" :
                        scan.repositoryUrl?.startsWith("files://") ? "bg-cyan-500/10" :
                        "bg-primary/10"
                      }`}>
                      {scan.repositoryUrl?.startsWith("folder://") ? (
                        <FolderOpen className="h-4 w-4 text-orange-500" />
                      ) : scan.repositoryUrl?.startsWith("snippet://") ? (
                        <Code2 className="h-4 w-4 text-purple-500" />
                      ) : scan.repositoryUrl?.startsWith("files://") ? (
                        <FileText className="h-4 w-4 text-cyan-500" />
                      ) : (
                        <Code2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-sm truncate" data-testid={`text-scan-name-${scan.id}`}>
                          {scan.projectName}
                        </p>
                        {scan.repositoryUrl?.startsWith("folder://") && (
                          <Badge variant="outline" className="text-xs shrink-0 text-orange-500 border-orange-500/30">Folder</Badge>
                        )}
                        {scan.repositoryUrl?.startsWith("snippet://") && (
                          <Badge variant="outline" className="text-xs shrink-0 text-purple-500 border-purple-500/30">Snippet</Badge>
                        )}
                        {scan.repositoryUrl?.startsWith("files://") && (
                          <Badge variant="outline" className="text-xs shrink-0 text-cyan-500 border-cyan-500/30">Files</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {LANGUAGES.find((l) => l.value === scan.language)?.label} &bull;{" "}
                        {scan.repositoryUrl?.replace(/^(folder|snippet|files):\/\//, "") || scan.repositoryUrl}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {scan.scanStatus === "completed" && (
                      <div className="text-right">
                        <p className="text-sm font-bold">{scan.issuesCount}</p>
                        <p className="text-xs text-muted-foreground">issues</p>
                      </div>
                    )}
                    {getScanStatusBadge(scan.scanStatus)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Folder Scan File-by-File Results */}
      {selectedScan && isFolderScan && selectedScan.scanStatus === "completed" && folderFindings.length > 0 && (
        <FolderScanResultsPanel
          findings={folderFindings}
          folderPath={selectedScan.repositoryUrl?.replace(/^(folder|snippet|files):\/\//, "") || ""}
          repositoryUrl={selectedScan.repositoryUrl}
        />
      )}

      {/* Dialogs */}
      <NewLinterScanDialog
        open={newScanOpen}
        onOpenChange={setNewScanOpen}
        onCreated={(id) => setSelectedScanId(id)}
      />
      <ExistingLinterScanDialog
        open={existingScanOpen}
        onOpenChange={setExistingScanOpen}
        onCreated={(id) => setSelectedScanId(id)}
      />
      <FolderScanDialog
        open={folderScanOpen}
        onOpenChange={setFolderScanOpen}
        onCreated={(id) => setSelectedScanId(id)}
      />

      {selectedScan && (
        <>
          <EditLinterScanDialog
            scan={selectedScan}
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
          />

          <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Linter Scan</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the scan &quot;{selectedScan.projectName}&quot; and all associated findings. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate(selectedScan.id)}
                  disabled={deleteMutation.isPending}
                  className="bg-destructive hover:bg-destructive/90"
                  data-testid="button-confirm-delete"
                >
                  {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Delete Scan
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={showFixDialog} onOpenChange={(open) => { setShowFixDialog(open); if (!open) { setShowFixedOutput(false); setExpandedFindingId(null); setFixedCodeData(null); } }}>
            <DialogContent aria-labelledby="fix-dialog-title" className="sm:max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle id="fix-dialog-title" className="flex items-center gap-2">
                  {showFixedOutput ? (
                    <><CheckCircle className="h-5 w-5 text-green-500" />Fixes Applied — Updated Code</>
                  ) : (
                    <><CheckCircle className="h-5 w-5 text-green-500" />Review & Fix Issues — Free</>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {showFixedOutput
                    ? "Your code has been fixed. Copy the full output or download it as a file."
                    : <>AI-powered code fixes for &quot;{selectedScan.projectName}&quot;. Click any issue to see the recommendation, then auto-fix or copy the fix manually.</>}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
                {showFixedOutput && fixedCodeData ? (
                  /* ── POST-FIX OUTPUT VIEW ── */
                  <div className="space-y-4">
                    {fixedCodeData.fixes.length > 0 && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        <p className="text-sm text-green-600 dark:text-green-400">
                          {fixedCodeData.fixes.length} fix{fixedCodeData.fixes.length !== 1 ? "es" : ""} applied successfully
                        </p>
                      </div>
                    )}

                    {fixedCodeData.fixedCode ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Complete Fixed Code</p>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(fixedCodeData.fixedCode!); toast({ title: "Copied", description: "Fixed code copied to clipboard." }); }} data-testid="button-copy-fixed-code">
                              <Copy className="h-3 w-3 mr-1.5" />Copy All
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => downloadCode(fixedCodeData.fixedCode!, `${selectedScan.projectName}-fixed.${selectedScan.language === "python" ? "py" : selectedScan.language === "javascript" ? "js" : "ts"}`)} data-testid="button-download-fixed-code">
                              <Download className="h-3 w-3 mr-1.5" />Download
                            </Button>
                          </div>
                        </div>
                        <pre className="bg-muted/60 border border-border rounded-lg p-3 text-xs font-mono overflow-x-auto overflow-y-auto max-h-64 whitespace-pre text-foreground leading-relaxed">{fixedCodeData.fixedCode}</pre>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Fix Recommendations Applied</p>
                        <div className="space-y-3">
                          {fixedCodeData.fixes.map((fix: any, i: number) => fix.afterCode && (
                            <div key={i} className="rounded-lg border border-border overflow-hidden">
                              <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center justify-between gap-2">
                                <p className="text-xs font-medium text-foreground truncate">{fix.title}</p>
                                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(fix.afterCode); toast({ title: "Copied" }); }}>
                                  <Copy className="h-3 w-3 mr-1" />Copy
                                </Button>
                              </div>
                              <pre className="bg-muted/30 p-3 text-xs font-mono overflow-x-auto whitespace-pre text-foreground leading-relaxed">{fix.afterCode}</pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── PRE-FIX VIEW ── */
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
                        <p className="text-xl font-bold text-red-500">{selectedScan.securityIssuesCount}</p>
                        <p className="text-xs text-muted-foreground">Security</p>
                      </div>
                      <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-center">
                        <p className="text-xl font-bold text-yellow-600">{selectedScan.hygieneIssuesCount}</p>
                        <p className="text-xs text-muted-foreground">Hygiene</p>
                      </div>
                      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center">
                        <p className="text-xl font-bold text-blue-500">{selectedScan.bestPracticeIssuesCount}</p>
                        <p className="text-xs text-muted-foreground">Best Practices</p>
                      </div>
                    </div>

                    {scanFindings.length > 0 && (
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Issues — click to see fix</p>
                          <p className="text-xs text-muted-foreground">{scanFindings.length} total</p>
                        </div>
                        <div className="divide-y divide-border">
                          {scanFindings.map((finding: any, idx: number) => {
                            const sev = finding.severity as string;
                            const sevColor =
                              sev === "CRITICAL" ? "text-red-500 bg-red-500/10 border-red-500/30" :
                              sev === "HIGH"     ? "text-orange-500 bg-orange-500/10 border-orange-500/30" :
                              sev === "MEDIUM"   ? "text-yellow-500 bg-yellow-500/10 border-yellow-500/30" :
                                                  "text-blue-400 bg-blue-400/10 border-blue-400/30";
                            const lineRef = finding.location
                              ? (() => { const p = (finding.location as string).split(":"); return p.length >= 2 ? `line ${p[p.length - 1]}` : null; })()
                              : null;
                            const isExpanded = expandedFindingId === (finding.id ?? String(idx));
                            const parsed = parseFixSuggestion(finding.aiSuggestion);
                            const isFixing = singleFixingId === finding.id;
                            return (
                              <div key={finding.id ?? idx} data-testid={`fix-issue-row-${idx}`}>
                                {/* Row header — clickable */}
                                <button
                                  onClick={() => setExpandedFindingId(isExpanded ? null : (finding.id ?? String(idx)))}
                                  className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                                  data-testid={`button-expand-issue-${idx}`}
                                >
                                  <span className={`mt-0.5 shrink-0 inline-block text-[9px] font-bold tracking-wide w-10 text-center py-0.5 rounded border ${sevColor}`}>
                                    {sev === "CRITICAL" ? "CRIT" : sev}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground leading-snug break-words">{finding.title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {finding.category}{lineRef ? ` · ${lineRef}` : ""}
                                    </p>
                                  </div>
                                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                                </button>

                                {/* Expanded detail panel */}
                                {isExpanded && (
                                  <div className="px-3 pb-3 space-y-3 bg-muted/20 border-t border-border">
                                    {/* Problem description */}
                                    {parsed.description && (
                                      <div className="pt-3">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">What&apos;s wrong</p>
                                        <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap font-mono bg-muted/40 rounded-md p-2">{parsed.description}</p>
                                      </div>
                                    )}

                                    {/* BEFORE / AFTER code blocks */}
                                    <div className="grid grid-cols-1 gap-2">
                                      {parsed.before && (
                                        <div>
                                          <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Before (vulnerable)</p>
                                          <pre className="bg-red-500/5 border border-red-500/20 rounded-md p-2 text-xs font-mono overflow-x-auto whitespace-pre text-foreground leading-relaxed">{parsed.before}</pre>
                                        </div>
                                      )}
                                      {parsed.after && (
                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <p className="text-xs font-semibold text-green-500 uppercase tracking-wide">After (fixed)</p>
                                            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(parsed.after!); toast({ title: "Fix copied", description: "Paste this into your code to fix the issue." }); }} data-testid={`button-copy-fix-${idx}`}>
                                              <Copy className="h-3 w-3 mr-1" />Copy Fix
                                            </Button>
                                          </div>
                                          <pre className="bg-green-500/5 border border-green-500/20 rounded-md p-2 text-xs font-mono overflow-x-auto whitespace-pre text-foreground leading-relaxed">{parsed.after}</pre>
                                        </div>
                                      )}
                                    </div>

                                    {/* Auto-fix button */}
                                    <Button
                                      size="sm"
                                      onClick={() => singleFixMutation.mutate({ scanId: selectedScan.id, findingId: finding.id })}
                                      disabled={isFixing || singleFixMutation.isPending}
                                      data-testid={`button-autofix-issue-${idx}`}
                                    >
                                      {isFixing ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <WrenchIcon className="h-3 w-3 mr-1.5" />}
                                      Auto-Fix This Issue
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-green-500">Free Per-Scan Fix Service</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Click each issue above to view the recommended fix and copy it, or use Apply All Fixes to auto-fix everything at once.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="gap-2 pt-2 border-t border-border">
                {showFixedOutput ? (
                  <Button variant="ghost" onClick={() => { setShowFixDialog(false); setShowFixedOutput(false); setFixedCodeData(null); }}>Close</Button>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => setShowFixDialog(false)}>Cancel</Button>
                    <Button
                      onClick={() => fixMutation.mutate(selectedScan.id)}
                      disabled={fixMutation.isPending}
                      data-testid="button-confirm-fix"
                    >
                      {fixMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Apply All Fixes
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </main>
  );
}
