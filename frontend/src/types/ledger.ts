export interface LedgerItem {
  id: string;
  type: 'topup' | 'worklog' | 'rate_change';
  date: string;
  description: string;
  amount: number;
  running_balance: number;
  hours?: number | null;
  applied_rate?: number | null;
  old_rate?: number | null;
  new_rate?: number | null;
}
