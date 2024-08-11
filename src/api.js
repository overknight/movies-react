import { createContext } from 'react';
import { Modal } from 'antd';

const API_BASE = 'https://api.themoviedb.org/3';

const defaultGetHeaders = {
  Authorization: `Bearer ${process.env.REACT_APP_API_KEY}`,
  accept: 'application/json',
};

const ResponseError = function (response, statusCode) {
  this.error = new Error(`Fetch response code: ${statusCode}`);
  this.error.details = [];
  const { status_message, status_code } = response;
  const hasStatusCode = typeof status_code === typeof Number();
  let detailsMsg = '';
  if (status_message) {
    detailsMsg = status_message;
    if (hasStatusCode) detailsMsg += ` (status code: ${status_code})`;
  } else if (!status_message && hasStatusCode) detailsMsg = `API status code: ${status_code}`;
  if (detailsMsg.length > 0) this.error.details.push(detailsMsg);
};

const getGuestSessionID = () => {
  const [id, expiresAt] = (localStorage.getItem('guestSessionInfo') || '\n').split('\n');
  if (!id && !expiresAt) {
    return fetch(`${API_BASE}/authentication/guest_session/new`, {
      headers: defaultGetHeaders,
    })
      .then((result) => {
        if (!result.ok) throw new Error('Failed to create guest session');
        return result.json();
      })
      .then(({ guest_session_id: id, expires_at: expiresAt }) => {
        localStorage.setItem('guestSessionInfo', `${id}\n${expiresAt}`);
        return id;
      });
  }
  return Promise.resolve(id);
};

const cachedRatedMovies = {};

const genresContext = createContext();

export default class {
  static GenresProvider = genresContext.Provider;

  static GenresConsumer = genresContext.Consumer;

  static search = (query, pageNumber) =>
    fetch(
      `${API_BASE}/search/movie?query=${query}&include_adult=true&language=en-US${pageNumber ? `&page=${pageNumber}` : ''}`,
      {
        headers: defaultGetHeaders,
      }
    ).then(
      (result) => {
        if (result.ok) return result.json();
      },
      (error) => ({ error })
    );

  static async getRatedMovies() {
    if (!cachedRatedMovies.results) {
      try {
        const guestSessionID = await getGuestSessionID();
        let result = await fetch(`${API_BASE}/guest_session/${guestSessionID}/rated/movies`, {
          headers: defaultGetHeaders,
        });
        const responseCode = result.status;
        result = await result.json();
        if (responseCode == 200 || responseCode == 404) cachedRatedMovies.results = [];
        else {
          const { error } = new ResponseError(result, responseCode);
          throw error;
        }
        if (responseCode == 200) {
          result.total_pages = result.total_pages || 1;
          let pageNumber = 1;
          do {
            for (const movie of result.results) {
              cachedRatedMovies.results.push(movie);
            }
            if (pageNumber == result.total_pages) break;
            result = await fetch(`${API_BASE}/guest_session/${guestSessionID}/rated/movies&page=${pageNumber}`);
            pageNumber++;
          } while (pageNumber != result.total_pages);
        }
      } catch (error) {
        error.title = 'Rated movies error';
        return { error };
      }
    }
    return cachedRatedMovies;
  }

  static getGenres = () =>
    fetch(`${API_BASE}/genre/movie/list`, {
      headers: defaultGetHeaders,
    })
      .then(
        (result) => {
          if (!result.ok)
            return result.json().then((responseInfo) => {
              const statusCode = result.status;
              throw { responseInfo, statusCode };
            });
          return result.json();
        },
        (error) => ({ error })
      )
      .catch(({ responseInfo, statusCode }) => new ResponseError(responseInfo, statusCode));

  static addRating(movieInfo, value, callback) {
    getGuestSessionID()
      .then((sessionID) => {
        return fetch(`https://api.themoviedb.org/3/movie/${movieInfo.id}/rating?guest_session_id=${sessionID}`, {
          method: 'POST',
          headers: { ...defaultGetHeaders, 'Content-Type': 'application/json;charset=utf-8' },
          body: JSON.stringify({ value }),
        });
      })
      .then(async (response) => {
        if (!response.ok) {
          console.log(await response.json());
          throw new Error(`Fetch response code: ${response.status}`);
        }
        const idx = cachedRatedMovies.results.findIndex((ent) => ent.id == movieInfo.id);
        if (!~idx) cachedRatedMovies.results.push(movieInfo);
        return response.json();
      })
      .then(callback)
      .catch((err) => {
        Modal.error({
          title: `Failed to rate movie "${movieInfo.title}"`,
          content: err.message,
        });
      });
  }

  static unsetRating(movieInfo, callback) {
    getGuestSessionID()
      .then((sessionID) => {
        return fetch(`https://api.themoviedb.org/3/movie/${movieInfo.id}/rating?guest_session_id=${sessionID}`, {
          method: 'DELETE',
          headers: defaultGetHeaders,
        });
      })
      .then(async (response) => {
        if (!response.ok) {
          console.log(await response.json());
          throw new Error(`Fetch response code: ${response.status}`);
        }
        return response.json();
      })
      .then(callback)
      .catch((err) => {
        Modal.error({
          title: `Failed to remove rating for movie "${movieInfo.title}"`,
          content: err.message,
        });
      });
  }
}
