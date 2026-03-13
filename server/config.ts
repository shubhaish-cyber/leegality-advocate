import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') !== 'production',

  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  clientUrl: (process.env.NODE_ENV || 'development') !== 'production'
    ? 'http://localhost:5173'
    : '',

  sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret-change-in-production',

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: '/api/auth/google/callback',
  },

  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID || '',
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
    callbackUrl: '/api/auth/linkedin/callback',
    scopes: ['openid', 'profile', 'email', 'w_member_social'],
  },

  marketingAllowedEmails: (process.env.MARKETING_ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),

  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32chars-long!!',
};
