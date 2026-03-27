import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MobileAppScan } from "@shared/schema";

const editScanSchema = z.object({
  appName: z.string().min(1, "App name is required"),
  appId: z.string().min(1, "App ID is required"),
  version: z.string().min(1, "Version is required"),
});

type EditScanFormData = z.infer<typeof editScanSchema>;

interface EditMobileAppScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scan: MobileAppScan;
}

function readWorkflowMeta(scan: MobileAppScan) {
  const m = scan.workflowMetadata;
  if (!m || typeof m !== "object") return { realDeviceDast: false, backendApiUrl: "" };
  const o = m as Record<string, unknown>;
  return {
    realDeviceDast: o.realDeviceDast === true,
    backendApiUrl: typeof o.backendApiUrl === "string" ? o.backendApiUrl : "",
  };
}

export function EditMobileAppScanDialog({ open, onOpenChange, scan }: EditMobileAppScanDialogProps) {
  const { toast } = useToast();

  const [realDeviceDast, setRealDeviceDast] = React.useState(false);
  const [backendApiUrl, setBackendApiUrl] = React.useState("");
  const initialAdvanced = React.useRef({ realDeviceDast: false, backendApiUrl: "" });

  const form = useForm<EditScanFormData>({
    resolver: zodResolver(editScanSchema),
    defaultValues: {
      appName: scan.appName,
      appId: scan.appId,
      version: scan.version,
    },
  });

  // Reset form when dialog opens or scan changes (preserves dirty tracking during editing)
  React.useEffect(() => {
    if (open) {
      form.reset(
        {
          appName: scan.appName,
          appId: scan.appId,
          version: scan.version,
        },
        { keepDirtyValues: false },
      );
      const adv = readWorkflowMeta(scan);
      setRealDeviceDast(adv.realDeviceDast);
      setBackendApiUrl(adv.backendApiUrl);
      initialAdvanced.current = { ...adv };
    }
  }, [open, scan.id]);

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/mobile-scans/${scan.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-scans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-scans", scan.id] });
      toast({
        title: "Scan updated",
        description: "Your scan configuration has been updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update scan configuration",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: EditScanFormData) => {
    const dirtyFields = form.formState.dirtyFields;
    const changedFields: Record<string, unknown> = {};

    if (dirtyFields.appName) changedFields.appName = data.appName;
    if (dirtyFields.appId) changedFields.appId = data.appId;
    if (dirtyFields.version) changedFields.version = data.version;

    const advChanged =
      realDeviceDast !== initialAdvanced.current.realDeviceDast ||
      backendApiUrl.trim() !== initialAdvanced.current.backendApiUrl.trim();

    if (advChanged) {
      const prev =
        scan.workflowMetadata && typeof scan.workflowMetadata === "object"
          ? ({ ...scan.workflowMetadata } as Record<string, unknown>)
          : {};
      const next: Record<string, unknown> = { ...prev, realDeviceDast };
      const trimmed = backendApiUrl.trim();
      if (trimmed) next.backendApiUrl = trimmed;
      else delete next.backendApiUrl;
      changedFields.workflowMetadata = next;
    }

    if (Object.keys(changedFields).length > 0) {
      updateMutation.mutate(changedFields);
    } else {
      toast({
        title: "No changes",
        description: "No fields were modified",
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-edit-mobile-scan">
        <DialogHeader>
          <DialogTitle data-testid="heading-edit-scan">Edit Scan Configuration</DialogTitle>
          <DialogDescription data-testid="text-edit-scan-description">
            Update the scan settings. Platform cannot be changed to preserve scan results. Optional real-device DAST runs
            after the static/mobile analysis when you start a new scan.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="appName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel data-testid="label-app-name">App Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="My Mobile App" data-testid="input-app-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="appId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel data-testid="label-app-id">App ID</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="com.example.app" data-testid="input-app-id" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="version"
              render={({ field }) => (
                <FormItem>
                  <FormLabel data-testid="label-version">Version</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="1.0.0" data-testid="input-version" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-sm text-muted-foreground">
              <span className="font-medium">Platform:</span>
              <span className="capitalize">{scan.platform}</span>
              <span className="text-xs">(cannot be changed)</span>
            </div>

            <div className="rounded-md border border-border/80 p-4 space-y-4">
              <div>
                <h4 className="text-sm font-medium">Real-device DAST (P6-C9)</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Adds lightweight API probes on the next scan run. Provide your backend base URL if the app talks to a
                  specific API host.
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <FormLabel htmlFor="real-device-dast" className="cursor-pointer">
                  Enable real-device style DAST pass
                </FormLabel>
                <Switch
                  id="real-device-dast"
                  checked={realDeviceDast}
                  onCheckedChange={setRealDeviceDast}
                  data-testid="switch-real-device-dast"
                />
              </div>
              <div className="space-y-2">
                <FormLabel htmlFor="backend-api-url">Backend API base URL (optional)</FormLabel>
                <Input
                  id="backend-api-url"
                  placeholder="https://api.example.com"
                  value={backendApiUrl}
                  onChange={(e) => setBackendApiUrl(e.target.value)}
                  data-testid="input-backend-api-url"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit">
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-changes">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
