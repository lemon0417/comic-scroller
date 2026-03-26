type LoadingRowsProps = {
  count?: number;
};

export default function LoadingRows({ count = 3 }: LoadingRowsProps) {
  return (
    <div className="flex flex-col gap-3" aria-label="Loading content">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="ds-series-row ds-loading-row"
          aria-hidden="true"
        >
          <div className="ds-series-row-cover ds-skeleton-block" />
          <div className="ds-series-row-body">
            <div className="ds-series-row-copy">
              <div className="ds-skeleton-chip" />
              <div className="ds-skeleton-line w-2/3" />
              <div className="ds-skeleton-line w-full" />
              <div className="ds-skeleton-line w-4/5" />
            </div>
            <div className="ds-series-row-actions">
              <div className="ds-skeleton-button" />
              <div className="ds-skeleton-button ds-skeleton-button-short" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
