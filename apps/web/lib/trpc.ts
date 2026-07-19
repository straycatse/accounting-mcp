import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@acc/api/trpc";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
