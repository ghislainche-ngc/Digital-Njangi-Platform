import { api } from './client.js';

export async function fetchAdminStats() {
  return api.get('/admin/stats');
}

export async function fetchAdminGroups() {
  const response = await api.get('/admin/groups');
  return response.data || [];
}

export async function updateGroupSubscription(groupId, payload) {
  return api.patch(`/admin/groups/${groupId}/subscription`, payload);
}

export async function updateGroupStatus(groupId, status) {
  return api.patch(`/admin/groups/${groupId}/status`, { status });
}

export async function fetchAdminTransactions() {
  const response = await api.get('/admin/transactions');
  return response.data || [];
}

export async function fetchAdminUsers() {
  const response = await api.get('/admin/users');
  return response.data || [];
}

export async function updateUserRole(userId, is_admin) {
  return api.patch(`/admin/users/${userId}/role`, { is_admin });
}

export async function deleteUser(userId) {
  return api.delete(`/admin/users/${userId}`);
}
