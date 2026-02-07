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
        className="relative inline-flex items-center justify-center overflow-hidden rounded-full p-2"
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
