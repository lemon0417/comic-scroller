import type { ButtonHTMLAttributes } from "react";

type RowAction = {
  label: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
};

type SeriesRowProps = {
  title: string;
  siteLabel: string;
  cover?: string;
  summary: string;
  detail?: string;
  actions?: RowAction[];
};

function mergeClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ActionButton({
  variant = "secondary",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  const variantClass =
    variant === "primary"
      ? "ds-btn-primary"
      : variant === "danger"
        ? "ds-btn-danger"
        : "ds-btn-quiet";

  return (
    <button
      type="button"
      className={mergeClasses(variantClass, className)}
      {...rest}
    />
  );
}

export default function SeriesRow({
  title,
  siteLabel,
  cover,
  summary,
  detail,
  actions = [],
}: SeriesRowProps) {
  return (
    <article className="ds-series-row">
      {cover ? (
        <img
          src={cover}
          alt=""
          width={48}
          height={48}
          className="ds-series-row-cover"
        />
      ) : (
        <div
          className="ds-series-row-cover ds-series-row-fallback"
          aria-hidden="true"
        >
          {title.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="ds-series-row-body">
        <div className="ds-series-row-copy">
          <div className="flex min-w-0 items-center gap-2">
            <span className="ds-series-chip">{siteLabel}</span>
          </div>
          <h2 className="ds-series-row-title">{title}</h2>
          <div className="ds-series-row-summary">{summary}</div>
          {detail ? <div className="ds-series-row-detail">{detail}</div> : null}
        </div>
        {actions.length > 0 ? (
          <div className="ds-series-row-actions">
            {actions.map((action) => (
              <ActionButton
                key={action.label}
                variant={action.variant}
                disabled={action.disabled}
                onClick={action.onClick}
              >
                {action.label}
              </ActionButton>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
