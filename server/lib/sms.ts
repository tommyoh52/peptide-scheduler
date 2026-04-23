import Twilio from "twilio";
import { log } from "./log";

let client: ReturnType<typeof Twilio> | null = null;
let fromNumber = "";

export function initSms() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    log(
      "sms: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER not all set — SMS reminders disabled.",
      "sms",
    );
    return;
  }
  try {
    client = Twilio(sid, token);
    fromNumber = from;
    log(`sms: Twilio configured (from=${fromNumber})`, "sms");
  } catch (e) {
    console.error("sms: init failed", e);
  }
}

export function isSmsConfigured() {
  return !!client;
}

export async function sendSms(params: { to: string; body: string }) {
  if (!client) return;
  await client.messages.create({ to: params.to, from: fromNumber, body: params.body });
}
