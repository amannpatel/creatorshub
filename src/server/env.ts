import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  }
  return value;
}

export function getMongoUri(): string {
  return required("MONGODB_URI");
}

export function getAuthSecret(): Uint8Array {
  const secret = required("AUTH_SECRET");
  if (secret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters long.");
  return new TextEncoder().encode(secret);
}

/** Sign-up is open only while no account exists, unless explicitly enabled. */
export function signupsExplicitlyAllowed(): boolean {
  return process.env.ALLOW_SIGNUPS === "true";
}
