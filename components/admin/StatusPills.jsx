import React from 'react';
import { Pill } from './ui';
import { MEMBER_STATUS, PAYMENT_STATUS, activeLabel } from '../../lib/admin';

// Membership status. A running membership that ends within 7 days shows as
// "Expiring soon" instead of "Active".
export function MembershipPill({ status, endDate }) {
  const info = status === 'active' ? activeLabel(endDate) : MEMBER_STATUS[status];
  return <Pill label={info?.label ?? String(status)} tone={info?.tone} />;
}

export function PaymentPill({ status }) {
  const info = PAYMENT_STATUS[status];
  return <Pill label={info?.label ?? String(status)} tone={info?.tone} />;
}
