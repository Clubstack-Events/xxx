// Stripe redirects here after successful payment: /signup/confirm?session_id=xxx
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { Resend } from "resend";
import twilio from "twilio";
import { OUTBOUND_TIMES, INBOUND_TIMES, FIXED_PICKUP } from "@/lib/data";
import * as discord from "@/lib/discord";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true });
const resend = new Resend(process.env.RESEND_API_KEY!);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  if (!session_id) redirect("/signup");

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(session_id);
  } catch {
    redirect("/signup");
  }

  if (session.payment_status !== "paid") redirect("/signup");

  const meta = session.metadata ?? {};
  const alreadySent = meta.receiptSent === "true";

  // Send receipt once — idempotent via metadata flag
  if (!alreadySent && meta.contact) {
    try {
      const tripType = meta.tripType ?? (meta.wantsReturn === "true" ? "round-trip" : "outbound");
      const outboundLabel = OUTBOUND_TIMES.find((t) => t.id === meta.outboundTime)?.label ?? "—";
      const inboundLabel = INBOUND_TIMES.find((t) => t.id === meta.inboundTime)?.label;
      const seats = Number(meta.seats ?? 1);
      const total = (session.amount_total ?? 0) / 100;

      if (meta.contactType === "email") {
        await resend.emails.send({
          from: "Fort Tilden Transportation <admin@clubstack.studio>",
          to: meta.contact,
          subject: "June 6 Fort Tilden",
          html: receiptHtml({ name: meta.name ?? "", seats, outboundLabel, tripType, inboundLabel, total }),
        });
      } else if (meta.contactType === "phone") {
        const smsBody = smsText({ name: meta.name ?? "", seats, outboundLabel, tripType, inboundLabel, total });
        const digits = meta.contact.replace(/\D/g, "");
        const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
        await twilioClient.messages.create({
          body: smsBody,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: e164,
        });
      }

      await stripe.checkout.sessions.update(session_id, { metadata: { ...meta, receiptSent: "true" } });
      discord.log("Confirmation sent", "success", {
        Name: meta.name ?? "—",
        Contact: meta.contact ?? "—",
        Method: meta.contactType === "phone" ? "SMS" : "Email",
        Seats: meta.seats ?? "1",
      });
    } catch (err) {
      console.error("[confirm] receipt send failed:", err);
      discord.log("Confirmation FAILED", "error", {
        Name: meta.name ?? "—",
        Contact: meta.contact ?? "—",
        Method: meta.contactType === "phone" ? "SMS" : "Email",
        Error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
  const seats = Number(meta.seats ?? 1);
  const tripType = meta.tripType ?? (meta.wantsReturn === "true" ? "round-trip" : "outbound");
  const outbound = OUTBOUND_TIMES.find((t) => t.id === meta.outboundTime);
  const inbound = INBOUND_TIMES.find((t) => t.id === meta.inboundTime);
  const total = (session.amount_total ?? 0) / 100;

  const rows: [string, string][] = [
    ["Name", meta.name ?? "—"],
    [meta.contactType === "phone" ? "Phone" : "Email", meta.contact ?? "—"],
    ["Pickup", FIXED_PICKUP.label],
    ["Seats", seats === 1 ? "1 seat" : `${seats} seats`],
    ["Departs", tripType === "inbound-only" ? "—" : (outbound?.label ?? "—")],
    ["Returns", tripType === "outbound" ? "One-way" : (inbound?.label ?? "—")],
    ["Paid", `$${total}`],
  ];

  return (
    <div style={{ background: "#f8f8f8", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", color: "#1a1a1a", fontFamily: "var(--font-body)", textAlign: "center" }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.3em", color: "#666", textTransform: "uppercase", marginBottom: "24px" }}>
          June 6 · Fort Tilden
        </div>

        <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 10vw, 3.5rem)", fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1, color: "#1a1a1a", marginBottom: "16px" }}>
          Screenshot this confirmation.
        </div>

        {seats > 1 && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", letterSpacing: "0.1em", color: "#666", textTransform: "uppercase", marginBottom: "8px" }}>
            {seats} seats confirmed
          </div>
        )}

        <p style={{ color: "#666", fontSize: "15px", marginBottom: "32px", lineHeight: 1.5 }}>
          Confirmation sent to <strong>{meta.contact}</strong>
        </p>

        <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: "8px", overflow: "hidden", marginBottom: "32px", textAlign: "left" }}>
          {rows.map(([k, v], i) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "16px 20px", borderBottom: i < rows.length - 1 ? "1px solid #e0e0e0" : "none" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#999", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500 }}>{k}</span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#1a1a1a", fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>

        <a href="/signup" style={{ display: "inline-block", background: "#060605", border: "none", color: "#fff", padding: "14px 28px", textDecoration: "none", fontFamily: "var(--font-mono)", fontSize: "12px", letterSpacing: "0.1em", borderRadius: "6px", cursor: "pointer" }}>
          ← book another seat
        </a>
      </div>
    </div>
  );
}

function smsText({ name, seats, outboundLabel, tripType, inboundLabel, total }: {
  name: string; seats: number; outboundLabel: string; tripType: string; inboundLabel?: string; total: number;
}): string {
  const tripLine = tripType === "round-trip"
    ? `Round-trip: departs ${outboundLabel}, returns ${inboundLabel ?? "—"}`
    : tripType === "inbound-only"
    ? `Return-only: departs Fort Tilden ${inboundLabel ?? "—"}`
    : `One-way: departs ${outboundLabel}`;
  return [
    `Hi ${name}`,
    `June 6 · Fort Tilden 🚌 `,
    `Pickup & Drop: ${FIXED_PICKUP.label}`,
    `${seats} seat${seats > 1 ? "s" : ""} · ${tripLine}`,
    `Total paid: $${total}`,
    `Save this confirmation.`,
  ].join("\n");
}

function receiptHtml({ name, seats, outboundLabel, tripType, inboundLabel, total }: {
  name: string; seats: number; outboundLabel: string; tripType: string; inboundLabel?: string; total: number;
}) {
  const rows = [
    ["Pickup", FIXED_PICKUP.label],
    ["Seats", seats === 1 ? "1 seat" : `${seats} seats`],
    ["Departs", tripType === "inbound-only" ? "—" : outboundLabel],
    ["Returns", tripType === "outbound" ? "One-way" : (inboundLabel ?? "—")],
    ["Total paid", `$${total}`],
  ];
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#f8f8f8;color:#1a1a1a;font-family:Helvetica Neue,Arial,sans-serif;padding:20px 16px;margin:0">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:32px 24px">
    <p style="font-size:12px;letter-spacing:0.15em;color:#999;text-transform:uppercase;margin:0 0 16px">June 6 · Fort Tilden</p>
    <h1 style="font-size:2rem;font-weight:700;letter-spacing:-0.03em;color:#1a1a1a;margin:0 0 12px">Save this email.</h1>
    <p style="color:#666;font-size:15px;margin:0 0 24px;line-height:1.5">Hi ${name} — here's your booking summary.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      ${rows.map(([k, v]) => `<tr style="border-bottom:1px solid #e0e0e0">
        <td style="padding:14px 0;color:#999;font-family:monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:500">${k}</td>
        <td style="padding:14px 0;color:#1a1a1a;text-align:right;font-weight:500">${v}</td>
      </tr>`).join("")}
    </table>
    <p style="margin:0;font-size:13px;color:#999;line-height:1.6">Questions? Reply to this email or contact us.</p>
  </div>
</body></html>`;
}
