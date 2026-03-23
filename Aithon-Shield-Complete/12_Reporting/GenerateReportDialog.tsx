import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { InsertReport, MvpCodeScan, MobileAppScan, WebAppScan } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";

const reportSchema = z.object({
  name: z.string().min(1, "Report name is required"),
  type: z.enum(["executive", "technical", "compliance"], {
    required_error: "Report type is required",
  }),
  scanIds: z.array(z.string()).min(1, "Select at least one scan"),
});

type ReportFormData = z.infer<typeof reportSchema>;

interface GenerateReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GenerateReportDialog({ open, onOpenChange }: GenerateReportDialogProps) {
  const { toast } = useToast();

  const { data: mvpScans = [] } = useQuery<MvpCodeScan[]>({
    queryKey: ["/api/mvp-scans"],
  });

  const { data: mobileScans = [] } = useQuery<MobileAppScan[]>({
    queryKey: ["/api/mobile-scans"],
  });

  const { data: webScans = [] } = useQuery<WebAppScan[]>({
    queryKey: ["/api/web-scans"],
  });

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      name: "",
      type: "executive",
      scanIds: [],
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: InsertReport) => {
      const res = await apiRequest("POST", "/api/reports", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({
        title: "Report Generated",
        description: "Your security report has been generated successfully",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate report",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ReportFormData) => {
    // Calculate findings from selected scans
    const allScans = [...mvpScans, ...mobileScans, ...webScans];
    const selectedScans = allScans.filter(scan => data.scanIds.includes(scan.id));
    
    const totalFindings = selectedScans.reduce((sum, scan) => sum + (scan.findingsCount || 0), 0);
    const criticalCount = selectedScans.reduce((sum, scan) => sum + (scan.criticalCount || 0), 0);
    const highCount = selectedScans.reduce((sum, scan) => sum + (scan.highCount || 0), 0);
    const mediumCount = selectedScans.reduce((sum, scan) => sum + (scan.mediumCount || 0), 0);
    const lowCount = selectedScans.reduce((sum, scan) => sum + (scan.lowCount || 0), 0);

    const reportData: InsertReport = {
      name: data.name,
      type: data.type,
      scanIds: data.scanIds,
      totalFindings,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      status: 'pending',
    };

    await generateMutation.mutateAsync(reportData);
  };

  // Get completed scans
  const completedScans = [
    ...mvpScans.filter(s => s.scanStatus === 'completed').map(s => ({
      id: s.id,
      name: s.projectName,
      type: 'MVP' as const,
      findings: s.findingsCount || 0,
    })),
    ...mobileScans.filter(s => s.scanStatus === 'completed').map(s => ({
      id: s.id,
      name: s.appName,
      type: 'Mobile' as const,
      findings: s.findingsCount || 0,
    })),
    ...webScans.filter(s => s.scanStatus === 'completed').map(s => ({
      id: s.id,
      name: s.appName,
      type: 'Web' as const,
      findings: s.findingsCount || 0,
    })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-generate-report">
        <DialogHeader>
          <DialogTitle>Generate Security Report</DialogTitle>
          <DialogDescription>
            Create a comprehensive security report from your completed scans
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Report Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Q4 2024 Security Summary"
                      {...field}
                      data-testid="input-report-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Report Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-report-type">
                        <SelectValue placeholder="Select report type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="executive">Executive Summary</SelectItem>
                      <SelectItem value="technical">Technical Report</SelectItem>
                      <SelectItem value="compliance">Compliance Report</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scanIds"
              render={() => (
                <FormItem>
                  <FormLabel>Select Scans to Include</FormLabel>
                  {completedScans.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No completed scans available. Please complete at least one scan first.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-4">
                      {completedScans.map((scan) => (
                        <FormField
                          key={scan.id}
                          control={form.control}
                          name="scanIds"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(scan.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, scan.id])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== scan.id
                                          )
                                        );
                                  }}
                                  data-testid={`checkbox-scan-${scan.id}`}
                                />
                              </FormControl>
                              <div className="flex-1">
                                <Label className="font-normal cursor-pointer">
                                  {scan.name}
                                  <span className="text-muted-foreground ml-2">
                                    ({scan.type} - {scan.findings} findings)
                                  </span>
                                </Label>
                              </div>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-report"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={generateMutation.isPending || completedScans.length === 0}
                data-testid="button-submit-report"
              >
                {generateMutation.isPending ? "Generating..." : "Generate Report"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
