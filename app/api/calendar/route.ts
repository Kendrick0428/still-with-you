// Builds a calendar event for an important date, with an alert before it, so the phone's own calendar can give a gentle reminder.
// Nothing is stored; the details arrive in a form post (not the address) so they don't end up in logs.
const clean = (s: string) => s.replace(/[\r\n]+/g, " ").replace(/([,;\\])/g, "\\$1").slice(0, 120);

export async function POST(req: Request) {
  const f = await req.formData();
  const title = clean(String(f.get("title") || "An important day"));
  const date = String(f.get("date") || "");
  const before = Math.min(Math.max(parseInt(String(f.get("before") || "3"), 10) || 3, 1), 14);
  const yearly = f.get("yearly") === "1";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Response("That date didn’t look right.", { status: 400 });
  const d = date.replace(/-/g, "");
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = next.toISOString().slice(0, 10).replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const note = clean("These days can bring many emotions. Open Still With You for help planning how you want to honor this day.");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Still With You//Important dates//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${d}-${crypto.randomUUID()}@stillwithyounow.com`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${end}`,
    ...(yearly ? ["RRULE:FREQ=YEARLY"] : []),
    `SUMMARY:${title}`, `DESCRIPTION:${note}`, "TRANSP:TRANSPARENT",
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${title} is coming up`, `TRIGGER:-PT${before * 24 - 9}H`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
  return new Response(ics, {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'inline; filename="still-with-you-date.ics"', "cache-control": "no-store" },
  });
}
