import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';

// Phone numbers on every public form. A number without a country code is read as Luxembourgish; `+…` and `00…`
// numbers from any country are accepted. Pure, so the checkout can run the same check in the browser.

export const isPhone = (value: string) => isValidPhoneNumber(value, 'LU');

/** `621123456` → `+352 621 123 456`: one readable, callable form for staff, e-mails and tap-to-call. */
export const formatPhone = (value: string) => (isPhone(value) ? parsePhoneNumber(value, 'LU').formatInternational() : value);
