import type { HTMLAttributes, ReactNode } from "react";

function mergeClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

export default function Panel({ className, children, ...rest }: PanelProps) {
  return (
    <div className={mergeClasses("ds-panel", className)} {...rest}>
      {children}
    </div>
  );
}
