import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const prefix = "helios-scrypt-v1";
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, result) => (error ? reject(error) : resolve(result)),
    ),
  );
}

export async function hashDoctorPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 512)
    throw new Error("Doctor passwords must contain 12–512 characters");
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `${prefix}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyDoctorPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  if (!password || password.length > 512) return false;
  const parts = encoded.split("$");
  if (parts.length !== 3 || parts[0] !== prefix) return false;
  const salt = Buffer.from(parts[1]!, "base64url");
  const expected = Buffer.from(parts[2]!, "base64url");
  if (salt.length !== 16 || expected.length !== 64) return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected);
}
