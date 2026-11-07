import { type Dictionary, interpolate } from '@/lib/i18n';
import { Details, heading, MailLayout, type MailBusiness, Reference } from './layout';
import { type OrderMail, OrderLines, TransferDetails, ViewButton } from './order-received';

export type StatusMail = OrderMail & { status: keyof Dictionary['mail']['order']['statusBody']; statusName: string };

/** The customer is told when their order is confirmed, ready, on its way, cancelled or refunded. */
export function OrderStatusMail({ t, business, logoUrl, data }: { t: Dictionary['mail']; business: MailBusiness; logoUrl: string; data: StatusMail }) {
  return (
    <MailLayout business={business} logoUrl={logoUrl}>
      <h1 style={heading}>{data.statusName}</h1>
      <Reference>{interpolate(t.order.reference, { number: data.number })}</Reference>
      <p>{interpolate(t.greeting, { name: data.name })}</p>
      <p>{t.order.statusBody[data.status]}</p>
      <Details
        rows={[
          [t.labels.number, data.number],
          [t.labels.mode, data.mode],
          [t.labels.slot, data.slot],
          ...(data.address ? [[t.labels.address, data.address] as [string, string]] : []),
        ]}
      />
      {data.transfer && <TransferDetails t={t} transfer={data.transfer} />}
      {data.status !== 'cancelled' && data.status !== 'refunded' && <OrderLines t={t} data={data} />}
      <ViewButton href={data.url} label={t.view} />
      <p>{t.signature}</p>
    </MailLayout>
  );
}
