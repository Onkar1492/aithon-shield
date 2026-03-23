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
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { WebAppScan } from "@shared/schema";

const editScanSchema = z.object({
  appName: z.string().min(1, "App name is required"),
  appUrl: z.string().url("Must be a valid URL"),
});

type EditScanFormData = z.infer<typeof editScanSchema>;

interface EditWebAppScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scan: WebAppScan;
}

export function EditWebAppScanDialog({ open, onOpenChange, scan }: EditWebAppScanDialogProps) {
  const { toast } = useToast();

  const form = useForm<EditScanFormData>({
    resolver: zodResolver(editScanSchema),
    defaultValues: {
      appName: scan.appName,
      appUrl: scan.appUrl,
    },
  });

  // Reset form when dialog opens or scan changes (preserves dirty tracking during editing)
  React.useEffect(() => {
    if (open) {
      form.reset({
        appName: scan.appName,
        appUrl: scan.appUrl,
      }, { keepDirtyValues: false });
    }
  }, [open, scan.id]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<EditScanFormData>) => {
      const res = await apiRequest("PATCH", `/api/web-scans/${scan.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/web-scans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/web-scans", scan.id] });
      toast({
        title: "Scan updated",
        description: "Your scan configuration has been updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update scan configuration",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: EditScanFormData) => {
    // Only send changed fields (true PATCH semantics) using react-hook-form's dirty tracking
    const dirtyFields = form.formState.dirtyFields;
    const changedFields: Partial<EditScanFormData> = {};
    
    if (dirtyFields.appName) {
      changedFields.appName = data.appName;
    }
    if (dirtyFields.appUrl) {
      changedFields.appUrl = data.appUrl;
    }

    // Only mutate if there are actual changes
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
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-edit-web-scan">
        <DialogHeader>
          <DialogTitle data-testid="heading-edit-scan">Edit Scan Configuration</DialogTitle>
          <DialogDescription data-testid="text-edit-scan-description">
            Update the scan settings. Note: Hosting platform cannot be changed to preserve scan results.
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
                    <Input
                      {...field}
                      placeholder="My Web App"
                      data-testid="input-app-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="appUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel data-testid="label-app-url">App URL</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="url"
                      placeholder="https://example.com"
                      data-testid="input-app-url"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-sm text-muted-foreground">
              <span className="font-medium">Hosting Platform:</span>
              <span className="capitalize">{scan.hostingPlatform}</span>
              <span className="text-xs">(cannot be changed)</span>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid="button-save-changes"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
