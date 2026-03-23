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
import type { MvpCodeScan } from "@shared/schema";

const editScanSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  repositoryUrl: z.string().url("Must be a valid URL"),
  branch: z.string().min(1, "Branch is required"),
});

type EditScanFormData = z.infer<typeof editScanSchema>;

interface EditMvpScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scan: MvpCodeScan;
}

export function EditMvpScanDialog({ open, onOpenChange, scan }: EditMvpScanDialogProps) {
  const { toast } = useToast();

  const form = useForm<EditScanFormData>({
    resolver: zodResolver(editScanSchema),
    defaultValues: {
      projectName: scan.projectName,
      repositoryUrl: scan.repositoryUrl,
      branch: scan.branch,
    },
  });

  // Reset form when dialog opens or scan changes (preserves dirty tracking during editing)
  React.useEffect(() => {
    if (open) {
      form.reset({
        projectName: scan.projectName,
        repositoryUrl: scan.repositoryUrl,
        branch: scan.branch,
      }, { keepDirtyValues: false });
    }
  }, [open, scan.id]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<EditScanFormData>) => {
      const res = await apiRequest("PATCH", `/api/mvp-scans/${scan.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mvp-scans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mvp-scans", scan.id] });
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
    
    if (dirtyFields.projectName) {
      changedFields.projectName = data.projectName;
    }
    if (dirtyFields.repositoryUrl) {
      changedFields.repositoryUrl = data.repositoryUrl;
    }
    if (dirtyFields.branch) {
      changedFields.branch = data.branch;
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
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-edit-mvp-scan">
        <DialogHeader>
          <DialogTitle data-testid="heading-edit-scan">Edit Scan Configuration</DialogTitle>
          <DialogDescription data-testid="text-edit-scan-description">
            Update the scan settings. Note: Platform cannot be changed to preserve scan results.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="projectName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel data-testid="label-project-name">Project Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="My Security App"
                      data-testid="input-project-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="repositoryUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel data-testid="label-repository-url">Repository URL</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="url"
                      placeholder="https://github.com/username/repo"
                      data-testid="input-repository-url"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="branch"
              render={({ field }) => (
                <FormItem>
                  <FormLabel data-testid="label-branch">Branch</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="main"
                      data-testid="input-branch"
                    />
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
