/**
 * Gets the QR signature secret from environment variables.
 * 
 * @returns The secret key for QR signature generation/verification
 * @throws Error if neither QR_SIGNATURE_SECRET nor JWT_SECRET is set
 */
export function getQrSignatureSecret(): string {
  const secret = process.env.QR_SIGNATURE_SECRET || process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error(
      'QR signature secret is not configured. Please set QR_SIGNATURE_SECRET or JWT_SECRET environment variable.'
    );
  }
  
  return secret;
}
