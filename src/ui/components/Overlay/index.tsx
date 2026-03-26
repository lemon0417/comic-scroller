import type { HTMLAttributes, ReactNode } from "react";

function mergeClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type OverlayProps = HTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
};

export default function Overlay({ className, children, ...rest }: OverlayProps) {
  return (
    <button
      type="button"
      className={mergeClasses("ds-overlay", className)}
      {...rest}
    >
      {children}
    </button>
  );
}
