import { connection } from 'next/server';
import { canOpen } from '@/app/(staff)/staff/session';
import { SCREENS, type Screen } from '@/app/(staff)/staff/screens';
import { currentStaff } from '@/modules/settings/service';

// Asked by proxy.ts when a staff token's roles refuse a screen: the current rules (roles, the areas Team & access gave
// them, the modules) decide. 200 = may open, 404 = not.
export async function GET(request: Request) {
  await connection();
  const screen = new URL(request.url).searchParams.get('screen') ?? '';
  const user = await currentStaff();
  const ok = Boolean(user) && screen in SCREENS && (await canOpen(user!, screen as Screen));
  return new Response(null, { status: ok ? 200 : 404, headers: { 'Cache-Control': 'no-store' } });
}
