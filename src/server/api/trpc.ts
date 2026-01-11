/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import superjson from "superjson";
import { ZodError } from "zod";

import { verifyAccessToken } from "~/lib/jwt";
import { db } from "~/server/db";
import { canAccessCase, canModifyCase } from "~/lib/rbac";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 */

interface CreateContextOptions {
  userId: string | null;
  req: CreateNextContextOptions["req"];
  res: CreateNextContextOptions["res"];
}

/**
 * This helper generates the "internals" for a tRPC context. If you need to use it, you can export
 * it from here.
 *
 * Examples of things you may need it for:
 * - testing, so we don't have to mock Next.js' req/res
 * - tRPC's `createSSGHelpers`, where we don't have req/res
 *
 * @see https://create.t3.gg/en/usage/trpc#-serverapitrpcts
 */
const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    userId: opts.userId,
    req: opts.req,
    res: opts.res,
    db,
  };
};

/**
 * This is the actual context you will use in your router. It will be used to process every request
 * that goes through your tRPC endpoint.
 *
 * @see https://trpc.io/docs/context
 */
export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const { req, res } = opts;

  // Extract Access Token from Authorization header
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.replace("Bearer ", "");

  let userId: string | null = null;

  // Verify Access Token if present
  if (accessToken) {
    try {
      const decoded = verifyAccessToken(accessToken);
      userId = decoded.userId;
    } catch {
      // Invalid or expired token - userId remains null
      // Client will need to refresh the token
      console.error("[TRPC] Invalid or expired Access Token");
    }
  }

  return createInnerTRPCContext({
    userId,
    req,
    res,
  });
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (process.env.NODE_ENV === "development") {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the Access Token is valid and guarantees `ctx.userId` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "로그인이 필요합니다",
      });
    }
    return next({
      ctx: {
        // infers the `userId` as non-nullable
        ...ctx,
        userId: ctx.userId,
      },
    });
  });

/**
 * Protected procedure with Case Access Check
 *
 * Use this for procedures that access case data. It verifies:
 * 1. User is authenticated (protectedProcedure)
 * 2. User has access to the specified case (via input.caseId)
 *
 * RBAC Rules:
 * - ADMIN: Can access all cases
 * - LAWYER/PARALEGAL/SUPPORT: Can only access their own cases
 *
 * @example
 * caseAccessProcedure
 *   .input(z.object({ caseId: z.string() }))
 *   .query(async ({ ctx, input }) => {
 *     // ctx.userId is guaranteed to have access to input.caseId
 *     return ctx.db.case.findUnique({ where: { id: input.caseId } });
 *   });
 */
export const caseAccessProcedure = protectedProcedure
  .use(async ({ ctx, input, next }) => {
    // Extract caseId from input (required for caseAccessProcedure)
    const caseId =
      input && typeof input === "object" && "caseId" in input
        ? (input as { caseId: string }).caseId
        : undefined;

    if (!caseId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "caseId가 필요합니다",
      });
    }

    // Check if user has access to this case
    const hasAccess = await canAccessCase(ctx.userId, caseId);

    if (!hasAccess) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "이 사건에 접근할 권한이 없습니다",
      });
    }

    return next({
      ctx,
    });
  });

/**
 * Protected procedure with Case Modification Check
 *
 * Use this for procedures that modify case data. It verifies:
 * 1. User is authenticated (protectedProcedure)
 * 2. User has permission to modify the specified case (via input.caseId)
 *
 * RBAC Rules:
 * - ADMIN: Can modify all cases
 * - LAWYER: Can only modify their own cases
 * - PARALEGAL/SUPPORT: No modification permissions
 *
 * @example
 * caseModifyProcedure
 *   .input(z.object({ caseId: z.string(), debtorName: z.string() }))
 *   .mutation(async ({ ctx, input }) => {
 *     // ctx.userId is guaranteed to have modification permission for input.caseId
 *     return ctx.db.case.update({
 *       where: { id: input.caseId },
 *       data: { debtorName: input.debtorName }
 *     });
 *   });
 */
export const caseModifyProcedure = protectedProcedure
  .use(async ({ ctx, input, next }) => {
    // Extract caseId from input (required for caseModifyProcedure)
    const caseId =
      input && typeof input === "object" && "caseId" in input
        ? (input as { caseId: string }).caseId
        : undefined;

    if (!caseId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "caseId가 필요합니다",
      });
    }

    // Check if user can modify this case
    const canModify = await canModifyCase(ctx.userId, caseId);

    if (!canModify) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "이 사건을 수정할 권한이 없습니다",
      });
    }

    return next({
      ctx,
    });
  });
