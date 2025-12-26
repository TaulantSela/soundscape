import type { NextFunction, Request, Response } from 'express';

export interface ApiError extends Error {
  status?: number;
  details?: unknown;
}

export function errorHandler(err: ApiError, _req: Request, res: Response, _next: NextFunction) {
  const status = err.status ?? 500;
  const payload = {
    message: err.message || 'Internal Server Error',
    ...(err.details ? { details: err.details } : {})
  };

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json(payload);
}
