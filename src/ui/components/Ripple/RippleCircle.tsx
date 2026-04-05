import { useCallback, useEffect, useRef, useState } from "react";

type RippleCircleProps = {
  removeRippleHandler: (id: string) => void;
  radius: number;
  id: string;
  left: number;
  top: number;
};

function getRippleClass(active: boolean, opacity: boolean): string {
  const base =
    "pointer-events-none absolute left-0 top-0 z-[1000] rounded-full bg-comic-ink/20 opacity-30 origin-center transition-[transform,opacity] duration-[350ms] ease-in-out";
  if (active && opacity) {
    return `${base} opacity-0`;
  }
  return base;
}

function RippleCircle({
  removeRippleHandler,
  radius,
  id,
  left,
  top,
}: RippleCircleProps) {
  const [active, setActive] = useState(false);
  const [opacity, setOpacity] = useState(false);
  const readyOpacityRef = useRef(false);

  useEffect(() => {
    const handleMouseUp = () => {
      document.removeEventListener("mouseup", handleMouseUp);
      if (readyOpacityRef.current) {
        setOpacity(true);
      } else {
        readyOpacityRef.current = true;
      }
    };

    document.addEventListener("mouseup", handleMouseUp);

    const activateTimer = window.setTimeout(() => {
      setActive(true);
    }, 0);
    const cleanupTimer = window.setTimeout(() => {
      setOpacity((currentOpacity) => currentOpacity || true);
    }, 420);
    const removeTimer = window.setTimeout(() => {
      removeRippleHandler(id);
    }, 900);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      window.clearTimeout(activateTimer);
      window.clearTimeout(cleanupTimer);
      window.clearTimeout(removeTimer);
    };
  }, [id, removeRippleHandler]);

  const handleTransitionEnd = useCallback(() => {
    if (active && opacity) {
      removeRippleHandler(id);
      return;
    }

    if (readyOpacityRef.current) {
      setOpacity(true);
      return;
    }

    readyOpacityRef.current = true;
  }, [active, id, opacity, removeRippleHandler]);

  const scale = active ? 1 : 0;
  const style = {
    transform: `translate(${left}px,${top}px) scale(${scale}, ${scale})`,
    width: radius * 2,
    height: radius * 2,
  };

  return (
    <span
      style={style}
      className={getRippleClass(active, opacity)}
      onTransitionEnd={handleTransitionEnd}
    />
  );
}

export default RippleCircle;
