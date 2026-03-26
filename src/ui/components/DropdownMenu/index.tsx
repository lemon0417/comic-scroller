import type { MouseEventHandler, ReactNode } from "react";
import { createContext, useContext } from "react";

type DropdownMenuContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(
  null,
);

type DropdownMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

function mergeClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function DropdownMenuRoot({ open, onOpenChange, children }: DropdownMenuProps) {
  return (
    <DropdownMenuContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DropdownMenuContext.Provider>
  );
}

type DropdownMenuTriggerProps = {
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

function DropdownMenuTrigger({
  children,
  className,
  onClick,
}: DropdownMenuTriggerProps) {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("DropdownMenuTrigger must be used within <DropdownMenu>.");
  }
  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    context.onOpenChange(!context.open);
  };

  return (
    <button type="button" className={className} onClick={handleClick}>
      {children}
    </button>
  );
}

type DropdownMenuContentProps = {
  children: ReactNode;
  className?: string;
};

function DropdownMenuContent({
  children,
  className,
}: DropdownMenuContentProps) {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("DropdownMenuContent must be used within <DropdownMenu>.");
  }
  return (
    <div
      role="menu"
      className={mergeClasses(
        "ds-menu-panel",
        context.open ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

type DropdownMenuItemProps = {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

function DropdownMenuItem({ children, onClick }: DropdownMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className="ds-menu-item"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

type DropdownMenuComponent = typeof DropdownMenuRoot & {
  Trigger: typeof DropdownMenuTrigger;
  Content: typeof DropdownMenuContent;
  Item: typeof DropdownMenuItem;
};

const DropdownMenu = Object.assign(DropdownMenuRoot, {
  Trigger: DropdownMenuTrigger,
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
}) as DropdownMenuComponent;

export default DropdownMenu;
export { DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger };
