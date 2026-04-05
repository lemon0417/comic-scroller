import type { ButtonHTMLAttributes } from "react";
import BinIcon from "@imgs/bin.svg?react";
import ArrowIcon from "@imgs/circle-right.svg?react";
import TagIcon from "@imgs/tag.svg?react";

type RowActionIcon = "arrow" | "tag" | "trash";

type RowAction = {
  icon?: RowActionIcon;
  label: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
};

type SeriesRowProps = {
  title: string;
  titleHref?: string;
  siteLabel: string;
  cover?: string;
  summary: string;
  detail?: string;
  actions?: RowAction[];
};

function mergeClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ActionIcon({ icon }: { icon: RowActionIcon }) {
  const className = "h-3.5 w-3.5 shrink-0 fill-current";
  if (icon === "arrow") {
    return <ArrowIcon aria-hidden="true" className={className} />;
  }
  if (icon === "tag") {
    return <TagIcon aria-hidden="true" className={className} />;
  }
  return <BinIcon aria-hidden="true" className={className} />;
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
        : "ds-btn-secondary";

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
  titleHref,
  siteLabel,
  cover,
  summary,
  detail,
  actions = [],
}: SeriesRowProps) {
  return (
    <article className="ds-series-row">
      <div className="ds-series-row-visual">
        <span className="ds-series-chip">{siteLabel}</span>
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
      </div>
      <div className="ds-series-row-body">
        <div className="ds-series-row-copy">
          <h2 className="ds-series-row-title">
            {titleHref ? (
              <a
                className="ds-series-row-title-link"
                href={titleHref}
                target="_blank"
                rel="noreferrer"
              >
                {title}
              </a>
            ) : (
              title
            )}
          </h2>
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
                {action.icon ? <ActionIcon icon={action.icon} /> : null}
                <span className={action.icon ? "ml-1.5" : undefined}>
                  {action.label}
                </span>
              </ActionButton>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
