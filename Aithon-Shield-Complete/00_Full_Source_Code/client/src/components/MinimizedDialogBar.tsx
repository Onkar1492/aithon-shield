import { useMinimizedDialogs } from '@/contexts/MinimizedDialogContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Maximize2, X, Zap, CheckCircle } from 'lucide-react';

export function MinimizedDialogBar() {
  const { minimizedDialogs, restoreDialog, removeMinimizedDialog } = useMinimizedDialogs();

  if (minimizedDialogs.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'global-fix':
        return Zap;
      case 'post-fix-validation':
        return CheckCircle;
      default:
        return Maximize2;
    }
  };

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 p-4 flex gap-3 bg-background/95 backdrop-blur-sm border-t"
      data-testid="minimized-dialog-bar"
    >
      <div className="flex gap-3 flex-wrap max-w-7xl mx-auto w-full">
        {minimizedDialogs.map(dialog => {
          const Icon = getIcon(dialog.type);
          return (
            <Card
              key={dialog.id}
              className="flex items-center gap-3 px-4 py-2 hover-elevate cursor-pointer"
              data-testid={`minimized-dialog-${dialog.id}`}
            >
              <Icon className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{dialog.title}</span>
              {dialog.blockedWorkflow && (
                <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                  Blocking workflow
                </span>
              )}
              <div className="flex gap-1 ml-auto">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => restoreDialog(dialog.id)}
                  data-testid={`button-restore-${dialog.id}`}
                  className="h-7 w-7"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeMinimizedDialog(dialog.id)}
                  data-testid={`button-close-minimized-${dialog.id}`}
                  className="h-7 w-7"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
