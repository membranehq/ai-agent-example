import { type Algorithm, sign } from 'jsonwebtoken';

interface TokenData {
  id?: string;
  name?: string;
}

export async function generateIntegrationAppCustomerAccessToken(
  tokenData: TokenData,
): Promise<string> {
  if (!process.env.WORKSPACE_KEY || !process.env.WORKSPACE_SECRET) {
    throw new Error('Integration.app credentials not configured');
  }

  try {
    const options = {
      issuer: process.env.WORKSPACE_KEY,
      expiresIn: 7200, // 2 hours
      algorithm: 'HS512' as Algorithm,
    };

    return sign(tokenData, process.env.WORKSPACE_SECRET, options);
  } catch (error) {
    console.error('Error generating integration token:', error);
    throw new Error('Failed to generate integration token');
  }
}
