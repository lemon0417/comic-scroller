import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@utils/cn";

type ListProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

export default function List({ className, children, ...rest }: ListProps) {
  return (
    <div className={cn("ds-list", className)} {...rest}>
      {children}
    </div>
  );
}
