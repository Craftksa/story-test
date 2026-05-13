"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { useCheckedLocale } from "@/lib/client-utils"
import { cn } from "@/lib/utils"

type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string
  showValueLabel?: boolean
}

function Progress({
  className,
  indicatorClassName,
  showValueLabel = true,
  value,
  ...props
}: ProgressProps) {
  const { dir, isRTL } = useCheckedLocale()
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0))

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      dir={dir}
      className={cn(
        "bg-foreground/20 relative h-3 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("bg-foreground h-full w-full flex-1 transition-all", indicatorClassName)}
        style={{
          transform: isRTL
            ? `translateX(${100 - safeValue}%)`
            : `translateX(-${100 - safeValue}%)`,
        }}
      />
      {showValueLabel && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs text-background text-center">
          {Math.round(safeValue)}%
        </div>
      )}
    </ProgressPrimitive.Root>
  )
}

export { Progress }
