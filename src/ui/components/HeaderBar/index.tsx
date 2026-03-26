import type { ReactNode } from "react";

type HeaderBarProps = {
  children: ReactNode;
};

export default function HeaderBar({ children }: HeaderBarProps) {
  return <div className="ds-header">{children}</div>;
}

type HeaderBarGroupProps = {
  children: ReactNode;
  className?: string;
};

export function HeaderBarGroup({ children, className }: HeaderBarGroupProps) {
  const classes = className ? `ds-header-group ${className}` : "ds-header-group";
  return <div className={classes}>{children}</div>;
}
