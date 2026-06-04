export const FIXED_PICKUP = {
  label: "1491 Gates Ave, Brooklyn, NY",
  sublabel: "Outside Tyler's apartment — street-level",
};

// TODO: Replace with confirmed outbound departure times + real seat counts
export const OUTBOUND_TIMES = [
  { id: "10:30pm", label: "10:30 PM", spots: 30 },
  { id: "12am", label: "12:00 AM", spots: 30 },
] as const;

// TODO: Replace with confirmed inbound (return) departure times
export const INBOUND_TIMES = [
  { id: "3am", label: "3:00 AM", spots: 30  },
  { id: "5:30am", label: "5:30 AM", spots: 30  },
] as const;

export const PRICES = {
  oneWay: 20,
  roundTrip: 30,
} as const;

export type SignupState = {
  name: string;
  contact: string;
  contactType: "phone" | "email";
  seats: number;
  outboundTime: string;
  wantsReturn: boolean;
  inboundTime: string;
  donation: number;
};

export const DEFAULT_STATE: SignupState = {
  name: "",
  contact: "",
  contactType: "phone",
  seats: 1,
  outboundTime: "",
  wantsReturn: false,
  inboundTime: "",
  donation: 15,
};

export function calcTotal(state: SignupState): number {
  const tripCost = state.wantsReturn ? PRICES.roundTrip : PRICES.oneWay;
  return tripCost * state.seats + state.donation;
}
