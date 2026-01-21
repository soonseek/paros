import { analyticsRouter } from "~/server/api/routers/analytics"; // Story 4.8
import { caseRouter } from "~/server/api/routers/case";
import { caseNoteRouter } from "~/server/api/routers/caseNote";
import { chatRouter } from "~/server/api/routers/chat";
import { exportRouter } from "~/server/api/routers/export"; // Story 7.1
import { fundFlowRouter } from "~/server/api/routers/fundFlow"; // Story 5.1
import { findingsRouter } from "~/server/api/routers/findings";
import { fileRouter } from "~/server/api/routers/file";
import { postRouter } from "~/server/api/routers/post";
import { savedFiltersRouter } from "~/server/api/routers/savedFilters"; // Story 8.2
import { settingsRouter } from "~/server/api/routers/settings"; // Admin Settings
import { tagRouter } from "~/server/api/routers/tag"; // Story 4.6
import { transactionChainRouter } from "~/server/api/routers/transactionChain"; // Story 5.3
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
  chat: chatRouter,
  export: exportRouter, // Story 7.1
  fundFlow: fundFlowRouter, // Story 5.1
  findings: findingsRouter,
  file: fileRouter,
  post: postRouter,
  savedFilters: savedFiltersRouter, // Story 8.2
  tag: tagRouter, // Story 4.6
  transaction: transactionRouter,
  transactionChain: transactionChainRouter, // Story 5.3
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
