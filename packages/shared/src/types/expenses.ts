import type { ExpenseOrigin } from '../index.js';

export interface ExpenseOriginTotals {
  PLATAFORMA: number;
  LOCAL: number;
}

export interface ExpenseDto {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  spentAt: string;
  origin: ExpenseOrigin;
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
  totalAmount: number;
  totalsByOrigin: ExpenseOriginTotals;
}

export interface ExpenseSummaryDto {
  period: 'day' | 'week' | 'month' | 'all';
  total: number;
  count: number;
  items: ExpenseDto[];
  byOrigin: ExpenseOriginTotals;
}

export interface CreateExpenseDto {
  name: string;
  description?: string;
  amount: number;
  spentAt?: string;
  origin?: ExpenseOrigin;
}

export interface UpdateExpenseDto {
  name?: string;
  description?: string | null;
  amount?: number;
  spentAt?: string;
  origin?: ExpenseOrigin;
}
