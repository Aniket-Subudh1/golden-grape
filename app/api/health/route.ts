import { connection } from 'next/server';
import { getPayloadClient } from '@/lib/payload';
import { ping } from '@/lib/tx';

const PING_TIMEOUT_MS = 2000;

export async function GET() {
  await connection();
  try {
    const payload = await getPayloadClient();
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('ping timeout')), PING_TIMEOUT_MS));
    await Promise.race([ping(payload), timeout]);
    return Response.json({ ok: true, mongo: 'up' });
  } catch (error) {
    console.error('health: mongo down', error);
    return Response.json({ ok: false, mongo: 'down' }, { status: 503 });
  }
}
