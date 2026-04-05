import { type MouseEvent, type ReactNode, useCallback, useRef } from "react";
import ripple from "../Ripple";
import { cn } from "@utils/cn";

type IconButtonProps = {
  children?: ReactNode;
  onClickHandler?: () => void;
  onMouseDownHandler?: (
    e: MouseEvent<HTMLButtonElement>,
    node: HTMLButtonElement | null,
  ) => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
};

function IconButton({
  children,
  onClickHandler,
  onMouseDownHandler,
  ariaLabel,
  className,
  disabled = false,
}: IconButtonProps) {
  const nodeRef = useRef<HTMLButtonElement | null>(null);

  const handleMouseDown = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (onMouseDownHandler) {
      onMouseDownHandler(event, nodeRef.current);
    }
  }, [disabled, onMouseDownHandler]);

  const handleClick = useCallback(() => {
    if (disabled) {
      return;
    }
    if (onClickHandler) {
      onClickHandler();
    }
  }, [disabled, onClickHandler]);

  return (
    <button
      type="button"
      className={cn("ds-icon-button", className)}
      ref={nodeRef}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {children}
    </button>
  );
}

export default ripple(IconButton);
