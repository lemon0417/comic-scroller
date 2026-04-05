import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@utils/cn";

type OverlayProps = HTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
};

export default function Overlay({ className, children, ...rest }: OverlayProps) {
  return (
    <button
      type="button"
      className={cn("ds-overlay", className)}
      {...rest}
    >
      {children}
    </button>
  );
}
