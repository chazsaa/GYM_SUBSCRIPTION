import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// A receipt is described by one plain object:
// { business, receiptNumber, reference, date, member, email, plan, type,
//   method, amount, verifiedByAdmin }

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const rows = (r) => [
  ['Receipt no.', r.receiptNumber],
  ['Reference', r.reference],
  ['Date', r.date],
  ['Member', r.member],
  ['Email', r.email],
  ['Plan', r.plan],
  ['Type', r.type],
  ['Payment method', r.method],
];

export const receiptText = (r) =>
  [
    `${r.business} - Official Receipt`,
    '',
    ...rows(r).map(([label, value]) => `${label}: ${value}`),
    `Amount paid: ${r.amount}`,
    r.verifiedByAdmin ? 'Payment verified by the gym admin.' : '',
    '',
    'Thank you for training with us!',
  ]
    .filter((line, i, all) => line !== '' || (i > 0 && all[i - 1] !== ''))
    .join('\n');

export const receiptHtml = (r) => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; padding: 32px; }
      h1 { margin: 0; color: #800000; font-size: 28px; }
      .sub { color: #666; margin: 4px 0 24px; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 10px 0; border-bottom: 1px solid #e5e5e5; font-size: 15px; }
      td:first-child { color: #666; width: 40%; }
      .total { margin-top: 24px; font-size: 22px; font-weight: bold; }
      .note { margin-top: 20px; color: #444; font-size: 14px; }
      .foot { margin-top: 40px; color: #888; font-size: 12px; }
    </style>
  </head>
  <body>
    <h1>${esc(r.business)}</h1>
    <div class="sub">Official Receipt</div>
    <table>
      ${rows(r)
        .map(([label, value]) => `<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`)
        .join('')}
    </table>
    <div class="total">Amount paid: ${esc(r.amount)}</div>
    ${r.verifiedByAdmin ? '<div class="note">Payment verified by the gym admin.</div>' : ''}
    <div class="foot">Thank you for training with us! Keep this receipt for your records.</div>
  </body>
</html>`;

// Share the receipt as a PDF. If that is not possible on this device, share plain text.
export const shareReceipt = async (r) => {
  try {
    if (Platform.OS === 'web') {
      await Print.printAsync({ html: receiptHtml(r) });
      return { ok: true };
    }
    const { uri } = await Print.printToFileAsync({ html: receiptHtml(r) });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share receipt',
        UTI: 'com.adobe.pdf',
      });
      return { ok: true };
    }
  } catch {
    // Fall through to the plain text share below.
  }
  try {
    await Share.share({ message: receiptText(r) });
    return { ok: true };
  } catch {
    return { ok: false };
  }
};
