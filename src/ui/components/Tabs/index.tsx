import type { ReactNode } from "react";
import { createContext, useContext } from "react";

type TabsContextValue = {
  value: string;
  onValueChange: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

type TabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
};

function mergeClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function TabsRoot({ value, onValueChange, children }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      {children}
    </TabsContext.Provider>
  );
}

type TabsListProps = {
  children: ReactNode;
  className?: string;
};

function TabsList({ children, className }: TabsListProps) {
  return (
    <div role="tablist" className={mergeClasses("ds-tabbar", className)}>
      {children}
    </div>
  );
}

type TabProps = {
  value: string;
  children?: ReactNode;
  className?: string;
};

function Tab({ value, children, className }: TabProps) {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tab must be used within <Tabs>.");
  }
  const isActive = context.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      className={mergeClasses(
        "ds-tab",
        isActive ? "ds-tab-active" : undefined,
        className,
      )}
      onClick={() => context.onValueChange(value)}
    >
      {children ?? value}
    </button>
  );
}

type TabsComponent = typeof TabsRoot & {
  List: typeof TabsList;
  Trigger: typeof Tab;
};

const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: Tab,
}) as TabsComponent;

export default Tabs;
export { TabsList, Tab };
