import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

// Opens the payment gateway's hosted checkout page for a pending payment.
// Only used when payments_mode is 'gateway' (see supabase/PAYMENTS_GO_LIVE.md).
// The secret gateway key never reaches the phone: the "create-checkout" Edge
// Function talks to the gateway, and a signed webhook confirms the payment.
export const openCheckout = async (paymentId) => {
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { payment_id: paymentId },
  });
  if (error || !data?.checkout_url) {
    return { ok: false, message: 'Could not open the payment page. Please try again.' };
  }
  await WebBrowser.openBrowserAsync(data.checkout_url);
  return { ok: true };
};
