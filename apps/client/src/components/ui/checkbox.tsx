"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import { CheckIcon, MinusIcon } from "lucide-react"

function Checkbox({
  className,
  indeterminate,
  ...props
}: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      indeterminate={indeterminate}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary shadow-xs outline-hidden transition-colors focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed data-[disabled]:cursor-not-allowed disabled:opacity-50 data-[disabled]:opacity-50 aria-checked:bg-primary aria-checked:text-primary-foreground data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        {indeterminate ? (
          <MinusIcon className="size-3" aria-hidden="true" />
        ) : (
          <CheckIcon className="size-3" aria-hidden="true" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
