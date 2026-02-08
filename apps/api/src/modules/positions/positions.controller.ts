import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { PositionsService } from './positions.service';

interface PositionTrade {
  id: string;
  type: 'BUY' | 'SELL';
  amount: string;
  price: string;
  timestamp: string;
}

class Position {
  id!: string;
  token!: string;
  amount!: string;
  entryPrice!: string;
  currentPrice!: string;
  pnl!: string;
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

@ApiTags('positions')
@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all positions',
    description: 'Retrieves all trading positions (currently returns open positions).',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved positions',
    type: [Position],
  })
  async getAllPositions() {
    return await this.positionsService.getOpenPositions();
  }

  @Get('open')
  @ApiOperation({
    summary: 'Get open positions',
    description: 'Retrieves all currently open trading positions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved open positions',
    type: [Position],
  })
  async getOpenPositions() {
    return await this.positionsService.getOpenPositions();
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
    type: [Position],
  })
  async getClosedPositions(@Query('limit') limit: number = 50) {
    return await this.positionsService.getClosedPositions(limit);
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
  async getPortfolioStats() {
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
    type: Position,
  })
  @ApiResponse({
    status: 404,
    description: 'Position not found',
  })
  async getPositionById(@Param('id') id: string) {
    return await this.positionsService.getPositionById(id);
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
    type: [Position],
  })
  async getPositionsByToken(@Param('token') token: string) {
    return await this.positionsService.getPositionsByToken(token);
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
    type: Position,
  })
  async updatePositionPrice(@Param('id') id: string, @Body('currentPrice') currentPrice: number) {
    return await this.positionsService.updatePositionPrice(id, currentPrice);
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
        exitPrice: { type: 'number', example: 155.50 },
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
    type: Position,
  })
  async closePosition(
    @Param('id') id: string,
    @Body() body: { exitPrice: number; reason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'TIMEOUT' }
  ) {
    return await this.positionsService.closePosition(id, body.exitPrice, body.reason);
  }
}
