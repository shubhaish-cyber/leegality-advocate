import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('Error:', err.message);

  if (err.message === 'Only JPG and PNG images are allowed') {
    return res.status(400).json({ error: err.message });
  }

  if (err.message?.includes('File too large')) {
    return res.status(400).json({ error: 'File size must be under 5MB' });
  }

  res.status(500).json({ error: 'Internal server error' });
}
