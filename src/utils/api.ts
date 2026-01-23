/**
 * This is the client-side entrypoint for your tRPC API. It is used to create the `api` object which
 * contains the Next.js App-wrapper, as well as your type-safe React Query hooks.
 *
 * We also create a few inference helpers for input and output types.
 */
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCNext } from "@trpc/next";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import superjson from "superjson";
import { toast } from "sonner";
import { type AppRouter } from "~/server/api/root";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return ""; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  // Check for preview environment
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
};

/**
 * Handle UNAUTHORIZED (401) errors globally
 * Clear auth storage and redirect to login
 */
export function handleUnauthorizedError() {
  console.error("[Auth] Unauthorized - clearing session and redirecting to login...");

  if (typeof window !== "undefined") {
    // Clear auth storage
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("access_token");
    document.cookie = "accessToken=; path=/; max-age=0; sameSite=strict";

    // Show toast notification
    toast.error("로그인이 만료되었습니다. 다시 로그인해주세요.");

    // Redirect immediately (no delay)
    window.location.href = "/login";
  }
}

/** A set of type-safe react-query hooks for your tRPC API. */
export const api = createTRPCNext<AppRouter>({
  config() {
    return {
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
        httpBatchLink({
          /**
           * Transformer used for data de-serialization from the server.
           *
           * @see https://trpc.io/docs/data-transformers
           */
          transformer: superjson,
          url: `${getBaseUrl()}/api/trpc`,
          /**
           * Custom fetch to handle 401 errors at HTTP level
           */
          async fetch(url, options) {
            const response = await fetch(url, options);

            // Check for 401 Unauthorized response
            if (response.status === 401) {
              console.error("[tRPC] HTTP 401 detected - handling unauthorized");
              handleUnauthorizedError();
            }

            return response;
          },
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
      /**
       * Global error handler for tRPC queries and mutations
       * Handles 401 UNAUTHORIZED errors globally
       */
      queryClientConfig: {
        defaultOptions: {
          queries: {
            onError: (error) => {
              console.error("[tRPC Query Error]", error);

              // Check for 401 in multiple ways
              if (error instanceof TRPCClientError) {
                // Check tRPC error code
                if (error.data?.code === "UNAUTHORIZED") {
                  console.error("[tRPC] UNAUTHORIZED error detected");
                  handleUnauthorizedError();
                  return;
                }

                // Check HTTP status
                if ((error as any).shape?.data?.httpStatus === 401) {
                  console.error("[tRPC] HTTP 401 detected in error");
                  handleUnauthorizedError();
                  return;
                }
              }

              // Generic 401 check
              const errorStr = JSON.stringify(error);
              if (errorStr.includes("401") || errorStr.includes("UNAUTHORIZED") || errorStr.includes("Unauthorized")) {
                console.error("[tRPC] 401/UNAUTHORIZED detected in error string");
                handleUnauthorizedError();
              }
            },
          },
          mutations: {
            onError: (error) => {
              console.error("[tRPC Mutation Error]", error);

              // Check for 401 in multiple ways
              if (error instanceof TRPCClientError) {
                // Check tRPC error code
                if (error.data?.code === "UNAUTHORIZED") {
                  console.error("[tRPC] UNAUTHORIZED error detected");
                  handleUnauthorizedError();
                  return;
                }

                // Check HTTP status
                if ((error as any).shape?.data?.httpStatus === 401) {
                  console.error("[tRPC] HTTP 401 detected in error");
                  handleUnauthorizedError();
                  return;
                }
              }

              // Generic 401 check
              const errorStr = JSON.stringify(error);
              if (errorStr.includes("401") || errorStr.includes("UNAUTHORIZED") || errorStr.includes("Unauthorized")) {
                console.error("[tRPC] 401/UNAUTHORIZED detected in error string");
                handleUnauthorizedError();
              }
            },
          },
        },
      },
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
