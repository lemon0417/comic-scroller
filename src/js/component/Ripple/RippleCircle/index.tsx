import { PureComponent } from "react";

type Props = {
  removeRippleHandler: Function;
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
    "pointer-events-none absolute left-0 top-0 z-[1000] rounded-full bg-[#808080] opacity-30 origin-center transition-[transform,opacity] duration-[350ms] ease-in-out";
  if (active && opacity) return `${base} opacity-0`;
  if (active) return base;
  return base;
}

class RippleCircle extends PureComponent<Props, State> {
  readyOpacity = false;

  state = {
    active: false,
    opacity: false,
  };

  componentDidMount() {
    document.addEventListener("mouseup", this.mouseUpHandler);
    setTimeout(() => this.setState({ active: true }), 0);
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
