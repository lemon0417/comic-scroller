import { PureComponent } from "react";

type Props = {
  removeRippleHandler: (id: string) => void;
  radius: number;
  id: string;
  left: number;
  top: number;
};

type State = {
  active: boolean;
  opacity: boolean;
};

function getRippleClass(active: boolean, opacity: boolean): string {
  const base =
    "pointer-events-none absolute left-0 top-0 z-[1000] rounded-full bg-comic-ink/20 opacity-30 origin-center transition-[transform,opacity] duration-[350ms] ease-in-out";
  if (active && opacity) return `${base} opacity-0`;
  if (active) return base;
  return base;
}

class RippleCircle extends PureComponent<Props, State> {
  readyOpacity = false;
  cleanupTimer: number | null = null;
  removeTimer: number | null = null;

  state = {
    active: false,
    opacity: false,
  };

  componentDidMount() {
    document.addEventListener("mouseup", this.mouseUpHandler);
    setTimeout(() => this.setState({ active: true }), 0);
    this.cleanupTimer = window.setTimeout(() => {
      if (!this.state.opacity) {
        this.setState({ opacity: true });
      }
    }, 420);
    this.removeTimer = window.setTimeout(() => {
      this.props.removeRippleHandler(this.props.id);
    }, 900);
  }

  componentWillUnmount() {
    if (this.cleanupTimer) {
      window.clearTimeout(this.cleanupTimer);
    }
    if (this.removeTimer) {
      window.clearTimeout(this.removeTimer);
    }
  }

  mouseUpHandler = () => {
    document.removeEventListener("mouseup", this.mouseUpHandler);
    if (this.readyOpacity) {
      this.setState({ opacity: true });
    } else {
      this.readyOpacity = true;
    }
  };

  transitionEndHandler = () => {
    if (this.state.active && this.state.opacity) {
      this.props.removeRippleHandler(this.props.id);
    } else if (this.readyOpacity) {
      this.setState({ opacity: true });
    } else {
      this.readyOpacity = true;
    }
  };

  render() {
    const { left, top, radius } = this.props;
    const { active, opacity } = this.state;
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
        onTransitionEnd={this.transitionEndHandler}
      />
    );
  }
}

export default RippleCircle;
