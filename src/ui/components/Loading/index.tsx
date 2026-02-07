import { Component } from "react";

class Loading extends Component {
  render() {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <svg className="h-[60px] w-[60px] animate-circular-rotate">
          <circle
            className="fill-none stroke-comic-accent [stroke-dasharray:1.25_250] [stroke-dashoffset:0] [stroke-linecap:round] [stroke-miterlimit:20] [stroke-width:4] animate-circular-dash"
            cx="30"
            cy="30"
            r="25"
          />
        </svg>
      </div>
    );
  }
}

export default Loading;
