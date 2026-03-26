import { useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface InfoTooltipProps {
  content: string;
  testId?: string;
  /** Use for longer help text (e.g. field purpose vs. technical inputs). */
  size?: "default" | "wide";
}

export function InfoTooltip({ content, testId, size = "default" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full text-muted-foreground flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="More information"
          data-testid={testId || "button-info"}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className={
          size === "wide"
            ? "max-w-[min(22rem,calc(100vw-2rem))] w-[22rem] text-sm leading-relaxed"
            : "w-64 text-sm"
        }
      >
        <p>{content}</p>
      </PopoverContent>
    </Popover>
  );
}
