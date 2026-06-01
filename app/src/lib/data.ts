export const FIXED_PICKUP = {
  label: "1132 E New York Ave, Brooklyn, NY 11212",
  sublabel: "Crown Heights — street-level",
};

// TODO: Replace with confirmed outbound departure times + real seat counts
export const OUTBOUND_TIMES = [
  { id: "1pm", label: "1:00 PM", spots: 6 },
  { id: "2pm", label: "2:00 PM", spots: 3 },
  { id: "3pm", label: "3:00 PM", spots: 10 },
  { id: "4pm", label: "4:00 PM", spots: 8 },
] as const;

// TODO: Replace with confirmed inbound (return) departure times
export const INBOUND_TIMES = [
  { id: "9pm", label: "9:00 PM" },
  { id: "10pm", label: "10:00 PM" },
  { id: "11pm", label: "11:00 PM" },
  { id: "midnight", label: "Midnight" },
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
