import { Shield, Search, Lock, Bug, Wifi, Database, Code, Globe, Smartphone } from "lucide-react";

interface ScanningAnimationProps {
  type?: "security" | "code" | "mobile" | "web" | "network";
  size?: "sm" | "md" | "lg";
  status?: "scanning" | "completed" | "failed" | "idle";
}

export function ScanningAnimation({ 
  type = "security", 
  size = "md",
  status = "scanning" 
}: ScanningAnimationProps) {
  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32"
  };

  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-14 h-14"
  };

  const ringSize = {
    sm: "w-12 h-12",
    md: "w-20 h-20",
    lg: "w-28 h-28"
  };

  const outerRingSize = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32"
  };

  const IconComponent = {
    security: Shield,
    code: Code,
    mobile: Smartphone,
    web: Globe,
    network: Wifi
  }[type];

  const statusColors = {
    scanning: "text-primary",
    completed: "text-emerald-500",
    failed: "text-red-500",
    idle: "text-muted-foreground"
  };

  const glowColors = {
    scanning: "rgba(59, 130, 246, 0.4)",
    completed: "rgba(16, 185, 129, 0.4)",
    failed: "rgba(239, 68, 68, 0.4)",
    idle: "rgba(100, 100, 100, 0.2)"
  };

  return (
    <div className={`relative flex items-center justify-center ${sizeClasses[size]}`}>
      {status === "scanning" && (
        <>
          <div 
            className={`absolute ${outerRingSize[size]} rounded-full border-2 border-primary/30 animate-ping`}
            style={{ animationDuration: "2s" }}
          />
          <div 
            className={`absolute ${ringSize[size]} rounded-full border-2 border-primary/50`}
            style={{ 
              animation: "spin 3s linear infinite",
              boxShadow: `0 0 20px ${glowColors[status]}`
            }}
          />
          <div 
            className={`absolute ${ringSize[size]} rounded-full`}
            style={{ 
              background: `conic-gradient(from 0deg, transparent, hsl(var(--primary)), transparent)`,
              animation: "spin 2s linear infinite",
              opacity: 0.6
            }}
          />
        </>
      )}
      
      {status === "completed" && (
        <div 
          className={`absolute ${ringSize[size]} rounded-full border-2 border-emerald-500/50`}
          style={{ boxShadow: `0 0 15px ${glowColors[status]}` }}
        />
      )}

      {status === "failed" && (
        <div 
          className={`absolute ${ringSize[size]} rounded-full border-2 border-red-500/50`}
          style={{ boxShadow: `0 0 15px ${glowColors[status]}` }}
        />
      )}
      
      <div 
        className={`relative z-10 rounded-full p-3 bg-card/80 backdrop-blur-sm ${statusColors[status]}`}
        style={{ 
          boxShadow: status === "scanning" ? `0 0 25px ${glowColors[status]}` : undefined
        }}
      >
        <IconComponent 
          className={`${iconSizes[size]} ${status === "scanning" ? "animate-pulse" : ""}`}
        />
      </div>

      {status === "scanning" && (
        <div className="absolute inset-0 flex items-center justify-center">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute rounded-full border border-primary/20"
              style={{
                width: `${60 + i * 20}%`,
                height: `${60 + i * 20}%`,
                animation: `pulse ${1.5 + i * 0.3}s ease-out infinite`,
                animationDelay: `${i * 0.2}s`
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ScanTypeIcon({ 
  type, 
  className = "w-5 h-5" 
}: { 
  type: "mvp" | "mobile" | "web" | "network" | "container" | "pipeline" | "linter";
  className?: string;
}) {
  const icons = {
    mvp: Code,
    mobile: Smartphone,
    web: Globe,
    network: Wifi,
    container: Database,
    pipeline: Code,
    linter: Search
  };

  const colors = {
    mvp: "text-blue-500",
    mobile: "text-purple-500",
    web: "text-cyan-500",
    network: "text-green-500",
    container: "text-orange-500",
    pipeline: "text-yellow-500",
    linter: "text-pink-500"
  };

  const Icon = icons[type];
  return <Icon className={`${className} ${colors[type]}`} />;
}

export function ActionIcon({ 
  action, 
  className = "w-5 h-5" 
}: { 
  action: "scan" | "fix" | "upload" | "download" | "analyze" | "protect" | "alert" | "success" | "error";
  className?: string;
}) {
  const icons = {
    scan: Search,
    fix: Bug,
    upload: Globe,
    download: Database,
    analyze: Code,
    protect: Shield,
    alert: Lock,
    success: Shield,
    error: Bug
  };

  const colors = {
    scan: "text-primary",
    fix: "text-emerald-500",
    upload: "text-cyan-500",
    download: "text-blue-500",
    analyze: "text-purple-500",
    protect: "text-green-500",
    alert: "text-amber-500",
    success: "text-emerald-500",
    error: "text-red-500"
  };

  const Icon = icons[action];
  return <Icon className={`${className} ${colors[action]}`} />;
}

export function StatusIndicator({ 
  status,
  showPulse = true,
  size = "md"
}: { 
  status: "active" | "success" | "warning" | "error" | "pending";
  showPulse?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const colors = {
    active: "bg-primary",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
    pending: "bg-gray-400"
  };

  const sizes = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4"
  };

  return (
    <span className="relative flex">
      {showPulse && status === "active" && (
        <span className={`absolute inline-flex h-full w-full rounded-full ${colors[status]} opacity-75 animate-ping`} />
      )}
      <span className={`relative inline-flex rounded-full ${sizes[size]} ${colors[status]}`} />
    </span>
  );
}
