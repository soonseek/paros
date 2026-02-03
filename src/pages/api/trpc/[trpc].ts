import { createNextApiHandler } from "@trpc/server/adapters/next";

import { env } from "~/env";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

// Next.js API route configuration for large file uploads (Story 3.3)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1gb', // Allow up to 1GB files for S3 upload
    },
    responseLimit: false, // 응답 크기 제한 해제
  },
};

// export API handler
export default createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError:
    env.NODE_ENV === "development"
      ? ({ path, error }) => {
          console.error(
            `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
          );
        }
      : undefined,
});
