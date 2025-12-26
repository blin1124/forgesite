// lib/crypto.ts
import crypto from "crypto";

function getKey(): Buffer {
  const hex = process.env.FORGESITE_ENCRYPTION_KEY;
  if (!hex) throw new Error("Missing FORGESITE_ENCRYPTION_KEY");

  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      `FORGESITE_ENCRYPTION_KEY must be 32 bytes (64 hex chars). Got ${key.length} bytes.`
    );
  }
  return key;
}

// Format: base64(iv).base64(tag).base64(ciphertext)
export function encryptText(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // recommended for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function decryptText(packed: string): string {
  const key = getKey();
  const parts = packed.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted_key format.");

  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString("utf8");
}
