// PageHeader component for the landing page.
import * as React from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-start md:justify-between md:gap-4",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[1.75rem]">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground md:text-[0.9375rem]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export { PageHeader };
