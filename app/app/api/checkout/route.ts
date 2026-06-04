import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import type { SignupState } from "@/lib/data";
import { PRICES, OUTBOUND_TIMES, INBOUND_TIMES, FIXED_PICKUP, type TripType } from "@/lib/data";
import { checkCapacity } from "@/lib/capacity";
import * as discord from "@/lib/discord";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true });

const VALID_OUTBOUND_IDS: Set<string> = new Set(OUTBOUND_TIMES.map((t) => t.id));
const VALID_INBOUND_IDS: Set<string> = new Set(INBOUND_TIMES.map((t) => t.id));

const VALID_TRIP_TYPES = new Set<TripType>(["outbound", "round-trip", "inbound-only"]);

function validateForm(form: unknown): form is SignupState {
  if (!form || typeof form !== "object") return false;
  const f = form as Record<string, unknown>;
  if (typeof f.name !== "string" || !f.name.trim()) return false;
  if (typeof f.contact !== "string" || !f.contact.trim()) return false;
  if (f.contactType !== "phone" && f.contactType !== "email") return false;
  if (f.contactType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contact as string)) return false;
  if (f.contactType === "phone" && (f.contact as string).replace(/\D/g, "").length < 10) return false;
  if (typeof f.seats !== "number" || f.seats < 1 || f.seats > 20 || !Number.isInteger(f.seats)) return false;
  if (!VALID_TRIP_TYPES.has(f.tripType as TripType)) return false;
  if (f.tripType !== "inbound-only" && (typeof f.outboundTime !== "string" || !VALID_OUTBOUND_IDS.has(f.outboundTime))) return false;
  if (f.tripType !== "outbound" && (typeof f.inboundTime !== "string" || !VALID_INBOUND_IDS.has(f.inboundTime))) return false;
  if (typeof f.donation !== "number" || f.donation < 0 || !Number.isInteger(f.donation)) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!validateForm(body)) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    const form = body;
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3005";

    const outboundTimeForCheck = form.tripType !== "inbound-only" ? form.outboundTime : null;
    const inboundTimeForCheck = form.tripType !== "outbound" ? form.inboundTime : null;

    const capacityCheck = await checkCapacity(outboundTimeForCheck, inboundTimeForCheck, form.seats);
    if (!capacityCheck.ok) {
      return NextResponse.json({ error: capacityCheck.reason ?? "Not enough seats available" }, { status: 409 });
    }

    const tripPrice = form.tripType === "round-trip" ? PRICES.roundTrip : PRICES.oneWay;
    const outbound = OUTBOUND_TIMES.find((t) => t.id === form.outboundTime);
    const inbound = INBOUND_TIMES.find((t) => t.id === form.inboundTime);

    const tripDescription = [
      form.tripType === "round-trip" ? "Round-trip" : form.tripType === "inbound-only" ? "Return-only" : "One-way",
      form.tripType !== "inbound-only" && outbound ? `departs ${outbound.label}` : null,
      form.tripType !== "outbound" && inbound ? `returns ${inbound.label}` : null,
      `· pickup: ${FIXED_PICKUP.label}`,
    ]
      .filter(Boolean)
      .join(", ");

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "usd",
          unit_amount: tripPrice * 100,
          product_data: {
            name: `Fort Tilden Transportation — June 6`,
            description: tripDescription,
          },
        },
        quantity: form.seats,
      },
    ];

    if (form.donation > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          unit_amount: form.donation * 100,
          product_data: {
            name: "Donation — Artist Fund",
            description: "All donations pay our artists directly.",
          },
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${base}/signup/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/signup`,
      metadata: {
        site: "ditp-june6",
        name: form.name,
        contact: form.contact,
        contactType: form.contactType,
        seats: String(form.seats),
        tripType: form.tripType,
        outboundTime: form.outboundTime ?? "",
        inboundTime: form.inboundTime ?? "",
      },
      customer_email: form.contactType === "email" ? form.contact : undefined,
    });

    discord.log("Checkout started", "info", {
      Name: form.name,
      Seats: String(form.seats),
      Trip: form.tripType,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    discord.log("Checkout creation failed", "error", { Error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
