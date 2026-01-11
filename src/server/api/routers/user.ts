import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { serialize } from "cookie";

import {
  generateVerificationToken,
  getTokenExpiration,
  hashPassword,
  isTokenExpired,
  verifyPassword,
} from "~/lib/auth";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "~/lib/jwt";
import { sendVerificationEmail, sendPasswordResetEmail } from "~/lib/email";
import {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  MAX_ATTEMPTS,
} from "~/lib/rate-limiter";

import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";

export const userRouter = createTRPCRouter({
  /**
   * Register a new user
   * POST /api/trpc/user.register
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email("유효한 이메일 주소를 입력해주세요"),
        password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { email, password } = input;

      // Check if email already exists
      const existingUser = await ctx.db.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 사용 중인 이메일입니다",
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Generate verification token
      const token = generateVerificationToken();
      const tokenExpires = getTokenExpiration();

      // Create user
      const user = await ctx.db.user.create({
        data: {
          email,
          password: hashedPassword,
          emailVerificationToken: token,
          emailVerificationExpires: tokenExpires,
          isActive: false,
        },
      });

      // Send verification email
      await sendVerificationEmail({
        to: email,
        token,
      });

      return {
        success: true,
        message: "인증 이메일을 발송했습니다",
        userId: user.id,
      };
    }),

  /**
   * Verify email with token
   * POST /api/trpc/user.verifyEmail
   */
  verifyEmail: publicProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { token } = input;

      // Find user by token
      const user = await ctx.db.user.findFirst({
        where: { emailVerificationToken: token },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "유효하지 않은 인증 링크입니다",
        });
      }

      // Check if token is expired
      if (isTokenExpired(user.emailVerificationExpires)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "인증 링크가 만료되었습니다. 다시 요청해주세요",
        });
      }

      // Determine which email to use (pendingEmail takes priority for email changes)
      const emailToUpdate = user.pendingEmail || user.email;

      // Activate user, update email if pendingEmail exists, and clear token
      await ctx.db.user.update({
        where: { id: user.id },
        data: {
          ...(user.pendingEmail && { email: user.pendingEmail }), // Update email if pendingEmail exists
          pendingEmail: null, // Clear pendingEmail after using it
          isActive: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      });

      return {
        success: true,
        message: "이메일 인증이 완료되었습니다",
      };
    }),

  /**
   * Login with email and password
   * POST /api/trpc/user.login
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email("유효한 이메일 주소를 입력해주세요"),
        password: z.string().min(1, "비밀번호를 입력해주세요"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { email, password } = input;

      // Get client IP for rate limiting
      const clientIp = (ctx.req?.headers["x-forwarded-for"] as string)?.split(
        ",",
      )[0] ||
        (ctx.req?.headers["x-real-ip"] as string) ||
        (ctx.req?.socket?.remoteAddress as string) ||
        "unknown";

      // Check rate limit
      const rateLimitCheck = checkRateLimit(clientIp);
      if (!rateLimitCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `너무 많은 로그인 시도가 있었습니다. ${rateLimitCheck.retryAfter}초 후에 다시 시도해주세요.`,
        });
      }

      // Find user by email
      const user = await ctx.db.user.findUnique({
        where: { email },
      });

      // Generic error message for security (don't reveal if user exists)
      if (!user) {
        // Record failed attempt
        const failedAttempt = recordFailedAttempt(clientIp);
        if (failedAttempt.blocked) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `너무 많은 로그인 시도가 있었습니다. ${failedAttempt.retryAfter}초 후에 다시 시도해주세요.`,
          });
        }
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: `이메일 또는 비밀번호가 올바르지 않습니다. 남은 시도 횟수: ${rateLimitCheck.remainingAttempts || MAX_ATTEMPTS - 1}`,
        });
      }

      // Check if user account is active (email verified)
      if (!user.isActive) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "이메일 또는 비밀번호가 올바르지 않습니다",
        });
      }

      // Verify password
      const isPasswordValid = await verifyPassword(password, user.password);

      if (!isPasswordValid) {
        // Record failed attempt
        const failedAttempt = recordFailedAttempt(clientIp);
        if (failedAttempt.blocked) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `너무 많은 로그인 시도가 있었습니다. ${failedAttempt.retryAfter}초 후에 다시 시도해주세요.`,
          });
        }
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: `이메일 또는 비밀번호가 올바르지 않습니다. 남은 시도 횟수: ${rateLimitCheck.remainingAttempts || MAX_ATTEMPTS - 1}`,
        });
      }

      // Reset rate limit on successful login
      resetRateLimit(clientIp);

      // Generate Access Token (15 minutes)
      const accessToken = generateAccessToken(user.id);

      // Generate Refresh Token (8 hours) with current tokenVersion
      const refreshToken = generateRefreshToken(user.id, user.tokenVersion);

      // Calculate refresh token expiry (8 hours from now)
      const refreshExpiresAt = new Date();
      refreshExpiresAt.setHours(refreshExpiresAt.getHours() + 8);

      // Store refresh token in database for rotation and logout support
      await ctx.db.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: refreshExpiresAt,
        },
      });

      // Set Refresh Token in HttpOnly Cookie
      const refreshTokenCookie = serialize("refresh_token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 8, // 8 hours
        path: "/",
      });

      // Set cookie in response
      ctx.res?.setHeader("Set-Cookie", refreshTokenCookie);

      return {
        success: true,
        message: "로그인되었습니다",
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    }),

  /**
   * Logout and clear refresh token cookie
   * POST /api/trpc/user.logout
   */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    // Increment user's tokenVersion (invalidates all existing refresh tokens)
    await ctx.db.user.update({
      where: { id: ctx.userId },
      data: {
        tokenVersion: {
          increment: 1,
        },
      },
    });

    // Delete all refresh tokens for this user from database
    await ctx.db.refreshToken.deleteMany({
      where: { userId: ctx.userId },
    });

    // Delete Refresh Token cookie by setting it with maxAge=0
    const deletedRefreshTokenCookie = serialize("refresh_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    // Set the deletion cookie in response
    ctx.res?.setHeader("Set-Cookie", deletedRefreshTokenCookie);

    return {
      success: true,
      message: "로그아웃되었습니다",
    };
  }),

  /**
   * Refresh access token using refresh token from cookie
   * POST /api/trpc/user.refresh
   */
  refresh: publicProcedure.mutation(async ({ ctx }) => {
    // Extract Refresh Token from HttpOnly cookie
    const refreshToken = ctx.req?.cookies?.refresh_token;

    if (!refreshToken) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Refresh token이 없습니다",
      });
    }

    // Verify Refresh Token JWT signature and expiry
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "유효하지 않거나 만료된 Refresh token입니다",
      });
    }

    // Check if refresh token exists in database and is not expired
    const storedToken = await ctx.db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Refresh token이 데이터베이스에 존재하지 않습니다",
      });
    }

    // Check if refresh token has expired
    if (storedToken.expiresAt < new Date()) {
      // Delete expired token
      await ctx.db.refreshToken.delete({
        where: { token: refreshToken },
      });
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Refresh token이 만료되었습니다",
      });
    }

    // Verify user is active
    if (!storedToken.user.isActive) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "유효하지 않은 사용자입니다",
      });
    }

    // Verify tokenVersion matches (token rotation)
    if (decoded.tokenVersion !== storedToken.user.tokenVersion) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Refresh token이 무효화되었습니다 (token version mismatch)",
      });
    }

    // Generate new Access Token
    const newAccessToken = generateAccessToken(storedToken.user.id);

    return {
      success: true,
      accessToken: newAccessToken,
    };
  }),

  /**
   * Request password reset email
   * POST /api/trpc/user.requestPasswordReset
   */
  requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.string().email("유효한 이메일 주소를 입력해주세요"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { email } = input;

      // Find user by email
      const user = await ctx.db.user.findUnique({
        where: { email },
      });

      // Security: Return same message even if email doesn't exist (account enumeration prevention)
      if (!user) {
        return {
          success: true,
          message: "비밀번호 재설정 링크를 이메일로 발송했습니다",
        };
      }

      // Generate password reset token (32 bytes, 1 hour expiry)
      const token = generateVerificationToken(); // Reuses existing token generation (32 bytes)
      const tokenExpires = new Date(Date.now() + 3600 * 1000); // 1 hour = 3600 seconds

      // Save token to database
      await ctx.db.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpires: tokenExpires,
        },
      });

      // Send password reset email
      await sendPasswordResetEmail({
        to: email,
        token,
      });

      return {
        success: true,
        message: "비밀번호 재설정 링크를 이메일로 발송했습니다",
      };
    }),

  /**
   * Verify password reset token
   * POST /api/trpc/user.verifyResetToken
   */
  verifyResetToken: publicProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { token } = input;

      // Find user by reset token
      const user = await ctx.db.user.findFirst({
        where: { passwordResetToken: token },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "유효하지 않거나 만료된 링크입니다",
        });
      }

      // Check if token is expired
      if (isTokenExpired(user.passwordResetExpires)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "링크가 만료되었습니다. 다시 요청해주세요",
        });
      }

      return {
        success: true,
        email: user.email,
      };
    }),

  /**
   * Reset password with token
   * POST /api/trpc/user.resetPassword
   */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
        confirmPassword: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { token, newPassword, confirmPassword } = input;

      // Verify passwords match
      if (newPassword !== confirmPassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "비밀번호가 일치하지 않습니다",
        });
      }

      // Find user by reset token
      const user = await ctx.db.user.findFirst({
        where: { passwordResetToken: token },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "유효하지 않거나 만료된 링크입니다",
        });
      }

      // Check if token is expired
      if (isTokenExpired(user.passwordResetExpires)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "링크가 만료되었습니다. 다시 요청해주세요",
        });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password and clear reset token
      await ctx.db.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
          tokenVersion: {
            increment: 1, // Invalidate all existing refresh tokens for security
          },
        },
      });

      // Delete all refresh tokens for this user (force re-login)
      await ctx.db.refreshToken.deleteMany({
        where: { userId: user.id },
      });

      return {
        success: true,
        message: "비밀번호가 재설정되었습니다",
      };
    }),

  /**
   * Get user profile
   * GET /api/trpc/user.getProfile
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    // Find user by ID from JWT token
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        // Explicitly exclude password field
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "사용자를 찾을 수 없습니다",
      });
    }

    return user;
  }),

  /**
   * Update user profile (name)
   * POST /api/trpc/user.updateProfile
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().max(100).nullable(), // Optional, max 100 chars
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { name } = input;

      // Update user name
      const updatedUser = await ctx.db.user.update({
        where: { id: ctx.userId },
        data: { name },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      return {
        success: true,
        message: "프로필이 업데이트되었습니다",
        user: updatedUser,
      };
    }),

  /**
   * Change password
   * POST /api/trpc/user.changePassword
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요"),
        newPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
        confirmPassword: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { currentPassword, newPassword, confirmPassword } = input;

      // Verify passwords match
      if (newPassword !== confirmPassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "비밀번호가 일치하지 않습니다",
        });
      }

      // Find user with password
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: {
          id: true,
          password: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다",
        });
      }

      // Verify current password
      const isPasswordValid = await verifyPassword(currentPassword, user.password);

      if (!isPasswordValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "현재 비밀번호가 올바르지 않습니다",
        });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password and increment tokenVersion (invalidate all refresh tokens)
      await ctx.db.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          tokenVersion: {
            increment: 1, // Invalidate all existing refresh tokens
          },
        },
      });

      // Delete all refresh tokens for this user (force re-login)
      await ctx.db.refreshToken.deleteMany({
        where: { userId: user.id },
      });

      return {
        success: true,
        message: "비밀번호가 변경되었습니다",
      };
    }),

  /**
   * Update email (requires re-verification)
   * POST /api/trpc/user.updateEmail
   */
  updateEmail: protectedProcedure
    .input(
      z.object({
        newEmail: z.string().email("유효한 이메일 주소를 입력해주세요"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { newEmail } = input;

      // Get current user
      const currentUser = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { email: true },
      });

      if (!currentUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "사용자를 찾을 수 없습니다",
        });
      }

      // Check if new email is different from current email
      if (newEmail === currentUser.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "새 이메일은 현재 이메일과 달라야 합니다",
        });
      }

      // Check if new email already exists
      const existingUser = await ctx.db.user.findUnique({
        where: { email: newEmail },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 사용 중인 이메일입니다",
        });
      }

      // Generate new verification token
      const token = generateVerificationToken();
      const tokenExpires = getTokenExpiration();

      // Update user with pendingEmail and set inactive
      await ctx.db.user.update({
        where: { id: ctx.userId },
        data: {
          pendingEmail: newEmail, // Store new email in pendingEmail
          emailVerificationToken: token,
          emailVerificationExpires: tokenExpires,
          isActive: false, // Require re-verification
        },
      });

      // Send verification email to NEW email
      await sendVerificationEmail({
        to: newEmail,
        token,
      });

      return {
        success: true,
        message:
          "새 이메일로 인증 링크를 발송했습니다. 인증 후 다시 로그인해주세요.",
      };
    }),
});
