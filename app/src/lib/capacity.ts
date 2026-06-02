import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});
import { OUTBOUND_TIMES, INBOUND_TIMES } from "./data";

export type SlotKey = `outbound:${string}` | `inbound:${string}`;

function bookedKey(slot: SlotKey): string {
  return `booked:${slot}`;
}

function capKey(slot: SlotKey): string {
  return `cap:${slot}`;
}

export const SLOT_CAPACITY = 30;

export type SlotAvailability = {
  id: string;
  booked: number;
  remaining: number;
  full: boolean;
};

export type Availability = {
  outbound: Record<string, SlotAvailability>;
  inbound: Record<string, SlotAvailability>;
};

export async function getAvailability(): Promise<Availability> {
  const outboundSlots = OUTBOUND_TIMES.map((t) => `outbound:${t.id}` as SlotKey);
  const inboundSlots = INBOUND_TIMES.map((t) => `inbound:${t.id}` as SlotKey);
  const allSlots = [...outboundSlots, ...inboundSlots];

  const bookedKeys = allSlots.map(bookedKey);
  const capKeys = allSlots.map(capKey);
  const values = await kv.mget<(number | null)[]>(...bookedKeys, ...capKeys);

  const bookedValues = values.slice(0, allSlots.length);
  const capValues = values.slice(allSlots.length);

  const outbound: Record<string, SlotAvailability> = {};
  OUTBOUND_TIMES.forEach((t, i) => {
    const booked = bookedValues[i] ?? 0;
    const cap = capValues[i] ?? SLOT_CAPACITY;
    outbound[t.id] = { id: t.id, booked, remaining: cap - booked, full: booked >= cap };
  });

  const inbound: Record<string, SlotAvailability> = {};
  INBOUND_TIMES.forEach((t, i) => {
    const booked = bookedValues[outboundSlots.length + i] ?? 0;
    const cap = capValues[outboundSlots.length + i] ?? SLOT_CAPACITY;
    inbound[t.id] = { id: t.id, booked, remaining: cap - booked, full: booked >= cap };
  });

  return { outbound, inbound };
}

// Soft gate: read-only check. Does not increment — only the webhook writes.
// A small race window exists when two sessions pass this check simultaneously,
// accepted as low-risk for a 60-seat event.
export async function checkCapacity(
  outboundTime: string,
  inboundTime: string | null,
  seats: number,
): Promise<{ ok: boolean; reason?: string }> {
  const av = await getAvailability();

  const ob = av.outbound[outboundTime];
  if (!ob) return { ok: false, reason: "Invalid outbound slot" };
  if (ob.remaining < seats) return { ok: false, reason: `Only ${ob.remaining} seat${ob.remaining === 1 ? "" : "s"} left on that departure` };

  if (inboundTime) {
    const ib = av.inbound[inboundTime];
    if (!ib) return { ok: false, reason: "Invalid inbound slot" };
    if (ib.remaining < seats) return { ok: false, reason: `Only ${ib.remaining} seat${ib.remaining === 1 ? "" : "s"} left on that return` };
  }

  return { ok: true };
}

export async function incrementFromWebhook(
  outboundTime: string,
  inboundTime: string | null,
  seats: number,
): Promise<void> {
  await kv.incrby(bookedKey(`outbound:${outboundTime}`), seats);
  if (inboundTime) {
    await kv.incrby(bookedKey(`inbound:${inboundTime}`), seats);
  }
}
