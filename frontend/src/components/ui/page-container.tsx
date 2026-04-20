// PageContainer component for the landing page.
import * as React from "react";

import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<Size, string> = {
  sm: "max-w-2xl",
  md: "max-w-3xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
};

function PageContainer({
  className,
  size = "lg",
  ...props
}: React.ComponentProps<"div"> & { size?: Size }) {
  return (
    <div
      data-slot="page-container"
      className={cn(
        "mx-auto w-full px-4 py-8 md:px-6 md:py-10",
        SIZE_MAP[size],
        className,
      )}
      {...props}
    />
  );
}

export { PageContainer };
