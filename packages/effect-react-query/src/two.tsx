import React from "react";
import type { QueryClient as RQQueryClient } from "@tanstack/react-query";
import { Context, Effect, Layer, ManagedRuntime } from "effect";

// Memoize layer construction across all calls to `ManagedRuntime.make` across all calls to `makeEffectRuntime`
// If the layer object itself changes (for instance because the args to the layer function change), then it will be recomputed
// because it is a new distinct layer object
const memoMap = Effect.runSync(Layer.makeMemoMap);

// ? if I have two layers, one does not depend on args one does, do they all get recomputer

declare const state: number;
class PureLayer extends Context.Tag("pure")<PureLayer, number>() {
  static make = Layer.sync(PureLayer, () => Date.now());
}
class DependentLayer extends Context.Tag("dependent")<
  DependentLayer,
  number
>() {
  static make = (n: number) => Layer.succeed(DependentLayer, n);
}

// does PureLayer get recomputed?
// because the layer this returns is a new Layer, but PureLayer hasnt changed
function makeLayer({ n }: { n: number }) {
  return Layer.mergeAll(PureLayer.make, DependentLayer.make(n));
}

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
