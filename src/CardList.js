import { Component, createRef } from 'react';
import { Card, Tag, Pagination, Rate } from 'antd';
import { format as dateFormat } from 'date-fns';

import moviesAPI from './api.js';

const movieOverview_maxLength = 209;
const movieTitle_compactLength = 27;

function genreTags(genre_ids, genresProvider) {
  const tagList = genre_ids.map((id) => {
    const genreInfo = genresProvider.find((ent) => ent.id == id);
    return (
      <Tag key={id} className="genre-tag">
        {genreInfo.name}
      </Tag>
    );
  });
  return <div className="genres">{tagList}</div>;
}

class Tooltip extends Component {
  constructor() {
    super();
    this.titleRef = createRef();
    this.tooltipRef = createRef();
  }

  componentDidMount() {
    const {
      tooltipRef: { current: tooltip },
      titleRef: { current: title },
    } = this;
    const [borderXsize, paddingXsize, width] = ((stylesheet) => {
      const { borderLeftWidth, borderRightWidth, paddingLeft, paddingRight, width } = stylesheet;
      return [
        parseInt(borderLeftWidth) + parseInt(borderRightWidth),
        parseInt(paddingLeft) + parseInt(paddingRight),
        parseInt(width),
      ];
    })(getComputedStyle(tooltip));
    tooltip.style.width = `${width + borderXsize + paddingXsize}px`;
    title.addEventListener('mousemove', (e) => {
      if (e.target == tooltip) return;
      const {
        documentElement: { clientWidth: docWidth },
      } = document;
      if (docWidth < 625) return;
      let newOffset = e.offsetX + width / 2;
      if (e.clientX + width + borderXsize + paddingXsize + 3 >= docWidth)
        newOffset = newOffset - e.clientX - width - borderXsize - paddingXsize + docWidth - 3;
      tooltip.style.left = `${newOffset}px`;
    });
    title.addEventListener('mouseleave', () => {
      delete tooltip.style.removeProperty('left');
    });
  }

  render() {
    return (
      <h2 ref={this.titleRef}>
        {this.props.children}
        <div ref={this.tooltipRef} className="tooltip">
          {this.props.children}
        </div>
      </h2>
    );
  }
}

export class CardList extends Component {
  state = { isLoadingPage: false, ratingMap: moviesAPI.ratingMap };

  loadPage = (pageNumber) => {
    this.setState({ isLoadingPage: true });
    this.props.loadPageHandler(pageNumber, this.props.lastSearch, () => {
      this.setState({ isLoadingPage: false });
    });
  };

  ajustPersonalRating = (movieInfo, value) => {
    const operation = moviesAPI[!value ? 'unsetRating' : 'addRating'];
    const args = !value ? [movieInfo] : [movieInfo, value];
    args.push(() => {
      this.setState(({ ratingMap }) => {
        ratingMap.set(movieInfo.id, value);
        return { ratingMap };
      });
      this.props.onRatingChange(movieInfo.id, value);
    });
    operation.apply(null, args);
  };

  render() {
    const { pageCount } = this.props;
    let { children } = this.props;
    children = children.map((item) => {
      const {
        id,
        title,
        poster_path: poster,
        release_date: releaseDate,
        vote_average: overallRating = 0,
        genre_ids,
      } = item;
      let { overview } = item;
      if (!poster || !overview || !releaseDate) return;
      if (overview.length > movieOverview_maxLength) {
        overview = overview.slice(0, movieOverview_maxLength).replace(/\s\S*$/, ' …');
      }
      return (
        <Card
          key={id}
          bordered
          className="movie-card"
          cover={<img alt="poster" src={`https://image.tmdb.org/t/p/w500${poster}`} />}
        >
          {title.length > movieTitle_compactLength ? <Tooltip>{title}</Tooltip> : <h2>{title}</h2>}
          <span
            className="rating"
            style={{
              borderColor:
                overallRating > 7
                  ? '#66e900'
                  : overallRating > 5
                    ? '#e9d100'
                    : overallRating > 3
                      ? '#e97e00'
                      : '#e90000',
            }}
          >
            {overallRating.toPrecision(2)}
          </span>
          <div className="release-date">{dateFormat(releaseDate, 'MMMM d, yyyy')}</div>
          <moviesAPI.GenresConsumer>{(genres) => genreTags(genre_ids, genres)}</moviesAPI.GenresConsumer>
          <p>{overview}</p>
          <div className="rate-wrapper">
            <Rate
              value={this.state.ratingMap.get(id) || 0}
              allowHalf
              count={10}
              onChange={this.ajustPersonalRating.bind(null, item)}
            />
          </div>
        </Card>
      );
    });
    const pagination = !pageCount ? null : (
      <Pagination
        align="center"
        defaultCurrent={1}
        showSizeChanger={false}
        pageSize={1}
        total={pageCount}
        onChange={this.loadPage}
        style={{ flexBasis: '100%' }}
        disabled={this.state.isLoadingPage}
      />
    );
    return (
      <>
        {children}
        {pagination}
      </>
    );
  }
}
