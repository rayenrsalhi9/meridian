import { cn } from "@/lib/utils";
import type React from "react";

export const LogoIcon = ({
  className,
  ...props
}: Omit<React.ComponentPropsWithoutRef<"img">, "src" | "alt">) => (
  <img
    {...props}
    src="/meridian-icon.webp"
    alt="Meridian"
    className={cn("size-6", className)}
  />
);


