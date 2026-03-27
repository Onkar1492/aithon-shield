import { useEffect, useRef } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationCenter } from "@/components/NotificationCenter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useScanNotifications } from "@/hooks/useScanNotifications";
import { MobileNav } from "@/components/MobileNav";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { TermsOfServiceDialog } from "@/components/TermsOfServiceDialog";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, ArrowLeft } from "lucide-react";
import { MinimizedDialogProvider } from "@/contexts/MinimizedDialogContext";
import { MinimizedDialogBar } from "@/components/MinimizedDialogBar";
import Dashboard from "@/pages/Dashboard";
import AllScans from "@/pages/AllScans";
import MobileAppScan from "@/pages/MobileAppScan";
import MvpCodeScan from "@/pages/MvpCodeScan";
import MvpPreview from "@/pages/MvpPreview";
import WebAppScan from "@/pages/WebAppScan";
import Findings from "@/pages/Findings";
import Archive from "@/pages/Archive";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Learn from "@/pages/Learn";
import Workspace from "@/pages/Workspace";
import InviteAccept from "@/pages/InviteAccept";
import SecurityHealth from "@/pages/SecurityHealth";
import DeveloperScoreCards from "@/pages/DeveloperScoreCards";
import ScheduledScansPage from "@/pages/ScheduledScans";
import CveWatchlistPage from "@/pages/CveWatchlist";
import SlaPage from "@/pages/Sla";
import RiskExceptionsPage from "@/pages/RiskExceptions";
import AttackSimulator from "@/pages/AttackSimulator";
import ScanDetails from "@/pages/ScanDetails";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import AccessibilityStatement from "@/pages/AccessibilityStatement";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import CookiePolicy from "@/pages/CookiePolicy";
import LinterScan from "@/pages/LinterScan";
import ReposDashboard from "@/pages/ReposDashboard";
import DependencyUpgradePlan from "@/pages/DependencyUpgradePlan";
import SecretsRotationPage from "@/pages/SecretsRotation";
import PlansPage from "@/pages/Plans";
import NotFound from "@/pages/not-found";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { SecurityOnboardingWizard } from "@/components/SecurityOnboardingWizard";
import { ShieldAdvisorDock } from "@/components/SecurityChatbot";

function Router() {
  useScanNotifications();
  
  return (
    <>
      <TermsOfServiceDialog />
      <SecurityOnboardingWizard />
      <RouteAnnouncer />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/scans" component={AllScans} />
        <Route path="/scan-details/:type/:id" component={ScanDetails} />
        <Route path="/mobile-app-scan" component={MobileAppScan} />
        <Route path="/mobile-scans" component={MobileAppScan} />
        <Route path="/mobile-scans/:id" component={MobileAppScan} />
        <Route path="/mvp-code-scan" component={MvpCodeScan} />
        <Route path="/mvp-scans" component={MvpCodeScan} />
        <Route path="/mvp-scans/:id" component={MvpCodeScan} />
        <Route path="/scans/mvp/:id/upgrade-plan" component={DependencyUpgradePlan} />
        <Route path="/web-app-scan" component={WebAppScan} />
        <Route path="/web-scans" component={WebAppScan} />
        <Route path="/web-scans/:id" component={WebAppScan} />
        <Route path="/linter-scan" component={LinterScan} />
        <Route path="/linter-scans" component={LinterScan} />
        <Route path="/linter-scans/:id" component={LinterScan} />
        <Route path="/findings" component={Findings} />
        <Route path="/security-health" component={SecurityHealth} />
        <Route path="/developer-score-cards" component={DeveloperScoreCards} />
        <Route path="/scheduled-scans" component={ScheduledScansPage} />
        <Route path="/cve-watchlist" component={CveWatchlistPage} />
        <Route path="/sla" component={SlaPage} />
        <Route path="/risk-exceptions" component={RiskExceptionsPage} />
        <Route path="/secrets-rotation" component={SecretsRotationPage} />
        <Route path="/plans" component={PlansPage} />
        <Route path="/archive" component={Archive} />
        <Route path="/reports" component={Reports} />
        <Route path="/attack-simulator" component={AttackSimulator} />
        <Route path="/learn" component={Learn} />
        <Route path="/workspace" component={Workspace} />
        <Route path="/repos" component={ReposDashboard} />
        <Route path="/settings" component={Settings} />
        <Route path="/accessibility" component={AccessibilityStatement} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/cookies" component={CookiePolicy} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/preview/:scanId" component={MvpPreview} />
    </Switch>
  );
}

function PublicPageLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <header role="banner" className="flex items-center justify-between px-6 py-4 border-b">
        <Button variant="ghost" onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/login")} aria-label="Go back" data-testid="button-public-back">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back
        </Button>
        <ThemeToggle />
      </header>
      <main id="main-content" role="main" aria-label="Main content" className="container mx-auto p-8 max-w-4xl" tabIndex={-1}>
        {children}
      </main>
      <footer role="contentinfo" className="border-t py-4 text-center text-xs text-muted-foreground">
        <nav aria-label="Legal navigation" className="flex items-center justify-center gap-3 flex-wrap">
          <a href="/privacy" className="hover:underline hover:text-foreground transition-colors">Privacy Policy</a>
          <span aria-hidden="true">&middot;</span>
          <a href="/cookies" className="hover:underline hover:text-foreground transition-colors">Cookie Policy</a>
          <span aria-hidden="true">&middot;</span>
          <a href="/accessibility" className="hover:underline hover:text-foreground transition-colors">Accessibility</a>
        </nav>
      </footer>
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="route-announcer" />
    </div>
  );
}

function RouteAnnouncer() {
  const [location] = useLocation();
  const prevLocation = useRef(location);

  useEffect(() => {
    if (prevLocation.current !== location) {
      prevLocation.current = location;
      const announcer = document.getElementById("route-announcer");
      if (announcer) {
        const pageTitle = document.title || "Page";
        announcer.textContent = `Navigated to ${pageTitle}`;
      }
    }
  }, [location]);

  return null;
}

function UserProfile() {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      // Clear ALL React Query cache to prevent data leakage between users
      queryClient.clear();
      toast({
        title: "Logged out",
        description: "You've been successfully logged out.",
      });
      setLocation("/login");
    },
  });

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground" data-testid="text-user-name">
        {user.firstName} {user.lastName}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
        data-testid="button-logout"
      >
        {logoutMutation.isPending ? "Logging out..." : "Logout"}
      </Button>
    </div>
  );
}

function AppLayout() {
  const isMobile = useIsMobile();
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen w-full">
        <a href="#main-content" className="skip-to-content" data-testid="link-skip-navigation">
          Skip to main content
        </a>
        <DemoModeBanner />
        <MobileHeader />
        <main id="main-content" role="main" aria-label="Main content" className="flex-1 overflow-auto pb-16" tabIndex={-1}>
          <div className="p-4">
            <Router />
          </div>
        </main>
        <MobileNav />
        <ShieldAdvisorDock />
        <MinimizedDialogBar />
        <div aria-live="polite" aria-atomic="true" className="sr-only" id="route-announcer" data-testid="route-announcer" />
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true} style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <a href="#main-content" className="skip-to-content" data-testid="link-skip-navigation">
          Skip to main content
        </a>
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <DemoModeBanner />
          <header role="banner" aria-label="Application header" className="flex items-center justify-between px-6 py-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" aria-label="Toggle sidebar navigation" />
            <div className="flex items-center gap-4">
              <NotificationCenter />
              <UserProfile />
              <ThemeToggle />
            </div>
          </header>
          <main id="main-content" role="main" aria-label="Main content" className="flex-1 overflow-auto" tabIndex={-1}>
            <div className="container mx-auto p-8 max-w-7xl">
              <Router />
            </div>
          </main>
        </div>
        <MinimizedDialogBar />
        <ShieldAdvisorDock />
        <div aria-live="polite" aria-atomic="true" className="sr-only" id="route-announcer" data-testid="route-announcer" />
      </div>
    </SidebarProvider>
  );
}

function AuthCheck({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated and not on login/signup page, redirect to login
  if (!isAuthenticated && location !== "/login" && location !== "/signup" && !location.startsWith("/invite/")) {
    return <Login />;
  }

  // If authenticated and on login/signup page, redirect to dashboard
  if (isAuthenticated && (location === "/login" || location === "/signup")) {
    return <AppLayout />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider defaultTheme="dark">
          <MinimizedDialogProvider>
            <Switch>
              <Route path="/preview/:scanId">
                <PublicRouter />
                <Toaster />
              </Route>
              <Route path="/accessibility">
                <PublicPageLayout>
                  <AccessibilityStatement />
                </PublicPageLayout>
                <Toaster />
              </Route>
              <Route path="/privacy">
                <PublicPageLayout>
                  <PrivacyPolicy />
                </PublicPageLayout>
                <Toaster />
              </Route>
              <Route path="/cookies">
                <PublicPageLayout>
                  <CookiePolicy />
                </PublicPageLayout>
                <Toaster />
              </Route>
              <Route path="/login">
                <AuthCheck>
                  <Login />
                </AuthCheck>
                <Toaster />
              </Route>
              <Route path="/signup">
                <AuthCheck>
                  <Signup />
                </AuthCheck>
                <Toaster />
              </Route>
              <Route path="/invite/:token">
                <AuthCheck>
                  <InviteAccept />
                </AuthCheck>
                <Toaster />
              </Route>
              <Route>
                <AuthCheck>
                  <AppLayout />
                </AuthCheck>
                <Toaster />
              </Route>
            </Switch>
            <div aria-live="assertive" aria-atomic="true" className="sr-only" id="global-announcer" />
          </MinimizedDialogProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
