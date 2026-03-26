import type { HTMLAttributes, ReactNode } from "react";

function mergeClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  description?: ReactNode;
};

export default function EmptyState({
  title = "No items",
  description,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      className={mergeClasses("ds-empty", className)}
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
