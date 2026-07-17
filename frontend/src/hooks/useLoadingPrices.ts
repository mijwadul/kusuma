import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

export interface LoadingPrice {
  id: number;
  project_id: number | null;
  vendor_id: number | null;
  unit_type: string;
  price: number;
  effective_date: string;
  created_at: string;
}

export interface LoadingPriceFormData {
  project_id: number | null;
  vendor_id: number | null;
  unit_type: string;
  price: number;
  effective_date: string;
}

export const useLoadingPrices = () => {
  const queryClient = useQueryClient();

  const pricesQuery = useQuery({
    queryKey: ['loading-prices'],
    queryFn: async () => {
      const response = await apiClient.get<LoadingPrice[]>('/loading-prices');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: LoadingPriceFormData) => {
      const response = await apiClient.post('/loading-prices', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loading-prices'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<LoadingPriceFormData> }) => {
      const response = await apiClient.put(`/loading-prices/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loading-prices'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/loading-prices/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loading-prices'] });
    },
  });

  return {
    prices: pricesQuery.data || [],
    isLoading: pricesQuery.isLoading,
    error: pricesQuery.error,
    createPrice: createMutation.mutateAsync,
    updatePrice: updateMutation.mutateAsync,
    deletePrice: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
