import { createNextApiHandler } from "@trpc/server/adapters/next";

import { env } from "~/env";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

// Next.js API route configuration for large file uploads (Story 3.3)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Allow up to 50MB files for S3 upload
    },
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
