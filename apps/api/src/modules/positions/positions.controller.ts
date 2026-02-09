import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { PositionsService } from './positions.service';
import type { PositionWithTrades, Position } from '@solana-eda/database';

interface PositionTrade {
  id: string;
  type: 'BUY' | 'SELL';
  amount: string;
  price: string;
  timestamp: string;
}

class PositionDto {
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
  trades!: PositionTrade[];
}

class PortfolioStats {
  totalPositions!: number;
  openPositions!: number;
  closedPositions!: number;
  totalPnL!: number;
  totalValue!: string;
  winRate!: number;
}

function mapPositionToDto(position: PositionWithTrades): PositionDto {
  return {
    id: position.id,
    token: position.token,
    amount: position.amount.toString(),
    entryPrice: position.entryPrice.toString(),
    currentPrice: position.currentPrice.toString(),
    pnl: Number(position.pnl ?? 0),
    status: position.status,
    openedAt: position.openedAt.toISOString(),
    closedAt: position.closedAt?.toISOString(),
    stopLoss: position.stopLoss?.toString(),
    takeProfit: position.takeProfit?.toString(),
    trades: position.trades.map((trade) => ({
      id: trade.id,
      type: trade.type,
      amount: trade.amount.toString(),
      price: trade.price.toString(),
      timestamp: trade.timestamp.toISOString(),
    })),
  };
}

@ApiTags('positions')
@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get('all')
  @ApiOperation({
    summary: 'Get all positions',
    description: 'Retrieves all trading positions (currently returns open positions).',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved positions',
    type: [PositionDto],
  })
  async getAllPositions(): Promise<PositionDto[]> {
    const positions = await this.positionsService.getOpenPositions();
    return positions.map(mapPositionToDto);
  }

  @Get('open')
  @ApiOperation({
    summary: 'Get open positions',
    description: 'Retrieves all currently open trading positions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved open positions',
    type: [PositionDto],
  })
  async getOpenPositions(): Promise<PositionDto[]> {
    const positions = await this.positionsService.getOpenPositions();
    return positions.map(mapPositionToDto);
  }

  @Get('closed')
  @ApiOperation({
    summary: 'Get closed positions',
    description: 'Retrieves recently closed trading positions.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of closed positions to return (default: 50)',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved closed positions',
    type: [PositionDto],
  })
  async getClosedPositions(@Query('limit') limit: number = 50): Promise<PositionDto[]> {
    const positions = await this.positionsService.getClosedPositions(limit);
    return positions.map(mapPositionToDto);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get portfolio statistics',
    description: 'Retrieves overall portfolio performance statistics.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved portfolio stats',
    type: PortfolioStats,
  })
  async getPortfolioStats(): Promise<{
    totalPositions: number;
    totalValue: number;
    totalPnl: number;
    avgPnl: number;
    winningPositions: number;
    losingPositions: number;
  }> {
    return await this.positionsService.getPortfolioStats();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get position by ID',
    description: 'Retrieves detailed information for a specific position.',
  })
  @ApiParam({
    name: 'id',
    description: 'Position ID',
    example: 'clm123456789',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved position',
    type: PositionDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Position not found',
  })
  async getPositionById(@Param('id') id: string): Promise<PositionDto | null> {
    const position = await this.positionsService.getPositionById(id);
    return position ? mapPositionToDto(position) : null;
  }

  @Get('token/:token')
  @ApiOperation({
    summary: 'Get positions by token',
    description: 'Retrieves all positions for a specific token.',
  })
  @ApiParam({
    name: 'token',
    description: 'Token mint address',
    example: 'So11111111111111111111111111111111111111112',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved token positions',
    type: [PositionDto],
  })
  async getPositionsByToken(@Param('token') token: string): Promise<PositionDto[]> {
    const positions = await this.positionsService.getPositionsByToken(token);
    return positions.map(mapPositionToDto);
  }

  @Put(':id/price')
  @ApiOperation({
    summary: 'Update position price',
    description: 'Updates the current price of a position, recalculating P&L.',
  })
  @ApiParam({
    name: 'id',
    description: 'Position ID',
    example: 'clm123456789',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['currentPrice'],
      properties: {
        currentPrice: { type: 'number', example: 150.25 },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully updated position price',
    type: PositionDto,
  })
  async updatePositionPrice(
    @Param('id') id: string,
    @Body('currentPrice') currentPrice: number,
  ): Promise<PositionDto | null> {
    const position = await this.positionsService.updatePositionPrice(id, currentPrice);
    if (!position) return null;
    return mapPositionToDto(position as PositionWithTrades);
  }

  @Post(':id/close')
  @ApiOperation({
    summary: 'Close position',
    description: 'Manually closes an open position at the specified price.',
  })
  @ApiParam({
    name: 'id',
    description: 'Position ID to close',
    example: 'clm123456789',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['exitPrice', 'reason'],
      properties: {
        exitPrice: { type: 'number', example: 155.5 },
        reason: {
          type: 'string',
          enum: ['TAKE_PROFIT', 'STOP_LOSS', 'MANUAL', 'TIMEOUT'],
          example: 'MANUAL',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully closed position',
    type: PositionDto,
  })
  async closePosition(
    @Param('id') id: string,
    @Body() body: { exitPrice: number; reason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'TIMEOUT' },
  ): Promise<PositionDto> {
    const position = await this.positionsService.closePosition(id, body.exitPrice, body.reason);
    return mapPositionToDto(position);
  }
}
