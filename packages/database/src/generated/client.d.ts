import * as runtime from '@prisma/client/runtime/client';
import * as $Class from './internal/class';
import * as Prisma from './internal/prismaNamespace';
export * as $Enums from './enums';
export * from './enums';
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
export declare const PrismaClient: $Class.PrismaClientConstructor;
export type PrismaClient<LogOpts extends Prisma.LogLevel = never, OmitOpts extends Prisma.PrismaClientOptions['omit'] = Prisma.PrismaClientOptions['omit'], ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = $Class.PrismaClient<LogOpts, OmitOpts, ExtArgs>;
export { Prisma };
/**
 * Model Account
 *
 */
export type Account = Prisma.AccountModel;
/**
 * Model Transaction
 *
 */
export type Transaction = Prisma.TransactionModel;
/**
 * Model Position
 *
 */
export type Position = Prisma.PositionModel;
/**
 * Model Trade
 *
 */
export type Trade = Prisma.TradeModel;
/**
 * Model BurnEventRecord
 *
 */
export type BurnEventRecord = Prisma.BurnEventRecordModel;
/**
 * Model LiquidityPoolRecord
 *
 */
export type LiquidityPoolRecord = Prisma.LiquidityPoolRecordModel;
/**
 * Model WorkerStatusRecord
 *
 */
export type WorkerStatusRecord = Prisma.WorkerStatusRecordModel;
/**
 * Model TradeSettings
 *
 */
export type TradeSettings = Prisma.TradeSettingsModel;
/**
 * Model PriceRecord
 *
 */
export type PriceRecord = Prisma.PriceRecordModel;
/**
 * Model MarketRecord
 *
 */
export type MarketRecord = Prisma.MarketRecordModel;
/**
 * Model TokenValidationRecord
 *
 */
export type TokenValidationRecord = Prisma.TokenValidationRecordModel;
/**
 * Model DiscoveredPool
 *
 */
export type DiscoveredPool = Prisma.DiscoveredPoolModel;
//# sourceMappingURL=client.d.ts.map