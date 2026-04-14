import * as React from "react";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentProps<"div"> {
  value: number;
  indicatorClassName?: string;
}

function Progress({ className, value, indicatorClassName, ...props }: ProgressProps) {
  const boundedValue = Math.max(0, Math.min(100, value));

  return (
    <div
      data-slot="progress"
      className={cn("relative h-1 w-full overflow-hidden rounded-full bg-zinc-200", className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn("h-full rounded-full bg-emerald-600 transition-all", indicatorClassName)}
        style={{ width: `${boundedValue}%` }}
      />
    </div>
  );
}

export { Progress };
