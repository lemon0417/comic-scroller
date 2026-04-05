import React, { Component } from "react";
import ripple from "../Ripple";
import { cn } from "@utils/cn";

type Props = {
  children?: React.ReactNode;
  onClickHandler?: () => void;
  onMouseDownHandler?: (
    e: React.MouseEvent<HTMLButtonElement>,
    node: HTMLButtonElement | null,
  ) => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
};

class IconButton extends Component<Props> {
  node: HTMLButtonElement | null = null;

  onMouseDownHandler = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (this.props.disabled) {
      return;
    }
    if (this.props.onMouseDownHandler) {
      this.props.onMouseDownHandler(e, this.node);
    }
  };

  onClickHandler = () => {
    if (this.props.disabled) {
      return;
    }
    if (this.props.onClickHandler) {
      this.props.onClickHandler();
    }
  };

  refHandler = (node: HTMLButtonElement | null) => {
    this.node = node;
  };

  render() {
    return (
      <button
        type="button"
        className={cn("ds-icon-button", this.props.className)}
        ref={this.refHandler}
        aria-label={this.props.ariaLabel}
        disabled={this.props.disabled}
        onClick={this.onClickHandler}
        onMouseDown={this.onMouseDownHandler}
      >
        {this.props.children}
      </button>
    );
  }
}

export default ripple(IconButton);
