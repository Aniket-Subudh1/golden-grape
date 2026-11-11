import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';

// The contact checks of every public form, pure so the forms run the same checks in the browser as the server.
// A phone number without a country code is read as Luxembourgish; `+…` and `00…` numbers from any country are accepted.

/** The browser-side e-mail check (the server's is zod's `z.email()`, stricter on edge cases). */
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

export const isPhone = (value: string) => isValidPhoneNumber(value, 'LU');

/** `621123456` → `+352 621 123 456`: one readable, callable form for staff, e-mails and tap-to-call. */
export const formatPhone = (value: string) => (isPhone(value) ? parsePhoneNumber(value, 'LU').formatInternational() : value);
