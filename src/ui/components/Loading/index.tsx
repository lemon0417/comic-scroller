import { Component } from "react";

class Loading extends Component {
  render() {
    return (
      <div className="reader-loading">
        <svg
          className="h-[44px] w-[44px] animate-circular-rotate"
          aria-hidden="true"
        >
          <circle
            className="fill-none stroke-comic-accent [stroke-dasharray:1.25_250] [stroke-dashoffset:0] [stroke-linecap:round] [stroke-miterlimit:20] [stroke-width:4] animate-circular-dash"
            cx="22"
            cy="22"
            r="18"
          />
        </svg>
        <p className="text-sm font-medium text-comic-ink/45">載入中...</p>
      </div>
    );
  }
}

export default Loading;
