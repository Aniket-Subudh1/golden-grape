// Admin options shared by several collections.

/** A list page whose "Create" opens a drawer over the list (components/admin/create-button.tsx). */
export const createInDrawer = (collectionSlug: string, label: string) => ({
  views: { list: { actions: [{ path: '@/components/admin/create-button', clientProps: { collectionSlug, label } }] } },
});
