import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { EventsService } from './events.service';

/**
 * Event response schemas for documentation
 */

interface TradePosition {
  id: string;
  token: string;
  status: string;
}

interface TradeItem {
  id: string;
  type: 'BUY' | 'SELL';
  amount: string;
  price: string;
  timestamp: string;
}

class BurnEvent {
  id!: string;
  txSignature!: string;
  token!: string;
  amount!: string;
  percentage!: number;
  timestamp!: string;
  processed!: boolean;
}

class LiquidityEvent {
  id!: string;
  address!: string;
  tokenA!: string;
  tokenB!: string;
  tvl!: string;
  price!: string;
  volume24h!: string;
  updatedAt!: string;
}

class TradeEvent {
  id!: string;
  positionId!: string;
  type!: 'BUY' | 'SELL';
  amount!: string;
  price!: string;
  signature!: string;
  slippage!: number;
  timestamp!: string;
  position?: TradePosition;
}

class PositionEvent {
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
  trades!: TradeItem[];
}

class PriceEvent {
  id!: string;
  token!: string;
  price!: string;
  source!: string;
  confidence!: number;
  volume24h?: string;
  timestamp!: string;
}

class AllEventsResponse {
  burnEvents!: BurnEvent[];
  liquidityEvents!: LiquidityEvent[];
  tradeEvents!: TradeEvent[];
  positionEvents!: PositionEvent[];
}

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
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
    type: AllEventsResponse,
  })
  async getAllEvents(@Query('limit') limit: number = 50) {
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
    type: [BurnEvent],
  })
  async getBurnEvents(@Query('limit') limit: number = 50) {
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
    type: [LiquidityEvent],
  })
  async getLiquidityEvents(@Query('limit') limit: number = 50) {
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
    type: [TradeEvent],
  })
  async getTradeEvents(@Query('limit') limit: number = 50) {
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
    type: [PositionEvent],
  })
  async getPositionEvents(@Query('limit') limit: number = 50) {
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
    type: [PriceEvent],
  })
  async getPriceEvents(@Query('limit') limit: number = 100, @Query('token') token?: string) {
    return await this.eventsService.getPriceEvents(limit, token);
  }
}
