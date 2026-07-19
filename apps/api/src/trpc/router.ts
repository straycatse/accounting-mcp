import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import type { Context } from "./context.js";
import {
  billingSummary,
  connectViaToken,
  disconnectConnection,
  listConnections,
} from "../services/connections.js";

const t = initTRPC.context<Context>().create({ transformer: superjson });

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
        if (!removed) throw new TRPCError({ code: "NOT_FOUND", message: "No such connection." });
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
            message: result.message,
            cause: result.error,
          });
        }
        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
