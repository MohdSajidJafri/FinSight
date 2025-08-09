import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from './currency';

export function useCurrency() {
  const { user } = useAuthStore();
  const currency = user?.currency || 'USD';

  const format = (amount: number, maximumFractionDigits?: number) =>
    formatCurrency(amount, currency, maximumFractionDigits);

  return { currency, format };
}

