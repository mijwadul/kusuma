import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

// Vendor Trucks
export const useVendorTrucks = (vendorId?: number | string) => {
  return useQuery({
    queryKey: ['vendor-trucks', vendorId],
    queryFn: async () => {
      if (!vendorId) return [];
      const response = await apiClient.get(`/hauling/vendors/${vendorId}/trucks`);
      return response.data;
    },
    enabled: !!vendorId,
  });
};

export const useCreateVendorTruck = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ vendorId, data }: { vendorId: number | string, data: any }) => {
      const response = await apiClient.post(`/hauling/vendors/${vendorId}/trucks`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-trucks', variables.vendorId] });
    },
  });
};

export const useUpdateVendorTruck = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ truckId, data }: { truckId: number | string, data: any }) => {
      const response = await apiClient.put(`/hauling/trucks/${truckId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-trucks'] });
    },
  });
};

export const useDeleteVendorTruck = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (truckId: number | string) => {
      const response = await apiClient.delete(`/hauling/trucks/${truckId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-trucks'] });
    },
  });
};

// Project Hauling Prices
export const useProjectHaulingPrices = (projectId?: number | string) => {
  return useQuery({
    queryKey: ['project-hauling-prices', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const response = await apiClient.get(`/hauling/projects/${projectId}/hauling-prices`);
      return response.data;
    },
    enabled: !!projectId,
  });
};

export const useSetProjectHaulingPrice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: number | string, data: any }) => {
      const response = await apiClient.post(`/hauling/projects/${projectId}/hauling-prices`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-hauling-prices', variables.projectId] });
    },
  });
};

export const useProjectHaulingObligations = (projectId?: number | string) => {
  return useQuery({
    queryKey: ['project-hauling-obligations', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const response = await apiClient.get(`/hauling/projects/${projectId}/hauling-obligations`);
      return response.data;
    },
    enabled: !!projectId,
  });
};

export const useUpdateProjectHaulingPrice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, priceId, data }: { projectId: number, priceId: number, data: any }) => {
      const response = await apiClient.put(`/hauling/projects/${projectId}/hauling-prices/${priceId}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-hauling-prices', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-hauling-obligations', variables.projectId] });
    },
  });
};

export const useDeleteProjectHaulingPrice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, priceId }: { projectId: number, priceId: number }) => {
      await apiClient.delete(`/hauling/projects/${projectId}/hauling-prices/${priceId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-hauling-prices', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-hauling-obligations', variables.projectId] });
    },
  });
};

export const useAllHaulingObligations = () => {
  return useQuery({
    queryKey: ['all-hauling-obligations'],
    queryFn: async () => {
      const response = await apiClient.get('/hauling/obligations');
      return response.data;
    },
  });
};

export const useVendorHaulingDetails = (vendorId: number | string | null | undefined) => {
  return useQuery({
    queryKey: ['vendor-hauling-details', vendorId],
    queryFn: async () => {
      if (!vendorId) return [];
      const response = await apiClient.get(`/hauling/vendors/${vendorId}/hauling-obligations/details`);
      return response.data;
    },
    enabled: !!vendorId,
  });
};

