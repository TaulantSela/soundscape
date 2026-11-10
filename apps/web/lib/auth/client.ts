'use client';

import { createAuthClient } from '@neon/auth/next';

/** Browser-side auth: talks to the `/api/auth/*` proxy route. */
export const authClient = createAuthClient();
