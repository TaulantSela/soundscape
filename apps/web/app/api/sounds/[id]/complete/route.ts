import { json, withUser } from '@/lib/server/api';
import { completeUpload } from '@/lib/server/user-sounds';

export const dynamic = 'force-dynamic';

/** Step 2 of an upload: confirm the file is in storage and add it to the library. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(request, async (user) => {
    const { id } = await params;
    return json(await completeUpload(user.id, id));
  });
}
