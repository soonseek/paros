import crypto from "crypto";
import bcrypt from "bcrypt";

/**
 * Security Constants
 */
const SALT_ROUNDS = 10;
const TOKEN_BYTES = 32; // 256-bit token
const TOKEN_EXPIRY_HOURS = 24; // 24 hours

/**
 * Generate a random email verification token
 * @returns Random 64-character hex string
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

/**
 * Calculate token expiration date
 * @returns Date object for 24 hours from now
 */
export function getTokenExpiration(): Date {
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + TOKEN_EXPIRY_HOURS);
  return expiration;
}

/**
 * Check if verification token is expired
 * @param expires - Token expiration date
 * @returns true if token is expired
 */
export function isTokenExpired(expires: Date | null): boolean {
  if (!expires) return true;
  return expires < new Date();
}

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

/**
 * Verify a password against a hash
 * @param password - Plain text password
 * @param hashedPassword - Hashed password from database
 * @returns true if password matches
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
