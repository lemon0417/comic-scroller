import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@utils/cn";

type ContentProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

export default function Content({ className, children, ...rest }: ContentProps) {
  return (
    <div className={cn("ds-content", className)} {...rest}>
      {children}
    </div>
  );
}
