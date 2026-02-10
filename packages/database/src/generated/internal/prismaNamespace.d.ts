import * as runtime from '@prisma/client/runtime/client';
import type * as Prisma from '../models';
import { type PrismaClient } from './class';
export type * from '../models';
export type DMMF = typeof runtime.DMMF;
export type PrismaPromise<T> = runtime.Types.Public.PrismaPromise<T>;
/**
 * Prisma Errors
 */
export declare const PrismaClientKnownRequestError: typeof runtime.PrismaClientKnownRequestError;
export type PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError;
export declare const PrismaClientUnknownRequestError: typeof runtime.PrismaClientUnknownRequestError;
export type PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError;
export declare const PrismaClientRustPanicError: typeof runtime.PrismaClientRustPanicError;
export type PrismaClientRustPanicError = runtime.PrismaClientRustPanicError;
export declare const PrismaClientInitializationError: typeof runtime.PrismaClientInitializationError;
export type PrismaClientInitializationError = runtime.PrismaClientInitializationError;
export declare const PrismaClientValidationError: typeof runtime.PrismaClientValidationError;
export type PrismaClientValidationError = runtime.PrismaClientValidationError;
/**
 * Re-export of sql-template-tag
 */
export declare const sql: typeof runtime.sqltag;
export declare const empty: runtime.Sql;
export declare const join: typeof runtime.join;
export declare const raw: typeof runtime.raw;
export declare const Sql: typeof runtime.Sql;
export type Sql = runtime.Sql;
/**
 * Decimal.js
 */
export declare const Decimal: typeof runtime.Decimal;
export type Decimal = runtime.Decimal;
export type DecimalJsLike = runtime.DecimalJsLike;
/**
 * Extensions
 */
export type Extension = runtime.Types.Extensions.UserArgs;
export declare const getExtensionContext: typeof runtime.Extensions.getExtensionContext;
export type Args<T, F extends runtime.Operation> = runtime.Types.Public.Args<T, F>;
export type Payload<T, F extends runtime.Operation = never> = runtime.Types.Public.Payload<T, F>;
export type Result<T, A, F extends runtime.Operation> = runtime.Types.Public.Result<T, A, F>;
export type Exact<A, W> = runtime.Types.Public.Exact<A, W>;
export type PrismaVersion = {
    client: string;
    engine: string;
};
/**
 * Prisma Client JS version: 7.3.0
 * Query Engine version: 9d6ad21cbbceab97458517b147a6a09ff43aa735
 */
export declare const prismaVersion: PrismaVersion;
/**
 * Utility Types
 */
export type Bytes = runtime.Bytes;
export type JsonObject = runtime.JsonObject;
export type JsonArray = runtime.JsonArray;
export type JsonValue = runtime.JsonValue;
export type InputJsonObject = runtime.InputJsonObject;
export type InputJsonArray = runtime.InputJsonArray;
export type InputJsonValue = runtime.InputJsonValue;
export declare const NullTypes: {
    DbNull: new (secret: never) => typeof runtime.DbNull;
    JsonNull: new (secret: never) => typeof runtime.JsonNull;
    AnyNull: new (secret: never) => typeof runtime.AnyNull;
};
/**
 * Helper for filtering JSON entries that have `null` on the database (empty on the db)
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const DbNull: runtime.DbNullClass;
/**
 * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const JsonNull: runtime.JsonNullClass;
/**
 * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const AnyNull: runtime.AnyNullClass;
type SelectAndInclude = {
    select: any;
    include: any;
};
type SelectAndOmit = {
    select: any;
    omit: any;
};
/**
 * From T, pick a set of properties whose keys are in the union K
 */
type Prisma__Pick<T, K extends keyof T> = {
    [P in K]: T[P];
};
export type Enumerable<T> = T | Array<T>;
/**
 * Subset
 * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
 */
export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
};
/**
 * SelectSubset
 * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
 * Additionally, it validates, if both select and include are present. If the case, it errors.
 */
export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
} & (T extends SelectAndInclude ? 'Please either choose `select` or `include`.' : T extends SelectAndOmit ? 'Please either choose `select` or `omit`.' : {});
/**
 * Subset + Intersection
 * @desc From `T` pick properties that exist in `U` and intersect `K`
 */
export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
} & K;
type Without<T, U> = {
    [P in Exclude<keyof T, keyof U>]?: never;
};
/**
 * XOR is needed to have a real mutually exclusive union type
 * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
 */
export type XOR<T, U> = T extends object ? U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : U : T;
/**
 * Is T a Record?
 */
type IsObject<T extends any> = T extends Array<any> ? False : T extends Date ? False : T extends Uint8Array ? False : T extends BigInt ? False : T extends object ? True : False;
/**
 * If it's T[], return T
 */
export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T;
/**
 * From ts-toolbelt
 */
type __Either<O extends object, K extends Key> = Omit<O, K> & {
    [P in K]: Prisma__Pick<O, P & keyof O>;
}[K];
type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>;
type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>;
type _Either<O extends object, K extends Key, strict extends Boolean> = {
    1: EitherStrict<O, K>;
    0: EitherLoose<O, K>;
}[strict];
export type Either<O extends object, K extends Key, strict extends Boolean = 1> = O extends unknown ? _Either<O, K, strict> : never;
export type Union = any;
export type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K];
} & {};
/** Helper Types for "Merge" **/
export type IntersectOf<U extends Union> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
export type Overwrite<O extends object, O1 extends object> = {
    [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
} & {};
type _Merge<U extends object> = IntersectOf<Overwrite<U, {
    [K in keyof U]-?: At<U, K>;
}>>;
type Key = string | number | symbol;
type AtStrict<O extends object, K extends Key> = O[K & keyof O];
type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
    1: AtStrict<O, K>;
    0: AtLoose<O, K>;
}[strict];
export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
} & {};
export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
} & {};
type _Record<K extends keyof any, T> = {
    [P in K]: T;
};
type NoExpand<T> = T extends unknown ? T : never;
export type AtLeast<O extends object, K extends string> = NoExpand<O extends unknown ? (K extends keyof O ? {
    [P in K]: O[P];
} & O : O) | ({
    [P in keyof O as P extends K ? P : never]-?: O[P];
} & O) : never>;
type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;
export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
/** End Helper Types for "Merge" **/
export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;
export type Boolean = True | False;
export type True = 1;
export type False = 0;
export type Not<B extends Boolean> = {
    0: 1;
    1: 0;
}[B];
export type Extends<A1 extends any, A2 extends any> = [A1] extends [never] ? 0 : A1 extends A2 ? 1 : 0;
export type Has<U extends Union, U1 extends Union> = Not<Extends<Exclude<U1, U>, U1>>;
export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
        0: 0;
        1: 1;
    };
    1: {
        0: 1;
        1: 1;
    };
}[B1][B2];
export type Keys<U extends Union> = U extends unknown ? keyof U : never;
export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O ? O[P] : never;
} : never;
type FieldPaths<T, U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>> = IsObject<T> extends True ? U : T;
export type GetHavingFields<T> = {
    [K in keyof T]: Or<Or<Extends<'OR', K>, Extends<'AND', K>>, Extends<'NOT', K>> extends True ? T[K] extends infer TK ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never> : never : {} extends FieldPaths<T[K]> ? never : K;
}[keyof T];
/**
 * Convert tuple to union
 */
type _TupleToUnion<T> = T extends (infer E)[] ? E : never;
type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>;
export type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T;
/**
 * Like `Pick`, but additionally can also accept an array of keys
 */
export type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>;
/**
 * Exclude all keys with underscores
 */
export type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T;
export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>;
type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>;
export declare const ModelName: {
    readonly Account: "Account";
    readonly Transaction: "Transaction";
    readonly Position: "Position";
    readonly Trade: "Trade";
    readonly BurnEventRecord: "BurnEventRecord";
    readonly LiquidityPoolRecord: "LiquidityPoolRecord";
    readonly WorkerStatusRecord: "WorkerStatusRecord";
    readonly TradeSettings: "TradeSettings";
    readonly PriceRecord: "PriceRecord";
    readonly MarketRecord: "MarketRecord";
    readonly TokenValidationRecord: "TokenValidationRecord";
    readonly DiscoveredPool: "DiscoveredPool";
};
export type ModelName = (typeof ModelName)[keyof typeof ModelName];
export interface TypeMapCb<GlobalOmitOptions = {}> extends runtime.Types.Utils.Fn<{
    extArgs: runtime.Types.Extensions.InternalArgs;
}, runtime.Types.Utils.Record<string, any>> {
    returns: TypeMap<this['params']['extArgs'], GlobalOmitOptions>;
}
export type TypeMap<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
        omit: GlobalOmitOptions;
    };
    meta: {
        modelProps: 'account' | 'transaction' | 'position' | 'trade' | 'burnEventRecord' | 'liquidityPoolRecord' | 'workerStatusRecord' | 'tradeSettings' | 'priceRecord' | 'marketRecord' | 'tokenValidationRecord' | 'discoveredPool';
        txIsolationLevel: TransactionIsolationLevel;
    };
    model: {
        Account: {
            payload: Prisma.$AccountPayload<ExtArgs>;
            fields: Prisma.AccountFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.AccountFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$AccountPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.AccountFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$AccountPayload>;
                };
                findFirst: {
                    args: Prisma.AccountFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$AccountPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.AccountFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$AccountPayload>;
                };
                findMany: {
                    args: Prisma.AccountFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$AccountPayload>[];
                };
                create: {
                    args: Prisma.AccountCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$AccountPayload>;
                };
                createMany: {
                    args: Prisma.AccountCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                createManyAndReturn: {
                    args: Prisma.AccountCreateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$AccountPayload>[];
                };
                delete: {
                    args: Prisma.AccountDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$AccountPayload>;
                };
                update: {
                    args: Prisma.AccountUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$AccountPayload>;
                };
                deleteMany: {
                    args: Prisma.AccountDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.AccountUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateManyAndReturn: {
                    args: Prisma.AccountUpdateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$AccountPayload>[];
                };
                upsert: {
                    args: Prisma.AccountUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$AccountPayload>;
                };
                aggregate: {
                    args: Prisma.AccountAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateAccount>;
                };
                groupBy: {
                    args: Prisma.AccountGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AccountGroupByOutputType>[];
                };
                count: {
                    args: Prisma.AccountCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AccountCountAggregateOutputType> | number;
                };
            };
        };
        Transaction: {
            payload: Prisma.$TransactionPayload<ExtArgs>;
            fields: Prisma.TransactionFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.TransactionFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TransactionPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.TransactionFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TransactionPayload>;
                };
                findFirst: {
                    args: Prisma.TransactionFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TransactionPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.TransactionFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TransactionPayload>;
                };
                findMany: {
                    args: Prisma.TransactionFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TransactionPayload>[];
                };
                create: {
                    args: Prisma.TransactionCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TransactionPayload>;
                };
                createMany: {
                    args: Prisma.TransactionCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                createManyAndReturn: {
                    args: Prisma.TransactionCreateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TransactionPayload>[];
                };
                delete: {
                    args: Prisma.TransactionDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TransactionPayload>;
                };
                update: {
                    args: Prisma.TransactionUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TransactionPayload>;
                };
                deleteMany: {
                    args: Prisma.TransactionDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.TransactionUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateManyAndReturn: {
                    args: Prisma.TransactionUpdateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TransactionPayload>[];
                };
                upsert: {
                    args: Prisma.TransactionUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TransactionPayload>;
                };
                aggregate: {
                    args: Prisma.TransactionAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateTransaction>;
                };
                groupBy: {
                    args: Prisma.TransactionGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.TransactionGroupByOutputType>[];
                };
                count: {
                    args: Prisma.TransactionCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.TransactionCountAggregateOutputType> | number;
                };
            };
        };
        Position: {
            payload: Prisma.$PositionPayload<ExtArgs>;
            fields: Prisma.PositionFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.PositionFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PositionPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.PositionFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PositionPayload>;
                };
                findFirst: {
                    args: Prisma.PositionFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PositionPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.PositionFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PositionPayload>;
                };
                findMany: {
                    args: Prisma.PositionFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PositionPayload>[];
                };
                create: {
                    args: Prisma.PositionCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PositionPayload>;
                };
                createMany: {
                    args: Prisma.PositionCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                createManyAndReturn: {
                    args: Prisma.PositionCreateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PositionPayload>[];
                };
                delete: {
                    args: Prisma.PositionDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PositionPayload>;
                };
                update: {
                    args: Prisma.PositionUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PositionPayload>;
                };
                deleteMany: {
                    args: Prisma.PositionDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.PositionUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateManyAndReturn: {
                    args: Prisma.PositionUpdateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PositionPayload>[];
                };
                upsert: {
                    args: Prisma.PositionUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PositionPayload>;
                };
                aggregate: {
                    args: Prisma.PositionAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregatePosition>;
                };
                groupBy: {
                    args: Prisma.PositionGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.PositionGroupByOutputType>[];
                };
                count: {
                    args: Prisma.PositionCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.PositionCountAggregateOutputType> | number;
                };
            };
        };
        Trade: {
            payload: Prisma.$TradePayload<ExtArgs>;
            fields: Prisma.TradeFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.TradeFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradePayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.TradeFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradePayload>;
                };
                findFirst: {
                    args: Prisma.TradeFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradePayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.TradeFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradePayload>;
                };
                findMany: {
                    args: Prisma.TradeFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradePayload>[];
                };
                create: {
                    args: Prisma.TradeCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradePayload>;
                };
                createMany: {
                    args: Prisma.TradeCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                createManyAndReturn: {
                    args: Prisma.TradeCreateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradePayload>[];
                };
                delete: {
                    args: Prisma.TradeDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradePayload>;
                };
                update: {
                    args: Prisma.TradeUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradePayload>;
                };
                deleteMany: {
                    args: Prisma.TradeDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.TradeUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateManyAndReturn: {
                    args: Prisma.TradeUpdateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradePayload>[];
                };
                upsert: {
                    args: Prisma.TradeUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradePayload>;
                };
                aggregate: {
                    args: Prisma.TradeAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateTrade>;
                };
                groupBy: {
                    args: Prisma.TradeGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.TradeGroupByOutputType>[];
                };
                count: {
                    args: Prisma.TradeCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.TradeCountAggregateOutputType> | number;
                };
            };
        };
        BurnEventRecord: {
            payload: Prisma.$BurnEventRecordPayload<ExtArgs>;
            fields: Prisma.BurnEventRecordFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.BurnEventRecordFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BurnEventRecordPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.BurnEventRecordFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BurnEventRecordPayload>;
                };
                findFirst: {
                    args: Prisma.BurnEventRecordFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BurnEventRecordPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.BurnEventRecordFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BurnEventRecordPayload>;
                };
                findMany: {
                    args: Prisma.BurnEventRecordFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BurnEventRecordPayload>[];
                };
                create: {
                    args: Prisma.BurnEventRecordCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BurnEventRecordPayload>;
                };
                createMany: {
                    args: Prisma.BurnEventRecordCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                createManyAndReturn: {
                    args: Prisma.BurnEventRecordCreateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BurnEventRecordPayload>[];
                };
                delete: {
                    args: Prisma.BurnEventRecordDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BurnEventRecordPayload>;
                };
                update: {
                    args: Prisma.BurnEventRecordUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BurnEventRecordPayload>;
                };
                deleteMany: {
                    args: Prisma.BurnEventRecordDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.BurnEventRecordUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateManyAndReturn: {
                    args: Prisma.BurnEventRecordUpdateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BurnEventRecordPayload>[];
                };
                upsert: {
                    args: Prisma.BurnEventRecordUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BurnEventRecordPayload>;
                };
                aggregate: {
                    args: Prisma.BurnEventRecordAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateBurnEventRecord>;
                };
                groupBy: {
                    args: Prisma.BurnEventRecordGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.BurnEventRecordGroupByOutputType>[];
                };
                count: {
                    args: Prisma.BurnEventRecordCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.BurnEventRecordCountAggregateOutputType> | number;
                };
            };
        };
        LiquidityPoolRecord: {
            payload: Prisma.$LiquidityPoolRecordPayload<ExtArgs>;
            fields: Prisma.LiquidityPoolRecordFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.LiquidityPoolRecordFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$LiquidityPoolRecordPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.LiquidityPoolRecordFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$LiquidityPoolRecordPayload>;
                };
                findFirst: {
                    args: Prisma.LiquidityPoolRecordFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$LiquidityPoolRecordPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.LiquidityPoolRecordFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$LiquidityPoolRecordPayload>;
                };
                findMany: {
                    args: Prisma.LiquidityPoolRecordFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$LiquidityPoolRecordPayload>[];
                };
                create: {
                    args: Prisma.LiquidityPoolRecordCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$LiquidityPoolRecordPayload>;
                };
                createMany: {
                    args: Prisma.LiquidityPoolRecordCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                createManyAndReturn: {
                    args: Prisma.LiquidityPoolRecordCreateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$LiquidityPoolRecordPayload>[];
                };
                delete: {
                    args: Prisma.LiquidityPoolRecordDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$LiquidityPoolRecordPayload>;
                };
                update: {
                    args: Prisma.LiquidityPoolRecordUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$LiquidityPoolRecordPayload>;
                };
                deleteMany: {
                    args: Prisma.LiquidityPoolRecordDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.LiquidityPoolRecordUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateManyAndReturn: {
                    args: Prisma.LiquidityPoolRecordUpdateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$LiquidityPoolRecordPayload>[];
                };
                upsert: {
                    args: Prisma.LiquidityPoolRecordUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$LiquidityPoolRecordPayload>;
                };
                aggregate: {
                    args: Prisma.LiquidityPoolRecordAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateLiquidityPoolRecord>;
                };
                groupBy: {
                    args: Prisma.LiquidityPoolRecordGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.LiquidityPoolRecordGroupByOutputType>[];
                };
                count: {
                    args: Prisma.LiquidityPoolRecordCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.LiquidityPoolRecordCountAggregateOutputType> | number;
                };
            };
        };
        WorkerStatusRecord: {
            payload: Prisma.$WorkerStatusRecordPayload<ExtArgs>;
            fields: Prisma.WorkerStatusRecordFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.WorkerStatusRecordFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WorkerStatusRecordPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.WorkerStatusRecordFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WorkerStatusRecordPayload>;
                };
                findFirst: {
                    args: Prisma.WorkerStatusRecordFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WorkerStatusRecordPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.WorkerStatusRecordFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WorkerStatusRecordPayload>;
                };
                findMany: {
                    args: Prisma.WorkerStatusRecordFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WorkerStatusRecordPayload>[];
                };
                create: {
                    args: Prisma.WorkerStatusRecordCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WorkerStatusRecordPayload>;
                };
                createMany: {
                    args: Prisma.WorkerStatusRecordCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                createManyAndReturn: {
                    args: Prisma.WorkerStatusRecordCreateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WorkerStatusRecordPayload>[];
                };
                delete: {
                    args: Prisma.WorkerStatusRecordDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WorkerStatusRecordPayload>;
                };
                update: {
                    args: Prisma.WorkerStatusRecordUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WorkerStatusRecordPayload>;
                };
                deleteMany: {
                    args: Prisma.WorkerStatusRecordDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.WorkerStatusRecordUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateManyAndReturn: {
                    args: Prisma.WorkerStatusRecordUpdateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WorkerStatusRecordPayload>[];
                };
                upsert: {
                    args: Prisma.WorkerStatusRecordUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WorkerStatusRecordPayload>;
                };
                aggregate: {
                    args: Prisma.WorkerStatusRecordAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateWorkerStatusRecord>;
                };
                groupBy: {
                    args: Prisma.WorkerStatusRecordGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.WorkerStatusRecordGroupByOutputType>[];
                };
                count: {
                    args: Prisma.WorkerStatusRecordCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.WorkerStatusRecordCountAggregateOutputType> | number;
                };
            };
        };
        TradeSettings: {
            payload: Prisma.$TradeSettingsPayload<ExtArgs>;
            fields: Prisma.TradeSettingsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.TradeSettingsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradeSettingsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.TradeSettingsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradeSettingsPayload>;
                };
                findFirst: {
                    args: Prisma.TradeSettingsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradeSettingsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.TradeSettingsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradeSettingsPayload>;
                };
                findMany: {
                    args: Prisma.TradeSettingsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradeSettingsPayload>[];
                };
                create: {
                    args: Prisma.TradeSettingsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradeSettingsPayload>;
                };
                createMany: {
                    args: Prisma.TradeSettingsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                createManyAndReturn: {
                    args: Prisma.TradeSettingsCreateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradeSettingsPayload>[];
                };
                delete: {
                    args: Prisma.TradeSettingsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradeSettingsPayload>;
                };
                update: {
                    args: Prisma.TradeSettingsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradeSettingsPayload>;
                };
                deleteMany: {
                    args: Prisma.TradeSettingsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.TradeSettingsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateManyAndReturn: {
                    args: Prisma.TradeSettingsUpdateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradeSettingsPayload>[];
                };
                upsert: {
                    args: Prisma.TradeSettingsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TradeSettingsPayload>;
                };
                aggregate: {
                    args: Prisma.TradeSettingsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateTradeSettings>;
                };
                groupBy: {
                    args: Prisma.TradeSettingsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.TradeSettingsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.TradeSettingsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.TradeSettingsCountAggregateOutputType> | number;
                };
            };
        };
        PriceRecord: {
            payload: Prisma.$PriceRecordPayload<ExtArgs>;
            fields: Prisma.PriceRecordFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.PriceRecordFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PriceRecordPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.PriceRecordFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PriceRecordPayload>;
                };
                findFirst: {
                    args: Prisma.PriceRecordFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PriceRecordPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.PriceRecordFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PriceRecordPayload>;
                };
                findMany: {
                    args: Prisma.PriceRecordFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PriceRecordPayload>[];
                };
                create: {
                    args: Prisma.PriceRecordCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PriceRecordPayload>;
                };
                createMany: {
                    args: Prisma.PriceRecordCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                createManyAndReturn: {
                    args: Prisma.PriceRecordCreateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PriceRecordPayload>[];
                };
                delete: {
                    args: Prisma.PriceRecordDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PriceRecordPayload>;
                };
                update: {
                    args: Prisma.PriceRecordUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PriceRecordPayload>;
                };
                deleteMany: {
                    args: Prisma.PriceRecordDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.PriceRecordUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateManyAndReturn: {
                    args: Prisma.PriceRecordUpdateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PriceRecordPayload>[];
                };
                upsert: {
                    args: Prisma.PriceRecordUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$PriceRecordPayload>;
                };
                aggregate: {
                    args: Prisma.PriceRecordAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregatePriceRecord>;
                };
                groupBy: {
                    args: Prisma.PriceRecordGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.PriceRecordGroupByOutputType>[];
                };
                count: {
                    args: Prisma.PriceRecordCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.PriceRecordCountAggregateOutputType> | number;
                };
            };
        };
        MarketRecord: {
            payload: Prisma.$MarketRecordPayload<ExtArgs>;
            fields: Prisma.MarketRecordFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.MarketRecordFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$MarketRecordPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.MarketRecordFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$MarketRecordPayload>;
                };
                findFirst: {
                    args: Prisma.MarketRecordFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$MarketRecordPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.MarketRecordFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$MarketRecordPayload>;
                };
                findMany: {
                    args: Prisma.MarketRecordFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$MarketRecordPayload>[];
                };
                create: {
                    args: Prisma.MarketRecordCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$MarketRecordPayload>;
                };
                createMany: {
                    args: Prisma.MarketRecordCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                createManyAndReturn: {
                    args: Prisma.MarketRecordCreateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$MarketRecordPayload>[];
                };
                delete: {
                    args: Prisma.MarketRecordDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$MarketRecordPayload>;
                };
                update: {
                    args: Prisma.MarketRecordUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$MarketRecordPayload>;
                };
                deleteMany: {
                    args: Prisma.MarketRecordDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.MarketRecordUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateManyAndReturn: {
                    args: Prisma.MarketRecordUpdateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$MarketRecordPayload>[];
                };
                upsert: {
                    args: Prisma.MarketRecordUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$MarketRecordPayload>;
                };
                aggregate: {
                    args: Prisma.MarketRecordAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateMarketRecord>;
                };
                groupBy: {
                    args: Prisma.MarketRecordGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.MarketRecordGroupByOutputType>[];
                };
                count: {
                    args: Prisma.MarketRecordCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.MarketRecordCountAggregateOutputType> | number;
                };
            };
        };
        TokenValidationRecord: {
            payload: Prisma.$TokenValidationRecordPayload<ExtArgs>;
            fields: Prisma.TokenValidationRecordFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.TokenValidationRecordFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TokenValidationRecordPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.TokenValidationRecordFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TokenValidationRecordPayload>;
                };
                findFirst: {
                    args: Prisma.TokenValidationRecordFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TokenValidationRecordPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.TokenValidationRecordFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TokenValidationRecordPayload>;
                };
                findMany: {
                    args: Prisma.TokenValidationRecordFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TokenValidationRecordPayload>[];
                };
                create: {
                    args: Prisma.TokenValidationRecordCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TokenValidationRecordPayload>;
                };
                createMany: {
                    args: Prisma.TokenValidationRecordCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                createManyAndReturn: {
                    args: Prisma.TokenValidationRecordCreateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TokenValidationRecordPayload>[];
                };
                delete: {
                    args: Prisma.TokenValidationRecordDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TokenValidationRecordPayload>;
                };
                update: {
                    args: Prisma.TokenValidationRecordUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TokenValidationRecordPayload>;
                };
                deleteMany: {
                    args: Prisma.TokenValidationRecordDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.TokenValidationRecordUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateManyAndReturn: {
                    args: Prisma.TokenValidationRecordUpdateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TokenValidationRecordPayload>[];
                };
                upsert: {
                    args: Prisma.TokenValidationRecordUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TokenValidationRecordPayload>;
                };
                aggregate: {
                    args: Prisma.TokenValidationRecordAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateTokenValidationRecord>;
                };
                groupBy: {
                    args: Prisma.TokenValidationRecordGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.TokenValidationRecordGroupByOutputType>[];
                };
                count: {
                    args: Prisma.TokenValidationRecordCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.TokenValidationRecordCountAggregateOutputType> | number;
                };
            };
        };
        DiscoveredPool: {
            payload: Prisma.$DiscoveredPoolPayload<ExtArgs>;
            fields: Prisma.DiscoveredPoolFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.DiscoveredPoolFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$DiscoveredPoolPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.DiscoveredPoolFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$DiscoveredPoolPayload>;
                };
                findFirst: {
                    args: Prisma.DiscoveredPoolFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$DiscoveredPoolPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.DiscoveredPoolFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$DiscoveredPoolPayload>;
                };
                findMany: {
                    args: Prisma.DiscoveredPoolFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$DiscoveredPoolPayload>[];
                };
                create: {
                    args: Prisma.DiscoveredPoolCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$DiscoveredPoolPayload>;
                };
                createMany: {
                    args: Prisma.DiscoveredPoolCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                createManyAndReturn: {
                    args: Prisma.DiscoveredPoolCreateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$DiscoveredPoolPayload>[];
                };
                delete: {
                    args: Prisma.DiscoveredPoolDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$DiscoveredPoolPayload>;
                };
                update: {
                    args: Prisma.DiscoveredPoolUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$DiscoveredPoolPayload>;
                };
                deleteMany: {
                    args: Prisma.DiscoveredPoolDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.DiscoveredPoolUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateManyAndReturn: {
                    args: Prisma.DiscoveredPoolUpdateManyAndReturnArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$DiscoveredPoolPayload>[];
                };
                upsert: {
                    args: Prisma.DiscoveredPoolUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$DiscoveredPoolPayload>;
                };
                aggregate: {
                    args: Prisma.DiscoveredPoolAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateDiscoveredPool>;
                };
                groupBy: {
                    args: Prisma.DiscoveredPoolGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.DiscoveredPoolGroupByOutputType>[];
                };
                count: {
                    args: Prisma.DiscoveredPoolCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.DiscoveredPoolCountAggregateOutputType> | number;
                };
            };
        };
    };
} & {
    other: {
        payload: any;
        operations: {
            $executeRaw: {
                args: [query: TemplateStringsArray | Sql, ...values: any[]];
                result: any;
            };
            $executeRawUnsafe: {
                args: [query: string, ...values: any[]];
                result: any;
            };
            $queryRaw: {
                args: [query: TemplateStringsArray | Sql, ...values: any[]];
                result: any;
            };
            $queryRawUnsafe: {
                args: [query: string, ...values: any[]];
                result: any;
            };
        };
    };
};
/**
 * Enums
 */
export declare const TransactionIsolationLevel: {
    readonly ReadUncommitted: "ReadUncommitted";
    readonly ReadCommitted: "ReadCommitted";
    readonly RepeatableRead: "RepeatableRead";
    readonly Serializable: "Serializable";
};
export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel];
export declare const AccountScalarFieldEnum: {
    readonly id: "id";
    readonly publicKey: "publicKey";
    readonly balance: "balance";
    readonly createdAt: "createdAt";
    readonly updatedAt: "updatedAt";
};
export type AccountScalarFieldEnum = (typeof AccountScalarFieldEnum)[keyof typeof AccountScalarFieldEnum];
export declare const TransactionScalarFieldEnum: {
    readonly id: "id";
    readonly signature: "signature";
    readonly type: "type";
    readonly amount: "amount";
    readonly token: "token";
    readonly from: "from";
    readonly to: "to";
    readonly timestamp: "timestamp";
};
export type TransactionScalarFieldEnum = (typeof TransactionScalarFieldEnum)[keyof typeof TransactionScalarFieldEnum];
export declare const PositionScalarFieldEnum: {
    readonly id: "id";
    readonly accountId: "accountId";
    readonly token: "token";
    readonly amount: "amount";
    readonly entryPrice: "entryPrice";
    readonly currentPrice: "currentPrice";
    readonly pnl: "pnl";
    readonly status: "status";
    readonly openedAt: "openedAt";
    readonly closedAt: "closedAt";
    readonly stopLoss: "stopLoss";
    readonly takeProfit: "takeProfit";
};
export type PositionScalarFieldEnum = (typeof PositionScalarFieldEnum)[keyof typeof PositionScalarFieldEnum];
export declare const TradeScalarFieldEnum: {
    readonly id: "id";
    readonly positionId: "positionId";
    readonly type: "type";
    readonly amount: "amount";
    readonly price: "price";
    readonly signature: "signature";
    readonly slippage: "slippage";
    readonly timestamp: "timestamp";
};
export type TradeScalarFieldEnum = (typeof TradeScalarFieldEnum)[keyof typeof TradeScalarFieldEnum];
export declare const BurnEventRecordScalarFieldEnum: {
    readonly id: "id";
    readonly txSignature: "txSignature";
    readonly token: "token";
    readonly amount: "amount";
    readonly percentage: "percentage";
    readonly timestamp: "timestamp";
    readonly processed: "processed";
};
export type BurnEventRecordScalarFieldEnum = (typeof BurnEventRecordScalarFieldEnum)[keyof typeof BurnEventRecordScalarFieldEnum];
export declare const LiquidityPoolRecordScalarFieldEnum: {
    readonly id: "id";
    readonly address: "address";
    readonly tokenA: "tokenA";
    readonly tokenB: "tokenB";
    readonly tvl: "tvl";
    readonly price: "price";
    readonly volume24h: "volume24h";
    readonly updatedAt: "updatedAt";
};
export type LiquidityPoolRecordScalarFieldEnum = (typeof LiquidityPoolRecordScalarFieldEnum)[keyof typeof LiquidityPoolRecordScalarFieldEnum];
export declare const WorkerStatusRecordScalarFieldEnum: {
    readonly id: "id";
    readonly name: "name";
    readonly status: "status";
    readonly lastSeen: "lastSeen";
    readonly metrics: "metrics";
};
export type WorkerStatusRecordScalarFieldEnum = (typeof WorkerStatusRecordScalarFieldEnum)[keyof typeof WorkerStatusRecordScalarFieldEnum];
export declare const TradeSettingsScalarFieldEnum: {
    readonly id: "id";
    readonly name: "name";
    readonly enabled: "enabled";
    readonly maxSlippage: "maxSlippage";
    readonly maxPositions: "maxPositions";
    readonly stopLossPercent: "stopLossPercent";
    readonly takeProfitPercent: "takeProfitPercent";
    readonly minBurnAmount: "minBurnAmount";
    readonly updatedAt: "updatedAt";
};
export type TradeSettingsScalarFieldEnum = (typeof TradeSettingsScalarFieldEnum)[keyof typeof TradeSettingsScalarFieldEnum];
export declare const PriceRecordScalarFieldEnum: {
    readonly id: "id";
    readonly token: "token";
    readonly price: "price";
    readonly source: "source";
    readonly confidence: "confidence";
    readonly volume24h: "volume24h";
    readonly timestamp: "timestamp";
};
export type PriceRecordScalarFieldEnum = (typeof PriceRecordScalarFieldEnum)[keyof typeof PriceRecordScalarFieldEnum];
export declare const MarketRecordScalarFieldEnum: {
    readonly id: "id";
    readonly address: "address";
    readonly baseMint: "baseMint";
    readonly quoteMint: "quoteMint";
    readonly dexType: "dexType";
    readonly discoveredAt: "discoveredAt";
    readonly status: "status";
    readonly validations: "validations";
    readonly marketData: "marketData";
};
export type MarketRecordScalarFieldEnum = (typeof MarketRecordScalarFieldEnum)[keyof typeof MarketRecordScalarFieldEnum];
export declare const TokenValidationRecordScalarFieldEnum: {
    readonly id: "id";
    readonly token: "token";
    readonly isRenounced: "isRenounced";
    readonly isBurned: "isBurned";
    readonly isLocked: "isLocked";
    readonly lpBurnedCount: "lpBurnedCount";
    readonly confidence: "confidence";
    readonly validatedAt: "validatedAt";
    readonly txSignature: "txSignature";
    readonly validationDetails: "validationDetails";
};
export type TokenValidationRecordScalarFieldEnum = (typeof TokenValidationRecordScalarFieldEnum)[keyof typeof TokenValidationRecordScalarFieldEnum];
export declare const DiscoveredPoolScalarFieldEnum: {
    readonly id: "id";
    readonly address: "address";
    readonly dexType: "dexType";
    readonly tokenA: "tokenA";
    readonly tokenB: "tokenB";
    readonly initialTvl: "initialTvl";
    readonly discoveredAt: "discoveredAt";
    readonly status: "status";
    readonly poolData: "poolData";
};
export type DiscoveredPoolScalarFieldEnum = (typeof DiscoveredPoolScalarFieldEnum)[keyof typeof DiscoveredPoolScalarFieldEnum];
export declare const SortOrder: {
    readonly asc: "asc";
    readonly desc: "desc";
};
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];
export declare const JsonNullValueInput: {
    readonly JsonNull: runtime.JsonNullClass;
};
export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput];
export declare const NullableJsonNullValueInput: {
    readonly DbNull: runtime.DbNullClass;
    readonly JsonNull: runtime.JsonNullClass;
};
export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput];
export declare const QueryMode: {
    readonly default: "default";
    readonly insensitive: "insensitive";
};
export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode];
export declare const NullsOrder: {
    readonly first: "first";
    readonly last: "last";
};
export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder];
export declare const JsonNullValueFilter: {
    readonly DbNull: runtime.DbNullClass;
    readonly JsonNull: runtime.JsonNullClass;
    readonly AnyNull: runtime.AnyNullClass;
};
export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter];
/**
 * Field references
 */
/**
 * Reference to a field of type 'String'
 */
export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>;
/**
 * Reference to a field of type 'String[]'
 */
export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>;
/**
 * Reference to a field of type 'Decimal'
 */
export type DecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal'>;
/**
 * Reference to a field of type 'Decimal[]'
 */
export type ListDecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal[]'>;
/**
 * Reference to a field of type 'DateTime'
 */
export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>;
/**
 * Reference to a field of type 'DateTime[]'
 */
export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>;
/**
 * Reference to a field of type 'Boolean'
 */
export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>;
/**
 * Reference to a field of type 'Json'
 */
export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>;
/**
 * Reference to a field of type 'QueryMode'
 */
export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>;
/**
 * Reference to a field of type 'Int'
 */
export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>;
/**
 * Reference to a field of type 'Int[]'
 */
export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>;
/**
 * Reference to a field of type 'Float'
 */
export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>;
/**
 * Reference to a field of type 'Float[]'
 */
export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>;
/**
 * Batch Payload for updateMany & deleteMany & createMany
 */
export type BatchPayload = {
    count: number;
};
export declare const defineExtension: runtime.Types.Extensions.ExtendsHook<"define", TypeMapCb, runtime.Types.Extensions.DefaultArgs>;
export type DefaultPrismaClient = PrismaClient;
export type ErrorFormat = 'pretty' | 'colorless' | 'minimal';
export type PrismaClientOptions = ({
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-pg`.
     */
    adapter: runtime.SqlDriverAdapterFactory;
    accelerateUrl?: never;
} | {
    /**
     * Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.
     */
    accelerateUrl: string;
    adapter?: never;
}) & {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat;
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     *
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     *
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     *
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[];
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: TransactionIsolationLevel;
    };
    /**
     * Global configuration for omitting model fields by default.
     *
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: GlobalOmitConfig;
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     *
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[];
};
export type GlobalOmitConfig = {
    account?: Prisma.AccountOmit;
    transaction?: Prisma.TransactionOmit;
    position?: Prisma.PositionOmit;
    trade?: Prisma.TradeOmit;
    burnEventRecord?: Prisma.BurnEventRecordOmit;
    liquidityPoolRecord?: Prisma.LiquidityPoolRecordOmit;
    workerStatusRecord?: Prisma.WorkerStatusRecordOmit;
    tradeSettings?: Prisma.TradeSettingsOmit;
    priceRecord?: Prisma.PriceRecordOmit;
    marketRecord?: Prisma.MarketRecordOmit;
    tokenValidationRecord?: Prisma.TokenValidationRecordOmit;
    discoveredPool?: Prisma.DiscoveredPoolOmit;
};
export type LogLevel = 'info' | 'query' | 'warn' | 'error';
export type LogDefinition = {
    level: LogLevel;
    emit: 'stdout' | 'event';
};
export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;
export type GetLogType<T> = CheckIsLogLevel<T extends LogDefinition ? T['level'] : T>;
export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition> ? GetLogType<T[number]> : never;
export type QueryEvent = {
    timestamp: Date;
    query: string;
    params: string;
    duration: number;
    target: string;
};
export type LogEvent = {
    timestamp: Date;
    message: string;
    target: string;
};
export type PrismaAction = 'findUnique' | 'findUniqueOrThrow' | 'findMany' | 'findFirst' | 'findFirstOrThrow' | 'create' | 'createMany' | 'createManyAndReturn' | 'update' | 'updateMany' | 'updateManyAndReturn' | 'upsert' | 'delete' | 'deleteMany' | 'executeRaw' | 'queryRaw' | 'aggregate' | 'count' | 'runCommandRaw' | 'findRaw' | 'groupBy';
/**
 * `PrismaClient` proxy available in interactive transactions.
 */
export type TransactionClient = Omit<DefaultPrismaClient, runtime.ITXClientDenyList>;
//# sourceMappingURL=prismaNamespace.d.ts.map