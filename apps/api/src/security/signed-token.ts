import { createHmac, timingSafeEqual } from "node:crypto";

type TokenKind = "patient-session" | "doctor-session";
type TokenPayload = { sub: string; kind: TokenKind; iat: number; exp: number };

export class SignedTokenCodec {
  constructor(
    private readonly secret: string,
    private readonly kind: TokenKind,
    private readonly ttlSeconds: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  create(subject: string) {
    const issuedAt = Math.floor(this.now() / 1_000);
    const encoded = Buffer.from(
      JSON.stringify({
        sub: subject,
        kind: this.kind,
        iat: issuedAt,
        exp: issuedAt + this.ttlSeconds,
      } satisfies TokenPayload),
    ).toString("base64url");
    return `v1.${encoded}.${this.signature(encoded)}`;
  }

  verify(token: string): { subject: string; expired: boolean } | undefined {
    if (token.length > 2_048) return undefined;
    const [version, encoded, suppliedHex, extra] = token.split(".");
    if (
      version !== "v1" ||
      !encoded ||
      !suppliedHex ||
      !/^[a-f0-9]{64}$/.test(suppliedHex) ||
      extra
    )
      return undefined;
    const supplied = Buffer.from(suppliedHex, "hex");
    const expected = Buffer.from(this.signature(encoded), "hex");
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return undefined;
    try {
      const payload = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8"),
      ) as Partial<TokenPayload>;
      const now = Math.floor(this.now() / 1_000);
      if (
        payload.kind !== this.kind ||
        typeof payload.sub !== "string" ||
        !payload.sub ||
        typeof payload.iat !== "number" ||
        typeof payload.exp !== "number" ||
        payload.iat > now + 60 ||
        payload.exp <= payload.iat
      )
        return undefined;
      return { subject: payload.sub, expired: payload.exp <= now };
    } catch {
      return undefined;
    }
  }

  private signature(encoded: string) {
    return createHmac("sha256", this.secret)
      .update(`${this.kind}:${encoded}`)
      .digest("hex");
  }
}
