import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import type { Context } from "./context.js";
import { AppError, isMessageKey } from "../lib/app-error.js";
import {
  billingSummary,
  connectViaToken,
  disconnectConnection,
  listConnections,
} from "../services/connections.js";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  // Surface the message-catalog reference of any AppError cause, so the web app
  // can render the failure in the reader's language instead of echoing the
  // English `message` (see apps/web/lib/trpc-error.ts).
  errorFormatter({ shape, error }) {
    if (!isMessageKey(error.cause)) return shape;
    return {
      ...shape,
      data: {
        ...shape.data,
        i18n: { key: error.cause.key, params: error.cause.params },
      },
    };
  },
});

const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { user: ctx.session.user } });
});

export const appRouter = t.router({
  billing: t.router({
    get: protectedProcedure.query(({ ctx }) => billingSummary(ctx.user.id)),
  }),
  connections: t.router({
    list: protectedProcedure.query(({ ctx }) => listConnections(ctx.user.id)),
    disconnect: protectedProcedure
      .input(z.object({ id: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const removed = await disconnectConnection(ctx.user.id, input.id);
        if (!removed) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No such connection.",
            cause: new AppError({ key: "connect.noSuchConnection" }, "No such connection."),
          });
        }
        return { ok: true as const };
      }),
    connectViaToken: protectedProcedure
      .input(z.object({ integrationToken: z.string(), companyId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const result = await connectViaToken(ctx.user.id, input.integrationToken, input.companyId);
        if (!result.ok) {
          throw new TRPCError({
            code:
              result.httpStatus === 402
                ? "FORBIDDEN"
                : result.httpStatus === 502
                  ? "BAD_GATEWAY"
                  : "BAD_REQUEST",
            message: result.error,
            cause: new AppError({ key: result.key, params: result.params }, result.error),
          });
        }
        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
