import { sign, type SignOptions } from 'jsonwebtoken';

export const generateIntegrationAppAdminToken = () => {
  if (!process.env.INTEGRATION_APP_WORKSPACE_SECRET) {
    throw new Error('INTEGRATION_APP_WORKSPACE_SECRET is not set');
  }

  if (!process.env.INTEGRATION_APP_WORKSPACE_KEY) {
    throw new Error('INTEGRATION_APP_WORKSPACE_KEY is not set');
  }

  const tokenData = {
    isAdmin: true,
  };

  const options: SignOptions = {
    issuer: process.env.INTEGRATION_APP_WORKSPACE_KEY,
    expiresIn: 7200,
    algorithm: 'HS512',
  };

  const token = sign(
    tokenData,
    process.env.INTEGRATION_APP_WORKSPACE_SECRET,
    options,
  );

  return token;
};
