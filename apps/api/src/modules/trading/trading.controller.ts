import { Controller, Get, Put, Body, Param, Query, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { TradingService } from './trading.service';

interface TradePosition {
  id: string;
  token: string;
  status: string;
}

class TradeSettings {
  id!: string;
  name!: string;
  enabled!: boolean;
  maxSlippage!: number;
  maxPositions!: number;
  stopLossPercent!: number;
  takeProfitPercent!: number;
  minBurnAmount!: number;
  updatedAt!: string;
}

class Trade {
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

class VolumeStats {
  totalVolume!: number;
  startDate!: string;
  endDate!: string;
  days!: number;
}

@ApiTags('trading')
@Controller('trading')
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Get('settings')
  @ApiOperation({
    summary: 'Get all trading settings',
    description: 'Retrieves all trading configuration settings.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved trading settings',
    type: [TradeSettings],
  })
  async getSettings() {
    return await this.tradingService.getSettings();
  }

  @Get('settings/enabled')
  @ApiOperation({
    summary: 'Get enabled trading settings',
    description: 'Retrieves the currently active trading settings.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved enabled settings',
    type: TradeSettings,
  })
  async getEnabledSettings() {
    return await this.tradingService.getEnabledSettings();
  }

  @Get('settings/:name')
  @ApiOperation({
    summary: 'Get trading settings by name',
    description: 'Retrieves specific trading settings by configuration name.',
  })
  @ApiParam({
    name: 'name',
    description: 'Settings name',
    example: 'default',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved settings',
    type: TradeSettings,
  })
  async getSettingsByName(@Param('name') name: string) {
    return await this.tradingService.getSettingsByName(name);
  }

  @Put('settings/:id')
  @ApiOperation({
    summary: 'Update trading settings',
    description: 'Updates trading configuration settings.',
  })
  @ApiParam({
    name: 'id',
    description: 'Settings ID to update',
    example: 'clm123456789',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', example: true },
        maxSlippage: { type: 'number', example: 0.03 },
        maxPositions: { type: 'number', example: 5 },
        stopLossPercent: { type: 'number', example: 0.10 },
        takeProfitPercent: { type: 'number', example: 0.50 },
        minBurnAmount: { type: 'number', example: 1000000 },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully updated settings',
    type: TradeSettings,
  })
  async updateSettings(@Param('id') id: string, @Body() data: any) {
    return await this.tradingService.updateSettings(id, data);
  }

  @Patch('settings/:id/toggle')
  @ApiOperation({
    summary: 'Toggle trading enabled state',
    description: 'Enables or disables automated trading.',
  })
  @ApiParam({
    name: 'id',
    description: 'Settings ID to toggle',
    example: 'clm123456789',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully toggled trading state',
    type: TradeSettings,
  })
  async toggleEnabled(@Param('id') id: string) {
    return await this.tradingService.toggleEnabled(id);
  }

  @Get('trades')
  @ApiOperation({
    summary: 'Get recent trades',
    description: 'Retrieves recent trade executions.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of trades to return (default: 50)',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved trades',
    type: [Trade],
  })
  async getTrades(@Query('limit') limit: number = 50) {
    return await this.tradingService.getTrades(limit);
  }

  @Get('trades/buy')
  @ApiOperation({
    summary: 'Get recent buy trades',
    description: 'Retrieves recent buy trade executions.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of trades to return (default: 50)',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved buy trades',
    type: [Trade],
  })
  async getBuyTrades(@Query('limit') limit: number = 50) {
    return await this.tradingService.getBuyTrades(limit);
  }

  @Get('trades/sell')
  @ApiOperation({
    summary: 'Get recent sell trades',
    description: 'Retrieves recent sell trade executions.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of trades to return (default: 50)',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved sell trades',
    type: [Trade],
  })
  async getSellTrades(@Query('limit') limit: number = 50) {
    return await this.tradingService.getSellTrades(limit);
  }

  @Get('stats/volume')
  @ApiOperation({
    summary: 'Get trading volume statistics',
    description: 'Calculates total trading volume for a specified time period.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to calculate volume for (default: 7)',
    example: 7,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved volume statistics',
    type: VolumeStats,
  })
  async getVolumeStats(@Query('days') days: number = 7) {
    return await this.tradingService.getVolumeStats(days);
  }
}
