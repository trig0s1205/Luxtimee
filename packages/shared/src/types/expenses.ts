export interface ExpenseDto {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  spentAt: string;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpensesListDto {
  items: ExpenseDto[];
  total: number;
  page: number;
  limit: number;
}

export interface ExpenseSummaryDto {
  period: 'day' | 'week' | 'month' | 'all';
  total: number;
  count: number;
  items: ExpenseDto[];
}

export interface CreateExpenseDto {
  name: string;
  description?: string;
  amount: number;
  spentAt?: string;
}

export interface UpdateExpenseDto {
  name?: string;
  description?: string | null;
  amount?: number;
  spentAt?: string;
}
