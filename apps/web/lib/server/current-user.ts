import { getAuth } from '@/lib/auth/server';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
}

/** The signed-in user for this request, from the session cookie. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { data } = await getAuth().getSession();
  const user = data?.user;
  return user ? { id: user.id, email: user.email, name: user.name } : null;
}
