import { Router } from 'express';
import { authRouter } from './auth';
import { presetsRouter } from './presets';
import { soundsRouter } from './sounds';
import { mixesRouter } from './mixes';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/sounds', soundsRouter);
apiRouter.use('/presets', presetsRouter);
apiRouter.use('/mixes', mixesRouter);
