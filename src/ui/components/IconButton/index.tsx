import React, { Component } from "react";
import ripple from "../Ripple";

type Props = {
  children?: React.ReactNode;
  onClickHandler?: Function;
  onMouseDownHandler?: Function;
};

class IconButton extends Component<Props> {
  node: any;

  onMouseDownHandler = (e: any) => {
    if (this.props.onMouseDownHandler) {
      this.props.onMouseDownHandler(e, this.node);
    }
  };

  onClickHandler = () => {
    if (this.props.onClickHandler) {
      this.props.onClickHandler();
    }
  };

  refHandler = (node: any) => {
    this.node = node;
  };

  render() {
    return (
      <span
        className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-none border-2 border-comic-ink bg-comic-paper p-1 shadow-comic-sm transition-transform duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0"
        ref={this.refHandler}
        onClick={this.onClickHandler}
        onMouseDown={this.onMouseDownHandler}
      >
        {this.props.children}
      </span>
    );
  }
}

export default ripple(IconButton);
