import React, { createContext, useContext, useMemo, useState } from "react";
import { QueryClient as RQQueryClient } from "@tanstack/react-query";
import * as Context from "effect/Context";
import * as FiberRefs from "effect/FiberRefs";
import * as Runtime from "effect/Runtime";

export class QueryClient extends Context.Tag("@markprompt/QueryClient")<
  QueryClient,
  RQQueryClient
>() {}

export type ClientServices = QueryClient;

const EffectRuntimeContext =
  createContext<Runtime.Runtime<ClientServices> | null>(null);

const EffectContextContent =
  createContext<Context.Context<ClientServices> | null>(null);

export const useEffectRuntime = () => {
  const runtime = useContext(EffectRuntimeContext);
  if (!runtime) {
    throw new Error(
      "useEffectRuntime must be used within an EffectRuntimeProvider",
    );
  }
  return runtime;
};

export const useEffectContext = () => {
  const context = useContext(EffectContextContent);
  if (!context) {
    throw new Error(
      "useEffectContext must be used within an EffectContextProvider",
    );
  }
  return context;
};

export const useQueryClient = () => {
  const context = useEffectContext();
  const queryClient = Context.get(context, QueryClient);
  return queryClient;
};

export const EffectServicesProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [queryClient] = useState(() => new RQQueryClient());
  const context = useMemo(
    () => Context.empty().pipe(Context.add(QueryClient, queryClient)),
    [queryClient],
  );
  const runtime = useMemo(
    () =>
      Runtime.make({
        context,
        fiberRefs: FiberRefs.empty(),
        runtimeFlags: Runtime.defaultRuntimeFlags,
      }),
    [context],
  );

  return (
    <EffectRuntimeContext.Provider value={runtime}>
      <EffectContextContent.Provider value={context}>
        {children}
      </EffectContextContent.Provider>
    </EffectRuntimeContext.Provider>
  );
};
