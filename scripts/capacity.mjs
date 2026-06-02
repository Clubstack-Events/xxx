#!/usr/bin/env node
/**
 * Capacity management script for production Redis.
 * Reads credentials from app/.env.prod (KV_REST_API_URL + KV_REST_API_TOKEN).
 *
 * Usage:
 *   node scripts/capacity.mjs status
 *   node scripts/capacity.mjs reset outbound:10:30pm
 *   node scripts/capacity.mjs reset all
 *   node scripts/capacity.mjs set-booked outbound:10:30pm 12
 *   node scripts/capacity.mjs extend outbound:10:30pm 45
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../app/.env.prod");

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = val;
  }
  return env;
}

const env = loadEnv(envPath);
const BASE_URL = env.KV_REST_API_URL;
const TOKEN = env.KV_REST_API_TOKEN;

if (!BASE_URL || !TOKEN) {
  console.error("Missing KV_REST_API_URL or KV_REST_API_TOKEN in app/.env.prod");
  process.exit(1);
}

const DEFAULT_CAP = 30;

const SLOTS = [
  "outbound:10:30pm",
  "outbound:12am",
  "inbound:3am",
  "inbound:5:30am",
];

async function redis(command, ...args) {
  const res = await fetch(`${BASE_URL}/${[command, ...args].map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

async function mget(...keys) {
  const res = await fetch(`${BASE_URL}/mget/${keys.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

async function status() {
  const bookedKeys = SLOTS.map((s) => `booked:${s}`);
  const capKeys = SLOTS.map((s) => `cap:${s}`);
  const values = await mget(...bookedKeys, ...capKeys);
  const booked = values.slice(0, SLOTS.length);
  const caps = values.slice(SLOTS.length);

  console.log("\nSlot availability (production)\n");
  for (let i = 0; i < SLOTS.length; i++) {
    const b = Number(booked[i] ?? 0);
    const cap = Number(caps[i] ?? DEFAULT_CAP);
    const remaining = cap - b;
    const tag = remaining <= 0 ? " FULL" : remaining <= 4 ? " LOW" : "";
    console.log(`  ${SLOTS[i].padEnd(22)}  booked=${b}  cap=${cap}  remaining=${remaining}${tag}`);
  }
  console.log();
}

async function reset(slot) {
  const targets = slot === "all" ? SLOTS : [slot];
  for (const s of targets) {
    if (!SLOTS.includes(s)) { console.error(`Unknown slot: ${s}`); process.exit(1); }
    await redis("set", `booked:${s}`, 0);
    console.log(`Reset booked:${s} → 0`);
  }
}

async function setBooked(slot, n) {
  if (!SLOTS.includes(slot)) { console.error(`Unknown slot: ${slot}`); process.exit(1); }
  await redis("set", `booked:${slot}`, n);
  console.log(`Set booked:${slot} → ${n}`);
}

async function extend(slot, newCap) {
  if (!SLOTS.includes(slot)) { console.error(`Unknown slot: ${slot}`); process.exit(1); }
  await redis("set", `cap:${slot}`, newCap);
  console.log(`Set cap:${slot} → ${newCap}`);
}

const [cmd, arg1, arg2] = process.argv.slice(2);

if (!cmd || cmd === "status") {
  await status();
} else if (cmd === "reset") {
  if (!arg1) { console.error("Usage: reset <slot|all>"); process.exit(1); }
  await reset(arg1);
  await status();
} else if (cmd === "set-booked") {
  if (!arg1 || arg2 === undefined) { console.error("Usage: set-booked <slot> <n>"); process.exit(1); }
  await setBooked(arg1, Number(arg2));
  await status();
} else if (cmd === "extend") {
  if (!arg1 || arg2 === undefined) { console.error("Usage: extend <slot> <new-cap>"); process.exit(1); }
  await extend(arg1, Number(arg2));
  await status();
} else {
  console.error(`Unknown command: ${cmd}`);
  console.error("Commands: status | reset <slot|all> | set-booked <slot> <n> | extend <slot> <new-cap>");
  process.exit(1);
}
