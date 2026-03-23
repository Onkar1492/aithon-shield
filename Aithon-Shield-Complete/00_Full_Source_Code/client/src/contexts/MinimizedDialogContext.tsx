import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type MinimizedDialog = {
  id: string;
  title: string;
  type: 'global-fix' | 'post-fix-validation';
  blockedWorkflow?: string; // workflow that's blocked while this dialog is minimized
  scanId?: string; // for scan-specific blocking
  onRestore: () => void;
  onClose?: () => void; // called when user dismisses minimized dialog
};

type MinimizedDialogContextType = {
  minimizedDialogs: MinimizedDialog[];
  addMinimizedDialog: (dialog: MinimizedDialog) => void;
  removeMinimizedDialog: (id: string) => void;
  restoreDialog: (id: string) => void;
  isWorkflowBlocked: (workflow: string, scanId?: string) => boolean;
};

const MinimizedDialogContext = createContext<MinimizedDialogContextType | undefined>(undefined);

export function MinimizedDialogProvider({ children }: { children: ReactNode }) {
  const [minimizedDialogs, setMinimizedDialogs] = useState<MinimizedDialog[]>([]);

  const addMinimizedDialog = useCallback((dialog: MinimizedDialog) => {
    setMinimizedDialogs(prev => {
      const exists = prev.find(d => d.id === dialog.id);
      if (exists) return prev;
      return [...prev, dialog];
    });
  }, []);

  const removeMinimizedDialog = useCallback((id: string) => {
    setMinimizedDialogs(prev => {
      const dialog = prev.find(d => d.id === id);
      
      // If dialog doesn't exist, return same array reference to prevent re-renders
      if (!dialog) {
        return prev;
      }
      
      // Call onClose callback before removing
      if (dialog.onClose) {
        dialog.onClose();
      }
      
      // Only create new array if we actually removed something
      return prev.filter(d => d.id !== id);
    });
  }, []);

  const restoreDialog = useCallback((id: string) => {
    setMinimizedDialogs(prev => {
      const dialog = prev.find(d => d.id === id);
      if (dialog) {
        dialog.onRestore();
        return prev.filter(d => d.id !== id);
      }
      return prev;
    });
  }, []);

  const isWorkflowBlocked = useCallback((workflow: string, scanId?: string) => {
    return minimizedDialogs.some(dialog => {
      if (!dialog.blockedWorkflow) return false;
      if (dialog.blockedWorkflow !== workflow) return false;
      if (dialog.scanId && scanId && dialog.scanId !== scanId) return false;
      return true;
    });
  }, [minimizedDialogs]);

  return (
    <MinimizedDialogContext.Provider
      value={{
        minimizedDialogs,
        addMinimizedDialog,
        removeMinimizedDialog,
        restoreDialog,
        isWorkflowBlocked,
      }}
    >
      {children}
    </MinimizedDialogContext.Provider>
  );
}

export function useMinimizedDialogs() {
  const context = useContext(MinimizedDialogContext);
  if (!context) {
    throw new Error('useMinimizedDialogs must be used within MinimizedDialogProvider');
  }
  return context;
}
