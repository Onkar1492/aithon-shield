import { FixScopeDialog } from "./FixScopeDialog";

interface LinterFixScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  findingTitle: string;
  totalFindings: number;
  onFixSingle: () => void;
  onFixAll: () => void;
}

export function LinterFixScopeDialog(props: LinterFixScopeDialogProps) {
  return <FixScopeDialog {...props} scanTypeName="Linter Scan" />;
}
