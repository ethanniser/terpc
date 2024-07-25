import type {
  MutateOptions,
  QueryFunctionContext,
  QueryKey,
  SkipToken,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Exit from "effect/Exit";
import * as Runtime from "effect/Runtime";

import type { ClientServices } from "./client-services";
import { useEffectRuntime } from "./client-services";

// Todo: useSuspenseQuery and queryOptions

type Override<TTargetA, TTargetB> = {
  [AKey in keyof TTargetA]: AKey extends keyof TTargetB
    ? TTargetB[AKey]
    : TTargetA[AKey];
};

/**
 *
 * Why are `retry` and `retryDelay` removed? Because its effect, just do it there its much more convenient and flexible
 *
 */
export function useEffectQuery<
  TData,
  TError,
  ThrowOnDefect extends boolean = false,
  TExposedError = ThrowOnDefect extends true ? TError : Cause.Cause<TError>,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: {
    throwOnDefect?: ThrowOnDefect;
  } & Override<
    Omit<
      UseQueryOptions<TData, TExposedError, TData, TQueryKey>,
      "retry" | "retryDelay"
    >,
    {
      queryFn?:
        | ((
            context: QueryFunctionContext<TQueryKey, never>,
          ) => Effect.Effect<TData, TError, ClientServices>)
        | SkipToken;
    }
  >,
): UseQueryResult<TData, TExposedError> {
  const throwOnDefect = options.throwOnDefect ?? false;

  const runtime = useEffectRuntime();
  const runPromiseExit = Runtime.runPromiseExit(runtime);
  const queryFn = options.queryFn;
  const throwOnError = options.throwOnError;

  const baseResults = useQuery({
    ...options,
    ...(typeof queryFn === "function"
      ? {
          queryFn: async (args) => {
            let queryEffect: Effect.Effect<TData, TError, ClientServices>;
            try {
              queryEffect = queryFn(args);
            } catch (e) {
              throw new Cause.UnknownException(e, "queryFn threw");
            }

            if (queryEffect === skipToken) {
              return queryEffect;
            }

            const effecToRun = queryEffect.pipe(
              Effect.withSpan("useEffectQuery", {
                attributes: {
                  queryKey: args.queryKey,
                  queryFn: queryFn.toString(),
                },
              }),
            );
            const result = await runPromiseExit(effecToRun, {
              signal: args.signal,
            });
            if (Exit.isFailure(result)) {
              // we always throw the cause
              throw result.cause;
            } else {
              return result.value;
            }
          },
        }
      : {}),
    ...(typeof throwOnError === "function"
      ? {
          throwOnError: (error, query) => {
            // this is safe because internally when we call useQuery we always throw the full cause or UnknownException
            const cause = error as Cause.Cause<TError> | Cause.UnknownException;

            // if the cause is UnknownException, we always return true and throw it
            if (Cause.isUnknownException(cause)) {
              return true;
            }
            const failureOrCause = Cause.failureOrCause(cause);

            if (throwOnDefect) {
              // in this case options.throwOnError expects a TError

              // the cause was a fail, so we have TError
              if (Either.isLeft(failureOrCause)) {
                // this is safe because if throwOnDefect is true then TExposedError is TError
                const exposedError =
                  failureOrCause.left as unknown as TExposedError;
                return throwOnError(exposedError, query);
              } else {
                // the cause was a die or interrupt, so we return true
                return true;
              }
            } else {
              // in this case options.throwOnError expects a Cause<TError>
              // this is safe because if throwOnDefect is false then TExposedError is Cause<TError>
              const exposedError = cause as unknown as TExposedError;
              return throwOnError(exposedError, query);
            }
          },
        }
      : {}),
  });

  const error = baseResults.error
    ? throwOnDefect
      ? Either.match(
          Cause.failureOrCause(
            baseResults.error as unknown as Cause.Cause<TError>, // this is safe because we always throw the full cause and we know that error is not null
          ),
          {
            onLeft: (error) => error as unknown as TExposedError, // if throwOnDefect is true then TExposedError is TError
            onRight: (_cause) => {
              throw new Error(
                "non fail cause with throwOnDefect: true should have thrown already",
              );
            },
          },
        )
      : baseResults.error // if throwOnDefect is false then TExposedError is Cause<TError>, and base error is always Cause<TError>
    : null;

  const failureReason = baseResults.failureReason
    ? throwOnDefect
      ? Either.match(
          Cause.failureOrCause(
            baseResults.failureReason as unknown as Cause.Cause<TError>, // this is safe because we always throw the full cause and we know that error is not null
          ),
          {
            onLeft: (error) => error as unknown as TExposedError, // if throwOnDefect is true then TExposedError is TError
            onRight: (_cause) => {
              throw new Error(
                "non fail cause with throwOnDefect: true should have thrown already",
              );
            },
          },
        )
      : baseResults.failureReason // if throwOnDefect is false then TExposedError is Cause<TError>, and base error is always Cause<TError>
    : null;

  return {
    ...baseResults,
    error,
    failureReason,
  } as UseQueryResult<TData, TExposedError>;
  // this is safe because we are only doing very light remapping
  // it gets mad when you touch error because it is either TError or null depending on other properities, but we honor those cases
}

/**
 *
 * Why are `retry` and `retryDelay` removed? Because its effect, just do it there its much more convenient and flexible
 */
export function useEffectMutation<
  TData,
  TError,
  ThrowOnDefect extends boolean = false,
  TExposedError = ThrowOnDefect extends true ? TError : Cause.Cause<TError>,
  TVariables = void,
  TContext = unknown,
>(
  options: {
    throwOnDefect?: ThrowOnDefect;
  } & Override<
    Omit<
      UseMutationOptions<TData, TExposedError, TVariables, TContext>,
      "retry" | "retryDelay"
    >,
    {
      mutationFn?: (
        variables: TVariables,
      ) => Effect.Effect<TData, TError, ClientServices>;
      onMutate?: (
        variables: TVariables,
      ) => Effect.Effect<TContext, unknown, ClientServices>;
      onSuccess?: (
        data: TData,
        variables: TVariables,
        context: TContext,
      ) => Effect.Effect<unknown, unknown, ClientServices>;
      onError?: (
        error: TExposedError,
        variables: TVariables,
        context: TContext | undefined,
      ) => Effect.Effect<unknown, unknown, ClientServices>;
      onSettled?: (
        data: TData | undefined,
        error: TExposedError | null,
        variables: TVariables,
        context: TContext | undefined,
      ) => Effect.Effect<unknown, unknown, ClientServices>;
    }
  >,
): Override<
  UseMutationResult<TData, TExposedError, TVariables, TContext>,
  {
    mutateAsync: (
      variables: TVariables,
      options?: MutateOptions<TData, Cause.Cause<TError>, TVariables, TContext>,
    ) => Promise<Exit.Exit<TData, TError>>;
    mutate: (
      variables: TVariables,
      options?: MutateOptions<TData, Cause.Cause<TError>, TVariables, TContext>,
    ) => void;
  }
> {
  const mutationFn = options.mutationFn;
  const throwOnDefect = options.throwOnDefect ?? false;
  const throwOnError = options.throwOnError;
  const onMutate = options.onMutate;
  const onSuccess = options.onSuccess;
  const onError = options.onError;
  const onSettled = options.onSettled;

  const runtime = useEffectRuntime();
  const runPromiseExit = Runtime.runPromiseExit(runtime);
  const runPromise = Runtime.runPromise(runtime);

  const baseResults = useMutation({
    ...options,
    mutationFn:
      typeof mutationFn === "function"
        ? async (variables: TVariables) => {
            let mutationEffect: Effect.Effect<TData, TError, ClientServices>;
            try {
              mutationEffect = mutationFn(variables);
            } catch (e) {
              throw new Cause.UnknownException(e, "mutationFn threw");
            }
            const effectToRun = mutationEffect.pipe(
              Effect.withSpan("useEffectMutation", {
                attributes: {
                  mutationFn: mutationFn.toString(),
                },
              }),
            );
            const result = await runPromiseExit(effectToRun);
            if (Exit.isFailure(result)) {
              // we always throw the cause
              throw result.cause;
            } else {
              return result.value;
            }
          }
        : mutationFn,
    throwOnError:
      typeof throwOnError === "function"
        ? (error: Cause.Cause<TError>) => {
            // this is safe because internally when we call useQuery we always throw the full cause or UnknownException
            const cause = error as Cause.Cause<TError> | Cause.UnknownException;

            // if the cause is UnknownException, we always return true and throw it
            if (Cause.isUnknownException(cause)) {
              return true;
            }

            const failureOrCause = Cause.failureOrCause(cause);

            if (throwOnDefect) {
              // in this case options.throwOnError expects a TError

              // the cause was a fail, so we have TError
              if (Either.isLeft(failureOrCause)) {
                // this is safe because if throwOnDefect is true then TExposedError is TError
                const exposedError =
                  failureOrCause.left as unknown as TExposedError;
                return throwOnError(exposedError);
              } else {
                // the cause was a die or interrupt, so we return true
                return true;
              }
            } else {
              // in this case options.throwOnError expects a Cause<TError>
              // this is safe because if throwOnDefect is false then TExposedError is Cause<TError>
              const exposedError = cause as unknown as TExposedError;
              return throwOnError(exposedError);
            }
          }
        : throwOnError,
    onMutate:
      typeof onMutate === "function"
        ? async (...args) => {
            return await runPromise(
              onMutate(...args).pipe(
                Effect.withSpan("useEffectMutation.onMutate", {
                  attributes: {
                    mutationFn: mutationFn?.toString(),
                  },
                }),
              ),
            );
          }
        : undefined,
    onSuccess:
      typeof onSuccess === "function"
        ? async (...args) => {
            return await runPromise(
              onSuccess(...args).pipe(
                Effect.withSpan("useEffectMutation.onSuccess", {
                  attributes: {
                    mutationFn: mutationFn?.toString(),
                  },
                }),
              ),
            );
          }
        : undefined,
    onError:
      typeof onError === "function"
        ? async (baseError, ...args) => {
            const error = throwOnDefect
              ? Either.match(Cause.failureOrCause(baseError), {
                  onLeft: (error) => error as TExposedError, // if throwOnDefect is true then TExposedError is TError
                  onRight: (_cause) => {
                    throw new Error(
                      "non fail cause with throwOnDefect: true should have thrown already",
                    );
                  },
                })
              : (baseError as unknown as TExposedError);

            return await runPromise(
              onError(error, ...args).pipe(
                Effect.withSpan("useEffectMutation.onError", {
                  attributes: {
                    mutationFn: mutationFn?.toString(),
                  },
                }),
              ),
            );
          }
        : undefined,
    onSettled:
      typeof onSettled === "function"
        ? async (data, baseError, ...args) => {
            const error = baseError
              ? throwOnDefect
                ? Either.match(Cause.failureOrCause(baseError), {
                    onLeft: (error) => error as TExposedError, // if throwOnDefect is true then TExposedError is TError
                    onRight: (_cause) => {
                      throw new Error(
                        "non fail cause with throwOnDefect: true should have thrown already",
                      );
                    },
                  })
                : (baseError as unknown as TExposedError)
              : null;

            return await runPromise(
              onSettled(data, error, ...args).pipe(
                Effect.withSpan("useEffectMutation.onSettled", {
                  attributes: {
                    mutationFn: mutationFn?.toString(),
                  },
                }),
              ),
            );
          }
        : undefined,
  });

  const error = (
    baseResults.error
      ? throwOnDefect
        ? Either.match(
            Cause.failureOrCause(
              baseResults.error as unknown as Cause.Cause<TError>, // this is safe because we always throw the full cause and we know that error is not null
            ),
            {
              onLeft: (error) => error as unknown as TExposedError, // if throwOnDefect is true then TExposedError is TError
              onRight: (_cause) => {
                throw new Error(
                  "non fail cause with throwOnDefect: true should have thrown already",
                );
              },
            },
          )
        : baseResults.error // if throwOnDefect is false then TExposedError is Cause<TError>, and base error is always Cause<TError>
      : null
  ) as TExposedError | null;

  const failureReason = (
    baseResults.failureReason
      ? throwOnDefect
        ? Either.match(
            Cause.failureOrCause(
              baseResults.failureReason as unknown as Cause.Cause<TError>, // this is safe because we always throw the full cause and we know that error is not null
            ),
            {
              onLeft: (error) => error as unknown as TExposedError, // if throwOnDefect is true then TExposedError is TError
              onRight: (_cause) => {
                throw new Error(
                  "non fail cause with throwOnDefect: true should have thrown already",
                );
              },
            },
          )
        : baseResults.failureReason // if throwOnDefect is false then TExposedError is Cause<TError>, and base error is always Cause<TError>
      : null
  ) as TExposedError | null;

  return {
    ...baseResults,
    mutateAsync: (variables, options) =>
      baseResults
        .mutateAsync(variables, options)
        .then((res) => Exit.succeed(res))
        // we always throw the cause, so we can always catch it
        .catch((cause: Cause.Cause<TError>) => Exit.fail(cause)) as Promise<
        Exit.Exit<TData, TError>
      >,
    mutate: (variables, options) => baseResults.mutate(variables, options),
    error,
    failureReason,
  } as Override<
    UseMutationResult<TData, TExposedError, TVariables, TContext>,
    {
      mutateAsync: (
        variables: TVariables,
        options?: MutateOptions<
          TData,
          Cause.Cause<TError>,
          TVariables,
          TContext
        >,
      ) => Promise<Exit.Exit<TData, TError>>;
      mutate: (
        variables: TVariables,
        options?: MutateOptions<
          TData,
          Cause.Cause<TError>,
          TVariables,
          TContext
        >,
      ) => void;
    }
  >;
  // this is safe because we are only doing very light remapping
  // it gets mad when you touch error because it is either TError or null depending on other properities, but we honor those cases
}
