import Button from "@components/Button";
import BinIcon from "@imgs/bin.svg?react";
import ArrowIcon from "@imgs/circle-right.svg?react";
import TagIcon from "@imgs/tag.svg?react";
import { cn } from "@utils/cn";

type RowActionIcon = "arrow" | "tag" | "trash";
type SeriesRowVariant = "popup" | "manage";

type RowAction = {
  icon?: RowActionIcon;
  label: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
};

type SeriesRowProps = {
  variant?: SeriesRowVariant;
  className?: string;
  title: string;
  titleHref?: string;
  siteLabel: string;
  cover?: string;
  summary: string;
  detail?: string;
  actions?: RowAction[];
};

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

export default function SeriesRow({
  variant = "manage",
  className,
  title,
  titleHref,
  siteLabel,
  cover,
  summary,
  detail,
  actions = [],
}: SeriesRowProps) {
  const Title = variant === "popup" ? "h3" : "h2";
  return (
    <article className={cn("series-row", `series-row--${variant}`, className)}>
      {cover ? (
        <img
          src={cover}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          className="series-row__cover"
        />
      ) : (
        <div
          className="series-row__cover series-row__cover--fallback"
          aria-hidden="true"
        >
          {title.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="series-row__copy">
        <span className="series-row__site">{siteLabel}</span>
        <Title className="series-row__title">
          {titleHref ? (
            <a
              className="series-row__title-link"
              href={titleHref}
              target="_blank"
              rel="noreferrer"
            >
              {title}
            </a>
          ) : (
            title
          )}
        </Title>
        <div className="series-row__summary">{summary}</div>
        {detail ? <div className="series-row__detail">{detail}</div> : null}
      </div>
      {actions.length > 0 ? (
        <div className="series-row__actions">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.icon ? <ActionIcon icon={action.icon} /> : null}
              <span className={action.icon ? "ml-1.5" : undefined}>
                {action.label}
              </span>
            </Button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
