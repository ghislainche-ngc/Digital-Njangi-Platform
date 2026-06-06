import { api } from '/src/js/api/client.js';
import { session } from '/src/js/auth/session.js';

function showSkeleton() {
  return `
    <div class="grid gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2 glass-card p-6 animate-pulse"><div class="h-6 bg-muted rounded w-32 mb-4"></div><div class="h-20 bg-muted rounded mb-4"></div><div class="h-4 bg-muted rounded w-full mb-2"></div><div class="h-4 bg-muted rounded w-full mb-2"></div></div>
      <div class="glass-card p-6 animate-pulse"><div class="h-6 bg-muted rounded w-24 mb-4"></div><div class="h-4 bg-muted rounded w-full mb-2"></div><div class="h-4 bg-muted rounded w-full mb-2"></div></div>
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

function renderNextPayout(next) {
  const initials = next.recipientName.split(' ').map(n => n[0]).slice(0, 2).join('');
  return `
    <div class="lg:col-span-2 glass-card p-6">
      <div class="flex items-center justify-between mb-5">
        <h2 class="font-display text-xl font-bold">Next payout</h2>
        <span class="chip chip-info">${next.cycleName} · ${next.drawType}</span>
      </div>
      <div class="flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-muted)]">
        <div class="h-14 w-14 rounded-full accent-bg text-[var(--text-on-brand)] grid place-items-center font-bold">${initials}</div>
        <div class="flex-1">
          <p class="font-display text-2xl font-bold">${next.recipientName}</p>
          <p class="text-sm muted">${next.method} · ${next.phone}</p>
        </div>
        <div class="text-right">
          <p class="font-display text-2xl font-bold">${formatAmount(next.amount)}</p>
          <p class="text-xs muted">FCFA · ${next.date}</p>
        </div>
      </div>
      <h3 class="font-semibold mt-6 mb-3 text-sm">Eligibility (PR-21)</h3>
      <ul class="space-y-2 text-sm">
        ${next.eligibility.map(e => `<li class="flex items-center gap-2"><span class="chip chip-${e.met ? 'paid' : 'due'}">${e.met ? '✓' : '○'}</span> ${e.label}</li>`).join('')}
      </ul>
      <h3 class="font-semibold mt-6 mb-3 text-sm">Delivery method</h3>
      <div class="grid grid-cols-3 gap-3">
        ${next.methods.map(m => `<button class="glass-card p-3 text-center ${m.selected ? 'ring-2 ring-[var(--accent)]' : ''}"><p class="font-semibold text-sm">${m.name}</p><p class="text-xs muted mt-1">${m.description}</p></button>`).join('')}
      </div>
      <div class="mt-6 flex gap-3">
        <button class="btn-ghost flex-1">Decline</button>
        <button class="btn-primary flex-1">Trigger payout</button>
      </div>
    </div>
  `;
}

function renderHistory(history) {
  return `
    <div class="glass-card p-6">
      <h2 class="font-display text-xl font-bold mb-4">History</h2>
      <ol class="space-y-3 text-sm">
        ${history.map(p => `
          <li class="flex items-center justify-between py-2 border-b border-subtle last:border-0">
            <div><p class="font-medium">${p.recipientName}</p><p class="text-xs muted">${p.cycleName} · ${p.date}</p></div>
            <span class="font-mono">${formatAmount(p.amount)}</span>
          </li>
        `).join('')}
      </ol>
    </div>
  `;
}

export async function renderPayouts(mountContent) {
  mountContent(showSkeleton());
  try {
    const data = await api.get('/api/payouts');
    mountContent(`
      <div class="grid gap-6 lg:grid-cols-3">
        ${renderNextPayout(data.next)}
        ${renderHistory(data.history)}
      </div>
      <p class="mt-6 text-xs muted">PR-26 three delivery methods · PR-27 notify all members · PR-29 PDF receipt · PR-30 fraud alert on self-payout.</p>
    `);
  } catch (err) {
    if (err.message.includes('401') || err.message.includes('Unauthorized')) {
      session.clear();
      window.location.href = '/login.html';
      return;
    }
    mountContent(showError(err.message || 'Failed to load payouts'));
  }
}