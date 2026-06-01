// Stripe redirects here after successful payment: /signup/confirm?session_id=xxx
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { Resend } from "resend";
import twilio from "twilio";
import { OUTBOUND_TIMES, INBOUND_TIMES, FIXED_PICKUP } from "@/lib/data";

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
      const outboundLabel = OUTBOUND_TIMES.find((t) => t.id === meta.outboundTime)?.label ?? "—";
      const inboundLabel = INBOUND_TIMES.find((t) => t.id === meta.inboundTime)?.label;
      const seats = Number(meta.seats ?? 1);
      const total = (session.amount_total ?? 0) / 100;

      if (meta.contactType === "email") {
        await resend.emails.send({
          from: "Fort Tilden Transportation <admin@clubstack.studio>",
          to: meta.contact,
          subject: "You're on the bus — June 6 Fort Tilden",
          html: receiptHtml({ name: meta.name ?? "", seats, outboundLabel, wantsReturn: meta.wantsReturn === "true", inboundLabel, total }),
        });
      } else if (meta.contactType === "phone") {
        const smsBody = smsText({ name: meta.name ?? "", seats, outboundLabel, wantsReturn: meta.wantsReturn === "true", inboundLabel, total });
        await twilioClient.messages.create({
          body: smsBody,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: meta.contact,
        });
      }

      await stripe.checkout.sessions.update(session_id, { metadata: { ...meta, receiptSent: "true" } });
    } catch {
      // Non-fatal — confirmation page still shows
    }
  }
  const seats = Number(meta.seats ?? 1);
  const wantsReturn = meta.wantsReturn === "true";
  const outbound = OUTBOUND_TIMES.find((t) => t.id === meta.outboundTime);
  const inbound = INBOUND_TIMES.find((t) => t.id === meta.inboundTime);
  const total = (session.amount_total ?? 0) / 100;

  const rows: [string, string][] = [
    ["Name", meta.name ?? "—"],
    [meta.contactType === "phone" ? "Phone" : "Email", meta.contact ?? "—"],
    ["Pickup", FIXED_PICKUP.label],
    ["Seats", seats === 1 ? "1 seat" : `${seats} seats`],
    ["Departs", outbound?.label ?? "—"],
    ["Returns", wantsReturn ? (inbound?.label ?? "—") : "One-way"],
    ["Paid", `$${total}`],
  ];

  return (
    <div style={{ background: "#060605", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px", color: "#f0f0f0", fontFamily: "var(--font-body)", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.3em", color: "#333", textTransform: "uppercase", marginBottom: "24px" }}>
        June 6 · Fort Tilden
      </div>

      <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(3rem, 12vw, 7rem)", fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 0.85, color: "#d3f707", marginBottom: "32px" }}>
        ON THE<br />BUS.
      </div>

      {seats > 1 && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", letterSpacing: "0.1em", color: "#555", textTransform: "uppercase", marginBottom: "8px" }}>
          {seats} seats confirmed
        </div>
      )}

      <p style={{ color: "#555", fontSize: "14px", marginBottom: "40px" }}>
        Confirmation sent to {meta.contact}. See you there.
      </p>

      <div style={{ border: "1px solid #1a1a1a", width: "100%", maxWidth: "400px", borderRadius: "4px", overflow: "hidden", marginBottom: "32px", textAlign: "left" }}>
        {rows.map(([k, v], i) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px", background: i % 2 === 0 ? "#0a0909" : "#080807", borderBottom: "1px solid #111" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>{k}</span>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "#ccc" }}>{v}</span>
          </div>
        ))}
      </div>

      <a href="/signup" style={{ background: "none", border: "1px solid #1a1a1a", color: "#333", padding: "12px 24px", textDecoration: "none", fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.1em", borderRadius: "4px" }}>
        ← book another seat
      </a>
    </div>
  );
}

function smsText({ name, seats, outboundLabel, wantsReturn, inboundLabel, total }: {
  name: string; seats: number; outboundLabel: string; wantsReturn: boolean; inboundLabel?: string; total: number;
}): string {
  const tripLine = wantsReturn
    ? `Round-trip: departs ${outboundLabel}, returns ${inboundLabel ?? "—"}`
    : `One-way: departs ${outboundLabel}`;
  return [
    `Hi ${name} — you're on the bus! 🚌`,
    `June 6 · Fort Tilden`,
    `Pickup: ${FIXED_PICKUP.label}`,
    `${seats} seat${seats > 1 ? "s" : ""} · ${tripLine}`,
    `Total paid: $${total}`,
    `See you there.`,
  ].join("\n");
}

function receiptHtml({ name, seats, outboundLabel, wantsReturn, inboundLabel, total }: {
  name: string; seats: number; outboundLabel: string; wantsReturn: boolean; inboundLabel?: string; total: number;
}) {
  const rows = [
    ["Pickup", FIXED_PICKUP.label],
    ["Seats", seats === 1 ? "1 seat" : `${seats} seats`],
    ["Departs", outboundLabel],
    ["Returns", wantsReturn ? (inboundLabel ?? "—") : "One-way"],
    ["Total paid", `$${total}`],
  ];
  return `<!DOCTYPE html><html><body style="background:#0c0b0a;color:#f0f0f0;font-family:Helvetica Neue,Arial,sans-serif;padding:40px 24px;max-width:480px;margin:0 auto">
  <p style="font-size:11px;letter-spacing:0.2em;color:#555;text-transform:uppercase;margin-bottom:24px">June 6 · Fort Tilden</p>
  <h1 style="font-size:2.5rem;font-weight:700;letter-spacing:-0.04em;color:#d3f707;margin:0 0 8px">You're on the bus.</h1>
  <p style="color:#555;font-size:14px;margin-bottom:32px">Hi ${name} — here's your booking summary.</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    ${rows.map(([k, v], i) => `<tr style="background:${i % 2 === 0 ? "#151412" : "#0c0b0a"}">
      <td style="padding:12px 16px;color:#555;font-family:monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase">${k}</td>
      <td style="padding:12px 16px;color:#ccc;text-align:right">${v}</td>
    </tr>`).join("")}
  </table>
  <p style="margin-top:32px;font-size:12px;color:#444">Questions? Reply to this email.</p>
</body></html>`;
}
