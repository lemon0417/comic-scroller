import React, { Component } from 'react';
import { connect } from 'react-redux';
import cn from './ComicImage.module.css';
import { updateImgType } from '../../reducers/comics';

type Props = {
  loading?: boolean,
  src?: string,
  type?: string,
  height?: number,
  innerHeight?: number,
  index?: number,
  updateImgType?: Function,
};

type State = {
  showImage: boolean,
};

function getImgClass(type: string) {
  switch (type) {
    case 'normal':
      return cn.ComicImage;
    case 'wide':
      return cn.ComicImageWide;
    case 'natural':
      return cn.ComicImageNatural;
    case 'end':
      return cn.ComicImageEnd;
    default:
      return cn.ComicImageInit;
  }
}

export class ComicImage extends Component<Props, State> {
  w: number;
  h: number;

  state = {
    showImage: false,
  };

  imgLoadHandler = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (this.props.type === 'image' && e.currentTarget) {
      const target = e.currentTarget;
      this.w = target.naturalWidth;
      this.h = target.naturalHeight;
      const innerHeight = this.props.innerHeight || 0;
      if (this.h > innerHeight - 48) {
        if (this.w > this.h) {
          this.props.updateImgType &&
            this.props.updateImgType(innerHeight - 68, this.props.index, 'wide');
        } else {
          
          this.props.updateImgType &&
            this.props.updateImgType(this.h + 4, this.props.index, 'natural');
        }
      } else {
        this.props.updateImgType &&
          this.props.updateImgType(this.h + 4, this.props.index, 'natural');
      }
    }
    this.setState({ showImage: true });
  };

  render() {
    return (
      <div
        className={getImgClass(this.props.type || '')}
        style={{
          minHeight: this.props.height,
        }}
      >
        {!this.state.showImage && this.props.type !== 'end' ? (
          <div>Loading...</div>
        ) : (
          undefined
        )}
        {!this.props.loading && this.props.type !== 'end' ? (
          <img
            style={this.state.showImage ? undefined : { display: 'none' }}
            src={this.props.src}
            onLoad={this.imgLoadHandler}
            alt={String(this.props.index ?? '')}
          />
        ) : (
          undefined
        )}
        {this.props.type === 'end' ? '本 章 結 束' : undefined}
      </div>
    );
  }
}

function makeMapStateToProps(state, props) {
  const { index } = props;
  return function mapStateToProps({ comics }) {
    const { src, loading, type, height } = comics.imageList.entity[index];
    return { src, loading, type, height, innerHeight: comics.innerHeight };
  };
}

export default connect(makeMapStateToProps, {
  updateImgType,
})(ComicImage);
