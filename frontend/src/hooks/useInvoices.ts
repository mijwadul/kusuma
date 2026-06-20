import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

export interface InvoiceItem {
  id?: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
}

export interface Invoice {
  id: number;
  invoice_type: string;
  project_id?: number | null;
  invoice_number: string;
  invoice_date: string;
  start_date: string;
  end_date: string;
  customer_name: string;
  customer_id?: number | null;
  total_amount: number;
  status: string;
  notes?: string;
  discount_type?: string | null;
  discount_value?: number | null;
  discount_amount?: number | null;
  final_amount?: number | null;
  is_downloaded: boolean;
  created_at?: string;
}

export const useInvoices = (options?: any) => {
  return useQuery<Invoice[], Error>({
    queryKey: ['invoices'],
    queryFn: async () => {
      const response = await apiClient.get<Invoice[]>('/invoices');
      return response.data;
    },
    ...options
  });
};

export const useCreateInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Invoice>) => {
      const response = await apiClient.post('/invoices', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
};

export const useUpdateInvoiceStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiClient.put(`/invoices/${id}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
};

export const useDeleteInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/invoices/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
};
