type LoadingRowsProps = {
  count?: number;
};

export default function LoadingRows({ count = 3 }: LoadingRowsProps) {
  return (
    <div className="flex flex-col gap-3" aria-label="載入中">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="loading-series-row ds-loading-row"
          aria-hidden="true"
        >
          <div className="loading-series-row__cover ds-skeleton-block" />
          <div className="loading-series-row__body">
            <div className="loading-series-row__copy">
              <div className="ds-skeleton-chip" />
              <div className="ds-skeleton-line w-2/3" />
              <div className="ds-skeleton-line w-full" />
              <div className="ds-skeleton-line w-4/5" />
            </div>
            <div className="loading-series-row__actions">
              <div className="ds-skeleton-button" />
              <div className="ds-skeleton-button ds-skeleton-button-short" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
