import type { ReactNode } from "react";

type SwitchFieldProps = {
  checked: boolean;
  description: ReactNode;
  disabled?: boolean;
  id: string;
  label: ReactNode;
  onToggle: () => void;
};

function getFieldBaseId(id: string) {
  return id.endsWith("-toggle") ? id.slice(0, -"-toggle".length) : id;
}

export default function SwitchField({
  checked,
  description,
  disabled = false,
  id,
  label,
  onToggle,
}: SwitchFieldProps) {
  const fieldBaseId = getFieldBaseId(id);
  const labelId = `${fieldBaseId}-label`;
  const descriptionId = `${fieldBaseId}-desc`;

  return (
    <div className="ds-switch-field">
      <span className="flex min-w-0 flex-col gap-1">
        <span id={labelId} className="text-[14px] font-medium text-comic-ink">
          {label}
        </span>
        <span id={descriptionId} className="ds-switch-field__description">
          {description}
        </span>
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        disabled={disabled}
        className="ds-switch"
        onClick={onToggle}
      >
        <span className="ds-switch__thumb" />
      </button>
    </div>
  );
}

export type { SwitchFieldProps };
