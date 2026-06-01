import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

export interface Vendor {
  id: number;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active: boolean;
  total_balance?: number;
}

export interface VendorTopup {
  id: number;
  vendor_id: number;
  amount: number;
  topup_date: string;
  notes?: string;
  approval_status: string;
}

export interface EquipmentBalance {
  id: number;
  vendor_id: number;
  amount: number;
}


export const useVendors = (options?: any) => {
  return useQuery<Vendor[], Error>({
    queryKey: ['vendors'],
    queryFn: async () => {
      const response = await apiClient.get<Vendor[]>('/vendors');
      return response.data;
    },
    ...options
  });
};

export const useCreateVendor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Vendor>) => {
      const response = await apiClient.post<Vendor>('/vendors', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
};

export const useUpdateVendor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<Vendor> }) => {
      const response = await apiClient.put<Vendor>(`/vendors/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
};

export const useDeleteVendor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/vendors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
};

export const useVendorTopups = (options?: any) => {
  return useQuery<VendorTopup[], Error>({
    queryKey: ['vendor-topups'],
    queryFn: async () => {
      const response = await apiClient.get<VendorTopup[]>('/vendors/topups/all');
      return response.data;
    },
    ...options
  });
};

export const useCreateVendorTopup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post<any>('/vendors/topups', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-topups'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-balances'] });
    },
  });
};

export const useUpdateVendorTopup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const response = await apiClient.put<any>(`/vendors/topups/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-topups'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-balances'] });
    },
  });
};

export const useApproveVendorTopup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const response = await apiClient.put<any>(`/vendors/topups/${id}/approve?status=${status}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-topups'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-balances'] });
    },
  });
};

export const useDeleteVendorTopup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/vendors/topups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-topups'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-balances'] });
    },
  });
};

export const useEquipmentBalances = (options?: any) => {
  return useQuery<EquipmentBalance[], Error>({
    queryKey: ['equipment-balances'],
    queryFn: async () => {
      const response = await apiClient.get<EquipmentBalance[]>('/vendors/equipment-balances/all');
      return response.data;
    },
    ...options
  });
};
