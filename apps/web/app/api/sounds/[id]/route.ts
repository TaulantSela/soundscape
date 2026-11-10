import { json, withUser } from '@/lib/server/api';
import { deleteUserSound } from '@/lib/server/user-sounds';

export const dynamic = 'force-dynamic';

/** Delete one of the user's sounds and its file. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(request, async (user) => {
    const { id } = await params;
    await deleteUserSound(user.id, id);
    return json({ ok: true });
  });
}
