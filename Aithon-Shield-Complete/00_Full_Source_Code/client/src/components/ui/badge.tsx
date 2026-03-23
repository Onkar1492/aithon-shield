import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" +
  " hover-elevate " ,
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-[0_0_8px_rgba(59,130,246,0.3)]",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-[0_0_8px_rgba(239,68,68,0.4)]",
        outline: "border [border-color:var(--badge-outline)] shadow-xs hover:border-primary/30",
        success: "border-transparent bg-emerald-500/20 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]",
        warning: "border-transparent bg-amber-500/20 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]",
        critical: "border-transparent bg-red-500/20 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]",
        high: "border-transparent bg-orange-500/20 text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.3)]",
        medium: "border-transparent bg-yellow-500/20 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.3)]",
        low: "border-transparent bg-blue-500/20 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.3)]",
        info: "border-transparent bg-cyan-500/20 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.3)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants }
