import { api } from '/src/js/api/client.js';
import { session } from '/src/js/auth/session.js';

function showSkeleton() {
  return `
    <div class="grid gap-4 md:grid-cols-3 mb-6">
      <div class="glass-card p-5 animate-pulse"><div class="h-4 bg-muted rounded w-20 mb-2"></div><div class="h-8 bg-muted rounded w-32"></div></div>
      <div class="glass-card p-5 animate-pulse"><div class="h-4 bg-muted rounded w-20 mb-2"></div><div class="h-8 bg-muted rounded w-32"></div></div>
      <div class="glass-card p-5 animate-pulse"><div class="h-4 bg-muted rounded w-20 mb-2"></div><div class="h-8 bg-muted rounded w-32"></div></div>
    </div>
    <div class="glass-card p-0 overflow-hidden">
      <table class="w-full text-sm">
        <tbody class="divide-y divide-[var(--border-subtle)]">
          ${Array(5).fill('<tr><td class="px-5 py-3"><div class="h-4 bg-muted rounded w-32 animate-pulse"></div></td><td><div class="h-4 bg-muted rounded w-20 animate-pulse"></div></td><td><div class="h-4 bg-muted rounded w-16 animate-pulse"></div></td><td><div class="h-4 bg-muted rounded w-20 animate-pulse"></div></td><td><div class="h-4 bg-muted rounded w-16 animate-pulse"></div></td><td class="text-right pr-5"><div class="h-4 bg-muted rounded w-12 animate-pulse"></div></td></tr>').join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showError(message) {
  return `
    <div class="glass-card p-4 mb-6 border-l-4 border-red-500 bg-red-500/10">
      <p class="text-sm text-red-400 font-medium">${message}</p>
      <button onclick="window.location.reload()" class="text-xs text-red-400 underline mt-1">Retry</button>
    </div>
  `;
}

function formatAmount(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function renderStats(stats) {
  return `
    <div class="grid gap-4 md:grid-cols-3 mb-6">
      <div class="glass-card p-5"><p class="text-xs uppercase tracking-widest muted">Collected</p><p class="mt-2 font-display text-3xl font-bold">${formatAmount(stats.collected)}</p><p class="mt-1 text-xs text-emerald-500">${stats.paidCount} of ${stats.totalMembers} members</p></div>
      <div class="glass-card p-5"><p class="text-xs uppercase tracking-widest muted">Due</p><p class="mt-2 font-display text-3xl font-bold">${formatAmount(stats.due)}</p><p class="mt-1 text-xs text-amber-500">${stats.pendingCount} members pending</p></div>
      <div class="glass-card p-5"><p class="text-xs uppercase tracking-widest muted">Failed</p><p class="mt-2 font-display text-3xl font-bold">${stats.failed}</p><p class="mt-1 text-xs text-red-500">${stats.failed > 0 ? 'Auto-retry in 4h' : 'All clear'}</p></div>
    </div>
  `;
}

function renderRows(contributions) {
  const rows = contributions.map(c => {
    const action = c.action 
      ? `<button class="nav-link text-xs">${c.action}</button>` 
      : '<span class="muted text-xs">—</span>';
    return `
      <tr>
        <td class="px-5 py-3 font-medium">${c.memberName}</td>
        <td>${c.method}</td>
        <td class="font-mono">${formatAmount(c.amount)}</td>
        <td>${c.date || '—'}</td>
        <td><span class="chip chip-${c.status}">${c.statusLabel}</span></td>
        <td class="text-right pr-5">${action}</td>
      </tr>
    `;
  }).join('');
  return `
    <div class="glass-card p-0 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="text-left muted uppercase text-xs bg-[var(--bg-muted)]">
          <tr>
            <th class="px-5 py-3">Member</th><th>Method</th><th>Amount</th><th>Date</th><th>Status</th><th class="text-right pr-5">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--border-subtle)]">${rows}</tbody>
      </table>
    </div>
  `;
}

function renderFilters() {
  return `
    <div class="glass-card p-5 mb-6 flex flex-wrap items-center gap-3">
      <select class="glass-input w-auto"><option>Cycle 4 · April</option><option>Cycle 3 · March</option></select>
      <select class="glass-input w-auto"><option>All statuses</option><option>Paid</option><option>Due</option><option>Failed</option></select>
      <div class="flex-1"></div>
      <button class="btn-ghost">↻ Retry all failed</button>
      <button class="btn-primary">+ Record cash payment</button>
    </div>
  `;
}

export async function renderContributions(mountContent) {
  mountContent(showSkeleton());
  try {
    const data = await api.get('/api/contributions');
    mountContent(`
      ${renderStats(data.stats)}
      ${renderFilters()}
      ${renderRows(data.contributions)}
      <p class="mt-4 text-xs muted">PR-13 auto MoMo debit · PR-16 automatic retry · PR-18 manual cash record · PR-20 Orange Money alt.</p>
    `);
  } catch (err) {
    if (err.message.includes('401') || err.message.includes('Unauthorized')) {
      session.clear();
      window.location.href = '/login.html';
      return;
    }
    mountContent(showError(err.message || 'Failed to load contributions'));
  }
}