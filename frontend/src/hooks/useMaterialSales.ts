import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

export interface IncomeRecord {
  id: number;
  income_date: string;
  income_type: string;
  amount: number;
  description?: string;
  payment_method: string;
  notes?: string;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  
  // Specific to material sales
  customer_name?: string;
  license_plate?: string;
  driver_name?: string;
  vehicle_type?: string;
  material_type?: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  project_id?: number;
  sj_length?: number;
  sj_width?: number;
  sj_height?: number;
  sj_volume_minus?: number;
  sj_gross_weight?: number;
  sj_tare_weight?: number;
  sj_weight_minus?: number;
}

export interface MaterialPrice {
  id: number;
  material_type: string;
  unit: string;
  price_per_unit: number;
  vehicle_type?: string;
  customer_name?: string;
  is_active: boolean;
  notes?: string;
}

export const useIncomeRecords = (params?: any, options?: any) => {
  return useQuery<IncomeRecord[], Error>({
    queryKey: ['income-records', params],
    queryFn: async () => {
      const response = await apiClient.get<IncomeRecord[]>('/income-records', { params });
      return response.data;
    },
    ...options
  });
};

export const useMaterialPrices = (params?: any, options?: any) => {
  return useQuery<MaterialPrice[], Error>({
    queryKey: ['material-prices', params],
    queryFn: async () => {
      const response = await apiClient.get<MaterialPrice[]>('/material-prices', { params });
      return response.data;
    },
    ...options
  });
};

export const useCreateIncomeRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<IncomeRecord>) => {
      const response = await apiClient.post('/income-records', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-records'] });
    },
  });
};

export const useUpdateIncomeRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<IncomeRecord> }) => {
      const response = await apiClient.put(`/income-records/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-records'] });
    },
  });
};

export const useDeleteIncomeRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/income-records/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-records'] });
    },
  });
};

export const useCreateMaterialPrice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<MaterialPrice>) => {
      const response = await apiClient.post('/material-prices', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-prices'] });
    },
  });
};

export const useUpdateMaterialPrice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<MaterialPrice> }) => {
      const response = await apiClient.put(`/material-prices/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-prices'] });
    },
  });
};

export const useDeleteMaterialPrice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/material-prices/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-prices'] });
    },
  });
};

export const useAddCustomerTruck = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ customerId, data }: { customerId: number; data: any }) => {
      const response = await apiClient.post(`/projects-data/customers/${customerId}/trucks`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useBulkUpdateSJ = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const response = await apiClient.put(`/income-records/bulk-sj`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-records'] });
    },
  });
};
