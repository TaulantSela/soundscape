import type { NextFunction, Request, Response } from 'express';

export interface ApiError extends Error {
  status?: number;
  statusCode?: number;
  details?: unknown;
  expose?: boolean;
}

export function errorHandler(err: ApiError, _req: Request, res: Response, _next: NextFunction) {
  // body-parser and other http-errors set `status`/`statusCode` themselves.
  const status = err.status ?? err.statusCode ?? 500;

  if (status >= 500) {
    console.error(err);
    // Never send internals (database errors, stack details) to clients.
    res.status(status).json({ message: 'Internal Server Error' });
    return;
  }

  res.status(status).json({
    message: err.message || 'Request failed',
    ...(err.details ? { details: err.details } : {})
  });
}
