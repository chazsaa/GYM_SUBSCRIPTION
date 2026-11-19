// Supabase Edge Function: payment-webhook
//
// PayMongo calls this after a customer pays. It is the ONLY thing (besides the gym
// admin, for cash) that can turn an online payment into a paid one, so it checks the
// signature first and ignores anything that is not really from PayMongo.
//
// Deploy WITHOUT the login check (PayMongo has no Supabase login):
//   supabase functions deploy payment-webhook --no-verify-jwt
// Secret:  supabase secrets set PAYMONGO_WEBHOOK_SECRET=whsk_...
//
// NOT TESTED against a real PayMongo account yet. Log the first test webhook
// and confirm the field names below match (see supabase/PAYMENTS_GO_LIVE.md).
import { createClient } from 'npm:@supabase/supabase-js@2';

const encoder = new TextEncoder();
const toHex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

// Compare two strings in constant time.
const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
};

// PayMongo signs "<timestamp>.<raw body>" with HMAC-SHA256 using the webhook secret.
// The header looks like: t=1496734173,te=<test signature>,li=<live signature>
async function isFromPayMongo(rawBody: string, header: string, secret: string) {
  const parts: Record<string, string> = {};
  for (const piece of header.split(',')) {
    const at = piece.indexOf('=');
    if (at > 0) parts[piece.slice(0, at).trim()] = piece.slice(at + 1).trim();
  }
  const timestamp = parts.t;
  if (!timestamp) return false;
  // Reject old requests, so a captured request cannot be replayed later.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`));
  const expected = toHex(mac);
  return [parts.te, parts.li].some((signature) => !!signature && safeEqual(expected, signature));
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const secret = Deno.env.get('PAYMONGO_WEBHOOK_SECRET');
  if (!secret) return new Response('not configured', { status: 500 });

  // 1. Signature first, before anything else is trusted.
  const rawBody = await req.text();
  const valid = await isFromPayMongo(rawBody, req.headers.get('Paymongo-Signature') ?? '', secret);
  if (!valid) return new Response('invalid signature', { status: 401 });

  // 2. Only "payment paid" events matter.
  const event = JSON.parse(rawBody);
  const eventId: string | undefined = event?.data?.id;
  const type: string | undefined = event?.data?.attributes?.type;
  if (type !== 'checkout_session.payment.paid') return new Response('ignored', { status: 200 });

  const session = event.data.attributes.data;
  const paymentId: string | undefined = session?.attributes?.metadata?.payment_id;
  const providerPayment = session?.attributes?.payments?.[0];
  const providerRef: string = providerPayment?.id ?? session?.id ?? '';
  if (!eventId || !paymentId) {
    console.error('Webhook without event id or payment_id', eventId);
    return new Response('ignored', { status: 200 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // 3. Make sure the amount paid is not less than the amount we asked for.
  const { data: payment } = await admin.from('payments').select('amount').eq('id', paymentId).maybeSingle();
  const paidCentavos = providerPayment?.attributes?.amount;
  if (payment && typeof paidCentavos === 'number' && paidCentavos < payment.amount * 100) {
    console.error('Amount mismatch, needs manual review', { paymentId, paidCentavos });
    return new Response('amount mismatch', { status: 200 });
  }

  // 4. Mark it paid. The database makes sure each event is handled only once.
  const { error } = await admin.rpc('gateway_finalize_payment', {
    p_payment_id: paymentId,
    p_provider_event_id: eventId,
    p_provider_ref: providerRef,
  });
  if (error) {
    const message = error.message ?? '';
    // These can never succeed on a retry, so tell PayMongo we are done with it.
    if (message.includes('payment_not_pending') || message.includes('payment_not_found')) {
      return new Response('already handled', { status: 200 });
    }
    console.error('finalize failed', message);
    return new Response('retry later', { status: 500 }); // PayMongo will send it again
  }
  return new Response('ok', { status: 200 });
});
