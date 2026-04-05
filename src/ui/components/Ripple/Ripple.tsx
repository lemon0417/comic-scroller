import {
  type ComponentType,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";

import RippleCircle from "./RippleCircle";

type RippleItem = {
  left: number;
  top: number;
  radius: number;
  id: string;
};

type RippleProps = {
  children?: ReactNode;
  onMouseDownHandler?: (
    event: MouseEvent<HTMLElement>,
    node: HTMLElement | null,
  ) => void;
};

const ripple = <T extends object>(WrapComponent: ComponentType<T>) => {
  function RippleComponent(props: RippleProps & T) {
    const { children, ...others } = props;
    const [ripples, setRipples] = useState<Array<RippleItem>>([]);
    const counterRef = useRef(0);

    const handleMouseDown = useCallback((event: MouseEvent<HTMLElement>) => {
      if (event.defaultPrevented) {
        return;
      }

      const x = event.pageX - window.scrollX || window.pageXOffset;
      const y = event.pageY - window.scrollY || window.pageYOffset;
      const { left, top, height, width } =
        event.currentTarget.getBoundingClientRect();
      const dx = x - left;
      const dy = y - top;
      const topLeft = dx * dx + dy * dy;
      const topRight = (width - dx) * (width - dx) + dy * dy;
      const bottomLeft = dx * dx + (height - dy) * (height - dy);
      const bottomRight =
        (width - dx) * (width - dx) + (height - dy) * (height - dy);
      const radius = Math.sqrt(
        Math.max(topLeft, topRight, bottomLeft, bottomRight),
      );

      counterRef.current += 1;
      setRipples((currentRipples) => [
        ...currentRipples,
        {
          left: dx - radius,
          top: dy - radius,
          radius,
          id: `ripple${counterRef.current}`,
        },
      ]);
    }, []);

    const removeRippleHandler = useCallback((id: string) => {
      setRipples((currentRipples) =>
        currentRipples.filter((item) => item.id !== id),
      );
    }, []);

    return (
      <WrapComponent
        {...(others as T)}
        onMouseDownHandler={handleMouseDown}
      >
        {ripples.map((item) => (
          <RippleCircle
            key={item.id}
            id={item.id}
            radius={item.radius}
            top={item.top}
            left={item.left}
            removeRippleHandler={removeRippleHandler}
          />
        ))}
        {children}
      </WrapComponent>
    );
  }

  RippleComponent.displayName = `Ripple(${WrapComponent.displayName ?? WrapComponent.name ?? "Component"})`;

  return RippleComponent;
};

export default ripple;
export type { RippleProps };
