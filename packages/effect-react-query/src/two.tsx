import React from "react";
import type { QueryClient as RQQueryClient } from "@tanstack/react-query";
import { Context, Effect, Layer, ManagedRuntime } from "effect";

export class QueryClient extends Context.Tag("@markprompt/QueryClient")<
  QueryClient,
  RQQueryClient
>() {}

export function makeEffectRuntime<
  R,
  E,
  Args extends Record<string, unknown> = {},
>(
  layer: (options: Args) => Layer.Layer<R, E>,
): {
  Provider: (
    props: Args & { readonly children?: React.ReactNode },
  ) => JSX.Element;
  useEffectRuntime: () => ManagedRuntime.ManagedRuntime<R, E>;
  useEffectQuery: any;
  useEffectMutation: any;
} {
  const Context = React.createContext<ManagedRuntime.ManagedRuntime<
    R,
    E
  > | null>(null);

  const useEffectRuntime = () => {
    const runtime = React.useContext(Context); // todo: can be `use`?
    if (!runtime) {
      throw new Error(
        "useEffectRuntime must be used within an EffectRuntimeProvider",
      );
    }
    return runtime;
  };
  const useEffectQuery = undefined;
  const useEffectMutation = undefined;

  const memoMap = Effect.runSync(Layer.makeMemoMap); // ? why
  const Provider = (args: Args & { readonly children?: React.ReactNode }) => {
    const deps: unknown[] = [];
    for (const key of Object.keys(args).sort()) {
      if (key === "children") continue;
      deps.push(args[key]);
    }
    const runtime = React.useMemo(
      () => ManagedRuntime.make(layer(args), memoMap),
      deps,
    );
    React.useEffect(
      () => () => {
        runtime.dispose();
      },
      [runtime],
    );
    return <Context.Provider value={runtime}>{args.children}</Context.Provider>;
  };

  return {
    Provider,
    useEffectRuntime,
    useEffectQuery,
    useEffectMutation,
  };
}

export function EffectReactQueryProvider<R, E>({
  children,
  queryClient,
  runtimeContext,
}: {
  children: React.ReactNode;
  queryClient: QueryClient;
  runtimeContext: React.Context<ManagedRuntime.ManagedRuntime<R, E>>;
}) {}
