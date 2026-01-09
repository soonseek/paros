/**
 * This is the client-side entrypoint for your tRPC API. It is used to create the `api` object which
 * contains the Next.js App-wrapper, as well as your type-safe React Query hooks.
 *
 * We also create a few inference helpers for input and output types.
 */
import { httpBatchLink, loggerLink, TRPCClientError } from "@trpc/client";
import { createTRPCNext } from "@trpc/next";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import superjson from "superjson";

import { type AppRouter } from "~/server/api/root";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return ""; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
};

/** A set of type-safe react-query hooks for your tRPC API. */
export const api = createTRPCNext<AppRouter>({
  config() {
    return {
      /**
       * Transformer used for data de-serialization from the server.
       *
       * @see https://trpc.io/docs/data-transformers
       */
      transformer: superjson,

      /**
       * Links used to determine request flow from client to server.
       *
       * @see https://trpc.io/docs/links
       */
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),

        // Custom link for auto-refreshing access tokens
        {
          name: "auto-refresh-link",
          async func(opts) {
            const { next, op } = opts;

            // Try the operation
            const result = await next(op);

            // Check if the result is an error with UNAUTHORIZED status
            if (
              result.error &&
              result.error.data?.code === "UNAUTHORIZED" &&
              typeof window !== "undefined"
            ) {
              // Try to refresh the token
              try {
                // Direct fetch to avoid infinite loop through tRPC
                const response = await fetch("/api/trpc/user.refresh", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ json: null }),
                });

                if (response.ok) {
                  const data = await response.json();
                  const newAccessToken = data.result.data.json.accessToken;

                  // Store new access token in sessionStorage (XSS mitigation)
                  sessionStorage.setItem("access_token", newAccessToken);

                  // Retry the original operation
                  return next({
                    ...op,
                    context: {
                      ...op.context,
                      headers: {
                        ...op.context.headers,
                        Authorization: `Bearer ${newAccessToken}`,
                      },
                    },
                  });
                } else {
                  // Refresh failed - redirect to login
                  sessionStorage.removeItem("access_token");
                  sessionStorage.removeItem("user");
                  window.location.href = "/login";
                }
              } catch (refreshError) {
                // Refresh failed - redirect to login
                sessionStorage.removeItem("access_token");
                sessionStorage.removeItem("user");
                window.location.href = "/login";
              }
            }

            return result;
          },
        },

        httpBatchLink({
          /**
           * Transformer used for data de-serialization from the server.
           *
           * @see https://trpc.io/docs/data-transformers
           */
          transformer: superjson,
          url: `${getBaseUrl()}/api/trpc`,
          /**
           * Add Authorization header with Access Token
           */
          headers() {
            // Only add headers on client-side
            if (typeof window === "undefined") return {};

            // Get Access Token from sessionStorage (XSS mitigation)
            const accessToken = sessionStorage.getItem("access_token");

            if (!accessToken) return {};

            return {
              Authorization: `Bearer ${accessToken}`,
            };
          },
        }),
      ],
    };
  },
  /**
   * Whether tRPC should await queries when server rendering pages.
   *
   * @see https://trpc.io/docs/nextjs#ssr-boolean-default-false
   */
  ssr: false,
  transformer: superjson,
});

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
