import React, { Component } from "react";
import cn from "./IconButton.module.css";
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
        className={cn.IconButton}
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
