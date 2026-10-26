export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function str(body, field, { required = false, max = 500, label = field } = {}) {
  const raw = body?.[field];
  const val = raw == null ? '' : String(raw).trim();
  if (required && !val) throw new HttpError(400, `${label} is required`);
  if (val.length > max) throw new HttpError(400, `${label} is too long`);
  return val || null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function email(body, field = 'email') {
  const val = str(body, field, { required: true, max: 254, label: 'Email' }).toLowerCase();
  if (!EMAIL_RE.test(val)) throw new HttpError(400, 'Enter a valid email address');
  return val;
}

export function password(body, field = 'password') {
  const val = body?.[field] == null ? '' : String(body[field]);
  if (val.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  if (val.length > 200) throw new HttpError(400, 'Password is too long');
  return val;
}

export function luhnValid(num) {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return num.length >= 12 && sum % 10 === 0;
}

export function cardBrand(num) {
  if (/^4/.test(num)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(num)) return 'Mastercard';
  if (/^3[47]/.test(num)) return 'Amex';
  if (/^6(011|5)/.test(num)) return 'Discover';
  return 'Card';
}
