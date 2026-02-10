import type * as runtime from '@prisma/client/runtime/client';
import type * as Prisma from '../internal/prismaNamespace';
/**
 * Model TradeSettings
 *
 */
export type TradeSettingsModel = runtime.Types.Result.DefaultSelection<Prisma.$TradeSettingsPayload>;
export type AggregateTradeSettings = {
    _count: TradeSettingsCountAggregateOutputType | null;
    _avg: TradeSettingsAvgAggregateOutputType | null;
    _sum: TradeSettingsSumAggregateOutputType | null;
    _min: TradeSettingsMinAggregateOutputType | null;
    _max: TradeSettingsMaxAggregateOutputType | null;
};
export type TradeSettingsAvgAggregateOutputType = {
    maxSlippage: runtime.Decimal | null;
    maxPositions: number | null;
    stopLossPercent: runtime.Decimal | null;
    takeProfitPercent: runtime.Decimal | null;
    minBurnAmount: runtime.Decimal | null;
};
export type TradeSettingsSumAggregateOutputType = {
    maxSlippage: runtime.Decimal | null;
    maxPositions: number | null;
    stopLossPercent: runtime.Decimal | null;
    takeProfitPercent: runtime.Decimal | null;
    minBurnAmount: runtime.Decimal | null;
};
export type TradeSettingsMinAggregateOutputType = {
    id: string | null;
    name: string | null;
    enabled: boolean | null;
    maxSlippage: runtime.Decimal | null;
    maxPositions: number | null;
    stopLossPercent: runtime.Decimal | null;
    takeProfitPercent: runtime.Decimal | null;
    minBurnAmount: runtime.Decimal | null;
    updatedAt: Date | null;
};
export type TradeSettingsMaxAggregateOutputType = {
    id: string | null;
    name: string | null;
    enabled: boolean | null;
    maxSlippage: runtime.Decimal | null;
    maxPositions: number | null;
    stopLossPercent: runtime.Decimal | null;
    takeProfitPercent: runtime.Decimal | null;
    minBurnAmount: runtime.Decimal | null;
    updatedAt: Date | null;
};
export type TradeSettingsCountAggregateOutputType = {
    id: number;
    name: number;
    enabled: number;
    maxSlippage: number;
    maxPositions: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    minBurnAmount: number;
    updatedAt: number;
    _all: number;
};
export type TradeSettingsAvgAggregateInputType = {
    maxSlippage?: true;
    maxPositions?: true;
    stopLossPercent?: true;
    takeProfitPercent?: true;
    minBurnAmount?: true;
};
export type TradeSettingsSumAggregateInputType = {
    maxSlippage?: true;
    maxPositions?: true;
    stopLossPercent?: true;
    takeProfitPercent?: true;
    minBurnAmount?: true;
};
export type TradeSettingsMinAggregateInputType = {
    id?: true;
    name?: true;
    enabled?: true;
    maxSlippage?: true;
    maxPositions?: true;
    stopLossPercent?: true;
    takeProfitPercent?: true;
    minBurnAmount?: true;
    updatedAt?: true;
};
export type TradeSettingsMaxAggregateInputType = {
    id?: true;
    name?: true;
    enabled?: true;
    maxSlippage?: true;
    maxPositions?: true;
    stopLossPercent?: true;
    takeProfitPercent?: true;
    minBurnAmount?: true;
    updatedAt?: true;
};
export type TradeSettingsCountAggregateInputType = {
    id?: true;
    name?: true;
    enabled?: true;
    maxSlippage?: true;
    maxPositions?: true;
    stopLossPercent?: true;
    takeProfitPercent?: true;
    minBurnAmount?: true;
    updatedAt?: true;
    _all?: true;
};
export type TradeSettingsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Filter which TradeSettings to aggregate.
     */
    where?: Prisma.TradeSettingsWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of TradeSettings to fetch.
     */
    orderBy?: Prisma.TradeSettingsOrderByWithRelationInput | Prisma.TradeSettingsOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: Prisma.TradeSettingsWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` TradeSettings from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` TradeSettings.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned TradeSettings
     **/
    _count?: true | TradeSettingsCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: TradeSettingsAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: TradeSettingsSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: TradeSettingsMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: TradeSettingsMaxAggregateInputType;
};
export type GetTradeSettingsAggregateType<T extends TradeSettingsAggregateArgs> = {
    [P in keyof T & keyof AggregateTradeSettings]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateTradeSettings[P]> : Prisma.GetScalarType<T[P], AggregateTradeSettings[P]>;
};
export type TradeSettingsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.TradeSettingsWhereInput;
    orderBy?: Prisma.TradeSettingsOrderByWithAggregationInput | Prisma.TradeSettingsOrderByWithAggregationInput[];
    by: Prisma.TradeSettingsScalarFieldEnum[] | Prisma.TradeSettingsScalarFieldEnum;
    having?: Prisma.TradeSettingsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: TradeSettingsCountAggregateInputType | true;
    _avg?: TradeSettingsAvgAggregateInputType;
    _sum?: TradeSettingsSumAggregateInputType;
    _min?: TradeSettingsMinAggregateInputType;
    _max?: TradeSettingsMaxAggregateInputType;
};
export type TradeSettingsGroupByOutputType = {
    id: string;
    name: string;
    enabled: boolean;
    maxSlippage: runtime.Decimal;
    maxPositions: number;
    stopLossPercent: runtime.Decimal;
    takeProfitPercent: runtime.Decimal;
    minBurnAmount: runtime.Decimal;
    updatedAt: Date;
    _count: TradeSettingsCountAggregateOutputType | null;
    _avg: TradeSettingsAvgAggregateOutputType | null;
    _sum: TradeSettingsSumAggregateOutputType | null;
    _min: TradeSettingsMinAggregateOutputType | null;
    _max: TradeSettingsMaxAggregateOutputType | null;
};
type GetTradeSettingsGroupByPayload<T extends TradeSettingsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<TradeSettingsGroupByOutputType, T['by']> & {
    [P in keyof T & keyof TradeSettingsGroupByOutputType]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], TradeSettingsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], TradeSettingsGroupByOutputType[P]>;
}>>;
export type TradeSettingsWhereInput = {
    AND?: Prisma.TradeSettingsWhereInput | Prisma.TradeSettingsWhereInput[];
    OR?: Prisma.TradeSettingsWhereInput[];
    NOT?: Prisma.TradeSettingsWhereInput | Prisma.TradeSettingsWhereInput[];
    id?: Prisma.StringFilter<'TradeSettings'> | string;
    name?: Prisma.StringFilter<'TradeSettings'> | string;
    enabled?: Prisma.BoolFilter<'TradeSettings'> | boolean;
    maxSlippage?: Prisma.DecimalFilter<'TradeSettings'> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    maxPositions?: Prisma.IntFilter<'TradeSettings'> | number;
    stopLossPercent?: Prisma.DecimalFilter<'TradeSettings'> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    takeProfitPercent?: Prisma.DecimalFilter<'TradeSettings'> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    minBurnAmount?: Prisma.DecimalFilter<'TradeSettings'> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    updatedAt?: Prisma.DateTimeFilter<'TradeSettings'> | Date | string;
};
export type TradeSettingsOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    enabled?: Prisma.SortOrder;
    maxSlippage?: Prisma.SortOrder;
    maxPositions?: Prisma.SortOrder;
    stopLossPercent?: Prisma.SortOrder;
    takeProfitPercent?: Prisma.SortOrder;
    minBurnAmount?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type TradeSettingsWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    name?: string;
    AND?: Prisma.TradeSettingsWhereInput | Prisma.TradeSettingsWhereInput[];
    OR?: Prisma.TradeSettingsWhereInput[];
    NOT?: Prisma.TradeSettingsWhereInput | Prisma.TradeSettingsWhereInput[];
    enabled?: Prisma.BoolFilter<'TradeSettings'> | boolean;
    maxSlippage?: Prisma.DecimalFilter<'TradeSettings'> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    maxPositions?: Prisma.IntFilter<'TradeSettings'> | number;
    stopLossPercent?: Prisma.DecimalFilter<'TradeSettings'> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    takeProfitPercent?: Prisma.DecimalFilter<'TradeSettings'> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    minBurnAmount?: Prisma.DecimalFilter<'TradeSettings'> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    updatedAt?: Prisma.DateTimeFilter<'TradeSettings'> | Date | string;
}, 'id' | 'name'>;
export type TradeSettingsOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    enabled?: Prisma.SortOrder;
    maxSlippage?: Prisma.SortOrder;
    maxPositions?: Prisma.SortOrder;
    stopLossPercent?: Prisma.SortOrder;
    takeProfitPercent?: Prisma.SortOrder;
    minBurnAmount?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    _count?: Prisma.TradeSettingsCountOrderByAggregateInput;
    _avg?: Prisma.TradeSettingsAvgOrderByAggregateInput;
    _max?: Prisma.TradeSettingsMaxOrderByAggregateInput;
    _min?: Prisma.TradeSettingsMinOrderByAggregateInput;
    _sum?: Prisma.TradeSettingsSumOrderByAggregateInput;
};
export type TradeSettingsScalarWhereWithAggregatesInput = {
    AND?: Prisma.TradeSettingsScalarWhereWithAggregatesInput | Prisma.TradeSettingsScalarWhereWithAggregatesInput[];
    OR?: Prisma.TradeSettingsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.TradeSettingsScalarWhereWithAggregatesInput | Prisma.TradeSettingsScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<'TradeSettings'> | string;
    name?: Prisma.StringWithAggregatesFilter<'TradeSettings'> | string;
    enabled?: Prisma.BoolWithAggregatesFilter<'TradeSettings'> | boolean;
    maxSlippage?: Prisma.DecimalWithAggregatesFilter<'TradeSettings'> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    maxPositions?: Prisma.IntWithAggregatesFilter<'TradeSettings'> | number;
    stopLossPercent?: Prisma.DecimalWithAggregatesFilter<'TradeSettings'> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    takeProfitPercent?: Prisma.DecimalWithAggregatesFilter<'TradeSettings'> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    minBurnAmount?: Prisma.DecimalWithAggregatesFilter<'TradeSettings'> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    updatedAt?: Prisma.DateTimeWithAggregatesFilter<'TradeSettings'> | Date | string;
};
export type TradeSettingsCreateInput = {
    id?: string;
    name: string;
    enabled?: boolean;
    maxSlippage?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    maxPositions?: number;
    stopLossPercent?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    takeProfitPercent?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    minBurnAmount?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    updatedAt?: Date | string;
};
export type TradeSettingsUncheckedCreateInput = {
    id?: string;
    name: string;
    enabled?: boolean;
    maxSlippage?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    maxPositions?: number;
    stopLossPercent?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    takeProfitPercent?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    minBurnAmount?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    updatedAt?: Date | string;
};
export type TradeSettingsUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    enabled?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    maxSlippage?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    maxPositions?: Prisma.IntFieldUpdateOperationsInput | number;
    stopLossPercent?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    takeProfitPercent?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    minBurnAmount?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type TradeSettingsUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    enabled?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    maxSlippage?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    maxPositions?: Prisma.IntFieldUpdateOperationsInput | number;
    stopLossPercent?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    takeProfitPercent?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    minBurnAmount?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type TradeSettingsCreateManyInput = {
    id?: string;
    name: string;
    enabled?: boolean;
    maxSlippage?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    maxPositions?: number;
    stopLossPercent?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    takeProfitPercent?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    minBurnAmount?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    updatedAt?: Date | string;
};
export type TradeSettingsUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    enabled?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    maxSlippage?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    maxPositions?: Prisma.IntFieldUpdateOperationsInput | number;
    stopLossPercent?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    takeProfitPercent?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    minBurnAmount?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type TradeSettingsUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    enabled?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    maxSlippage?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    maxPositions?: Prisma.IntFieldUpdateOperationsInput | number;
    stopLossPercent?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    takeProfitPercent?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    minBurnAmount?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type TradeSettingsCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    enabled?: Prisma.SortOrder;
    maxSlippage?: Prisma.SortOrder;
    maxPositions?: Prisma.SortOrder;
    stopLossPercent?: Prisma.SortOrder;
    takeProfitPercent?: Prisma.SortOrder;
    minBurnAmount?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type TradeSettingsAvgOrderByAggregateInput = {
    maxSlippage?: Prisma.SortOrder;
    maxPositions?: Prisma.SortOrder;
    stopLossPercent?: Prisma.SortOrder;
    takeProfitPercent?: Prisma.SortOrder;
    minBurnAmount?: Prisma.SortOrder;
};
export type TradeSettingsMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    enabled?: Prisma.SortOrder;
    maxSlippage?: Prisma.SortOrder;
    maxPositions?: Prisma.SortOrder;
    stopLossPercent?: Prisma.SortOrder;
    takeProfitPercent?: Prisma.SortOrder;
    minBurnAmount?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type TradeSettingsMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    enabled?: Prisma.SortOrder;
    maxSlippage?: Prisma.SortOrder;
    maxPositions?: Prisma.SortOrder;
    stopLossPercent?: Prisma.SortOrder;
    takeProfitPercent?: Prisma.SortOrder;
    minBurnAmount?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type TradeSettingsSumOrderByAggregateInput = {
    maxSlippage?: Prisma.SortOrder;
    maxPositions?: Prisma.SortOrder;
    stopLossPercent?: Prisma.SortOrder;
    takeProfitPercent?: Prisma.SortOrder;
    minBurnAmount?: Prisma.SortOrder;
};
export type IntFieldUpdateOperationsInput = {
    set?: number;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
};
export type TradeSettingsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    name?: boolean;
    enabled?: boolean;
    maxSlippage?: boolean;
    maxPositions?: boolean;
    stopLossPercent?: boolean;
    takeProfitPercent?: boolean;
    minBurnAmount?: boolean;
    updatedAt?: boolean;
}, ExtArgs['result']['tradeSettings']>;
export type TradeSettingsSelectCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    name?: boolean;
    enabled?: boolean;
    maxSlippage?: boolean;
    maxPositions?: boolean;
    stopLossPercent?: boolean;
    takeProfitPercent?: boolean;
    minBurnAmount?: boolean;
    updatedAt?: boolean;
}, ExtArgs['result']['tradeSettings']>;
export type TradeSettingsSelectUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    name?: boolean;
    enabled?: boolean;
    maxSlippage?: boolean;
    maxPositions?: boolean;
    stopLossPercent?: boolean;
    takeProfitPercent?: boolean;
    minBurnAmount?: boolean;
    updatedAt?: boolean;
}, ExtArgs['result']['tradeSettings']>;
export type TradeSettingsSelectScalar = {
    id?: boolean;
    name?: boolean;
    enabled?: boolean;
    maxSlippage?: boolean;
    maxPositions?: boolean;
    stopLossPercent?: boolean;
    takeProfitPercent?: boolean;
    minBurnAmount?: boolean;
    updatedAt?: boolean;
};
export type TradeSettingsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<'id' | 'name' | 'enabled' | 'maxSlippage' | 'maxPositions' | 'stopLossPercent' | 'takeProfitPercent' | 'minBurnAmount' | 'updatedAt', ExtArgs['result']['tradeSettings']>;
export type $TradeSettingsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: 'TradeSettings';
    objects: {};
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        name: string;
        enabled: boolean;
        maxSlippage: runtime.Decimal;
        maxPositions: number;
        stopLossPercent: runtime.Decimal;
        takeProfitPercent: runtime.Decimal;
        minBurnAmount: runtime.Decimal;
        updatedAt: Date;
    }, ExtArgs['result']['tradeSettings']>;
    composites: {};
};
export type TradeSettingsGetPayload<S extends boolean | null | undefined | TradeSettingsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$TradeSettingsPayload, S>;
export type TradeSettingsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<TradeSettingsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: TradeSettingsCountAggregateInputType | true;
};
export interface TradeSettingsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['TradeSettings'];
        meta: {
            name: 'TradeSettings';
        };
    };
    /**
     * Find zero or one TradeSettings that matches the filter.
     * @param {TradeSettingsFindUniqueArgs} args - Arguments to find a TradeSettings
     * @example
     * // Get one TradeSettings
     * const tradeSettings = await prisma.tradeSettings.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TradeSettingsFindUniqueArgs>(args: Prisma.SelectSubset<T, TradeSettingsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__TradeSettingsClient<runtime.Types.Result.GetResult<Prisma.$TradeSettingsPayload<ExtArgs>, T, 'findUnique', GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    /**
     * Find one TradeSettings that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TradeSettingsFindUniqueOrThrowArgs} args - Arguments to find a TradeSettings
     * @example
     * // Get one TradeSettings
     * const tradeSettings = await prisma.tradeSettings.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TradeSettingsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, TradeSettingsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__TradeSettingsClient<runtime.Types.Result.GetResult<Prisma.$TradeSettingsPayload<ExtArgs>, T, 'findUniqueOrThrow', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Find the first TradeSettings that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TradeSettingsFindFirstArgs} args - Arguments to find a TradeSettings
     * @example
     * // Get one TradeSettings
     * const tradeSettings = await prisma.tradeSettings.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TradeSettingsFindFirstArgs>(args?: Prisma.SelectSubset<T, TradeSettingsFindFirstArgs<ExtArgs>>): Prisma.Prisma__TradeSettingsClient<runtime.Types.Result.GetResult<Prisma.$TradeSettingsPayload<ExtArgs>, T, 'findFirst', GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    /**
     * Find the first TradeSettings that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TradeSettingsFindFirstOrThrowArgs} args - Arguments to find a TradeSettings
     * @example
     * // Get one TradeSettings
     * const tradeSettings = await prisma.tradeSettings.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TradeSettingsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, TradeSettingsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__TradeSettingsClient<runtime.Types.Result.GetResult<Prisma.$TradeSettingsPayload<ExtArgs>, T, 'findFirstOrThrow', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Find zero or more TradeSettings that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TradeSettingsFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TradeSettings
     * const tradeSettings = await prisma.tradeSettings.findMany()
     *
     * // Get first 10 TradeSettings
     * const tradeSettings = await prisma.tradeSettings.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const tradeSettingsWithIdOnly = await prisma.tradeSettings.findMany({ select: { id: true } })
     *
     */
    findMany<T extends TradeSettingsFindManyArgs>(args?: Prisma.SelectSubset<T, TradeSettingsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$TradeSettingsPayload<ExtArgs>, T, 'findMany', GlobalOmitOptions>>;
    /**
     * Create a TradeSettings.
     * @param {TradeSettingsCreateArgs} args - Arguments to create a TradeSettings.
     * @example
     * // Create one TradeSettings
     * const TradeSettings = await prisma.tradeSettings.create({
     *   data: {
     *     // ... data to create a TradeSettings
     *   }
     * })
     *
     */
    create<T extends TradeSettingsCreateArgs>(args: Prisma.SelectSubset<T, TradeSettingsCreateArgs<ExtArgs>>): Prisma.Prisma__TradeSettingsClient<runtime.Types.Result.GetResult<Prisma.$TradeSettingsPayload<ExtArgs>, T, 'create', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Create many TradeSettings.
     * @param {TradeSettingsCreateManyArgs} args - Arguments to create many TradeSettings.
     * @example
     * // Create many TradeSettings
     * const tradeSettings = await prisma.tradeSettings.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends TradeSettingsCreateManyArgs>(args?: Prisma.SelectSubset<T, TradeSettingsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Create many TradeSettings and returns the data saved in the database.
     * @param {TradeSettingsCreateManyAndReturnArgs} args - Arguments to create many TradeSettings.
     * @example
     * // Create many TradeSettings
     * const tradeSettings = await prisma.tradeSettings.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many TradeSettings and only return the `id`
     * const tradeSettingsWithIdOnly = await prisma.tradeSettings.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends TradeSettingsCreateManyAndReturnArgs>(args?: Prisma.SelectSubset<T, TradeSettingsCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$TradeSettingsPayload<ExtArgs>, T, 'createManyAndReturn', GlobalOmitOptions>>;
    /**
     * Delete a TradeSettings.
     * @param {TradeSettingsDeleteArgs} args - Arguments to delete one TradeSettings.
     * @example
     * // Delete one TradeSettings
     * const TradeSettings = await prisma.tradeSettings.delete({
     *   where: {
     *     // ... filter to delete one TradeSettings
     *   }
     * })
     *
     */
    delete<T extends TradeSettingsDeleteArgs>(args: Prisma.SelectSubset<T, TradeSettingsDeleteArgs<ExtArgs>>): Prisma.Prisma__TradeSettingsClient<runtime.Types.Result.GetResult<Prisma.$TradeSettingsPayload<ExtArgs>, T, 'delete', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Update one TradeSettings.
     * @param {TradeSettingsUpdateArgs} args - Arguments to update one TradeSettings.
     * @example
     * // Update one TradeSettings
     * const tradeSettings = await prisma.tradeSettings.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends TradeSettingsUpdateArgs>(args: Prisma.SelectSubset<T, TradeSettingsUpdateArgs<ExtArgs>>): Prisma.Prisma__TradeSettingsClient<runtime.Types.Result.GetResult<Prisma.$TradeSettingsPayload<ExtArgs>, T, 'update', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Delete zero or more TradeSettings.
     * @param {TradeSettingsDeleteManyArgs} args - Arguments to filter TradeSettings to delete.
     * @example
     * // Delete a few TradeSettings
     * const { count } = await prisma.tradeSettings.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends TradeSettingsDeleteManyArgs>(args?: Prisma.SelectSubset<T, TradeSettingsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Update zero or more TradeSettings.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TradeSettingsUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TradeSettings
     * const tradeSettings = await prisma.tradeSettings.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends TradeSettingsUpdateManyArgs>(args: Prisma.SelectSubset<T, TradeSettingsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Update zero or more TradeSettings and returns the data updated in the database.
     * @param {TradeSettingsUpdateManyAndReturnArgs} args - Arguments to update many TradeSettings.
     * @example
     * // Update many TradeSettings
     * const tradeSettings = await prisma.tradeSettings.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more TradeSettings and only return the `id`
     * const tradeSettingsWithIdOnly = await prisma.tradeSettings.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends TradeSettingsUpdateManyAndReturnArgs>(args: Prisma.SelectSubset<T, TradeSettingsUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$TradeSettingsPayload<ExtArgs>, T, 'updateManyAndReturn', GlobalOmitOptions>>;
    /**
     * Create or update one TradeSettings.
     * @param {TradeSettingsUpsertArgs} args - Arguments to update or create a TradeSettings.
     * @example
     * // Update or create a TradeSettings
     * const tradeSettings = await prisma.tradeSettings.upsert({
     *   create: {
     *     // ... data to create a TradeSettings
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TradeSettings we want to update
     *   }
     * })
     */
    upsert<T extends TradeSettingsUpsertArgs>(args: Prisma.SelectSubset<T, TradeSettingsUpsertArgs<ExtArgs>>): Prisma.Prisma__TradeSettingsClient<runtime.Types.Result.GetResult<Prisma.$TradeSettingsPayload<ExtArgs>, T, 'upsert', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Count the number of TradeSettings.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TradeSettingsCountArgs} args - Arguments to filter TradeSettings to count.
     * @example
     * // Count the number of TradeSettings
     * const count = await prisma.tradeSettings.count({
     *   where: {
     *     // ... the filter for the TradeSettings we want to count
     *   }
     * })
     **/
    count<T extends TradeSettingsCountArgs>(args?: Prisma.Subset<T, TradeSettingsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], TradeSettingsCountAggregateOutputType> : number>;
    /**
     * Allows you to perform aggregations operations on a TradeSettings.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TradeSettingsAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends TradeSettingsAggregateArgs>(args: Prisma.Subset<T, TradeSettingsAggregateArgs>): Prisma.PrismaPromise<GetTradeSettingsAggregateType<T>>;
    /**
     * Group by TradeSettings.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TradeSettingsGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<T extends TradeSettingsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: TradeSettingsGroupByArgs['orderBy'];
    } : {
        orderBy?: TradeSettingsGroupByArgs['orderBy'];
    }, OrderFields extends Prisma.ExcludeUnderscoreKeys<Prisma.Keys<Prisma.MaybeTupleToUnion<T['orderBy']>>>, ByFields extends Prisma.MaybeTupleToUnion<T['by']>, ByValid extends Prisma.Has<ByFields, OrderFields>, HavingFields extends Prisma.GetHavingFields<T['having']>, HavingValid extends Prisma.Has<ByFields, HavingFields>, ByEmpty extends T['by'] extends never[] ? Prisma.True : Prisma.False, InputErrors extends ByEmpty extends Prisma.True ? `Error: "by" must not be empty.` : HavingValid extends Prisma.False ? {
        [P in HavingFields]: P extends ByFields ? never : P extends string ? `Error: Field "${P}" used in "having" needs to be provided in "by".` : [Error, 'Field ', P, ` in "having" needs to be provided in "by"`];
    }[HavingFields] : 'take' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "take", you also need to provide "orderBy"' : 'skip' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "skip", you also need to provide "orderBy"' : ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, TradeSettingsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTradeSettingsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the TradeSettings model
     */
    readonly fields: TradeSettingsFieldRefs;
}
/**
 * The delegate class that acts as a "Promise-like" for TradeSettings.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export interface Prisma__TradeSettingsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
/**
 * Fields of the TradeSettings model
 */
export interface TradeSettingsFieldRefs {
    readonly id: Prisma.FieldRef<'TradeSettings', 'String'>;
    readonly name: Prisma.FieldRef<'TradeSettings', 'String'>;
    readonly enabled: Prisma.FieldRef<'TradeSettings', 'Boolean'>;
    readonly maxSlippage: Prisma.FieldRef<'TradeSettings', 'Decimal'>;
    readonly maxPositions: Prisma.FieldRef<'TradeSettings', 'Int'>;
    readonly stopLossPercent: Prisma.FieldRef<'TradeSettings', 'Decimal'>;
    readonly takeProfitPercent: Prisma.FieldRef<'TradeSettings', 'Decimal'>;
    readonly minBurnAmount: Prisma.FieldRef<'TradeSettings', 'Decimal'>;
    readonly updatedAt: Prisma.FieldRef<'TradeSettings', 'DateTime'>;
}
/**
 * TradeSettings findUnique
 */
export type TradeSettingsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeSettings
     */
    select?: Prisma.TradeSettingsSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the TradeSettings
     */
    omit?: Prisma.TradeSettingsOmit<ExtArgs> | null;
    /**
     * Filter, which TradeSettings to fetch.
     */
    where: Prisma.TradeSettingsWhereUniqueInput;
};
/**
 * TradeSettings findUniqueOrThrow
 */
export type TradeSettingsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeSettings
     */
    select?: Prisma.TradeSettingsSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the TradeSettings
     */
    omit?: Prisma.TradeSettingsOmit<ExtArgs> | null;
    /**
     * Filter, which TradeSettings to fetch.
     */
    where: Prisma.TradeSettingsWhereUniqueInput;
};
/**
 * TradeSettings findFirst
 */
export type TradeSettingsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeSettings
     */
    select?: Prisma.TradeSettingsSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the TradeSettings
     */
    omit?: Prisma.TradeSettingsOmit<ExtArgs> | null;
    /**
     * Filter, which TradeSettings to fetch.
     */
    where?: Prisma.TradeSettingsWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of TradeSettings to fetch.
     */
    orderBy?: Prisma.TradeSettingsOrderByWithRelationInput | Prisma.TradeSettingsOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for TradeSettings.
     */
    cursor?: Prisma.TradeSettingsWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` TradeSettings from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` TradeSettings.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of TradeSettings.
     */
    distinct?: Prisma.TradeSettingsScalarFieldEnum | Prisma.TradeSettingsScalarFieldEnum[];
};
/**
 * TradeSettings findFirstOrThrow
 */
export type TradeSettingsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeSettings
     */
    select?: Prisma.TradeSettingsSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the TradeSettings
     */
    omit?: Prisma.TradeSettingsOmit<ExtArgs> | null;
    /**
     * Filter, which TradeSettings to fetch.
     */
    where?: Prisma.TradeSettingsWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of TradeSettings to fetch.
     */
    orderBy?: Prisma.TradeSettingsOrderByWithRelationInput | Prisma.TradeSettingsOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for TradeSettings.
     */
    cursor?: Prisma.TradeSettingsWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` TradeSettings from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` TradeSettings.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of TradeSettings.
     */
    distinct?: Prisma.TradeSettingsScalarFieldEnum | Prisma.TradeSettingsScalarFieldEnum[];
};
/**
 * TradeSettings findMany
 */
export type TradeSettingsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeSettings
     */
    select?: Prisma.TradeSettingsSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the TradeSettings
     */
    omit?: Prisma.TradeSettingsOmit<ExtArgs> | null;
    /**
     * Filter, which TradeSettings to fetch.
     */
    where?: Prisma.TradeSettingsWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of TradeSettings to fetch.
     */
    orderBy?: Prisma.TradeSettingsOrderByWithRelationInput | Prisma.TradeSettingsOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing TradeSettings.
     */
    cursor?: Prisma.TradeSettingsWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` TradeSettings from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` TradeSettings.
     */
    skip?: number;
    distinct?: Prisma.TradeSettingsScalarFieldEnum | Prisma.TradeSettingsScalarFieldEnum[];
};
/**
 * TradeSettings create
 */
export type TradeSettingsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeSettings
     */
    select?: Prisma.TradeSettingsSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the TradeSettings
     */
    omit?: Prisma.TradeSettingsOmit<ExtArgs> | null;
    /**
     * The data needed to create a TradeSettings.
     */
    data: Prisma.XOR<Prisma.TradeSettingsCreateInput, Prisma.TradeSettingsUncheckedCreateInput>;
};
/**
 * TradeSettings createMany
 */
export type TradeSettingsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * The data used to create many TradeSettings.
     */
    data: Prisma.TradeSettingsCreateManyInput | Prisma.TradeSettingsCreateManyInput[];
    skipDuplicates?: boolean;
};
/**
 * TradeSettings createManyAndReturn
 */
export type TradeSettingsCreateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeSettings
     */
    select?: Prisma.TradeSettingsSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the TradeSettings
     */
    omit?: Prisma.TradeSettingsOmit<ExtArgs> | null;
    /**
     * The data used to create many TradeSettings.
     */
    data: Prisma.TradeSettingsCreateManyInput | Prisma.TradeSettingsCreateManyInput[];
    skipDuplicates?: boolean;
};
/**
 * TradeSettings update
 */
export type TradeSettingsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeSettings
     */
    select?: Prisma.TradeSettingsSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the TradeSettings
     */
    omit?: Prisma.TradeSettingsOmit<ExtArgs> | null;
    /**
     * The data needed to update a TradeSettings.
     */
    data: Prisma.XOR<Prisma.TradeSettingsUpdateInput, Prisma.TradeSettingsUncheckedUpdateInput>;
    /**
     * Choose, which TradeSettings to update.
     */
    where: Prisma.TradeSettingsWhereUniqueInput;
};
/**
 * TradeSettings updateMany
 */
export type TradeSettingsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * The data used to update TradeSettings.
     */
    data: Prisma.XOR<Prisma.TradeSettingsUpdateManyMutationInput, Prisma.TradeSettingsUncheckedUpdateManyInput>;
    /**
     * Filter which TradeSettings to update
     */
    where?: Prisma.TradeSettingsWhereInput;
    /**
     * Limit how many TradeSettings to update.
     */
    limit?: number;
};
/**
 * TradeSettings updateManyAndReturn
 */
export type TradeSettingsUpdateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeSettings
     */
    select?: Prisma.TradeSettingsSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the TradeSettings
     */
    omit?: Prisma.TradeSettingsOmit<ExtArgs> | null;
    /**
     * The data used to update TradeSettings.
     */
    data: Prisma.XOR<Prisma.TradeSettingsUpdateManyMutationInput, Prisma.TradeSettingsUncheckedUpdateManyInput>;
    /**
     * Filter which TradeSettings to update
     */
    where?: Prisma.TradeSettingsWhereInput;
    /**
     * Limit how many TradeSettings to update.
     */
    limit?: number;
};
/**
 * TradeSettings upsert
 */
export type TradeSettingsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeSettings
     */
    select?: Prisma.TradeSettingsSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the TradeSettings
     */
    omit?: Prisma.TradeSettingsOmit<ExtArgs> | null;
    /**
     * The filter to search for the TradeSettings to update in case it exists.
     */
    where: Prisma.TradeSettingsWhereUniqueInput;
    /**
     * In case the TradeSettings found by the `where` argument doesn't exist, create a new TradeSettings with this data.
     */
    create: Prisma.XOR<Prisma.TradeSettingsCreateInput, Prisma.TradeSettingsUncheckedCreateInput>;
    /**
     * In case the TradeSettings was found with the provided `where` argument, update it with this data.
     */
    update: Prisma.XOR<Prisma.TradeSettingsUpdateInput, Prisma.TradeSettingsUncheckedUpdateInput>;
};
/**
 * TradeSettings delete
 */
export type TradeSettingsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeSettings
     */
    select?: Prisma.TradeSettingsSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the TradeSettings
     */
    omit?: Prisma.TradeSettingsOmit<ExtArgs> | null;
    /**
     * Filter which TradeSettings to delete.
     */
    where: Prisma.TradeSettingsWhereUniqueInput;
};
/**
 * TradeSettings deleteMany
 */
export type TradeSettingsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Filter which TradeSettings to delete
     */
    where?: Prisma.TradeSettingsWhereInput;
    /**
     * Limit how many TradeSettings to delete.
     */
    limit?: number;
};
/**
 * TradeSettings without action
 */
export type TradeSettingsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TradeSettings
     */
    select?: Prisma.TradeSettingsSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the TradeSettings
     */
    omit?: Prisma.TradeSettingsOmit<ExtArgs> | null;
};
export {};
//# sourceMappingURL=TradeSettings.d.ts.map