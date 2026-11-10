import { json, withUser } from '@/lib/server/api';
import { listUserSounds } from '@/lib/server/user-sounds';

export const dynamic = 'force-dynamic';

/** The signed-in user's uploaded sounds and how much of their quota they use. */
export async function GET(request: Request) {
  return withUser(request, async (user) => json(await listUserSounds(user.id)));
}
