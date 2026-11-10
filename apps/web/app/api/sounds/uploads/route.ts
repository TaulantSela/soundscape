import { z } from 'zod';
import { json, jsonError, readJson, withUser } from '@/lib/server/api';
import { reserveUpload } from '@/lib/server/user-sounds';

export const dynamic = 'force-dynamic';

const reserveSchema = z.object({
  name: z.string().max(200),
  contentType: z.string().max(100),
  sizeBytes: z.number().int().positive()
});

/**
 * Step 1 of an upload: reserve quota and get a presigned URL. The client then
 * PUTs the file straight to Blob (functions can't receive bodies over 4.5 MB)
 * and confirms with `POST /api/sounds/:id/complete`.
 */
export async function POST(request: Request) {
  return withUser(request, async (user) => {
    const parsed = reserveSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return jsonError('Send the sound name, content type and size.', 400);
    }
    return json(await reserveUpload(user.id, parsed.data), 201);
  });
}
