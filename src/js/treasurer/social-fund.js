import { api } from '/src/js/api/client.js';
import { session } from '/src/js/auth/session.js';

function showSkeleton() {
  return `
    <div class="grid gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2 glass-card p-6 animate-pulse"><div class="h-4 bg-muted rounded w-32 mb-2"></div><div class="h-12 bg-muted rounded w-48 mb-2"></div><div class="h-4 bg-muted rounded w-64 mb-6"></div><div class="h-8 bg-muted rounded w-32 mb-4"></div><div class="h-4 bg-muted rounded w-full mb-2"></div><div class="h-4 bg-muted rounded w-full mb-2"></div></div>
      <div class="glass-card p-6 animate-pulse"><div class="h-6 bg-muted rounded w-32 mb-4"></div><div class="h-4 bg-muted rounded w-full mb-2"></div><div class="h-4 bg-muted rounded w-full mb-2"></div><div class="h-8 bg-muted rounded w-full mt-4"></div></div>
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

function renderBalance(balance) {
  return `
    <div class="lg:col-span-2 glass-card p-6">
      <p class="text-xs uppercase tracking-widest muted">Current balance</p>
      <p class="mt-2 font-display text-5xl font-bold">${formatAmount(balance.amount)} FCFA</p>
      <p class="mt-1 text-sm muted">${balance.description}</p>
      <div class="mt-6 flex gap-3">
        <button class="btn-primary">+ Deposit</button>
        <button class="btn-ghost">− Withdraw</button>
      </div>
      <h3 class="font-semibold text-sm mt-8 mb-3">Recent activity</h3>
      <ul class="divide-y divide-[var(--border-subtle)]">
        ${balance.activity.map(a => `
          <li class="flex items-center justify-between py-3">
            <div><p class="text-sm font-medium">${a.description}</p><p class="text-xs muted">${a.date} · ${a.type}</p></div>
            <span class="chip chip-${a.status} font-mono">${a.amount > 0 ? '+' : '−'} ${formatAmount(Math.abs(a.amount))}</span>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

function renderRules(rules) {
  return `
    <div class="glass-card p-6">
      <h3 class="font-display text-lg font-bold mb-3">Contribution rule</h3>
      <p class="text-sm muted">${rules.description}</p>
      <div class="mt-6">
        <label class="text-xs font-semibold uppercase tracking-wider muted">Per-cycle amount (FCFA)</label>
        <input class="glass-input mt-1" type="number" value="${rules.perCycleAmount}" />
      </div>
      <div class="mt-4">
        <label class="text-xs font-semibold uppercase tracking-wider muted">Approval threshold</label>
        <input class="glass-input mt-1" type="number" value="${rules.approvalThreshold}" />
        <p class="mt-1 text-xs muted">Withdrawals above require President sign-off.</p>
      </div>
      <button class="btn-primary w-full mt-6">Save rules</button>
    </div>
  `;
}

export async function renderSocialFund(mountContent) {
  mountContent(showSkeleton());
  try {
    const data = await api.get('/api/social-fund');
    mountContent(`
      <div class="grid gap-6 lg:grid-cols-3">
        ${renderBalance(data.balance)}
        ${renderRules(data.rules)}
      </div>
      <p class="mt-4 text-xs muted">PR-39: separate social fund, deposits, withdrawals, current balance.</p>
    `);
  } catch (err) {
    if (err.message.includes('401') || err.message.includes('Unauthorized')) {
      session.clear();
      window.location.href = '/login.html';
      return;
    }
    mountContent(showError(err.message || 'Failed to load social fund'));
  }
}