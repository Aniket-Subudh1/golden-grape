import { describe, expect, it, vi } from 'vitest';
import * as mail from '@/lib/mail';
import { withTx } from '@/lib/tx';
import { getTestPayload, makeVariant } from '@/tests/helpers';
import { lowStockDigest } from './jobs';
import { postMovements } from './service';

// AC-M3.1-06: given sizes below their level at 07:00, one e-mail lists them; given none, no e-mail.

const payload = await getTestPayload();
await payload.updateGlobal({ slug: 'BusinessSettings', data: { business: { name: 'Golden Grape', street: '25 Zac Klengbousbierg', postalCode: '7795', city: 'Bissen' }, alerts: { defaultLowStock: 3, lowStockEmail: 'stock@example.test' } }, overrideAccess: true, context: { skipRevalidate: true } });
const sent = vi.spyOn(mail, 'sendMail').mockResolvedValue(undefined);

describe('low-stock-digest', () => {
  it('nothing low → no e-mail', async () => {
    await makeVariant(payload, { onHand: 10 });
    expect(await lowStockDigest(payload)).toMatchObject({ sent: false, count: 0 });
    expect(sent).not.toHaveBeenCalled();
  });

  it('two sizes low → one e-mail to the alert address listing both, with stock and level', async () => {
    const a = await makeVariant(payload, { onHand: 10 });
    await makeVariant(payload, { onHand: 0 }); // 0 ≤ 3
    await withTx(payload, (tx) => postMovements(tx, [{ variant: a.variant.id, unitQty: -8, type: 'adjustment', reason: 'breakage', channel: 'backoffice' }]));
    const result = await lowStockDigest(payload);
    expect(result).toMatchObject({ sent: true, count: 2, to: 'stock@example.test' });
    expect(sent).toHaveBeenCalledTimes(1);
    const message = sent.mock.calls[0][0];
    expect(message.to).toBe('stock@example.test');
    expect(message.subject).toBe('Stock bas : 2 article(s) à recommander');
    expect(message.text).toContain(a.product.name);
  });
});
