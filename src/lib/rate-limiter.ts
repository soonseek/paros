// Simple in-memory rate limiter for login attempts
// In production, use Redis or similar for distributed systems

// Configuration
export const MAX_ATTEMPTS = 5; // Maximum failed attempts
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes block

interface RateLimitEntry {
  count: number;
  resetAt: Date;
  blockedUntil?: Date;
}

// Store rate limit data by IP address
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check if request should be rate limited
 * @param identifier - IP address or user identifier
 * @returns Object with { allowed: boolean, retryAfter?: number }
 */
export function checkRateLimit(identifier: string): {
  allowed: boolean;
  retryAfter?: number; // seconds until retry
  remainingAttempts?: number;
} {
  const now = new Date();
  const entry = rateLimitStore.get(identifier);

  // No previous attempts
  if (!entry) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  // Check if currently blocked
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const retryAfter = Math.ceil(
      (entry.blockedUntil.getTime() - now.getTime()) / 1000
    );
    return { allowed: false, retryAfter };
  }

  // Check if window has expired
  if (entry.resetAt < now) {
    // Window expired, reset counter
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  // Within window, check remaining attempts
  const remainingAttempts = MAX_ATTEMPTS - entry.count;
  return {
    allowed: entry.count < MAX_ATTEMPTS,
    remainingAttempts,
  };
}

/**
 * Record a failed login attempt
 * @param identifier - IP address or user identifier
 * @returns Object with { blocked: boolean, retryAfter?: number }
 */
export function recordFailedAttempt(identifier: string): {
  blocked: boolean;
  retryAfter?: number;
} {
  const now = new Date();
  const entry = rateLimitStore.get(identifier);

  // Create new entry or reset if window expired
  if (!entry || entry.resetAt < now) {
    const resetAt = new Date(now.getTime() + WINDOW_MS);
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt,
    });
    return { blocked: false };
  }

  // Increment counter
  const newCount = entry.count + 1;
  const resetAt = entry.resetAt;

  // Check if should be blocked
  if (newCount >= MAX_ATTEMPTS) {
    const blockedUntil = new Date(now.getTime() + BLOCK_DURATION_MS);
    const retryAfter = Math.ceil(BLOCK_DURATION_MS / 1000);

    rateLimitStore.set(identifier, {
      count: newCount,
      resetAt,
      blockedUntil,
    });

    return { blocked: true, retryAfter };
  }

  // Update counter
  rateLimitStore.set(identifier, {
    count: newCount,
    resetAt,
  });

  return { blocked: false };
}

/**
 * Reset rate limit counter (called on successful login)
 * @param identifier - IP address or user identifier
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupExpiredEntries(): void {
  const now = new Date();
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove if window expired and not blocked
    if (entry.resetAt < now && (!entry.blockedUntil || entry.blockedUntil < now)) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup expired entries every 5 minutes
if (typeof window === "undefined") {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}
