import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { incrementFromWebhook } from "@/lib/capacity";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true });
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook verification failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata ?? {};

    const outboundTime = meta.outboundTime;
    const wantsReturn = meta.wantsReturn === "true";
    const inboundTime = wantsReturn && meta.inboundTime ? meta.inboundTime : null;
    const seats = parseInt(meta.seats ?? "1", 10);

    if (outboundTime && seats > 0) {
      await incrementFromWebhook(outboundTime, inboundTime, seats);
    }
  }

  return NextResponse.json({ received: true });
}
