import webpush from "web-push";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { log } from "./log";

let configured = false;
let publicKey = "";
let privateKey = "";
let subject = "";

export function initPush() {
  const envPub = process.env.VAPID_PUBLIC_KEY;
  const envPriv = process.env.VAPID_PRIVATE_KEY;
  const envSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

  if (envPub && envPriv) {
    publicKey = envPub;
    privateKey = envPriv;
    subject = envSubject;
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
    log("push: using VAPID keys from env", "push");
    return;
  }

  // Fall back to locally-generated keys (persisted to DATA_DIR/vapid.json)
  const dataDir = process.env.DATA_DIR || ".";
  try {
    mkdirSync(dataDir, { recursive: true });
  } catch {}
  const path = join(dataDir, "vapid.json");
  if (existsSync(path)) {
    try {
      const j = JSON.parse(readFileSync(path, "utf8"));
      publicKey = j.publicKey;
      privateKey = j.privateKey;
      subject = j.subject || envSubject;
      webpush.setVapidDetails(subject, publicKey, privateKey);
      configured = true;
      log("push: loaded VAPID keys from vapid.json", "push");
      return;
    } catch (e) {
      console.error("push: failed to read vapid.json", e);
    }
  }

  // Generate fresh
  try {
    const keys = webpush.generateVAPIDKeys();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    subject = envSubject;
    try {
      writeFileSync(path, JSON.stringify({ publicKey, privateKey, subject }, null, 2));
    } catch {}
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
    log(
      `push: Generated VAPID keys; add to env for production consistency. VAPID_PUBLIC_KEY=${publicKey}`,
      "push",
    );
  } catch (e) {
    console.error("push: failed to generate VAPID keys", e);
  }
}

export function isPushConfigured() {
  return configured;
}

export function getVapidPublicKey() {
  return publicKey;
}

export async function sendPush(
  subscriptionJson: string,
  payload: { title: string; body: string; url?: string },
) {
  if (!configured) return;
  const sub = JSON.parse(subscriptionJson);
  await webpush.sendNotification(sub, JSON.stringify(payload));
}
