import { cn } from "@utils/cn";
import type { HTMLAttributes, ReactNode } from "react";

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
