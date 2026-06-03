const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

type Severity = "info" | "success" | "warning" | "error";

const COLORS: Record<Severity, number> = {
  info: 0x3498db,
  success: 0x2ecc71,
  warning: 0xf39c12,
  error: 0xe74c3c,
};

export function log(
  title: string,
  severity: Severity,
  fields?: Record<string, string>,
) {
  if (!WEBHOOK_URL) return;

  const embed = {
    title,
    color: COLORS[severity],
    fields: fields
      ? Object.entries(fields).map(([name, value]) => ({
          name,
          value,
          inline: true,
        }))
      : [],
    timestamp: new Date().toISOString(),
    footer: { text: "ditp-june6" },
  };

  // Fire-and-forget — never block the caller
  fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  }).catch(() => {});
}
