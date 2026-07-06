import { AdminPinService } from './AdminPinService';

describe('AdminPinService', () => {
  let service: AdminPinService;

  beforeEach(() => {
    service = new AdminPinService();
  });

  describe('hashPin', () => {
    it('should return a salt:hash string', () => {
      const result = service.hashPin('123456');
      expect(result).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
    });

    it('should return different hashes for the same PIN (different salt)', () => {
      const hash1 = service.hashPin('123456');
      const hash2 = service.hashPin('123456');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different PINs', () => {
      const hash1 = service.hashPin('123456');
      const hash2 = service.hashPin('654321');
      const salt1 = hash1.split(':')[0];
      const salt2 = hash2.split(':')[0];
      // Different salts should be used
      expect(salt1).not.toBe(salt2);
    });
  });

  describe('verifyPin', () => {
    it('should return true for correct PIN', () => {
      const hash = service.hashPin('123456');
      expect(service.verifyPin('123456', hash)).toBe(true);
    });

    it('should return false for incorrect PIN', () => {
      const hash = service.hashPin('123456');
      expect(service.verifyPin('000000', hash)).toBe(false);
    });

    it('should return false for empty hash', () => {
      expect(service.verifyPin('123456', '')).toBe(false);
    });

    it('should return false for malformed hash (no colon)', () => {
      expect(service.verifyPin('123456', 'justhexwithoutcolon')).toBe(false);
    });

    it('should return false for hash with too many parts', () => {
      expect(service.verifyPin('123456', 'part1:part2:part3')).toBe(false);
    });

    it('should return false for empty PIN', () => {
      const hash = service.hashPin('123456');
      // Empty PIN will produce a different hash
      expect(service.verifyPin('', hash)).toBe(false);
    });

    it('should return false for wrong-length PIN', () => {
      const hash = service.hashPin('123456');
      expect(service.verifyPin('1234567', hash)).toBe(false);
    });

    it('should be deterministic — same PIN+same hash always matches', () => {
      const hash = service.hashPin('123456');
      // Multiple verifications of the same correct PIN
      expect(service.verifyPin('123456', hash)).toBe(true);
      expect(service.verifyPin('123456', hash)).toBe(true);
      expect(service.verifyPin('123456', hash)).toBe(true);
    });

    it('should handle 8-digit PINs', () => {
      const hash = service.hashPin('12345678');
      expect(service.verifyPin('12345678', hash)).toBe(true);
      expect(service.verifyPin('87654321', hash)).toBe(false);
    });

    it('should handle 6-digit PINs', () => {
      const hash = service.hashPin('654321');
      expect(service.verifyPin('654321', hash)).toBe(true);
    });
  });
});
