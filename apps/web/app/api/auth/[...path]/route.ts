import { getAuth } from '@/lib/auth/server';

type Handler = ReturnType<ReturnType<typeof getAuth>['handler']>;
type RouteContext = Parameters<Handler['GET']>[1];

// Proxies every auth call (sign-in, sign-up, session, password reset, OAuth
// callbacks) to Managed Better Auth and keeps the session cookie on our domain.
export const GET = (request: Request, context: RouteContext) => getAuth().handler().GET(request, context);
export const POST = (request: Request, context: RouteContext) => getAuth().handler().POST(request, context);
export const PUT = (request: Request, context: RouteContext) => getAuth().handler().PUT(request, context);
export const PATCH = (request: Request, context: RouteContext) => getAuth().handler().PATCH(request, context);
export const DELETE = (request: Request, context: RouteContext) => getAuth().handler().DELETE(request, context);
