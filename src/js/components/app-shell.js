/* Authenticated app shell — sidebar + topbar + main region.
   Each role dashboard calls renderShell() inside its <body> to mount the chrome.
   Keeps layout logic in one place so Dev A / Dev B don't repeat it. */

import { session } from '/src/js/auth/session.js';
import { destinationFor } from '/src/js/auth/role-redirect.js';

// Every officer is also a contributing member of the Njangi — they pay into the
// pot and sit in the rotation like everyone else. So President / Treasurer /
// Secretary navs include a "My Njangi" block with the same personal pages
// a regular member sees (own history, own rotation turn, own ledger view, own
// profile + wallet settings).
const MEMBER_PERSONAL = [
  { href: '/app/member/history.html',  label: 'my_history',  icon: 'cash' },
  { href: '/app/member/rotation.html', label: 'my_rotation', icon: 'calendar' },
  { href: '/app/member/ledger.html',   label: 'ledger',      icon: 'chart' },
  { href: '/app/member/profile.html',  label: 'profile',     icon: 'cog' },
];

const NAV_BY_ROLE = {
  admin: [
    { href: '/app/admin/',               label: 'overview',  icon: 'grid' },
    { href: '/app/admin/groups.html',    label: 'groups',    icon: 'users' },
    { href: '/app/admin/users.html',      label: 'users',     icon: 'users' },
    { href: '/app/admin/analytics.html', label: 'analytics', icon: 'chart' },
  ],
  president: [
    { section: 'section_manage' },
    { href: '/app/president/',              label: 'overview', icon: 'grid' },
    { href: '/app/president/members.html',  label: 'members',  icon: 'users' },
    { href: '/app/president/reports.html',  label: 'reports',  icon: 'chart' },
    { href: '/app/president/settings.html', label: 'settings', icon: 'cog' },
    { section: 'section_personal' },
    ...MEMBER_PERSONAL,
  ],
  treasurer: [
    { section: 'section_manage' },
    { href: '/app/treasurer/',                   label: 'overview',      icon: 'grid' },
    { href: '/app/treasurer/contributions.html', label: 'contributions', icon: 'cash' },
    { href: '/app/treasurer/payouts.html',       label: 'payouts',       icon: 'send' },
    { href: '/app/treasurer/fines.html',         label: 'fines',         icon: 'alert' },
    { href: '/app/treasurer/social-fund.html',   label: 'social_fund',   icon: 'heart' },
    { section: 'section_personal' },
    ...MEMBER_PERSONAL,
  ],
  secretary: [
    { section: 'section_manage' },
    { href: '/app/secretary/',                   label: 'overview',      icon: 'grid' },
    { href: '/app/secretary/directory.html',     label: 'directory',     icon: 'users' },
    { href: '/app/secretary/announcements.html', label: 'announcements', icon: 'megaphone' },
    { href: '/app/secretary/minutes.html',       label: 'minutes',       icon: 'doc' },
    { section: 'section_personal' },
    ...MEMBER_PERSONAL,
  ],
  member: [
    { href: '/app/member/',             label: 'overview', icon: 'grid' },
    { href: '/app/member/history.html', label: 'history',  icon: 'cash' },
    { href: '/app/member/rotation.html',label: 'rotation', icon: 'calendar' },
    { href: '/app/member/ledger.html',  label: 'ledger',   icon: 'chart' },
    { href: '/app/member/profile.html', label: 'profile',  icon: 'cog' },
  ],
};

const ICONS = {
  grid:     '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  users:    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  chart:    '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  cog:      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  cash:     '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  send:     '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  alert:    '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  megaphone:'<path d="M3 11v3a1 1 0 0 0 1 1h9l5 3V7l-5 3H4a1 1 0 0 0-1 1z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  heart:    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  doc:      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/>',
};

function iconSvg(name) {
  return `<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.grid}</svg>`;
}

export function renderShell({ role, title, mount = '#app-shell' } = {}) {
  /* ── Route guard: redirect unauthenticated or wrong-role users ── */
  if (!session.isAuthenticated()) {
    window.location.assign('/login.html');
    return;
  }
  const sessionUser = session.user();
  if (sessionUser && sessionUser.role && sessionUser.role !== role) {
    // Officers (president/treasurer/secretary) can access member personal pages
    const memberPersonalPaths = ['/app/member/history.html', '/app/member/rotation.html', '/app/member/ledger.html', '/app/member/profile.html'];
    const isOfficerOnMemberPage = ['president', 'treasurer', 'secretary'].includes(sessionUser.role) && memberPersonalPaths.some(p => window.location.pathname.endsWith(p));
    if (!isOfficerOnMemberPage) {
      window.location.assign(destinationFor(sessionUser.role));
      return;
    }
  }

  const user = sessionUser || { full_name: 'Demo User', role };
  const displayName = user.full_name || user.name || 'Demo User';
  const activeRole = user.role || role;
  const items = NAV_BY_ROLE[activeRole] || [];
  const initials = displayName.split(' ').map(s => s[0]).slice(0, 2).join('');
  const path = window.location.pathname.replace(/\/+$/, '/');

  const nav = items.map((it, i) => {
    if (it.section) {
      return `
        <div class="px-3 pt-${i === 0 ? '1' : '4'} pb-1 text-[10px] uppercase tracking-widest muted font-semibold"
             x-text="$t('dashboard.${it.section}')"></div>
      `;
    }
    const active = path === it.href.replace(/\/+$/, '/');
    return `
      <a href="${it.href}" class="nav-link w-full ${active ? 'active' : ''}">
        ${iconSvg(it.icon)}
        <span x-text="$t('dashboard.${it.label}')"></span>
      </a>
    `;
  }).join('');

  document.querySelector(mount).innerHTML = `
    <div x-data="{ mobileMenuOpen: false }" class="flex h-screen overflow-hidden bg-[var(--bg-app)]">
      <!-- Mobile Sidebar Drawer -->
      <div x-show="mobileMenuOpen" class="md:hidden fixed inset-0 z-50 flex" x-cloak>
        <!-- Backdrop -->
        <div @click="mobileMenuOpen = false" x-transition:enter="transition-opacity ease-linear duration-300" x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100" x-transition:leave="transition-opacity ease-linear duration-300" x-transition:leave-start="opacity-100" x-transition:leave-end="opacity-0" class="fixed inset-0 bg-black/60 backdrop-blur-sm"></div>
        
        <!-- Drawer content -->
        <aside x-transition:enter="transition ease-in-out duration-300 transform" x-transition:enter-start="-translate-x-full" x-transition:enter-end="translate-x-0" x-transition:leave="transition ease-in-out duration-300 transform" x-transition:leave-start="translate-x-0" x-transition:leave-end="-translate-x-full" class="relative flex flex-col w-64 max-w-xs h-full p-4 gap-1 bg-[var(--glass-bg-heavy)] border-r border-subtle backdrop-blur-lg">
          <div class="flex items-center justify-between px-3 py-3">
            <a href="/" class="flex items-center gap-2 font-display font-extrabold text-lg">
              <span class="font-display font-black text-2xl tracking-[-0.07em]">
                <span class="text-[#e53238]">N</span><span class="text-[#0064d2]">j</span><span class="text-[#f5af02]">a</span><span class="text-[#86b817]">n</span><span class="text-[#e53238]">g</span><span class="text-[#0064d2]">i</span><span class="text-black dark:text-white ml-0.5">Bridge</span>
              </span>
            </a>
            <button @click="mobileMenuOpen = false" class="nav-link p-1">✕</button>
          </div>
          <div class="px-3 pb-2 text-xs uppercase tracking-widest muted">${activeRole}</div>
          <nav class="flex flex-col gap-1">${nav}</nav>
          <div class="mt-auto glass-card p-3 flex items-center gap-3">
            <div class="h-9 w-9 rounded-full overflow-hidden bg-[var(--bg-muted)] border border-subtle flex items-center justify-center relative select-none">
              <img src="${user.avatar_url || ('https://fcgbqyiwiumzuqnwkzgf.supabase.co/storage/v1/object/public/avatars/' + user.id + '.png')}" 
                   onerror="this.style.display='none'; this.nextElementSibling.style.display='grid'" 
                   class="h-full w-full object-cover" 
                   style="${user.avatar_url ? 'display: block;' : 'display: none;'}" />
              <div class="h-9 w-9 rounded-full accent-bg text-white grid place-items-center font-semibold text-sm" 
                   style="${user.avatar_url ? 'display: none;' : 'display: grid;'}">${initials}</div>
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium truncate">${displayName}</p>
              <p class="text-xs muted truncate">${user.email || 'demo@naas.app'}</p>
            </div>
          </div>
        </aside>
      </div>

      <!-- Desktop Sidebar -->
      <aside class="hidden md:flex md:flex-col w-64 glass-card-heavy rounded-none border-r border-subtle p-4 gap-1 h-full overflow-y-auto">
        <a href="/" class="flex items-center select-none font-display font-black text-2xl tracking-[-0.07em] px-3 py-3">
          <span class="text-[#e53238]">N</span><span class="text-[#0064d2]">j</span><span class="text-[#f5af02]">a</span><span class="text-[#86b817]">n</span><span class="text-[#e53238]">g</span><span class="text-[#0064d2]">i</span><span class="text-black dark:text-white ml-0.5">Bridge</span>
        </span>
      </a>
        <div class="mt-2 px-3 pb-2 text-xs uppercase tracking-widest muted">${activeRole}</div>
        <nav class="flex flex-col gap-1">${nav}</nav>
        <div class="mt-auto glass-card p-3 flex items-center gap-3">
          <div class="h-9 w-9 rounded-full overflow-hidden bg-[var(--bg-muted)] border border-subtle flex items-center justify-center relative select-none">
            <img src="${user.avatar_url || ('https://fcgbqyiwiumzuqnwkzgf.supabase.co/storage/v1/object/public/avatars/' + user.id + '.png')}" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='grid'" 
                 class="h-full w-full object-cover" 
                 style="${user.avatar_url ? 'display: block;' : 'display: none;'}" />
            <div class="h-9 w-9 rounded-full accent-bg text-white grid place-items-center font-semibold text-sm" 
                 style="${user.avatar_url ? 'display: none;' : 'display: grid;'}">${initials}</div>
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">${displayName}</p>
            <p class="text-xs muted truncate">${user.email || 'demo@naas.app'}</p>
          </div>
        </div>
      </aside>

      <!-- Main Container -->
      <div class="flex-1 flex flex-col h-full overflow-hidden">
        <header class="glass-nav sticky top-0 z-30">
          <div class="mx-auto max-w-7xl px-4 md:px-6 py-3 flex items-center gap-4">
            <!-- Mobile Menu Toggle -->
            <button @click="mobileMenuOpen = true" class="md:hidden nav-link p-1.5 mr-1" aria-label="Open menu">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 class="font-display text-lg font-bold">${title || ''}</h1>
            <div class="ml-auto flex items-center gap-2">
              <!-- language -->
              <div x-data="{ open: false }" class="relative">
                <button @click="open = !open" @click.outside="open = false" class="nav-link">
                  <span class="uppercase text-xs font-semibold" x-text="$store.i18n.locale"></span>
                </button>
                <div x-show="open" x-transition class="glass-card absolute right-0 mt-2 w-28 p-1">
                  <template x-for="l in $store.i18n.locales()" :key="l">
                    <button
                      @click="$store.i18n.setLocale(l); open = false"
                      class="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-[var(--bg-muted)]"
                      :class="$store.i18n.locale === l ? 'accent-text font-semibold' : ''"
                      x-text="l.toUpperCase()"
                    ></button>
                  </template>
                </div>
              </div>
              <!-- theme -->
              <button @click="$store.theme.toggle()" class="nav-link">
                <svg x-show="$store.theme.effective === 'light'" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
                <svg x-show="$store.theme.effective === 'dark'" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
                </svg>
              </button>
              <a href="/login.html" id="logout-link" class="nav-link" x-text="$t('dashboard.logout')"></a>
            </div>
          </div>
        </header>
        <main class="flex-1 overflow-y-auto relative z-10 mx-auto w-full max-w-7xl px-4 md:px-6 py-8" id="role-content">
          <!-- role content injected by page -->
        </main>
      </div>
    </div>
  `;

  document.querySelector('#logout-link')?.addEventListener('click', () => {
    session.clear();
  });
}

export function mountContent(html) {
  document.querySelector('#role-content').innerHTML = html;
}
