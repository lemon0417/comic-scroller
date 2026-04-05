type NoticeBannerProps = {
  message: string;
  tone?: "success" | "error" | "info";
  onDismiss?: () => void;
};

function mergeClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function NoticeBanner({
  message,
  tone = "info",
  onDismiss,
}: NoticeBannerProps) {
  return (
    <div
      className={mergeClasses(
        "ds-notice",
        tone === "success"
          ? "ds-notice-success"
          : tone === "error"
            ? "ds-notice-error"
            : "ds-notice-info",
      )}
      role="status"
      aria-live="polite"
    >
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" className="ds-link-button" onClick={onDismiss}>
          關閉
        </button>
      ) : null}
    </div>
  );
}
