import { cn } from "@/lib/utils";
import type React from "react";

export const LogoIcon = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"img">) => (
  <img
    src="/meridian-icon.webp"
    alt="Meridian"
    className={cn("size-6", className)}
    {...props}
  />
);


