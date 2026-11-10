import express from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { apiRouter } from './routes/api';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';

export interface AppOptions {
  /** Origins allowed to call the API from a browser. */
  corsOrigins?: string[];
  /**
   * Express `trust proxy` setting: the number of proxies in front of the API.
   * Leave it off unless there is one, or clients can spoof their IP and
   * dodge the rate limits.
   */
  trustProxy?: number | false;
}

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function parseOrigins(raw: string | undefined) {
  return (raw ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function parseTrustProxy(raw: string | undefined): number | false {
  const hops = Number.parseInt(raw ?? '', 10);
  return Number.isInteger(hops) && hops > 0 ? hops : false;
}

function corsOptions(allowed: string[]): CorsOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    origin(origin, callback) {
      // Same-origin and non-browser requests send no Origin header.
      if (!origin) {
        return callback(null, true);
      }
      const normalized = origin.replace(/\/$/, '');
      const ok = allowed.includes(normalized) || (!isProduction && LOCAL_ORIGIN.test(normalized));
      return callback(null, ok);
    },
    credentials: true
  };
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const corsOrigins = options.corsOrigins ?? parseOrigins(process.env.FRONTEND_URL);
  const trustProxy = options.trustProxy ?? parseTrustProxy(process.env.TRUST_PROXY);

  if (trustProxy) {
    app.set('trust proxy', trustProxy);
  }

  app.use(helmet());
  app.use(cors(corsOptions(corsOrigins)));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
