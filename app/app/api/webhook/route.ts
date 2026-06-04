import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { incrementFromWebhook } from "@/lib/capacity";
import * as discord from "@/lib/discord";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true });
const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    discord.log("Webhook rejected", "warning", { Reason: "Missing signature" });
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook verification failed";
    discord.log("Webhook signature failed", "error", { Error: msg });
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata ?? {};

    if (meta.site !== "ditp-june6") {
      return NextResponse.json({ received: true });
    }

    // backward-compat: old sessions stored wantsReturn, new sessions store tripType
    const tripType = meta.tripType ?? (meta.wantsReturn === "true" ? "round-trip" : "outbound");
    const outboundTime = tripType !== "inbound-only" && meta.outboundTime ? meta.outboundTime : null;
    const inboundTime = tripType !== "outbound" && meta.inboundTime ? meta.inboundTime : null;
    const seats = parseInt(meta.seats ?? "1", 10);

    if (seats > 0 && (outboundTime || inboundTime)) {
      await incrementFromWebhook(outboundTime, inboundTime, seats);
      discord.log("Seats booked", "success", {
        Name: meta.name ?? "—",
        Seats: String(seats),
        Trip: tripType,
        Outbound: outboundTime ?? "—",
        Return: inboundTime ?? "—",
      });
    }
  }

  return NextResponse.json({ received: true });
}
