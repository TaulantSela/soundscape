import { json, withUser } from '@/lib/server/api';
import { getUserSoundFileUrl } from '@/lib/server/user-sounds';

export const dynamic = 'force-dynamic';

/**
 * A short-lived signed URL for the file, so playback reads straight from
 * Blob instead of streaming through a function. Only the owner gets one.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(request, async (user) => {
    const { id } = await params;
    return json(await getUserSoundFileUrl(user.id, id));
  });
}
