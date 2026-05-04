/**
 * Logger Utility Tests
 */

import { maskIp } from '../src/utils/logger';

describe('maskIp', () => {
  test('masks last octet of IPv4', () => {
    expect(maskIp('192.168.1.100')).toBe('192.168.1.x');
  });

  test('masks last octet of localhost IP', () => {
    expect(maskIp('127.0.0.1')).toBe('127.0.0.x');
  });

  test('returns non-IPv4 string as-is', () => {
    expect(maskIp('unknown')).toBe('unknown');
  });

  test('returns empty string for empty input', () => {
    expect(maskIp('')).toBe('');
  });

  test('returns IPv6 as-is (no masking applied)', () => {
    expect(maskIp('2001:db8::1')).toBe('2001:db8::1');
  });

  test('returns IPv6 localhost as-is', () => {
    expect(maskIp('::1')).toBe('::1');
  });
});
