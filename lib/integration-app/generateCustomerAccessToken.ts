import { type Algorithm, sign } from 'jsonwebtoken';

interface TokenData {
  id?: string;
  name?: string;
}

export async function generateIntegrationAppCustomerAccessToken(
  tokenData: TokenData,
  expiresIn = 7200, // 2 hours
): Promise<string> {
  if (
    !process.env.INTEGRATION_APP_WORKSPACE_KEY ||
    !process.env.INTEGRATION_APP_WORKSPACE_SECRET
  ) {
    throw new Error('Integration.app credentials not configured');
  }

  try {
    const options = {
      issuer: process.env.INTEGRATION_APP_WORKSPACE_KEY,
      expiresIn,
      algorithm: 'HS512' as Algorithm,
    };

    return sign(
      tokenData,
      process.env.INTEGRATION_APP_WORKSPACE_SECRET,
      options,
    );
  } catch (error) {
    console.error('Error generating integration token:', error);
    throw new Error('Failed to generate integration token');
  }
}
