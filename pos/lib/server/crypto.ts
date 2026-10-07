import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashPin(pin: string): string {
  return sha256(`tilda-pin:${pin}`);
}

export function verifyPin(pin: string, hash: string): boolean {
  const a = Buffer.from(hashPin(pin));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function s256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
