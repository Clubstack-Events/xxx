"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  OUTBOUND_TIMES,
  INBOUND_TIMES,
  FIXED_PICKUP,
  DEFAULT_STATE,
  PRICES,
  calcTotal,
  type SignupState,
  type TripType,
} from "@/lib/data";
import type { Availability } from "@/lib/capacity";

type CardId = "name" | "contact" | "seats" | "outbound" | "return-yn" | "return-time" | "donate" | "review";

const CARD_ORDER: CardId[] = ["name", "contact", "seats", "outbound", "return-yn", "return-time", "donate", "review"];

function getCardOrder(form: SignupState): CardId[] {
  return CARD_ORDER.filter((id) => {
    if (id === "return-yn") return form.tripType !== "inbound-only";
    if (id === "return-time") return form.tripType === "round-trip" || form.tripType === "inbound-only";
    return true;
  });
}

export function SignupFlow() {
  const [form, setForm] = useState<SignupState>(DEFAULT_STATE);
  const [cardIdx, setCardIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);

  useEffect(() => {
    fetch("/api/availability")
      .then((r) => r.json())
      .then((data) => { if (!data.error) setAvailability(data); })
      .catch(() => {});
  }, []);

  function set<K extends keyof SignupState>(key: K, val: SignupState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const order = getCardOrder(form);
  const current = order[cardIdx];
  const isLast = cardIdx === order.length - 1;

  function advance() {
    if (isLast) {
      handleCheckout();
      return;
    }
    setCardIdx((i) => i + 1);
  }

  function retreat() {
    if (cardIdx === 0) return;
    setCardIdx((i) => i - 1);
  }

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "#060605", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Progress dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: "6px", paddingTop: "32px" }}>
        {order.map((_, i) => (
          <div key={i} style={{ width: i === cardIdx ? "20px" : "6px", height: "6px", borderRadius: "3px", background: i <= cardIdx ? "#d3f707" : "#222", transition: "all 250ms ease", opacity: i > cardIdx ? 0.4 : 1 }} />
        ))}
      </div>

      {/* Card area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 32px 32px", maxWidth: "640px", margin: "0 auto", width: "100%" }}>
        <KioskCard
          cardId={current}
          form={form}
          set={set}
          onAdvance={advance}
          isLast={isLast}
          loading={loading}
          error={error}
          availability={availability}
        />
      </div>

      {cardIdx > 0 && (
        <div style={{ padding: "0 32px 24px", maxWidth: "640px", margin: "0 auto", width: "100%" }}>
          <button onClick={retreat} disabled={loading} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: "13px", fontFamily: "var(--font-mono)", letterSpacing: "0.05em", padding: 0 }}>
            ← back
          </button>
        </div>
      )}
    </div>
  );
}

function KioskCard({
  cardId, form, set, onAdvance, isLast, loading, error, availability,
}: {
  cardId: CardId;
  form: SignupState;
  set: <K extends keyof SignupState>(k: K, v: SignupState[K]) => void;
  onAdvance: () => void;
  isLast: boolean;
  loading: boolean;
  error: string | null;
  availability: Availability | null;
}) {
  const bigLabel: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(2rem, 6vw, 3.5rem)",
    fontWeight: 600,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
    color: "#f0f0f0",
    marginBottom: "16px",
  };

  const kioskInput: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid #222",
    color: "#f0f0f0",
    fontSize: "clamp(1.25rem, 4vw, 2rem)",
    fontFamily: "var(--font-display)",
    fontWeight: 450,
    letterSpacing: "-0.02em",
    padding: "12px 0",
    outline: "none",
    caretColor: "#d3f707",
  };

  const total = calcTotal(form);

  const continueBtn = (disabled = false) => (
    <div>
      <button
        onClick={onAdvance}
        disabled={disabled || loading}
        style={{
          marginTop: "48px",
          background: disabled || loading ? "#111" : "#d3f707",
          color: disabled || loading ? "#333" : "#060605",
          border: "none",
          borderRadius: "4px",
          padding: "16px 32px",
          fontSize: "15px",
          fontWeight: 700,
          fontFamily: "var(--font-display)",
          letterSpacing: "-0.01em",
          cursor: disabled || loading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          transition: "background 150ms",
        }}
      >
        {loading ? (
          <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Redirecting to payment…</>
        ) : isLast ? (
          <>Pay ${total} →</>
        ) : (
          <>Continue <ArrowRight size={18} strokeWidth={2} /></>
        )}
      </button>
      {error && <p style={{ marginTop: "12px", color: "#f7074b", fontSize: "13px", fontFamily: "var(--font-mono)" }}>{error}</p>}
    </div>
  );

  if (cardId === "name") return (
    <div>
      <p style={bigLabel}>What&apos;s your name?</p>
      <input
        autoFocus
        value={form.name}
        onChange={(e) => set("name", e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && form.name.trim() && onAdvance()}
        placeholder="Full name"
        style={kioskInput}
      />
      {continueBtn(!form.name.trim())}
    </div>
  );

  if (cardId === "contact") {
    const isValidPhone = (v: string) => v.replace(/\D/g, "").length >= 10;
    const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    const isValid = form.contactType === "phone" ? isValidPhone(form.contact) : isValidEmail(form.contact);
    const showError = form.contact.trim().length > 3 && !isValid;
    return (
      <div>
        <p style={bigLabel}>How can we reach you?</p>
        <div style={{ display: "flex", gap: "0", marginBottom: "20px", borderBottom: "1px solid #1a1a1a" }}>
          {(["phone", "email"] as const).map((t) => (
            <button key={t} onClick={() => set("contactType", t)} style={{ flex: 1, padding: "10px", background: "none", border: "none", color: form.contactType === t ? "#d3f707" : "#333", fontFamily: "var(--font-mono)", fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", borderBottom: form.contactType === t ? "2px solid #d3f707" : "2px solid transparent", transition: "all 150ms" }}>
              {t}
            </button>
          ))}
        </div>
        <input
          autoFocus
          value={form.contact}
          onChange={(e) => set("contact", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && isValid && onAdvance()}
          placeholder={form.contactType === "phone" ? "+1 (555) 000-0000" : "you@example.com"}
          type={form.contactType === "phone" ? "tel" : "email"}
          style={{ ...kioskInput, borderBottomColor: showError ? "#f7074b" : "#222" }}
        />
        {showError && (
          <p style={{ marginTop: "8px", color: "#f7074b", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
            {form.contactType === "phone" ? "Enter a valid phone number (10+ digits)" : "Enter a valid email address"}
          </p>
        )}
        {continueBtn(!isValid)}
      </div>
    );
  }

  if (cardId === "seats") return (
    <div>
      <p style={bigLabel}>How many seats?</p>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: "#d3f707", letterSpacing: "-0.01em", marginBottom: "20px" }}>
        Each seat is ${PRICES.oneWay} one-way · ${PRICES.roundTrip} round-trip
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "32px", marginBottom: "8px" }}>
        <button
          onClick={() => set("seats", Math.max(1, form.seats - 1))}
          disabled={form.seats <= 1}
          style={{ width: "52px", height: "52px", border: "1px solid #222", background: "none", color: form.seats <= 1 ? "#333" : "#888", fontSize: "28px", cursor: form.seats <= 1 ? "not-allowed" : "pointer", borderRadius: "4px", lineHeight: 1 }}
        >−</button>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "5rem", fontWeight: 600, letterSpacing: "-0.04em", color: "#f0f0f0", minWidth: "80px", textAlign: "center", lineHeight: 1 }}>
          {form.seats}
        </span>
        <button
          onClick={() => set("seats", form.seats + 1)}
          style={{ width: "52px", height: "52px", border: "1px solid #222", background: "none", color: "#888", fontSize: "28px", cursor: "pointer", borderRadius: "4px", lineHeight: 1 }}
        >+</button>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#555", marginBottom: "0", paddingLeft: "84px" }}>
        {form.seats === 1 ? "just you" : `you + ${form.seats - 1} guest${form.seats > 2 ? "s" : ""}`}
      </div>
      {continueBtn(false)}
    </div>
  );

  if (cardId === "outbound") return (
    <div>
      <p style={bigLabel}>When do you want to leave?</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {OUTBOUND_TIMES.map((t) => {
          const slot = availability?.outbound[t.id];
          const full = slot?.full ?? false;
          const remaining = slot?.remaining ?? t.spots;
          const selected = form.outboundTime === t.id && form.tripType !== "inbound-only";
          return (
            <button
              key={t.id}
              disabled={full}
              onClick={() => { if (!full) { set("outboundTime", t.id); set("tripType", "outbound"); setTimeout(onAdvance, 180); } }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", background: selected ? "rgba(211,247,7,0.08)" : "#0a0909", border: `1px solid ${selected ? "#d3f707" : "#1a1a1a"}`, cursor: full ? "not-allowed" : "pointer", borderRadius: "4px", transition: "all 150ms", opacity: full ? 0.4 : 1 }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "18px", color: selected ? "#d3f707" : "#888", letterSpacing: "0.02em" }}>{t.label}</span>
              {full
                ? <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#555" }}>full</span>
                : remaining <= 10 && <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#444" }}>{remaining} left</span>
              }
            </button>
          );
        })}
        <button
          onClick={() => { set("tripType", "inbound-only" as TripType); setTimeout(onAdvance, 180); }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", background: form.tripType === "inbound-only" ? "rgba(211,247,7,0.08)" : "#0a0909", border: `1px solid ${form.tripType === "inbound-only" ? "#d3f707" : "#1a1a1a"}`, cursor: "pointer", borderRadius: "4px", transition: "all 150ms", marginTop: "6px" }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "15px", color: form.tripType === "inbound-only" ? "#d3f707" : "#555", letterSpacing: "0.02em" }}>Skip — return home only · ${PRICES.oneWay}</span>
        </button>
      </div>
    </div>
  );

  if (cardId === "return-yn") return (
    <div>
      <p style={bigLabel}>Need a ride back?</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {(["round-trip", "outbound"] as TripType[]).map((t) => (
          <button key={t} onClick={() => { set("tripType", t); setTimeout(onAdvance, 180); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", background: form.tripType === t ? "rgba(211,247,7,0.08)" : "#0a0909", border: `1px solid ${form.tripType === t ? "#d3f707" : "#1a1a1a"}`, cursor: "pointer", borderRadius: "4px", transition: "all 150ms" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "18px", color: form.tripType === t ? "#d3f707" : "#888", letterSpacing: "0.02em" }}>
              {t === "round-trip" ? `Yes — $${PRICES.roundTrip} round-trip` : `No — $${PRICES.oneWay} one-way`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  if (cardId === "return-time") return (
    <div>
      <p style={bigLabel}>What time are you leaving?</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {INBOUND_TIMES.map((t) => {
          const slot = availability?.inbound[t.id];
          const full = slot?.full ?? false;
          const remaining = slot?.remaining ?? t.spots;
          const selected = form.inboundTime === t.id;
          return (
            <button
              key={t.id}
              disabled={full}
              onClick={() => { if (!full) { set("inboundTime", t.id); setTimeout(onAdvance, 180); } }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", background: selected ? "rgba(211,247,7,0.08)" : "#0a0909", border: `1px solid ${selected ? "#d3f707" : "#1a1a1a"}`, cursor: full ? "not-allowed" : "pointer", borderRadius: "4px", transition: "all 150ms", opacity: full ? 0.4 : 1 }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "18px", color: selected ? "#d3f707" : "#888", letterSpacing: "0.02em" }}>{t.label}</span>
              {full
                ? <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#555" }}>full</span>
                : remaining <= 10 && <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#444" }}>{remaining} left</span>
              }
            </button>
          );
        })}
      </div>
    </div>
  );

  if (cardId === "donate") return (
    <div>
      <p style={bigLabel}>Add a donation?</p>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: "#d3f707", letterSpacing: "-0.01em", marginBottom: "20px" }}>
        All donations pay our artists directly. Suggested: $15.
      </div>
      <div style={{ display: "flex", gap: "6px", marginBottom: "24px", flexWrap: "wrap" }}>
        {[0, 10, 15, 25].map((p) => (
          <button key={p} onClick={() => set("donation", p)} style={{ padding: "14px 20px", background: form.donation === p ? (p > 0 ? "rgba(211,247,7,0.12)" : "rgba(255,255,255,0.05)") : "#0a0909", border: `1px solid ${form.donation === p ? (p > 0 ? "#d3f707" : "#333") : "#1a1a1a"}`, color: form.donation === p ? (p > 0 ? "#d3f707" : "#888") : "#555", cursor: "pointer", borderRadius: "4px", fontFamily: "var(--font-mono)", fontSize: "14px", transition: "all 150ms" }}>
            {p === 0 ? "Skip" : `$${p}`}
          </button>
        ))}
      </div>
      {continueBtn(false)}
    </div>
  );

  if (cardId === "review") {
    const outbound = OUTBOUND_TIMES.find((t) => t.id === form.outboundTime);
    const inbound = INBOUND_TIMES.find((t) => t.id === form.inboundTime);
    const tripCost = (form.tripType === "round-trip" ? PRICES.roundTrip : PRICES.oneWay) * form.seats;
    const returnsLabel = form.tripType === "outbound" ? "One-way" : (inbound?.label ?? "—");
    const departsLabel = form.tripType === "inbound-only" ? "—" : (outbound?.label ?? "—");
    return (
      <div>
        <p style={{ ...bigLabel, fontSize: "clamp(1.5rem, 4vw, 2.5rem)" }}>Here&apos;s your ticket.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0", border: "1px solid #1a1a1a", borderRadius: "4px", overflow: "hidden", marginBottom: "8px" }}>
          {[
            ["Name", form.name],
            [form.contactType === "phone" ? "Phone" : "Email", form.contact],
            ["Pickup", FIXED_PICKUP.label],
            ["Seats", form.seats === 1 ? "1 seat (just you)" : `${form.seats} seats`],
            ["Departs", departsLabel],
            ["Returns", returnsLabel],
            ["Trip cost", `$${tripCost} (${form.seats} × $${form.tripType === "round-trip" ? PRICES.roundTrip : PRICES.oneWay})`],
            ["Donation", form.donation > 0 ? `$${form.donation}` : "None"],
          ].map(([k, v], i) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px", background: i % 2 === 0 ? "#0a0909" : "#080807", borderBottom: "1px solid #111" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>{k}</span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "#ccc" }}>{v}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px", background: "#0a0909" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>Total</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 700, color: "#d3f707", letterSpacing: "-0.02em" }}>${total}</span>
          </div>
        </div>
        <p style={{ fontSize: "11px", color: "#333", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>
          You&apos;ll complete payment on Stripe. Confirmation via {form.contactType}.
        </p>
        {continueBtn(false)}
      </div>
    );
  }

  return null;
}
