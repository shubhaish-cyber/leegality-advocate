import session from 'express-session';
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

const prisma = new PrismaClient();

export const sessionMiddleware = session({
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: !config.isDev,
    sameSite: 'lax',
  },
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: new PrismaSessionStore(prisma, {
    checkPeriod: 2 * 60 * 1000,
    dbRecordIdIsSessionId: true,
  }),
});
