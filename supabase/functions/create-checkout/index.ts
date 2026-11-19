// Supabase Edge Function: create-checkout
//
// The app calls this with { payment_id }. It checks who is asking, loads that
// member's pending payment, asks PayMongo for a hosted checkout page, and
// returns the page address. The PayMongo SECRET key lives only here, as a
// Supabase secret. It never goes into the app.
//
// Deploy:  supabase functions deploy create-checkout
// Secrets: supabase secrets set PAYMONGO_SECRET_KEY=sk_test_... \
//            CHECKOUT_SUCCESS_URL=https://... CHECKOUT_CANCEL_URL=https://...
//
// NOT TESTED against a real PayMongo account yet. Test it in PayMongo test
// mode first (see supabase/PAYMENTS_GO_LIVE.md).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// GymFit payment method -> PayMongo payment method type
const METHOD_TYPES: Record<string, string> = { gcash: 'gcash', maya: 'paymaya', card: 'card' };
const KIND_LABELS: Record<string, string> = { new: 'New membership', renewal: 'Renewal', upgrade: 'Upgrade' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const secretKey = Deno.env.get('PAYMONGO_SECRET_KEY');
    const successUrl = Deno.env.get('CHECKOUT_SUCCESS_URL');
    const cancelUrl = Deno.env.get('CHECKOUT_CANCEL_URL');
    if (!secretKey || !successUrl || !cancelUrl) return json({ error: 'not_configured' }, 500);

    // 1. Who is asking? Use the member's own login token.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'not_logged_in' }, 401);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'not_logged_in' }, 401);

    // 2. Load the payment. Row Level Security means a member can only read their own.
    const { payment_id } = await req.json();
    const { data: payment } = await userClient
      .from('payments')
      .select('id, amount, method, reference, status, kind, plan_id')
      .eq('id', payment_id)
      .maybeSingle();
    if (!payment) return json({ error: 'payment_not_found' }, 404);
    if (payment.status !== 'pending' || !(payment.method in METHOD_TYPES) || payment.amount <= 0) {
      return json({ error: 'payment_not_payable' }, 400);
    }
    const { data: plan } = await userClient.from('plans').select('name').eq('id', payment.plan_id).maybeSingle();

    // 3. Ask PayMongo for a hosted checkout page. Amounts are in centavos.
    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${secretKey}:`)}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                currency: 'PHP',
                amount: payment.amount * 100,
                name: `${plan?.name ?? 'Membership'} (${KIND_LABELS[payment.kind] ?? 'Payment'})`,
                quantity: 1,
              },
            ],
            payment_method_types: [METHOD_TYPES[payment.method]],
            success_url: successUrl,
            cancel_url: cancelUrl,
            reference_number: payment.reference,
            description: `GymFit ${payment.reference}`,
            metadata: { payment_id: payment.id },
          },
        },
      }),
    });
    const result = await response.json();
    const checkoutUrl = result?.data?.attributes?.checkout_url;
    if (!response.ok || !checkoutUrl) {
      console.error('PayMongo error', JSON.stringify(result));
      return json({ error: 'gateway_error' }, 502);
    }

    // 4. Remember which checkout belongs to this payment (server-side only).
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await admin.rpc('gateway_attach_checkout', {
      p_payment_id: payment.id,
      p_provider: 'paymongo',
      p_checkout_id: result.data.id,
    });

    return json({ checkout_url: checkoutUrl });
  } catch (error) {
    console.error(error);
    return json({ error: 'server_error' }, 500);
  }
});
