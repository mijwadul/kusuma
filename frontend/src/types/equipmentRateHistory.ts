export interface EquipmentRateHistory {
  id: number;
  equipment_id: number;
  old_rate: number | null;
  new_rate: number;
  trigger_type: 'immediate' | 'deposit' | 'date';
  effective_date: string | null;
  status: 'pending' | 'applied' | 'cancelled';
  created_at: string;
  applied_at: string | null;
}

export interface EquipmentRateChangeRequest {
  rental_rate_per_hour: number;
  rate_trigger_type: 'immediate' | 'deposit' | 'date';
  rate_effective_date?: string | null;
  auto_recalculate?: boolean;
}
