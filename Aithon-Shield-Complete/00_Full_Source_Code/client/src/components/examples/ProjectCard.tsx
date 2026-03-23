import { ProjectCard } from "../ProjectCard";

export default function ProjectCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-background">
      <ProjectCard
        id="proj_001"
        name="E-Commerce API"
        type="api"
        lastScan="2 hours ago"
        findingsCount={45}
        criticalCount={3}
      />
      <ProjectCard
        id="proj_002"
        name="Mobile App"
        type="mobile"
        lastScan="1 day ago"
        findingsCount={28}
        criticalCount={1}
      />
      <ProjectCard
        id="proj_003"
        name="Web Dashboard"
        type="web"
        lastScan="3 days ago"
        findingsCount={67}
        criticalCount={5}
      />
    </div>
  );
}
