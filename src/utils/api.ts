/**
 * This is the client-side entrypoint for your tRPC API. It is used to create the `api` object which
 * contains the Next.js App-wrapper, as well as your type-safe React Query hooks.
 *
 * We also create a few inference helpers for input and output types.
 */
import { httpBatchLink, loggerLink, TRPCClientError, TRPCLink } from "@trpc/client";
import { createTRPCNext } from "@trpc/next";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import superjson from "superjson";
import { toast } from "sonner";
import { observable } from "@trpc/server/observable";

import { type AppRouter } from "~/server/api/root";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return ""; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
};

/**
 * Custom tRPC link to handle 401 UNAUTHORIZED errors globally
 * Intercepts responses and shows custom toast message before redirecting
 */
const authLink: TRPCLink<AppRouter> = () => {
  return ({ next, op }) => {
    return observable((observer) => {
      const unsubscribe = next(op).subscribe({
        next: (value) => {
          // Check if response contains an UNAUTHORIZED error
          if (
            value &&
            typeof value === "object" &&
            "error" in value &&
            value.error instanceof TRPCClientError
          ) {
            const error = value.error as TRPCClientError<AppRouter>;

            // Check if this is a 401 UNAUTHORIZED error
            if (error.data?.code === "UNAUTHORIZED") {
              console.error("[Auth] 401 detected - handling globally...");

              // Clear auth storage immediately
              if (typeof window !== "undefined") {
                sessionStorage.removeItem("user");
                sessionStorage.removeItem("access_token");
                document.cookie = "accessToken=; path=/; max-age=0; sameSite=strict";
              }

              // Show custom toast message (overrides server message)
              toast.error("로그인이 만료되었습니다. 다시 로그인해주세요.");

              // Redirect to login after 1 second
              setTimeout(() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/login";
                }
              }, 1000);

              // Don't propagate the error to components
              return;
            }
          }

          // Pass through non-401 errors normally
          observer.next(value);
        },
        error: (err) => {
          observer.error(err);
        },
        complete: () => {
          observer.complete();
        },
      });
      return unsubscribe;
    });
  };
};

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
        // Add auth error handling link before httpBatchLink
        authLink(),
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

    // Redirect to login page after a short delay
    setTimeout(() => {
      window.location.href = "/login";
    }, 1000);
  }
}
