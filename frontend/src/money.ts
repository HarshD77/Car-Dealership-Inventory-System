export function dollarsToCents(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error('Enter a nonnegative price with at most two decimal places.');
  }
  const [dollars, cents = ''] = value.split('.');
  const result = BigInt(dollars) * 100n + BigInt(cents.padEnd(2, '0'));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Price exceeds the supported maximum.');
  return Number(result);
}

export function centsToDollars(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export function formatPrice(cents: number): string {
  const [whole, fraction] = centsToDollars(cents).split('.');
  return `$${BigInt(whole).toLocaleString('en-US')}.${fraction}`;
}
