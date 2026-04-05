import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@utils/cn";

type ContentProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  variant?: "default" | "popup" | "manage";
};

export default function Content({
  className,
  children,
  variant = "default",
  ...rest
}: ContentProps) {
  return (
    <div
      className={cn(
        "ds-content",
        variant !== "default" ? `ds-content--${variant}` : undefined,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
