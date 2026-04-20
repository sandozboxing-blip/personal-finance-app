import type { Category, Month, Transaction, Budget, MonthlySummaryData, ParsedTransaction } from './types';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const monthsApi = {
  getAll: () => apiFetch<Month[]>('/api/months'),
  getOrCreate: (year: number, month: number) => apiFetch<Month>(`/api/months/${year}/${month}`),
  update: (year: number, month: number, data: Partial<Month>) =>
    apiFetch<Month>(`/api/months/${year}/${month}`, { method: 'PUT', body: JSON.stringify(data) }),
  getSummary: (year: number, month: number) =>
    apiFetch<MonthlySummaryData>(`/api/months/${year}/${month}/summary`),
  getAllocation: (year: number, month: number) =>
    apiFetch<{ current: import('./types').AllocationData; previous: import('./types').AllocationData }>(
      `/api/months/${year}/${month}/allocation`
    ),
};

export const transactionsApi = {
  getAll: (params: { monthId?: number; type?: string; categoryId?: number; bank?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params.monthId) qs.set('monthId', String(params.monthId));
    if (params.type) qs.set('type', params.type);
    if (params.categoryId) qs.set('categoryId', String(params.categoryId));
    if (params.bank) qs.set('bank', params.bank);
    if (params.search) qs.set('search', params.search);
    return apiFetch<Transaction[]>(`/api/transactions?${qs.toString()}`);
  },
  create: (data: Omit<Transaction, 'id' | 'created_at' | 'manually_reviewed' | 'category_display_name' | 'category_color' | 'category_name'>) =>
    apiFetch<Transaction>('/api/transactions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Transaction>) =>
    apiFetch<Transaction>(`/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<{ success: boolean }>(`/api/transactions/${id}`, { method: 'DELETE' }),
};

export const categoriesApi = {
  getAll: () => apiFetch<Category[]>('/api/categories'),
  create: (data: Partial<Category>) =>
    apiFetch<Category>('/api/categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Category>) =>
    apiFetch<Category>(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<{ success: boolean } | { error: string; count: number }>(`/api/categories/${id}`, { method: 'DELETE' }),
};

export const budgetsApi = {
  getAll: (monthId: number) => apiFetch<Budget[]>(`/api/budgets?monthId=${monthId}`),
  upsert: (data: { month_id: number; category_id: number; planned: number }) =>
    apiFetch<Budget>('/api/budgets', { method: 'PUT', body: JSON.stringify(data) }),
  copyFromPrevious: (month_id: number) =>
    apiFetch<{ copied: number }>('/api/budgets/copy-from-previous', { method: 'POST', body: JSON.stringify({ month_id }) }),
};

export const importApi = {
  parse: async (file: File, bank: string): Promise<{ transactions: ParsedTransaction[]; count: number }> => {
    const form = new FormData();
    form.append('file', file);
    form.append('bank', bank);
    const res = await fetch('/api/import/parse', { method: 'POST', body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },
  confirm: (transactions: ParsedTransaction[], year: number, month: number) =>
    apiFetch<{ imported: number }>('/api/import/confirm', {
      method: 'POST',
      body: JSON.stringify({ transactions, year, month }),
    }),
};

export const exportApi = {
  download: (year: number, month: number) => {
    window.location.href = `/api/export/${year}/${month}`;
  },
};

export const merchantRulesApi = {
  getAll: () => apiFetch<import('./types').MerchantRule[]>('/api/merchant-rules'),
  create: (data: { pattern: string; category_id: number; description_clean?: string; match_amount?: number | null; match_type?: 'contains' | 'regex' }) =>
    apiFetch<import('./types').MerchantRule>('/api/merchant-rules', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { pattern: string; category_id: number; description_clean?: string; match_amount?: number | null; match_type: 'contains' | 'regex' }) =>
    apiFetch<import('./types').MerchantRule>(`/api/merchant-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<{ success: boolean }>(`/api/merchant-rules/${id}`, { method: 'DELETE' }),
  bulkCategorize: (data: { pattern: string; category_id: number; scope: string; year: number; month: number; match_amount?: number | null; match_type?: 'contains' | 'regex' }) =>
    apiFetch<{ updated: number }>('/api/transactions/bulk-categorize', { method: 'POST', body: JSON.stringify(data) }),
};

export interface TrendPoint {
  label: string;
  year: number;
  month: number;
  income: number;
  expenses: number;
  saved: number;
}

export interface DailyPoint { date: string; amount: number; }

export const analyticsApi = {
  getTrend: () => apiFetch<TrendPoint[]>('/api/analytics/trend'),
  getDaily: (year: number, month: number) =>
    apiFetch<{ current: DailyPoint[]; previous: DailyPoint[] }>(
      `/api/analytics/daily?year=${year}&month=${month}`
    ),
};
