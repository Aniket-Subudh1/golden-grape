import { revalidateTag } from 'next/cache';
import type { PayloadRequest } from 'payload';

// afterChange/afterDelete hook for collections and globals whose content is cached under `tag`.
// Expires immediately so the next page load shows the edit. The seed and tests run outside Next and
// set `context.skipRevalidate`.
export const revalidateTagHook =
  (tag: string) =>
  <T>({ req, doc }: { req: PayloadRequest; doc: T }): T => {
    if (!req.context.skipRevalidate) revalidateTag(tag, { expire: 0 });
    return doc;
  };
