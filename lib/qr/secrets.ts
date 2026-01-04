/**
 * Gets the QR signature secret from environment variables.
 * 
 * @returns The secret key for QR signature generation/verification
 * @throws Error if neither QR_SIGNATURE_SECRET nor JWT_SECRET is set
 */
export function getQrSignatureSecret(): string {
  const secret = process.env.QR_SIGNATURE_SECRET || process.env.JWT_SECRET;
  
  if (!secret) {
    const isProduction = process.env.NODE_ENV === 'production';
    const errorMessage = 
      'QR signature secret is not configured. ' +
      'Please set QR_SIGNATURE_SECRET or JWT_SECRET environment variable. ' +
      'This is required for secure QR code signature generation and verification.';
    
    // Log a visible warning in all environments
    console.error('SECURITY ERROR: Missing QR signature secret configuration');
    console.error(errorMessage);
    
    // In production, this will cause deployment to fail
    if (isProduction) {
      console.error('FATAL: Application cannot start without QR signature secret in production environment.');
    }
    
    throw new Error(errorMessage);
  }
  
  return secret;
}
