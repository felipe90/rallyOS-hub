/**
 * Payload Validation Tests
 */

import { validatePayload, validateSocketPayload, ValidationError, ValidationRules } from '../src/utils/validation';

// Mock socket for testing
function createMockSocket() {
  return {
    emit: jest.fn(),
    handshake: { address: '127.0.0.1' },
  };
}

describe('Payload Validation', () => {
  describe('validatePayload', () => {
    test('passes with valid data', () => {
      const rules: ValidationRules = {
        tableId: { required: true, type: 'string', maxLength: 36 },
        name: { type: 'string', maxLength: 256 },
      };
      expect(() => validatePayload({ tableId: 'abc-123', name: 'Test' }, rules)).not.toThrow();
    });

    test('throws on missing required field', () => {
      const rules: ValidationRules = {
        tableId: { required: true, type: 'string' },
      };
      expect(() => validatePayload({}, rules)).toThrow(ValidationError);
    });

    test('throws on wrong type', () => {
      const rules: ValidationRules = {
        tableId: { required: true, type: 'string' },
      };
      expect(() => validatePayload({ tableId: 123 }, rules)).toThrow(ValidationError);
    });

    test('throws on string exceeding maxLength', () => {
      const rules: ValidationRules = {
        name: { required: true, type: 'string', maxLength: 10 },
      };
      expect(() => validatePayload({ name: 'a'.repeat(100) }, rules)).toThrow(ValidationError);
    });

    test('throws on pattern mismatch', () => {
      const rules: ValidationRules = {
        pin: { required: true, type: 'string', pattern: /^\d{4}$/ },
      };
      expect(() => validatePayload({ pin: 'abc' }, rules)).toThrow(ValidationError);
    });

    test('throws on enum mismatch', () => {
      const rules: ValidationRules = {
        player: { required: true, type: 'string', enum: ['A', 'B'] },
      };
      expect(() => validatePayload({ player: 'C' }, rules)).toThrow(ValidationError);
    });

    test('passes with valid 4-digit PIN', () => {
      const rules: ValidationRules = {
        pin: { required: true, type: 'string', pattern: /^\d{4}$/ },
      };
      expect(() => validatePayload({ pin: '1234' }, rules)).not.toThrow();
    });

    test('allows optional fields to be undefined', () => {
      const rules: ValidationRules = {
        tableId: { required: true, type: 'string' },
        name: { type: 'string', maxLength: 256 },
      };
      expect(() => validatePayload({ tableId: 'abc' }, rules)).not.toThrow();
    });
  });

  describe('validateSocketPayload', () => {
    test('returns true for valid payload', () => {
      const mockSocket = createMockSocket();
      const rules: ValidationRules = {
        tableId: { required: true, type: 'string' },
      };
      const result = validateSocketPayload(mockSocket, { tableId: 'abc' }, rules, 'TEST_EVENT');
      expect(result).toBe(true);
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    test('returns false and emits ERROR for invalid payload', () => {
      const mockSocket = createMockSocket();
      const rules: ValidationRules = {
        tableId: { required: true, type: 'string' },
      };
      const result = validateSocketPayload(mockSocket, {}, rules, 'TEST_EVENT');
      expect(result).toBe(false);
      expect(mockSocket.emit).toHaveBeenCalledWith('ERROR', {
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        field: 'tableId',
        event: 'TEST_EVENT',
      });
    });
  });
});
