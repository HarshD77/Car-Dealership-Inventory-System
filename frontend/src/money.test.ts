import { describe, expect, it } from 'vitest';
import { dollarsToCents } from './money';

describe('money conversion at the UI boundary', () => {
  it.each([['0', 0], ['12.34', 1234], ['1.01', 101], ['1.1', 110], ['90071992547409.91', Number.MAX_SAFE_INTEGER]])('converts %s exactly', (input, cents) => {
    expect(dollarsToCents(input)).toBe(cents);
  });
  it.each(['', 'NaN', '-1', '1.001', 'Infinity', '1e3', '90071992547409.92'])('rejects invalid or unsafe money %s', input => {
    expect(() => dollarsToCents(input)).toThrow();
  });
});
