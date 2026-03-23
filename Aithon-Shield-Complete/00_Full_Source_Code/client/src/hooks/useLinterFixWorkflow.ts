import { useFixWorkflow } from "./useFixWorkflow";

export function useLinterFixWorkflow(scanId: string) {
  return useFixWorkflow('linter', scanId);
}
