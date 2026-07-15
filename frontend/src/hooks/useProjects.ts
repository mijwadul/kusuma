import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

export interface MaterialItem {
  id?: number;
  material_type: string;
  unit: string;
  target_quantity: number | string;
  unit_price?: number | string | null;
  notes?: string;
}

export interface Project {
  id: number;
  name: string;
  client_name?: string;
  description?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
  loading_rate?: number;
  progress: number;
  status: string;
  notes?: string;
  material_items: MaterialItem[];
  total_material_value: number;
  realized_amount: number;
  budget_used: number;
  remaining_budget: number;
  measurement_type?: string;
  assigned_user_ids?: number[];
  assigned_employee_ids?: number[];
  assigned_users?: { id: number; email: string; full_name?: string; role: string }[];
  assigned_employees?: { id: number; name: string; position?: string }[];
}

export interface CustomerMaterialPreference {
  id?: number;
  material_type: string;
  unit: string;
  vehicle_type?: string;
  unit_price?: number | string | null;
}

export interface CustomerTruck {
  id?: number;
  license_plate: string;
  driver_name?: string;
  vehicle_type: string;
}

export interface Customer {
  id: number;
  name: string;
  company?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  is_active: boolean;
  material_preferences: CustomerMaterialPreference[];
  trucks: CustomerTruck[];
  total_purchases: number;
  purchase_count: number;
}

export interface ProjectMeta {
  material_types: string[];
  material_units: Record<string, string[]>;
  all_units: string[];
  project_statuses: string[];
}

export const useProjectsList = (status?: string, options?: any) => {
  return useQuery<Project[], Error>({
    queryKey: ['projects', status],
    queryFn: async () => {
      const response = await apiClient.get<Project[]>('/projects-data/projects', {
        params: { status }
      });
      return response.data;
    },
    ...options
  });
};

export const useCustomersList = (is_active?: boolean, options?: any) => {
  return useQuery<Customer[], Error>({
    queryKey: ['customers', is_active],
    queryFn: async () => {
      const response = await apiClient.get<Customer[]>('/projects-data/customers', {
        params: { is_active }
      });
      return response.data;
    },
    ...options
  });
};

export const useProjectMeta = (options?: any) => {
  return useQuery<ProjectMeta, Error>({
    queryKey: ['project-meta'],
    queryFn: async () => {
      const response = await apiClient.get<ProjectMeta>('/projects-data/meta');
      return response.data;
    },
    ...options
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Project>) => {
      const response = await apiClient.post('/projects-data/projects', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Project> }) => {
      const response = await apiClient.put(`/projects-data/projects/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/projects-data/projects/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Customer>) => {
      const response = await apiClient.post('/projects-data/customers', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Customer> }) => {
      const response = await apiClient.put(`/projects-data/customers/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/projects-data/customers/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};
