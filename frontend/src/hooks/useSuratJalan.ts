import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

export interface SuratJalanCreate {
  project_id: number;
  nama_supir: string;
  nopol: string;
  asal_tambang: string;
  
  // Tonase
  bruto?: number;
  tarra?: number;
  
  // Kubikasi
  panjang?: number;
  lebar?: number;
  tinggi?: number;
}

export const useCreateSuratJalan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SuratJalanCreate) => {
      const response = await apiClient.post('/surat-jalan', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surat-jalans'] });
    },
  });
};

export const useProjectSuratJalans = (projectId?: number | string) => {
  return useQuery({
    queryKey: ['surat-jalans', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const response = await apiClient.get(`/projects/${projectId}/surat-jalan`);
      return response.data;
    },
    enabled: !!projectId,
  });
};

export const useUpdateSuratJalan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<SuratJalanCreate> }) => {
      const response = await apiClient.put(`/surat-jalan/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surat-jalans'] });
    },
  });
};

export const useDeleteSuratJalan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/surat-jalan/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surat-jalans'] });
    },
  });
};
