import { analyticsRouter } from "~/server/api/routers/analytics"; // Story 4.8
import { caseRouter } from "~/server/api/routers/case";
import { caseNoteRouter } from "~/server/api/routers/caseNote";
import { findingsRouter } from "~/server/api/routers/findings";
import { fileRouter } from "~/server/api/routers/file";
import { postRouter } from "~/server/api/routers/post";
import { tagRouter } from "~/server/api/routers/tag"; // Story 4.6
import { transactionRouter } from "~/server/api/routers/transaction";
import { userRouter } from "~/server/api/routers/user";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  analytics: analyticsRouter, // Story 4.8
  case: caseRouter,
  caseNote: caseNoteRouter,
  findings: findingsRouter,
  file: fileRouter,
  post: postRouter,
  tag: tagRouter, // Story 4.6
  transaction: transactionRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
