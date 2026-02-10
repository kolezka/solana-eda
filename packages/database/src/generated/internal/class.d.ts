import * as runtime from '@prisma/client/runtime/client';
import type * as Prisma from './prismaNamespace';
export type LogOptions<ClientOptions extends Prisma.PrismaClientOptions> = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never;
export interface PrismaClientConstructor {
    /**
     * ## Prisma Client
     *
     * Type-safe database client for TypeScript
     * @example
     * ```
     * const prisma = new PrismaClient()
     * // Fetch zero or more Accounts
     * const accounts = await prisma.account.findMany()
     * ```
     *
     * Read more in our [docs](https://pris.ly/d/client).
     */
    new <Options extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions, LogOpts extends LogOptions<Options> = LogOptions<Options>, OmitOpts extends Prisma.PrismaClientOptions['omit'] = Options extends {
        omit: infer U;
    } ? U : Prisma.PrismaClientOptions['omit'], ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs>(options: Prisma.Subset<Options, Prisma.PrismaClientOptions>): PrismaClient<LogOpts, OmitOpts, ExtArgs>;
}
/**
 * ## Prisma Client
 *
 * Type-safe database client for TypeScript
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Accounts
 * const accounts = await prisma.account.findMany()
 * ```
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export interface PrismaClient<in LogOpts extends Prisma.LogLevel = never, in out OmitOpts extends Prisma.PrismaClientOptions['omit'] = undefined, in out ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['other'];
    };
    $on<V extends LogOpts>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;
    /**
     * Connect with the database
     */
    $connect(): runtime.Types.Utils.JsPromise<void>;
    /**
     * Disconnect from the database
     */
    $disconnect(): runtime.Types.Utils.JsPromise<void>;
    /**
     * Executes a prepared raw query and returns the number of affected rows.
     * @example
     * ```
     * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
     * ```
     *
     * Read more in our [docs](https://pris.ly/d/raw-queries).
     */
    $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;
    /**
     * Executes a raw query and returns the number of affected rows.
     * Susceptible to SQL injections, see documentation.
     * @example
     * ```
     * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
     * ```
     *
     * Read more in our [docs](https://pris.ly/d/raw-queries).
     */
    $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;
    /**
     * Performs a prepared raw query and returns the `SELECT` data.
     * @example
     * ```
     * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
     * ```
     *
     * Read more in our [docs](https://pris.ly/d/raw-queries).
     */
    $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;
    /**
     * Performs a raw query and returns the `SELECT` data.
     * Susceptible to SQL injections, see documentation.
     * @example
     * ```
     * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
     * ```
     *
     * Read more in our [docs](https://pris.ly/d/raw-queries).
     */
    $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;
    /**
     * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
     * @example
     * ```
     * const [george, bob, alice] = await prisma.$transaction([
     *   prisma.user.create({ data: { name: 'George' } }),
     *   prisma.user.create({ data: { name: 'Bob' } }),
     *   prisma.user.create({ data: { name: 'Alice' } }),
     * ])
     * ```
     *
     * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
     */
    $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: {
        isolationLevel?: Prisma.TransactionIsolationLevel;
    }): runtime.Types.Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>;
    $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => runtime.Types.Utils.JsPromise<R>, options?: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: Prisma.TransactionIsolationLevel;
    }): runtime.Types.Utils.JsPromise<R>;
    $extends: runtime.Types.Extensions.ExtendsHook<'extends', Prisma.TypeMapCb<OmitOpts>, ExtArgs, runtime.Types.Utils.Call<Prisma.TypeMapCb<OmitOpts>, {
        extArgs: ExtArgs;
    }>>;
    /**
     * `prisma.account`: Exposes CRUD operations for the **Account** model.
     * Example usage:
     * ```ts
     * // Fetch zero or more Accounts
     * const accounts = await prisma.account.findMany()
     * ```
     */
    get account(): Prisma.AccountDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    /**
     * `prisma.transaction`: Exposes CRUD operations for the **Transaction** model.
     * Example usage:
     * ```ts
     * // Fetch zero or more Transactions
     * const transactions = await prisma.transaction.findMany()
     * ```
     */
    get transaction(): Prisma.TransactionDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    /**
     * `prisma.position`: Exposes CRUD operations for the **Position** model.
     * Example usage:
     * ```ts
     * // Fetch zero or more Positions
     * const positions = await prisma.position.findMany()
     * ```
     */
    get position(): Prisma.PositionDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    /**
     * `prisma.trade`: Exposes CRUD operations for the **Trade** model.
     * Example usage:
     * ```ts
     * // Fetch zero or more Trades
     * const trades = await prisma.trade.findMany()
     * ```
     */
    get trade(): Prisma.TradeDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    /**
     * `prisma.burnEventRecord`: Exposes CRUD operations for the **BurnEventRecord** model.
     * Example usage:
     * ```ts
     * // Fetch zero or more BurnEventRecords
     * const burnEventRecords = await prisma.burnEventRecord.findMany()
     * ```
     */
    get burnEventRecord(): Prisma.BurnEventRecordDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    /**
     * `prisma.liquidityPoolRecord`: Exposes CRUD operations for the **LiquidityPoolRecord** model.
     * Example usage:
     * ```ts
     * // Fetch zero or more LiquidityPoolRecords
     * const liquidityPoolRecords = await prisma.liquidityPoolRecord.findMany()
     * ```
     */
    get liquidityPoolRecord(): Prisma.LiquidityPoolRecordDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    /**
     * `prisma.workerStatusRecord`: Exposes CRUD operations for the **WorkerStatusRecord** model.
     * Example usage:
     * ```ts
     * // Fetch zero or more WorkerStatusRecords
     * const workerStatusRecords = await prisma.workerStatusRecord.findMany()
     * ```
     */
    get workerStatusRecord(): Prisma.WorkerStatusRecordDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    /**
     * `prisma.tradeSettings`: Exposes CRUD operations for the **TradeSettings** model.
     * Example usage:
     * ```ts
     * // Fetch zero or more TradeSettings
     * const tradeSettings = await prisma.tradeSettings.findMany()
     * ```
     */
    get tradeSettings(): Prisma.TradeSettingsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    /**
     * `prisma.priceRecord`: Exposes CRUD operations for the **PriceRecord** model.
     * Example usage:
     * ```ts
     * // Fetch zero or more PriceRecords
     * const priceRecords = await prisma.priceRecord.findMany()
     * ```
     */
    get priceRecord(): Prisma.PriceRecordDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    /**
     * `prisma.marketRecord`: Exposes CRUD operations for the **MarketRecord** model.
     * Example usage:
     * ```ts
     * // Fetch zero or more MarketRecords
     * const marketRecords = await prisma.marketRecord.findMany()
     * ```
     */
    get marketRecord(): Prisma.MarketRecordDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    /**
     * `prisma.tokenValidationRecord`: Exposes CRUD operations for the **TokenValidationRecord** model.
     * Example usage:
     * ```ts
     * // Fetch zero or more TokenValidationRecords
     * const tokenValidationRecords = await prisma.tokenValidationRecord.findMany()
     * ```
     */
    get tokenValidationRecord(): Prisma.TokenValidationRecordDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    /**
     * `prisma.discoveredPool`: Exposes CRUD operations for the **DiscoveredPool** model.
     * Example usage:
     * ```ts
     * // Fetch zero or more DiscoveredPools
     * const discoveredPools = await prisma.discoveredPool.findMany()
     * ```
     */
    get discoveredPool(): Prisma.DiscoveredPoolDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
}
export declare function getPrismaClientClass(): PrismaClientConstructor;
//# sourceMappingURL=class.d.ts.map