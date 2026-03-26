import type { HTMLAttributes, ReactNode } from "react";

function mergeClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ListProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

export default function List({ className, children, ...rest }: ListProps) {
  return (
    <div className={mergeClasses("ds-list", className)} {...rest}>
      {children}
    </div>
  );
}
