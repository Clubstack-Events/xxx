# Event Signup Domain Glossary

## Language

**Slot**: An outbound or inbound trip identified by direction and departure time. Each slot has a fixed capacity of 30 seats (2 buses × 15).
_Avoid_: Run, departure, bus

**Seat**: One unit of slot capacity consumed by a booking. A signup with N seats decrements N from the chosen outbound slot and, if round-trip, N from the chosen inbound slot.
_Avoid_: Spot, ticket, person (in the capacity context)

**Capacity**: The maximum number of seats on a slot. Fixed at 30.

**Booked**: The count of seats on a slot consumed by completed purchases. Capacity minus booked equals remaining availability.
_Avoid_: Reserved, taken

---

## Core Entities

### Guest
A person signing up for transportation to/from the June 6 Fort Tilden event. One-time transaction identity only—no persistent account. Identified by phone and/or email for confirmation delivery.

### Trip
A directed journey between a pickup location and Fort Tilden. Either **outbound** (to event) or **inbound** (from event). Each trip has a fixed departure time and price.

**Trip Types:**
- **Outbound trip**: departure from pickup location → Fort Tilden. Price: $20 per one-way OR $30 for round-trip (outbound + inbound pair)
- **Inbound trip**: departure from Fort Tilden → return to pickup location. Selected only if guest also selected an outbound trip.

### Signup
A guest's complete form submission. Contains:
- Guest contact info (name, phone and/or email)
- Selected trips (one outbound + optionally one inbound)
- Donation amount (optional, default $15, custom editable)
- Confirmation delivery preference (derived from contact info provided)

## Constraints & Rules

**Trip Selection:**
- Guest must select exactly one outbound trip
- Guest may optionally select one inbound trip (if selected, timing must be sensible: inbound departure time ≥ some minimum duration after event start)
- Maximum 2 trips per signup (outbound + inbound)

**Payment:**
- Trip payment is mandatory and immediate (at form submission → Stripe checkout → confirmation)
- Donation is optional; guest can skip or customize the $15 default
- Total charge = trip price + donation (if any)

**Data Retention:**
- Guest records are deleted immediately after confirmation is sent
- No audit logs or PII retention

**Confirmation Delivery:**
- Primary: SMS/WhatsApp via Twilio (to phone number if provided)
- Fallback: Email (if phone not provided, or SMS fails)
- Contains: trip details, departure/return times, total donation amount

## External Dependencies

- **Stripe**: Payment processing for trips + donations. Products pre-created. Uses custom price input for donation.
- **Twilio**: SMS/WhatsApp delivery for confirmations
- **Vercel**: Hosting platform
- **Vercel KV**: Redis-based key-value store used to track booked seat counts per slot
- **clubstack-studio domain**: Event URL only (e.g., xx.clubstack.studio); no database sharing
