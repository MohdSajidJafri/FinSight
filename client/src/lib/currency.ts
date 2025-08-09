export function formatCurrency(amount: number, currency: string = 'USD', maximumFractionDigits?: number): string {
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency
  };
  if (maximumFractionDigits !== undefined) {
    options.maximumFractionDigits = maximumFractionDigits;
  }
  return new Intl.NumberFormat('en-US', options).format(amount);
}

