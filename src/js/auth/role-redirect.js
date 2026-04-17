/* Per PR-04 — route each user to their role dashboard after login. */
const ROLE_ROUTES = {
  admin:     '/app/admin/',
  president: '/app/president/',
  treasurer: '/app/treasurer/',
  secretary: '/app/secretary/',
  member:    '/app/member/',
};

export function destinationFor(role) {
  return ROLE_ROUTES[role] || ROLE_ROUTES.member;
}

export function redirectByRole(role) {
  window.location.assign(destinationFor(role));
}
