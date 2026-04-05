import { cn } from "@utils/cn";
import type { HTMLAttributes, ReactNode } from "react";

type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  description?: ReactNode;
};

export default function EmptyState({
  title = "暫無資料",
  description,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      className={cn("ds-empty", className)}
      role="status"
      {...rest}
    >
      <h2 className="ds-empty-title">{title}</h2>
      {description ? (
        <div className="ds-empty-desc">{description}</div>
      ) : null}
    </div>
  );
}
