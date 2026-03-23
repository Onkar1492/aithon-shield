import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import SsoConfiguration from "@/components/SsoConfiguration";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { profileSettingsFormSchema, type User } from "@shared/schema";
import {
  requestNotificationPermission as requestPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getNotificationPermission,
} from "@/lib/pushNotifications";

type ProfileFormData = z.infer<typeof profileSettingsFormSchema>;

export default function Settings() {
  const { toast } = useToast();
  const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission());

  // Update notification permission when it changes
  useEffect(() => {
    const updatePermission = () => {
      setNotificationPermission(getNotificationPermission());
    };
    
    // Listen for permission changes
    const interval = setInterval(updatePermission, 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: userData, isLoading: isLoadingUser } = useQuery<{ user: User }>({
    queryKey: ['/api/auth/me'],
  });

  const user = userData?.user;

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSettingsFormSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      password: "",
    },
    values: user ? {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: "",
    } : undefined,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const payload: any = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
      };
      if (data.password && data.password.length > 0) {
        payload.password = data.password;
      }
      const response = await apiRequest('PATCH', '/api/user/profile', payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      profileForm.setValue('password', '');
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      const response = await apiRequest('PATCH', '/api/user/notifications', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: "Notification preferences updated",
        description: "Your notification preferences have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onProfileSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const handleNotificationToggle = (key: keyof User, value: boolean) => {
    updateNotificationsMutation.mutate({ [key]: value });
  };

  const requestNotificationPermission = async () => {
    try {
      const permission = await requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        // Subscribe to push notifications
        const subscription = await subscribeToPushNotifications();
        
        if (subscription) {
          toast({
            title: "Notifications enabled",
            description: "You will now receive push notifications about your scans.",
          });
        } else {
          toast({
            title: "Subscription failed",
            description: "Failed to subscribe to push notifications. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Notifications blocked",
          description: "Please enable notifications in your browser settings.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      toast({
        title: "Error",
        description: "Failed to enable notifications. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-settings-title">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your security platform configuration
        </p>
      </div>

      {/* User Profile Section */}
      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">User Profile</h2>
        {isLoadingUser ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" data-testid="skeleton-profile-loading" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={profileForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-first-name"
                          disabled={updateProfileMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-last-name"
                          disabled={updateProfileMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={profileForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        data-testid="input-email"
                        disabled={updateProfileMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password (leave blank to keep current)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="••••••••"
                        data-testid="input-password"
                        disabled={updateProfileMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </form>
          </Form>
        )}
      </Card>

      {/* Push Notification Section */}
      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Push Notifications</h2>
        {isLoadingUser ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" data-testid="skeleton-notifications-loading" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {notificationPermission !== 'granted' && (
              <div className="p-4 shadow-sm rounded-lg flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-sm">Browser Notifications Not Enabled</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click the button to enable push notifications in your browser
                  </p>
                </div>
                <Button
                  onClick={requestNotificationPermission}
                  variant="outline"
                  data-testid="button-request-permission"
                >
                  Request Permission
                </Button>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="push-enabled" className="text-base">Enable Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications about your scans and security findings
                </p>
              </div>
              <Switch
                id="push-enabled"
                checked={user?.pushNotificationsEnabled ?? true}
                onCheckedChange={(checked) => handleNotificationToggle('pushNotificationsEnabled', checked)}
                disabled={updateNotificationsMutation.isPending}
                data-testid="switch-push-enabled"
              />
            </div>
            
            {user?.pushNotificationsEnabled && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notify-scan-complete" className="text-sm font-normal">Scan Complete Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Get notified when a scan finishes
                      </p>
                    </div>
                    <Switch
                      id="notify-scan-complete"
                      checked={user?.notifyOnScanComplete ?? true}
                      onCheckedChange={(checked) => handleNotificationToggle('notifyOnScanComplete', checked)}
                      disabled={updateNotificationsMutation.isPending}
                      data-testid="switch-notify-scan-complete"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notify-fixes-applied" className="text-sm font-normal">Fixes Applied Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Get notified when fixes are successfully applied
                      </p>
                    </div>
                    <Switch
                      id="notify-fixes-applied"
                      checked={user?.notifyOnFixesApplied ?? true}
                      onCheckedChange={(checked) => handleNotificationToggle('notifyOnFixesApplied', checked)}
                      disabled={updateNotificationsMutation.isPending}
                      data-testid="switch-notify-fixes-applied"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notify-upload" className="text-sm font-normal">Upload/Re-upload Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Get notified about upload progress and completion
                      </p>
                    </div>
                    <Switch
                      id="notify-upload"
                      checked={user?.notifyOnUpload ?? true}
                      onCheckedChange={(checked) => handleNotificationToggle('notifyOnUpload', checked)}
                      disabled={updateNotificationsMutation.isPending}
                      data-testid="switch-notify-upload"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">General Settings</h2>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              defaultValue="Acme Corporation"
              data-testid="input-org-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Contact Email</Label>
            <Input
              id="contact-email"
              type="email"
              defaultValue="security@acme.com"
              data-testid="input-contact-email"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Subscription Tier</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 shadow-sm rounded-lg">
              <div className="mb-3">
                <h3 className="font-semibold">Free</h3>
                <p className="text-2xl font-bold mt-1">$0<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                <li>• 5 scans/month</li>
                <li>• Basic findings</li>
                <li>• Community support</li>
              </ul>
              <Button variant="outline" className="w-full" disabled data-testid="button-tier-free">Current Plan</Button>
            </div>
            <div className="p-4 border-2 border-primary rounded-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge>Recommended</Badge>
              </div>
              <div className="mb-3">
                <h3 className="font-semibold">Pro</h3>
                <p className="text-2xl font-bold mt-1">$99<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                <li>• Unlimited scans</li>
                <li>• AI remediation</li>
                <li>• Priority support</li>
              </ul>
              <Button className="w-full" data-testid="button-tier-pro">Upgrade to Pro</Button>
            </div>
            <div className="p-4 shadow-sm rounded-lg">
              <div className="mb-3">
                <h3 className="font-semibold">Enterprise</h3>
                <p className="text-2xl font-bold mt-1">Custom</p>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                <li>• Everything in Pro</li>
                <li>• SSO & RBAC</li>
                <li>• Dedicated support</li>
              </ul>
              <Button variant="outline" className="w-full" data-testid="button-tier-enterprise">Contact Sales</Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Scan Configuration</h2>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-scan on Push</Label>
              <p className="text-sm text-muted-foreground">
                Automatically trigger scans when code is pushed
              </p>
            </div>
            <Switch defaultChecked data-testid="switch-auto-scan" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive email alerts for critical findings
              </p>
            </div>
            <Switch defaultChecked data-testid="switch-email-notifications" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Block Deployments</Label>
              <p className="text-sm text-muted-foreground">
                Block deployments when critical issues are found
              </p>
            </div>
            <Switch data-testid="switch-block-deployments" />
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Alert Notifications</h2>
        <div className="space-y-6">
          <div>
            <Label className="mb-3 block">Alert Channels</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 shadow-sm rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">📧</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Email</p>
                    <p className="text-xs text-muted-foreground">security@acme.com</p>
                  </div>
                </div>
                <Switch defaultChecked data-testid="switch-email-alerts" />
              </div>
              <div className="flex items-center justify-between p-3 shadow-sm rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">💬</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Slack</p>
                    <p className="text-xs text-muted-foreground">#security-alerts</p>
                  </div>
                </div>
                <Switch defaultChecked data-testid="switch-slack-alerts" />
              </div>
              <div className="flex items-center justify-between p-3 shadow-sm rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">📱</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">SMS</p>
                    <p className="text-xs text-muted-foreground">+1 (555) 123-4567</p>
                  </div>
                </div>
                <Switch data-testid="switch-sms-alerts" />
              </div>
              <div className="flex items-center justify-between p-3 shadow-sm rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">🔔</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Microsoft Teams</p>
                    <p className="text-xs text-muted-foreground">Security Team</p>
                  </div>
                </div>
                <Switch data-testid="switch-teams-alerts" />
              </div>
            </div>
          </div>
          <Separator />
          <div>
            <Label className="mb-3 block">Alert Thresholds</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Critical Findings</Label>
                <Switch defaultChecked data-testid="switch-critical-alerts" />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">High Findings</Label>
                <Switch defaultChecked data-testid="switch-high-alerts" />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Medium Findings</Label>
                <Switch data-testid="switch-medium-alerts" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Integrations</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 shadow-sm rounded-lg">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="font-semibold text-primary">GH</span>
              </div>
              <div>
                <p className="font-medium">GitHub</p>
                <p className="text-sm text-muted-foreground">Connected</p>
              </div>
            </div>
            <Button variant="outline" data-testid="button-configure-github">
              Configure
            </Button>
          </div>
          <div className="flex items-center justify-between p-4 shadow-sm rounded-lg">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="font-semibold text-primary">JR</span>
              </div>
              <div>
                <p className="font-medium">Jira</p>
                <p className="text-sm text-muted-foreground">Not connected</p>
              </div>
            </div>
            <Button data-testid="button-connect-jira">Connect</Button>
          </div>
        </div>
      </Card>

      <SsoConfiguration />

      <div className="flex justify-end">
        <Button data-testid="button-save-settings">Save Changes</Button>
      </div>
    </div>
  );
}
