import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

import { EquipmentRateHistory } from '../types/equipmentRateHistory';

export interface Equipment {
  id: number;
  name: string;
  brand?: string;
  type: string;
  capacity?: number;
  location?: string;
  status: string;
  ownership_status: string;
  rental_rate_per_hour?: number;
  pending_rental_rate_per_hour?: number | null;
  locked_balance_for_pending_rate?: number | null;
  pending_rate_effective_date?: string | null;
  vendor_id?: number;
}

export const useEquipment = (options?: any) => {
  return useQuery<Equipment[], Error>({
    queryKey: ['equipment'],
    queryFn: async () => {
      const response = await apiClient.get<Equipment[]>('/equipment');
      return response.data;
    },
    ...options
  });
};

export const useCreateEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Equipment>) => {
      const response = await apiClient.post<Equipment>('/equipment', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
};

export const useUpdateEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<Equipment> }) => {
      const response = await apiClient.put<Equipment>(`/equipment/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
};

export const useDeleteEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/equipment/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
};

export const useEquipmentFuelReport = (options?: any) => {
  return useQuery<any[], Error>({
    queryKey: ['equipment-fuel-report'],
    queryFn: async () => {
      const response = await apiClient.get<any[]>('/fuel/equipment-report');
      return response.data;
    },
    ...options
  });
};

export const useEquipmentRateHistory = (equipmentId: number, options?: any) => {
  return useQuery<EquipmentRateHistory[], Error>({
    queryKey: ['equipment-rate-history', equipmentId],
    queryFn: async () => {
      const response = await apiClient.get<EquipmentRateHistory[]>(`/equipment/${equipmentId}/rate-history`);
      return response.data;
    },
    enabled: !!equipmentId,
    ...options
  });
};

import { LedgerItem } from '../types/ledger';

export const useEquipmentLedger = (equipmentId: number, options?: any) => {
  return useQuery<LedgerItem[], Error>({
    queryKey: ['equipment-ledger', equipmentId],
    queryFn: async () => {
      const response = await apiClient.get<LedgerItem[]>(`/equipment/${equipmentId}/ledger`);
      return response.data;
    },
    enabled: !!equipmentId,
    ...options
  });
};
