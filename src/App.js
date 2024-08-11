import { Component } from 'react';
import { Alert, Button, Input, Spin, Flex, Tabs } from 'antd';
import { LoadingOutlined, WarningTwoTone } from '@ant-design/icons';
import debounce from 'lodash.debounce';

import moviesAPI from './api.js';
import { CardList } from './CardList.js';
import './style.css';

class App extends Component {
  constructor() {
    super();
    this.state = { isBusy: true, tab: 'search' };
    this.performSearch = debounce(async (e) => {
      if (!e.target.value) return;
      this.setState({ isBusy: true, status: 'Searching…' });
      const result = await moviesAPI.search(e.target.value);
      if (result.error) {
        result.error.title = 'Search error';
        this.finishJobWithError(result.error);
        return;
      }
      if (result.total_results == 0) {
        this.setState({
          view: (
            <Alert message={`No movies found for "${e.target.value}"`} className="search-results-info" type="info" />
          ),
          pageCount: 0,
          isBusy: false,
        });
        return;
      }
      result.query = e.target.value;
      this.displayResults(result);
    }, 1250);
    this.goToPage = async (pageNumber, lastSearch, callback) => {
      const result = await moviesAPI.search(lastSearch, pageNumber);
      if (result.error) {
        this.finishJobWithError(result.error);
        return;
      }
      result.query = lastSearch;
      this.displayResults(result);
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
      callback();
    };
    this.switchToTab = (tabKey) => {
      const tab = tabKey.replace('tab-', '');
      if (tab == 'search') {
        this.setState({ tab, isBusy: true }, async () => {
          const result = await moviesAPI.search('return');
          if (result.error) {
            this.finishJobWithError(result.error);
            return;
          }
          result.query = 'return';
          this.displayResults(result);
        });
        return;
      }
      this.setState({ tab }, () => {
        this.displayResults(this.state.ratedMovies);
      });
    };
    this.movieRatingHandler = (movieID, ratingAmount) => {
      const idx = this.state.ratedMovies.results.findIndex((ent) => ent.id == movieID);
      if (~idx)
        this.setState(
          ({ ratedMovies }) => {
            const { results } = ratedMovies;
            if (ratingAmount === 0) {
              ratedMovies.results = [...results.slice(0, idx), ...results.slice(idx + 1)];
            } else {
              ratedMovies.results[idx] = { ...results[idx], rating: ratingAmount };
            }
            return { ratedMovies };
          },
          async () => {
            if (this.state.tab == 'rated') this.displayResults(this.state.ratedMovies);
          }
        );
    };
  }

  finishJobWithError(info) {
    const title = info.title || 'Connection error';
    const { details = [] } = info;
    let msg = details.map((detailsMsg, idx) => <p key={idx}>{detailsMsg}</p>);
    msg = [<p key="msg-primary">{info.message}</p>, ...msg];
    this.setState({
      view: (
        <Flex vertical align="center" style={{ flexBasis: '80%' }}>
          <WarningTwoTone twoToneColor="#f90" className="api-warning" />
          <Alert
            className="api-alert"
            message={<b>{title}</b>}
            description={msg}
            type="error"
            style={{ margin: '12px 0', width: '100%' }}
          />
          <Button size="small" type="primary">
            Try again
          </Button>
        </Flex>
      ),
      status: undefined,
      isBusy: false,
    });
  }

  displayResults(info) {
    this.setState(() => ({
      isBusy: false,
      status: undefined,
      view: (
        <CardList
          pageCount={info.total_pages}
          lastSearch={info.query}
          loadPageHandler={this.goToPage}
          onRatingChange={this.movieRatingHandler}
        >
          {info.results}
        </CardList>
      ),
    }));
  }

  async componentDidMount() {
    this.movieGenres = await moviesAPI.getGenres();
    if (this.movieGenres.error) {
      this.movieGenres.error.title = 'Movie genres error';
      this.finishJobWithError(this.movieGenres.error);
      return;
    }
    this.movieGenres = this.movieGenres.genres;
    const ratedMovies = await moviesAPI.getRatedMovies();
    if (ratedMovies.error) {
      this.finishJobWithError(ratedMovies.error);
      return;
    }
    this.setState({ ratedMovies });
    moviesAPI.ratingMap = new Map(ratedMovies.results.map((ent) => [ent.id, ent.rating]));
    const searchResults = await moviesAPI.search('return');
    if (searchResults.error) {
      this.finishJobWithError(searchResults.error);
      return;
    }
    searchResults.query = 'return';
    this.displayResults(searchResults);
  }

  render() {
    const { isBusy, status, view } = this.state;
    const representation = isBusy ? (
      <Flex justify="center" align="center" gap="middle" style={{ width: '100%' }}>
        <Spin
          indicator={
            <LoadingOutlined
              style={{
                fontSize: 31,
              }}
              spin
            />
          }
        />
        <h2>{status || 'Loading data'}</h2>
      </Flex>
    ) : (
      view
    );
    return (
      <>
        <Tabs
          style={{ alignSelf: 'center' }}
          defaultActiveKey="tab-search"
          onChange={this.switchToTab}
          items={[
            {
              label: 'Search',
              key: 'tab-search',
            },
            {
              label: 'Rated',
              disabled: this.state.isBusy,
              key: 'tab-rated',
            },
          ]}
        />
        <div style={{ flexBasis: '100%', height: '0' }}></div>
        {this.state.tab == 'search' ? (
          <Input placeholder="Type to search…" onChange={this.performSearch} className="input-search" />
        ) : null}
        <div style={{ flexBasis: '100%', height: '0' }}></div>
        <moviesAPI.GenresProvider value={this.movieGenres}>{representation}</moviesAPI.GenresProvider>
      </>
    );
  }
}

export default App;
