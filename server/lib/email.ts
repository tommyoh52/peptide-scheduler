import { Resend } from "resend";
import { log } from "./log";

let client: Resend | null = null;
let fromAddress = "Peptide Calculator <reminders@resend.dev>";

export function initEmail() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    log("email: RESEND_API_KEY not set — email reminders disabled.", "email");
    return;
  }
  try {
    client = new Resend(key);
    fromAddress = process.env.FROM_EMAIL || fromAddress;
    log(`email: Resend configured (from=${fromAddress})`, "email");
  } catch (e) {
    console.error("email: init failed", e);
  }
}

export function isEmailConfigured() {
  return !!client;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  if (!client) return;
  await client.emails.send({
    from: fromAddress,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}
