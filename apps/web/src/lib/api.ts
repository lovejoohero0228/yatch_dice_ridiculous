const API_BASE = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'request failed');
  }
  return response.json();
}

export const api = {
  baseUrl: API_BASE,
  listAccounts: () => request('/accounts'),
  createAccount: (name: string) => request('/accounts', { method: 'POST', body: JSON.stringify({ name }) }),
  leaderboard: () => request('/leaderboard'),
  shop: () => request('/shop'),
  purchaseSkin: (accountId: string, skinId: string) =>
    request(`/accounts/${accountId}/purchase`, { method: 'POST', body: JSON.stringify({ skinId }) }),
  selectSkin: (accountId: string, skinId: string) =>
    request(`/accounts/${accountId}/select-skin`, { method: 'POST', body: JSON.stringify({ skinId }) }),
};
