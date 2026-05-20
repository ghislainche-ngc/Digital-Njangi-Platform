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
          ${Array(4).fill('<tr><td class="px-5 py-3"><div class="h-4 bg-muted rounded w-32 animate-pulse"></div></td><td><div class="h-4 bg-muted rounded w-24 animate-pulse"></div></td><td><div class="h-4 bg-muted rounded w-16 animate-pulse"></div></td><td><div class="h-4 bg-muted rounded w-20 animate-pulse"></div></td><td><div class="h-4 bg-muted rounded w-16 animate-pulse"></div></td><td class="text-right pr-5"><div class="h-4 bg-muted rounded w-20 animate-pulse"></div></td></tr>').join('')}
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
      <div class="glass-card p-5"><p class="text-xs uppercase tracking-widest muted">Outstanding</p><p class="mt-2 font-display text-3xl font-bold">${formatAmount(stats.outstanding)}</p><p class="mt-1 text-xs text-amber-500">${stats.unpaidCount} unpaid fines</p></div>
      <div class="glass-card p-5"><p class="text-xs uppercase tracking-widest muted">Collected YTD</p><p class="mt-2 font-display text-3xl font-bold">${formatAmount(stats.collectedYTD)}</p></div>
      <div class="glass-card p-5"><p class="text-xs uppercase tracking-widest muted">Waivers</p><p class="mt-2 font-display text-3xl font-bold">${stats.waivers}</p><p class="mt-1 text-xs muted">Logged with reason</p></div>
    </div>
  `;
}

function renderRows(fines) {
  const rows = fines.map(f => {
    const actions = f.actions?.length 
      ? f.actions.map(a => `<button class="nav-link text-xs ${a.type === 'waive' ? 'text-amber-500' : ''}">${a.label}</button>`).join(' ')
      : '<span class="muted text-xs">—</span>';
    return `
      <tr>
        <td class="px-5 py-3 font-medium">${f.memberName}</td>
        <td>${f.reason}</td>
        <td class="font-mono">${formatAmount(f.amount)}</td>
        <td>${f.issuedDate}</td>
        <td><span class="chip chip-${f.status}">${f.statusLabel}</span></td>
        <td class="text-right pr-5">${actions}</td>
      </tr>
    `;
  }).join('');
  return `
    <div class="glass-card p-0 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="text-left muted uppercase text-xs bg-[var(--bg-muted)]">
          <tr><th class="px-5 py-3">Member</th><th>Reason</th><th>Amount</th><th>Issued</th><th>Status</th><th class="text-right pr-5">Actions</th></tr>
        </thead>
        <tbody class="divide-y divide-[var(--border-subtle)]">${rows}</tbody>
      </table>
    </div>
  `;
}

export async function renderFines(mountContent) {
  mountContent(showSkeleton());
  try {
    const data = await api.get('/api/fines');
    mountContent(`
      ${renderStats(data.stats)}
      <div class="glass-card p-5 mb-6 flex justify-end"><button class="btn-primary">+ Issue fine</button></div>
      ${renderRows(data.fines)}
      <p class="mt-4 text-xs muted">PR-36 record fine · PR-37 mark paid · PR-38 waiver logged immutably with reason.</p>
    `);
  } catch (err) {
    if (err.message.includes('401') || err.message.includes('Unauthorized')) {
      session.clear();
      window.location.href = '/login.html';
      return;
    }
    mountContent(showError(err.message || 'Failed to load fines'));
  }
}