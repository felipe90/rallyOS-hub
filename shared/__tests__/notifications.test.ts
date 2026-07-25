/**
 * Kiosk Notification shared contracts tests
 *
 * Covers: KioskNotificationType union, KioskNotificationData interface,
 * SocketEvents entries, NOTIFICATION_RULES constants, and sanitizeMessage().
 */

import { KioskNotificationType, KioskNotificationData, KioskNotificationScope } from '../types';
import { SocketEvents } from '../events';
import { NOTIFICATION_RULES, sanitizeMessage } from '../validation';

// ── KioskNotificationType (union literal) ───────────────────────────

describe('KioskNotificationType (union literal)', () => {
  test('accepts "info"', () => {
    const type: KioskNotificationType = 'info';
    expect(type).toBe('info');
  });

  test('accepts "warning"', () => {
    const type: KioskNotificationType = 'warning';
    expect(type).toBe('warning');
  });

  test('accepts "error"', () => {
    const type: KioskNotificationType = 'error';
    expect(type).toBe('error');
  });

  test('accepts "important"', () => {
    const type: KioskNotificationType = 'important';
    expect(type).toBe('important');
  });
});

// ── KioskNotificationData (interface) ───────────────────────────────

describe('KioskNotificationData (interface shape)', () => {
  test('has required fields: type, message, duration, timestamp', () => {
    const data: KioskNotificationData = {
      type: 'warning',
      message: 'Court 4 is ready',
      duration: 10,
      timestamp: 1715971200000,
    };

    expect(data.type).toBe('warning');
    expect(data.message).toBe('Court 4 is ready');
    expect(data.duration).toBe(10);
    expect(data.timestamp).toBe(1715971200000);
  });

  test('supports all four notification types', () => {
    const types: KioskNotificationType[] = ['info', 'warning', 'error', 'important'];

    for (const type of types) {
      const data: KioskNotificationData = {
        type,
        message: `Test ${type} message`,
        duration: 5,
        timestamp: Date.now(),
      };
      expect(data.type).toBe(type);
    }
  });
});

// ── KioskNotificationScope (new type) ────────────────────────────────

describe('KioskNotificationScope', () => {
  test('accepts "club"', () => {
    const scope: KioskNotificationScope = 'club';
    expect(scope).toBe('club');
  });

  test('accepts "general"', () => {
    const scope: KioskNotificationScope = 'general';
    expect(scope).toBe('general');
  });
});

describe('KioskNotificationData — scope field (task 1.1)', () => {
  test('accepts optional scope field set to "club"', () => {
    const data: KioskNotificationData = {
      type: 'info',
      message: 'Club notification',
      duration: 5,
      timestamp: 1715971200000,
      scope: 'club',
    };
    expect(data.scope).toBe('club');
  });

  test('accepts optional scope field set to "general"', () => {
    const data: KioskNotificationData = {
      type: 'warning',
      message: 'General announcement',
      duration: 10,
      timestamp: 1715971200000,
      scope: 'general',
    };
    expect(data.scope).toBe('general');
  });

  test('scope is optional — data without scope is valid', () => {
    const data: KioskNotificationData = {
      type: 'error',
      message: 'No scope set',
      duration: 5,
      timestamp: 1715971200000,
    };
    expect(data.scope).toBeUndefined();
  });
});

// ── SocketEvents (event names) ──────────────────────────────────────

describe('SocketEvents — notification events', () => {
  test('SEND_NOTIFICATION is in CLIENT events', () => {
    expect(SocketEvents.CLIENT.SEND_NOTIFICATION).toBe('SEND_NOTIFICATION');
  });

  test('KIOSK_NOTIFICATION is in SERVER events', () => {
    expect(SocketEvents.SERVER.KIOSK_NOTIFICATION).toBe('KIOSK_NOTIFICATION');
  });

  test('CLUB_SEND_NOTIFICATION is in CLIENT events (task 1.2)', () => {
    expect(SocketEvents.CLIENT.CLUB_SEND_NOTIFICATION).toBe('CLUB_SEND_NOTIFICATION');
  });
});

// ── NOTIFICATION_RULES (validation constants) ───────────────────────

describe('NOTIFICATION_RULES', () => {
  test('maxLength is 280', () => {
    expect(NOTIFICATION_RULES.message.maxLength).toBe(280);
  });

  test('validTypes includes all four types', () => {
    expect(NOTIFICATION_RULES.validTypes).toEqual(['info', 'warning', 'error', 'important']);
  });

  test('validDurations are [5, 10, 15, 30]', () => {
    expect(NOTIFICATION_RULES.validDurations).toEqual([5, 10, 15, 30]);
  });

  test('defaultDuration is 5', () => {
    expect(NOTIFICATION_RULES.defaultDuration).toBe(5);
  });
});

// ── sanitizeMessage() ───────────────────────────────────────────────

describe('sanitizeMessage', () => {
  test('strips HTML tags from message', () => {
    expect(sanitizeMessage('<b>break</b>')).toBe('break');
    expect(sanitizeMessage('<script>alert(1)</script>')).toBe('alert(1)');
    expect(sanitizeMessage('<p>Safe text</p>')).toBe('Safe text');
  });

  test('returns plain text unchanged', () => {
    expect(sanitizeMessage('Court 4 is ready')).toBe('Court 4 is ready');
  });

  test('handles empty string', () => {
    expect(sanitizeMessage('')).toBe('');
  });

  test('truncates message longer than 280 characters', () => {
    const longMessage = 'x'.repeat(300);
    expect(sanitizeMessage(longMessage).length).toBe(280);
  });
});
