import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Shield,
  LayoutDashboard,
  ScanSearch,
  Smartphone,
  Code,
  Globe,
  FileText,
  Activity,
  Award,
  GitBranch,
  Settings,
  CheckCircle2,
  Zap,
  BookOpen,
  ScrollText,
  Archive,
  Accessibility,
  Lock,
  Cookie,
  FileCode2,
  Building2,
  CalendarClock,
  Radar,
  Timer,
  Scale,
  FolderGit2,
  KeyRound,
  CreditCard,
} from "lucide-react";
import { useLocation } from "wouter";
import logoImage from "@assets/image_1761361808622.png";

const coreItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/" },
  { title: "Workspace", icon: Building2, path: "/workspace" },
  { title: "Repos & Environments", icon: FolderGit2, path: "/repos" },
  { title: "All Scans", icon: ScanSearch, path: "/scans" },
  { title: "MVP Scan", icon: Code, path: "/mvp-code-scan" },
  { title: "Mobile App Scan", icon: Smartphone, path: "/mobile-app-scan" },
  { title: "Web App Scan", icon: Globe, path: "/web-app-scan" },
  { title: "Findings", icon: Shield, path: "/findings" },
  { title: "Archive", icon: Archive, path: "/archive" },
  { title: "Reports", icon: FileText, path: "/reports" },
  { title: "Security Health", icon: Activity, path: "/security-health" },
  { title: "Developer score cards", icon: Award, path: "/developer-score-cards" },
  { title: "Attack path graph", icon: GitBranch, path: "/attack-path" },
  { title: "Scheduled Scans", icon: CalendarClock, path: "/scheduled-scans" },
  { title: "CVE Watchlist", icon: Radar, path: "/cve-watchlist" },
  { title: "SLA", icon: Timer, path: "/sla" },
  { title: "Risk exceptions", icon: Scale, path: "/risk-exceptions" },
  { title: "Secrets Rotation", icon: KeyRound, path: "/secrets-rotation" },
  /** Keep with SLA / risk so governance is visible without scrolling past Core. */
  { title: "Compliance", icon: CheckCircle2, path: "/compliance" },
];

const additionalServicesItems = [
  { title: "Code Linter Scan", icon: FileCode2, path: "/linter-scan" },
];

const analysisItems = [{ title: "Attack Simulator", icon: Zap, path: "/attack-simulator" }];

const resourceItems = [
  { title: "Plans & Pricing", icon: CreditCard, path: "/plans" },
  { title: "Learning Hub", icon: BookOpen, path: "/learn" },
  { title: "Audit Log", icon: ScrollText, path: "/audit-log" },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar aria-label="Main navigation">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-2">
          <img
            src={logoImage}
            alt="Aithon Shield Logo"
            className="h-8 w-8 object-contain"
          />
          <div>
            <h2 className="font-bold text-base">Aithon Shield</h2>
            <p className="text-xs text-muted-foreground">Security Platform</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pb-4 mb-4">
          <SidebarGroupLabel>Core</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {coreItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.path}
                    data-testid={`sidebar-${item.title.toLowerCase().replace(/ /g, '-')}`}
                  >
                    <a href={item.path}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="pb-4 mb-4">
          <SidebarGroupLabel>Additional Services</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {additionalServicesItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.path || location === "/linter-scans" || location.startsWith("/linter-scans/")}
                    data-testid={`sidebar-${item.title.toLowerCase().replace(/ /g, '-')}`}
                  >
                    <a href={item.path}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="pb-4 mb-4">
          <SidebarGroupLabel>Analysis</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analysisItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.path}
                    data-testid={`sidebar-${item.title.toLowerCase().replace(/ /g, '-')}`}
                  >
                    <a href={item.path}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="pb-4 mb-4">
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {resourceItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.path}
                    data-testid={`sidebar-${item.title.toLowerCase().replace(/ /g, '-')}`}
                  >
                    <a href={item.path}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/settings"}
              data-testid="sidebar-settings"
            >
              <a href="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mt-3 pt-3 border-t">
          <nav aria-label="Legal pages" className="flex flex-col gap-1">
            <a href="/accessibility" className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 flex items-center gap-2" data-testid="sidebar-accessibility">
              <Accessibility className="h-3 w-3" aria-hidden="true" />
              Accessibility
            </a>
            <a href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 flex items-center gap-2" data-testid="sidebar-privacy">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Privacy Policy
            </a>
            <a href="/cookies" className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 flex items-center gap-2" data-testid="sidebar-cookies">
              <Cookie className="h-3 w-3" aria-hidden="true" />
              Cookie Policy
            </a>
          </nav>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
