/**
 * Admin login: one shared password (ADMIN_PASSWORD, set in Netlify) and a
 * signed session cookie. The signing key is derived from the password, so
 * changing the password logs everyone out.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export const SESSION_COOKIE = "__Host-spazia_admin";
const SESSION_DAYS = 14;

function key(password: string): Buffer {
  return createHash("sha256").update(`spazia-admin-session:${password}`).digest();
}

function sign(payload: string, password: string): string {
  return createHmac("sha256", key(password)).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function adminPassword(): string {
  return env("ADMIN_PASSWORD");
}

export function checkPassword(given: unknown): boolean {
  const password = adminPassword();
  if (!password || typeof given !== "string") return false;
  // Compare hashes so the comparison takes the same time whatever the length.
  const a = createHash("sha256").update(given).digest("hex");
  const b = createHash("sha256").update(password).digest("hex");
  return safeEqual(a, b);
}

export function createSessionCookie(now = Date.now()): string {
  const exp = String(now + SESSION_DAYS * 86400_000);
  const value = `${exp}.${sign(exp, adminPassword())}`;
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export function isLoggedIn(req: Request, now = Date.now()): boolean {
  const password = adminPassword();
  if (!password) return false;
  const value = readCookie(req, SESSION_COOKIE);
  if (!value) return false;
  const [exp, signature] = value.split(".");
  if (!exp || !signature || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  return safeEqual(signature, sign(exp, password));
}
