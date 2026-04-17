const TOKEN_KEY = 'naas.jwt';
const USER_KEY  = 'naas.user';

export const session = {
  set(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  user() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  },
  isAuthenticated() {
    return Boolean(this.token());
  },
};
