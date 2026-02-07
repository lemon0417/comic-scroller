import { Component, type SyntheticEvent } from "react";
import { connect } from "react-redux";
import { updateImgType } from "../../reducers/comics";

type Props = {
  loading?: boolean;
  src?: string;
  type?: string;
  height?: number;
  innerHeight?: number;
  index?: number;
  updateImgType?: Function;
};

type State = {
  showImage: boolean;
};

function getImgClass(type: string) {
  const base =
    "my-[5px] flex max-w-[100vw] items-center justify-center border-2 border-comic-paper text-center text-comic-paper";
  switch (type) {
    case "normal":
      return base;
    case "wide":
      return `${base} min-w-[980px]`;
    case "natural":
      return base;
    case "end":
      return "my-5 text-center font-display text-[36px] leading-[72px] text-comic-accent";
    default:
      return `${base} w-[980px]`;
  }
}

export class ComicImage extends Component<Props, State> {
  w = 0;
  h = 0;

  state = {
    showImage: false,
  };

  imgLoadHandler = (e: SyntheticEvent<HTMLImageElement>) => {
    if (this.props.type === "image" && e.currentTarget) {
      const target = e.currentTarget;
      this.w = target.naturalWidth;
      this.h = target.naturalHeight;
      const innerHeight = this.props.innerHeight || 0;
      if (this.h > innerHeight - 48) {
        if (this.w > this.h) {
          this.props.updateImgType &&
            this.props.updateImgType(
              innerHeight - 68,
              this.props.index,
              "wide",
            );
        } else {
          this.props.updateImgType &&
            this.props.updateImgType(this.h + 4, this.props.index, "natural");
        }
      } else {
        this.props.updateImgType &&
          this.props.updateImgType(this.h + 4, this.props.index, "natural");
      }
    }
    this.setState({ showImage: true });
  };

  render() {
    return (
      <div
        className={getImgClass(this.props.type || "")}
        data-variant={this.props.type || "init"}
        style={{
          minHeight: this.props.height,
        }}
      >
        {!this.state.showImage && this.props.type !== "end" ? (
          <div className="w-[900px] text-center font-display text-[40px] text-comic-paper">
            Loading...
          </div>
        ) : undefined}
        {!this.props.loading && this.props.type !== "end" ? (
          <img
            style={this.state.showImage ? undefined : { display: "none" }}
            className="h-full object-contain"
            src={this.props.src}
            onLoad={this.imgLoadHandler}
            alt={String(this.props.index ?? "")}
          />
        ) : undefined}
        {this.props.type === "end" ? "本 章 結 束" : undefined}
      </div>
    );
  }
}

function makeMapStateToProps(_state: any, props: any) {
  const { index } = props;
  return function mapStateToProps({ comics }: any) {
    const { src, loading, type, height } = comics.imageList.entity[index];
    return { src, loading, type, height, innerHeight: comics.innerHeight };
  };
}

export default connect(makeMapStateToProps, {
  updateImgType,
})(ComicImage);
