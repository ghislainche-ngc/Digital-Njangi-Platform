import { api } from './client.js';
import { session } from '../auth/session.js';

const GROUP_STORAGE_KEY = 'naas.groupId';

function queryGroupId() {
  return new URLSearchParams(window.location.search).get('groupId') || '';
}

function withQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  return query.toString() ? `?${query.toString()}` : '';
}

export function getStoredGroupId() {
  return localStorage.getItem(GROUP_STORAGE_KEY) || '';
}

export function setStoredGroupId(groupId) {
  if (groupId) {
    localStorage.setItem(GROUP_STORAGE_KEY, groupId);
  } else {
    localStorage.removeItem(GROUP_STORAGE_KEY);
  }
}

export function clearStoredGroupId() {
  localStorage.removeItem(GROUP_STORAGE_KEY);
}

export async function loadMyGroups() {
  const response = await api.get('/groups/mine');
  return response.data || [];
}

export async function resolveGroupContext() {
  const groups = await loadMyGroups();
  const activeGroupId = queryGroupId() || getStoredGroupId() || groups[0]?.id || '';

  if (activeGroupId) {
    setStoredGroupId(activeGroupId);
  }

  const activeGroup = groups.find((group) => group.id === activeGroupId) || null;
  if (activeGroup && activeGroup.role) {
    const user = session.user();
    if (user && user.role !== activeGroup.role) {
      user.role = activeGroup.role;
      user.group_id = activeGroupId;
      session.set(session.token(), user);
    }
  }

  return {
    groups,
    activeGroupId,
    activeGroup,
  };
}

export function groupLabel(group) {
  if (!group) return 'No group selected';
  const parts = [group.name];
  if (group.frequency) parts.push(group.frequency);
  if (group.contribution_amount) parts.push(`${Number(group.contribution_amount).toLocaleString()} FCFA`);
  return parts.join(' · ');
}

export async function createGroup(payload) {
  return api.post('/groups', payload);
}

export async function getGroup(groupId) {
  return api.get(`/groups/${groupId}`);
}

export async function listMembers(groupId) {
  return api.get(`/groups/${groupId}/members`);
}

export async function listContributions(groupId, params = {}) {
  return api.get(`/groups/${groupId}/contributions${withQuery(params)}`);
}

export async function getContributionStats(groupId) {
  return api.get(`/groups/${groupId}/contributions/stats`);
}

export async function initiateContributionPayment(groupId, gateway) {
  return api.post(`/groups/${groupId}/contributions/pay`, { gateway });
}

export async function recordCashContribution(groupId, memberId, amount, notes = '') {
  return api.post(`/groups/${groupId}/contributions/cash`, { memberId, amount, notes });
}

export async function retryContributionPayment(groupId, contributionId, gateway) {
  return api.post(`/groups/${groupId}/contributions/${contributionId}/retry`, { gateway });
}

export async function listPayouts(groupId, params = {}) {
  return api.get(`/groups/${groupId}/payouts${withQuery(params)}`);
}

export async function getCurrentPayout(groupId) {
  return api.get(`/groups/${groupId}/payouts/current`);
}

export async function determineNextRecipient(groupId) {
  return api.post(`/groups/${groupId}/payouts/determine-next-recipient`);
}

export async function nominatePayout(groupId, recipientId, deliveryMethod, notes = '') {
  return api.post(`/groups/${groupId}/payouts/nominate`, { recipientId, deliveryMethod, notes });
}

export async function approvePayout(groupId, payoutId) {
  return api.post(`/groups/${groupId}/payouts/${payoutId}/approve`, {});
}

export async function executePayout(groupId, payoutId, deliveryMethod) {
  return api.post(`/groups/${groupId}/payouts/${payoutId}/execute`, { deliveryMethod });
}

export async function listGroupFines(groupId) {
  return api.get(`/groups/${groupId}/fines`);
}

export async function listMyFines(groupId) {
  return api.get(`/groups/${groupId}/fines/mine`);
}

export async function recordFine(groupId, memberId, amount, reason) {
  return api.post(`/groups/${groupId}/fines`, { memberId, amount, reason });
}

export async function markFinePaid(groupId, fineId, paymentMethod = 'cash') {
  return api.patch(`/groups/${groupId}/fines/${fineId}/pay`, { paymentMethod });
}

export async function waiveFine(groupId, fineId, reason) {
  return api.patch(`/groups/${groupId}/fines/${fineId}/waive`, { reason });
}

export async function getSocialFundBalance(groupId) {
  return api.get(`/groups/${groupId}/social-fund`);
}

export async function listSocialFundEvents(groupId) {
  return api.get(`/groups/${groupId}/social-fund/events`);
}

export async function recordSocialFundDeposit(groupId, amount, reason) {
  return api.post(`/groups/${groupId}/social-fund/deposit`, { amount, reason });
}

export async function recordSocialFundWithdrawal(groupId, amount, reason) {
  return api.post(`/groups/${groupId}/social-fund/withdrawal`, { amount, reason });
}

export async function getGroupLedger(groupId) {
  return api.get(`/groups/${groupId}/reports/ledger`);
}

export async function getGroupSummary(groupId) {
  return api.get(`/groups/${groupId}/reports/summary`);
}

export async function getMyHistory(groupId) {
  return api.get(`/groups/${groupId}/reports/my-history`);
}

export async function exportPDFReport(groupId) {
  return api.post(`/groups/${groupId}/reports/export`, {});
}

export async function getMyContributions(groupId) {
  return api.get(`/groups/${groupId}/contributions/mine`);
}

export async function updateSettings(groupId, payload) {
  return api.patch(`/groups/${groupId}`, payload);
}

export async function renewSubscription(groupId, gateway) {
  return api.post(`/groups/${groupId}/billing/renew`, { gateway });
}

export async function updateGroupGateway(groupId, gateway) {
  return api.patch(`/groups/${groupId}/gateway`, { gateway });
}

export async function updateGroupPayoutGateway(groupId, payout_gateway) {
  return api.patch(`/groups/${groupId}/payout-gateway`, { payout_gateway });
}

export async function inviteMember(groupId, phone) {
  return api.post(`/groups/${groupId}/invitations`, { phone });
}

export async function updateMemberRole(groupId, userId, role) {
  return api.patch(`/groups/${groupId}/members/${userId}/role`, { role });
}

export async function removeMember(groupId, userId) {
  return api.delete(`/groups/${groupId}/members/${userId}`);
}