import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
import { env } from "../config/env";

// AES-256-GCM encrypt/decrypt for TAXII server credential blobs — an
// explicit, documented stand-in for a real secrets manager (Vault/cloud
// KMS), not one itself. The key is derived from CREDENTIAL_ENCRYPTION_KEY
// via SHA-256 so any sufficiently long passphrase works as the env var, not
// just a raw 32-byte value. Identical scheme to integration-service's
// src/lib/crypto.ts.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended IV length for GCM

function deriveKey(): Buffer {
  return createHash("sha256").update(env.CREDENTIAL_ENCRYPTION_KEY).digest();
}

// Output shape: base64(iv):base64(authTag):base64(ciphertext) — three
// colon-joined base64 segments, stored verbatim in
// TaxiiServer.encryptedCredential.
export function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((buf) => buf.toString("base64")).join(":");
}

export function decrypt(encoded: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted credential");
  }
  const key = deriveKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

export function encryptCredential(credential: Record<string, unknown>): string {
  return encrypt(JSON.stringify(credential));
}

export function decryptCredential(encoded: string): Record<string, unknown> {
  return JSON.parse(decrypt(encoded)) as Record<string, unknown>;
}
