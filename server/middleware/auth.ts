import { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
  interface SessionData {
    userId: string;
    userType: 'marketing' | 'rep';
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

export function requireMarketing(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.session.userType !== 'marketing') {
    return res.status(403).json({ error: 'Marketing access required' });
  }
  next();
}

export function requireRep(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.session.userType !== 'rep') {
    return res.status(403).json({ error: 'Rep access required' });
  }
  next();
}
