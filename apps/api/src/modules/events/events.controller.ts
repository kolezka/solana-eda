import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { EventsService } from './events.service';
import type {
  AllEventsResponse,
  BurnEventDto,
  LiquidityEventDto,
  TradeEventDto,
  PositionEventDto,
  PriceEventDto,
} from './events.service';

// Swagger documentation classes (must be classes, not types)
class BurnEventSwagger implements BurnEventDto {
  id!: string;
  txSignature!: string;
  token!: string;
  amount!: string;
  percentage!: number;
  timestamp!: string;
  processed!: boolean;
}

class LiquidityEventSwagger implements LiquidityEventDto {
  id!: string;
  address!: string;
  tokenA!: string;
  tokenB!: string;
  tvl!: string;
  price!: string;
  volume24h!: string;
  updatedAt!: string;
}

class TradeEventSwagger implements TradeEventDto {
  id!: string;
  positionId!: string;
  type!: 'BUY' | 'SELL';
  amount!: string;
  price!: string;
  signature!: string | null;
  slippage!: number;
  timestamp!: string;
  position?: { id: string; token: string; status: string } | null;
}

class PositionEventSwagger implements PositionEventDto {
  id!: string;
  token!: string;
  amount!: string;
  entryPrice!: string;
  currentPrice!: string;
  pnl!: number;
  status!: 'OPEN' | 'CLOSED';
  openedAt!: string;
  closedAt?: string;
  stopLoss?: string;
  takeProfit?: string;
  trades!: Array<{
    id: string;
    type: 'BUY' | 'SELL';
    amount: string;
    price: string;
    timestamp: string;
  }>;
}

class PriceEventSwagger implements PriceEventDto {
  id!: string;
  token!: string;
  price!: string;
  source!: string;
  confidence!: number;
  volume24h?: string;
  timestamp!: string;
}

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('all')
  @ApiOperation({
    summary: 'Get all recent events',
    description:
      'Retrieves a combined list of all recent events including burns, liquidity changes, trades, and position updates.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of events per type (default: 50)',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved all events',
    schema: {
      type: 'object',
      properties: {
        burnEvents: { type: 'array', items: { $ref: '#/components/schemas/BurnEventSwagger' } },
        liquidityEvents: {
          type: 'array',
          items: { $ref: '#/components/schemas/LiquidityEventSwagger' },
        },
        tradeEvents: { type: 'array', items: { $ref: '#/components/schemas/TradeEventSwagger' } },
        positionEvents: {
          type: 'array',
          items: { $ref: '#/components/schemas/PositionEventSwagger' },
        },
      },
    },
  })
  async getAllEvents(@Query('limit') limit: number = 50): Promise<AllEventsResponse> {
    return await this.eventsService.getRecentEvents(limit);
  }

  @Get('burn')
  @ApiOperation({
    summary: 'Get burn events',
    description: 'Retrieves recent token burn events detected by the burn detector worker.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of events (default: 50)',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved burn events',
    type: [BurnEventSwagger],
  })
  async getBurnEvents(@Query('limit') limit: number = 50): Promise<BurnEventDto[]> {
    return await this.eventsService.getBurnEvents(limit);
  }

  @Get('liquidity')
  @ApiOperation({
    summary: 'Get liquidity events',
    description: 'Retrieves recent liquidity pool state changes with significant TVL movements.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of events (default: 50)',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved liquidity events',
    type: [LiquidityEventSwagger],
  })
  async getLiquidityEvents(@Query('limit') limit: number = 50): Promise<LiquidityEventDto[]> {
    return await this.eventsService.getLiquidityEvents(limit);
  }

  @Get('trades')
  @ApiOperation({
    summary: 'Get trade events',
    description: 'Retrieves recent trade executions including both buys and sells.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of events (default: 50)',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved trade events',
    type: [TradeEventSwagger],
  })
  async getTradeEvents(@Query('limit') limit: number = 50): Promise<TradeEventDto[]> {
    return await this.eventsService.getTradeEvents(limit);
  }

  @Get('positions')
  @ApiOperation({
    summary: 'Get position events',
    description: 'Retrieves current and recent trading positions with their status.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of events (default: 50)',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved position events',
    type: [PositionEventSwagger],
  })
  async getPositionEvents(@Query('limit') limit: number = 50): Promise<PositionEventDto[]> {
    return await this.eventsService.getPositionEvents(limit);
  }

  @Get('prices')
  @ApiOperation({
    summary: 'Get price events',
    description: 'Retrieves recent price updates from the price aggregator worker.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of events (default: 100)',
    example: 100,
  })
  @ApiQuery({
    name: 'token',
    required: false,
    type: String,
    description: 'Filter by token mint address',
    example: 'So11111111111111111111111111111111111111112',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved price events',
    type: [PriceEventSwagger],
  })
  async getPriceEvents(
    @Query('limit') limit: number = 100,
    @Query('token') token?: string,
  ): Promise<PriceEventDto[]> {
    return await this.eventsService.getPriceEvents(limit, token);
  }
}
