import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@utils/cn";

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

export default function Panel({ className, children, ...rest }: PanelProps) {
  return (
    <div className={cn("ds-panel", className)} {...rest}>
      {children}
    </div>
  );
}
