import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

export interface CashFlowReport {
  total_income: number;
  total_expense: number;
  net_balance: number;
  incomes: any[];
  expenses: any[];
}

export const useCashFlowReport = (params: { start_date: string; end_date: string; project_id?: string }, options?: any) => {
  return useQuery<CashFlowReport, Error>({
    queryKey: ['cashflow', params],
    queryFn: async () => {
      const response = await apiClient.get<CashFlowReport>('/reports/cashflow', { params });
      return response.data;
    },
    ...options,
  });
};

export const useOperationalReport = (params: { start_date: string; end_date: string }, options?: any) => {
  return useQuery<any, Error>({
    queryKey: ['operational_report', params],
    queryFn: async () => {
      const response = await apiClient.get<any>('/reports/range', { params });
      return response.data;
    },
    ...options,
  });
};
