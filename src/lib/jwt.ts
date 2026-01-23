import jwt from "jsonwebtoken";

import { env } from "~/env";

// Token expiry times
const ACCESS_TOKEN_EXPIRY = "7d"; // 7 days - changed from 15min to improve user experience
const REFRESH_TOKEN_EXPIRY = "7d"; // 7 days - changed from 8h to match access token

// JWT payload interface
export interface AccessTokenPayload {
  userId: string;
  type: "access";
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
  type: "refresh";
}

/**
 * Generate Access Token (15 minutes)
 * Contains user ID for authentication
 */
export function generateAccessToken(userId: string): string {
  const payload: AccessTokenPayload = {
    userId,
    type: "access",
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

/**
 * Generate Refresh Token (8 hours)
 * Contains user ID and token version for additional security
 */
export function generateRefreshToken(
  userId: string,
  tokenVersion: number = 1
): string {
  const payload: RefreshTokenPayload = {
    userId,
    tokenVersion,
    type: "refresh",
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

/**
 * Verify Access Token
 * Returns the decoded payload if valid
 * Throws error if invalid or expired
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;

    // Ensure it's an access token
    if (decoded.type !== "access") {
      throw new Error("Invalid token type");
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Access token expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid access token");
    }
    throw error;
  }
}

/**
 * Verify Refresh Token
 * Returns the decoded payload if valid
 * Throws error if invalid or expired
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as RefreshTokenPayload;

    // Ensure it's a refresh token
    if (decoded.type !== "refresh") {
      throw new Error("Invalid token type");
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Refresh token expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid refresh token");
    }
    throw error;
  }
}

/**
 * Generate a random refresh token string
 * Used for storing in database or as an additional identifier
 */
export function generateRefreshTokenId(): string {
  return crypto.randomUUID();
}
