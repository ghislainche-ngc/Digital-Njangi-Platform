import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        landing:  resolve(__dirname, 'index.html'),
        login:    resolve(__dirname, 'login.html'),
        register: resolve(__dirname, 'register.html'),

        admin:           resolve(__dirname, 'app/admin/index.html'),
        admin_groups:    resolve(__dirname, 'app/admin/groups.html'),
        admin_analytics: resolve(__dirname, 'app/admin/analytics.html'),

        president:          resolve(__dirname, 'app/president/index.html'),
        president_members:  resolve(__dirname, 'app/president/members.html'),
        president_reports:  resolve(__dirname, 'app/president/reports.html'),
        president_settings: resolve(__dirname, 'app/president/settings.html'),

        treasurer:               resolve(__dirname, 'app/treasurer/index.html'),
        treasurer_contributions: resolve(__dirname, 'app/treasurer/contributions.html'),
        treasurer_payouts:       resolve(__dirname, 'app/treasurer/payouts.html'),
        treasurer_fines:         resolve(__dirname, 'app/treasurer/fines.html'),
        treasurer_social:        resolve(__dirname, 'app/treasurer/social-fund.html'),

        secretary:               resolve(__dirname, 'app/secretary/index.html'),
        secretary_directory:     resolve(__dirname, 'app/secretary/directory.html'),
        secretary_announcements: resolve(__dirname, 'app/secretary/announcements.html'),
        secretary_minutes:       resolve(__dirname, 'app/secretary/minutes.html'),

        member:          resolve(__dirname, 'app/member/index.html'),
        member_history:  resolve(__dirname, 'app/member/history.html'),
        member_rotation: resolve(__dirname, 'app/member/rotation.html'),
        member_ledger:   resolve(__dirname, 'app/member/ledger.html'),
        member_profile:  resolve(__dirname, 'app/member/profile.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: '/',
  },
});
