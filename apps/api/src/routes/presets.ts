import { Router } from 'express';

export const presetsRouter = Router();

presetsRouter.get('/', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

presetsRouter.post('/', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

presetsRouter.put('/:id', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

presetsRouter.delete('/:id', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});
