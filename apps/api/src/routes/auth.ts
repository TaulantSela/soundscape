import { Router } from 'express';
import rateLimit from 'express-rate-limit';

export const authRouter = Router();

const authLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });

authRouter.use(authLimiter);

authRouter.post('/register', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

authRouter.post('/login', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

authRouter.post('/logout', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

authRouter.post('/forgot-password', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

authRouter.post('/reset-password', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});
