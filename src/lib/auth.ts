import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Senha e token de sessão. Só primitivas do Node (scrypt, HMAC), sem criptografia caseira.
// Quando o Supabase entrar, ele assume as duas coisas e este arquivo sai.

// Formato guardado: scrypt$<salt hex>$<hash hex>
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | undefined): boolean {
  const [scheme, saltHex, hashHex] = (stored ?? "").split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

// Token do cookie: "<userId>.<assinatura>". Sem a assinatura certa, ninguém se passa por outro id.
function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionToken(userId: string, secret: string): string {
  return `${userId}.${sign(userId, secret)}`;
}

export function readSessionToken(token: string | undefined, secret: string): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(userId, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return userId;
}
