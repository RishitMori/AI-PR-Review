import crypto from 'node:crypto';
import { config } from '../config.js';

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  notes?: {
    user_id?: string;
    plan_id?: string;
  };
}

export const razorpayPlans = [
  {
    id: 'basic',
    name: 'Basic',
    amount: 100000,
    repoLimit: 2,
    benefits: ['2 repositories', 'AI PR summaries', 'Basic review settings']
  },
  {
    id: 'pro',
    name: 'Pro',
    amount: 200000,
    repoLimit: 5,
    benefits: ['5 repositories', 'Inline review comments', 'Priority review queue']
  },
  {
    id: 'scale',
    name: 'Scale',
    amount: 500000,
    repoLimit: null,
    benefits: ['Unlimited repositories', 'Advanced repository policies', 'Priority support']
  }
] as const;

export type RazorpayPlanId = (typeof razorpayPlans)[number]['id'];

export const freePlan = {
  id: 'free',
  name: 'Free',
  amount: 0,
  repoLimit: 1,
  benefits: ['1 repository', 'AI PR summaries', 'Basic dashboard']
} as const;

export type BillingPlanId = RazorpayPlanId | typeof freePlan.id;

export function isRazorpayCheckoutReady() {
  return Boolean(config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET);
}

export function getRazorpayPlan(planId: string) {
  return razorpayPlans.find((plan) => plan.id === planId);
}

export function getBillingPlan(planIdOrName: string | null | undefined) {
  const normalized = normalizePlanKey(planIdOrName);
  if (!normalized || normalized === freePlan.id) return freePlan;
  return razorpayPlans.find((plan) => plan.id === normalized || normalizePlanKey(plan.name) === normalized) ?? freePlan;
}

export function getUserPlanAccess(user: { billingStatus?: string | null; planName?: string | null } | null | undefined) {
  if (user?.billingStatus !== 'active') {
    return {
      plan: freePlan,
      hasPaidAccess: false,
      hasDashboardAccess: true
    };
  }

  const plan = getBillingPlan(user.planName);
  return {
    plan: plan.id === freePlan.id ? freePlan : plan,
    hasPaidAccess: plan.id !== freePlan.id,
    hasDashboardAccess: true
  };
}

export function isUpgradePlan(currentPlanId: BillingPlanId, nextPlanId: BillingPlanId) {
  return planRank(nextPlanId) > planRank(currentPlanId);
}

export async function createRazorpayOrder(user: { userId: number; username: string }, planId: RazorpayPlanId) {
  assertRazorpayConfigured();

  const plan = getRazorpayPlan(planId);
  if (!plan) throw new Error('Invalid Razorpay plan.');

  const receipt = `rp_${user.userId}_${Date.now()}`.slice(0, 40);
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: plan.amount,
      currency: config.RAZORPAY_CURRENCY,
      receipt,
      notes: {
        user_id: String(user.userId),
        username: user.username,
        plan: plan.name,
        plan_id: plan.id
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Razorpay order creation failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as RazorpayOrderResponse;
}

export function verifyRazorpayPaymentSignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  assertRazorpayConfigured();

  const expected = crypto
    .createHmac('sha256', config.RAZORPAY_KEY_SECRET)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(input.razorpaySignature);
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function fetchRazorpayOrder(orderId: string) {
  assertRazorpayConfigured();

  const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`).toString('base64')}`
    }
  });

  if (!response.ok) {
    throw new Error(`Razorpay order lookup failed (${response.status}).`);
  }

  return (await response.json()) as RazorpayOrderResponse;
}

function assertRazorpayConfigured() {
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay checkout is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }
}

function normalizePlanKey(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, '-');
  return normalized === 'starter' ? 'basic' : normalized;
}

function planRank(planId: BillingPlanId) {
  if (planId === 'free') return 0;
  if (planId === 'basic') return 1;
  if (planId === 'pro') return 2;
  return 3;
}
