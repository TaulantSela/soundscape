import { Router } from 'express';

export const mixesRouter = Router();

mixesRouter.post('/', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

mixesRouter.get('/:id', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});
