import { NextResponse } from "next/server";
import { getAvailability } from "@/lib/capacity";

export const revalidate = 0;

export async function GET() {
  try {
    const availability = await getAvailability();
    return NextResponse.json(availability);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
