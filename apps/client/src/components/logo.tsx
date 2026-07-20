import type React from "react";

export const LogoIcon = (props: React.ComponentPropsWithoutRef<"img">) => (
  <img
    src="/meridian-icon.webp"
    alt="Meridian"
    className="size-6"
    {...props}
  />
);

export const Logo = (props: React.ComponentPropsWithoutRef<"img">) => (
  <img
    src="/meridian-icon.webp"
    alt="Meridian"
    className="h-6"
    {...props}
  />
);
