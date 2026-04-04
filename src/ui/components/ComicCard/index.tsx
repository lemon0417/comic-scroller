import { Component } from "react";
import { connect } from "react-redux";
import TrashTopIcon from "@imgs/bin_top.svg?react";
import TrashBodyIcon from "@imgs/bin_body.svg?react";
import { requestRemoveCard } from "@domain/actions/popup";
import Card from "@components/Card";

function getComicCardClass(shift: boolean, move: boolean) {
  const base = "ds-card";
  if (move) {
    return `${base} ds-card-move`;
  }
  if (shift) {
    return `${base} ds-card-shift`;
  }
  return base;
}

type Props = {
  url: string;
  category: string;
  comicsID: string;
  chapterID?: string;
  cover: string;
  title: string;
  site: string;
  index: number | string;
  move: boolean;
  shift: boolean;
  requestRemoveCard: Function;
  lastRead: {
    href: string;
    title: string;
  };
  lastChapter: {
    href: string;
    title: string;
  };
  updateChapter: {
    href: string;
    title: string;
  };
};

class ComicCard extends Component<Props> {
  pageClickHandler = () => {
    chrome.tabs.create({ url: this.props.url });
  };

  lastReadHandler = () => {
    chrome.tabs.create({ url: this.props.lastRead.href });
  };

  lastChapterHandler = () => {
    chrome.tabs.create({ url: this.props.lastChapter.href });
  };

  updateChapterHandler = () => {
    chrome.tabs.create({ url: this.props.updateChapter.href });
  };

  removeHandler = () => {
    this.props.requestRemoveCard({
      category: this.props.category,
      index: this.props.index,
      comicsID: this.props.comicsID,
      chapterID: this.props.chapterID,
      site: this.props.site,
    });
  };

  render() {
    return (
      <Card
        className={getComicCardClass(this.props.shift, this.props.move)}
        data-index={this.props.index}
        data-move={this.props.move}
        data-shift={this.props.shift}
      >
        <Card.Cover src={this.props.cover} alt={"cover"} />
        <Card.Action onClick={this.removeHandler}>
          <TrashTopIcon className="absolute right-0 top-0 fill-current text-comic-accent transition-transform duration-300 ease-in-out origin-top-left group-hover:-rotate-[20deg]" />
          <TrashBodyIcon className="absolute right-0 top-0 fill-current text-comic-ink" />
        </Card.Action>
        <Card.Body>
          <Card.Header>
            <Card.Title onClick={this.pageClickHandler}>
              {this.props.title}
            </Card.Title>
          </Card.Header>
          <div>
            {this.props.updateChapter ? (
              <Card.Meta>
                <span className="mr-2">更新章節</span>
                <Card.Link onClick={this.updateChapterHandler}>
                  {this.props.updateChapter.title}
                </Card.Link>
              </Card.Meta>
            ) : undefined}
            <Card.Meta>
              <span className="mr-2">上次看到</span>
              <Card.Link onClick={this.lastReadHandler}>
                {this.props.lastRead.title}
              </Card.Link>
            </Card.Meta>
            <Card.Meta>
              <span className="mr-2">最新一話</span>
              <Card.Link onClick={this.lastChapterHandler}>
                {this.props.lastChapter.title}
              </Card.Link>
            </Card.Meta>
          </div>
        </Card.Body>
      </Card>
    );
  }
}

function mapStateToProps(state: any, ownProps: any) {
  const bucket = state.popup[ownProps.site] || {};
  const record = bucket[ownProps.comicsID];
  if (!record) {
    return {
      title: "",
      url: "",
      cover: "",
      lastRead: {},
      lastChapter: {},
    };
  }
  const { title, lastRead, cover, url, chapters, chapterList } = record;
  return {
    title,
    url,
    cover,
    lastRead: chapters[lastRead] || {},
    lastChapter:
      chapterList[0] && chapters[chapterList[0]]
        ? chapters[chapterList[0]]
        : {},
  };
}

export default connect(mapStateToProps, {
  requestRemoveCard,
})(ComicCard);
