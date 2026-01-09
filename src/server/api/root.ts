import { caseRouter } from "~/server/api/routers/case";
import { caseNoteRouter } from "~/server/api/routers/caseNote";
import { fileRouter } from "~/server/api/routers/file";
import { postRouter } from "~/server/api/routers/post";
import { userRouter } from "~/server/api/routers/user";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  case: caseRouter,
  caseNote: caseNoteRouter,
  file: fileRouter,
  post: postRouter,
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
