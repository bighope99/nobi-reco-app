import { createHmac } from 'crypto';

// Mock environment variable
const QR_SIGNATURE_SECRET = 'test-secret-key';

describe('QR Signature Generation and Verification', () => {
  let createQrPayload: any;

  beforeAll(async () => {
    // Reset modules to ensure fresh import with environment variable
    jest.resetModules();
    process.env.QR_SIGNATURE_SECRET = QR_SIGNATURE_SECRET;

    // Import after setting environment variable
    const module = await import('@/lib/qr/card-generator');
    createQrPayload = module.createQrPayload;
  });

  describe('createQrPayload', () => {
    it('should generate valid QR payload with signature', () => {
      const childId = 'child-123';
      const facilityId = 'facility-456';

      const result = createQrPayload(childId, facilityId);

      expect(result).toHaveProperty('payload');
      expect(result).toHaveProperty('signature');
      expect(result.signature).toMatch(/^[a-f0-9]{64}$/i);
    });

    it('should include correct data in payload', () => {
      const childId = 'child-123';
      const facilityId = 'facility-456';

      const result = createQrPayload(childId, facilityId);
      const parsed = JSON.parse(result.payload);

      expect(parsed.type).toBe('attendance');
      expect(parsed.child_id).toBe(childId);
      expect(parsed.facility_id).toBe(facilityId);
      expect(parsed.signature).toBe(result.signature);
    });

    it('should generate consistent signature for same input', () => {
      const childId = 'child-123';
      const facilityId = 'facility-456';

      const result1 = createQrPayload(childId, facilityId);
      const result2 = createQrPayload(childId, facilityId);

      expect(result1.signature).toBe(result2.signature);
    });

    it('should generate different signatures for different inputs', () => {
      const result1 = createQrPayload('child-123', 'facility-456');
      const result2 = createQrPayload('child-999', 'facility-456');

      expect(result1.signature).not.toBe(result2.signature);
    });
  });

  describe('Signature Verification Logic', () => {
    it('should verify signature matches expected format', () => {
      const childId = 'child-123';
      const facilityId = 'facility-456';

      const { signature: generatedSignature } = createQrPayload(childId, facilityId);

      // This is the verification logic from the API route
      const expectedSignature = createHmac('sha256', QR_SIGNATURE_SECRET)
        .update(`${childId}${facilityId}${QR_SIGNATURE_SECRET}`)
        .digest('hex');

      expect(generatedSignature).toBe(expectedSignature);
    });

    it('should handle signature verification with various input types', () => {
      const testCases = [
        { childId: 'child-abc', facilityId: 'facility-xyz' },
        { childId: '12345', facilityId: '67890' },
        { childId: 'child-with-dash', facilityId: 'facility-with-dash' },
      ];

      testCases.forEach(({ childId, facilityId }) => {
        const { signature: generatedSignature } = createQrPayload(childId, facilityId);

        const expectedSignature = createHmac('sha256', QR_SIGNATURE_SECRET)
          .update(`${childId}${facilityId}${QR_SIGNATURE_SECRET}`)
          .digest('hex');

        expect(generatedSignature).toBe(expectedSignature);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const result = createQrPayload('', '');
      expect(result.signature).toMatch(/^[a-f0-9]{64}$/i);
    });

    it('should handle special characters in IDs', () => {
      const result = createQrPayload('child-!@#$%', 'facility-^&*()');
      expect(result.signature).toMatch(/^[a-f0-9]{64}$/i);
    });

    it('should handle very long IDs', () => {
      const longId = 'a'.repeat(1000);
      const result = createQrPayload(longId, longId);
      expect(result.signature).toMatch(/^[a-f0-9]{64}$/i);
    });
  });
});
