import { Router } from 'express';

export const soundsRouter = Router();

soundsRouter.get('/', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});
