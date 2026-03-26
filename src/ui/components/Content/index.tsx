import type { HTMLAttributes, ReactNode } from "react";

function mergeClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ContentProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

export default function Content({ className, children, ...rest }: ContentProps) {
  return (
    <div className={mergeClasses("ds-content", className)} {...rest}>
      {children}
    </div>
  );
}
