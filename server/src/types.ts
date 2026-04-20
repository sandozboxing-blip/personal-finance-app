export interface Category {
  id: number;
  name: string;
  display_name: string;
  type: 'expense' | 'income';
  color: string;
  is_active: number;
  sort_order: number;
  created_at: string;
}

export interface Month {
  id: number;
  year: number;
  month: number;
  status: 'active' | 'closed';
  start_balance: number;
  end_balance: number;
  created_at: string;
}

export interface Transaction {
  id: number;
  month_id: number;
  date: string;
  amount: number;
  description: string;
  raw_description: string | null;
  type: 'expense' | 'income' | 'transfer';
  category_id: number | null;
  bank: 'revolut' | 'santander' | 'fibank' | 'manual';
  manually_reviewed: number;
  created_at: string;
}

export interface Budget {
  id: number;
  month_id: number;
  category_id: number;
  planned: number;
}

export interface MerchantRule {
  id: number;
  pattern: string;
  category_id: number | null;
  description_clean: string | null;
  match_amount: number | null;
  match_type: 'contains' | 'regex';
  bank: string | null;
  created_at: string;
}

export interface RawTransaction {
  date: string;
  amount: number;
  description: string;
  raw_description: string;
  type: 'expense' | 'income' | 'transfer';
  bank: 'revolut' | 'santander' | 'fibank' | 'manual';
}

export interface CategorizedTransaction extends RawTransaction {
  category_id: number | null;
  description: string;
}

export interface MonthlySummary {
  income: number;
  expenses: number;
  saved: number;
  start_balance: number;
  end_balance: number;
}

export interface CategoryTotal {
  category_id: number;
  category_name: string;
  display_name: string;
  total: number;
}

export interface AllocationData {
  living_costs: number;
  extra_costs: number;
  necessary_allowance: number;
  allowance_f: number;
  difference: number;
}
