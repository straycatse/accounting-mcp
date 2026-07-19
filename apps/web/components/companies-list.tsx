"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Building2, Trash2 } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CompaniesList() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const connections = useQuery(trpc.connections.list.queryOptions());
  const [removeError, setRemoveError] = useState("");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.billing.get.queryKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.connections.list.queryKey() });
  };

  const disconnect = useMutation(
    trpc.connections.disconnect.mutationOptions({
      onSuccess: () => {
        setRemoveError("");
        refresh();
      },
      onError: (err) => setRemoveError(`Could not remove: ${err.message}`),
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4" />
          Connected companies
        </CardTitle>
        <CardDescription>Companies your AI assistant can access.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {removeError && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>{removeError}</AlertTitle>
          </Alert>
        )}
        {connections.isPending ? (
          <Skeleton className="h-12 w-full" />
        ) : !connections.data || connections.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="divide-y">
            {connections.data.map((conn) => (
              <li key={conn.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {conn.companyName ?? conn.tenantId}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">
                      {conn.authType === "integration_token" ? "private token" : "oauth"}
                    </Badge>
                    <Badge variant={conn.status === "active" ? "outline" : "secondary"}>
                      {conn.status}
                    </Badge>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={disconnect.isPending}>
                      <Trash2 />
                      Remove
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Remove {conn.companyName ?? conn.tenantId}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Your AI assistant loses access to this company and the stored credentials
                        are deleted. You can reconnect it later.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={() => disconnect.mutate({ id: conn.id })}
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
