import type * as runtime from '@prisma/client/runtime/client';
import type * as Prisma from '../internal/prismaNamespace';
/**
 * Model DiscoveredPool
 *
 */
export type DiscoveredPoolModel = runtime.Types.Result.DefaultSelection<Prisma.$DiscoveredPoolPayload>;
export type AggregateDiscoveredPool = {
    _count: DiscoveredPoolCountAggregateOutputType | null;
    _avg: DiscoveredPoolAvgAggregateOutputType | null;
    _sum: DiscoveredPoolSumAggregateOutputType | null;
    _min: DiscoveredPoolMinAggregateOutputType | null;
    _max: DiscoveredPoolMaxAggregateOutputType | null;
};
export type DiscoveredPoolAvgAggregateOutputType = {
    initialTvl: runtime.Decimal | null;
};
export type DiscoveredPoolSumAggregateOutputType = {
    initialTvl: runtime.Decimal | null;
};
export type DiscoveredPoolMinAggregateOutputType = {
    id: string | null;
    address: string | null;
    dexType: string | null;
    tokenA: string | null;
    tokenB: string | null;
    initialTvl: runtime.Decimal | null;
    discoveredAt: Date | null;
    status: string | null;
};
export type DiscoveredPoolMaxAggregateOutputType = {
    id: string | null;
    address: string | null;
    dexType: string | null;
    tokenA: string | null;
    tokenB: string | null;
    initialTvl: runtime.Decimal | null;
    discoveredAt: Date | null;
    status: string | null;
};
export type DiscoveredPoolCountAggregateOutputType = {
    id: number;
    address: number;
    dexType: number;
    tokenA: number;
    tokenB: number;
    initialTvl: number;
    discoveredAt: number;
    status: number;
    poolData: number;
    _all: number;
};
export type DiscoveredPoolAvgAggregateInputType = {
    initialTvl?: true;
};
export type DiscoveredPoolSumAggregateInputType = {
    initialTvl?: true;
};
export type DiscoveredPoolMinAggregateInputType = {
    id?: true;
    address?: true;
    dexType?: true;
    tokenA?: true;
    tokenB?: true;
    initialTvl?: true;
    discoveredAt?: true;
    status?: true;
};
export type DiscoveredPoolMaxAggregateInputType = {
    id?: true;
    address?: true;
    dexType?: true;
    tokenA?: true;
    tokenB?: true;
    initialTvl?: true;
    discoveredAt?: true;
    status?: true;
};
export type DiscoveredPoolCountAggregateInputType = {
    id?: true;
    address?: true;
    dexType?: true;
    tokenA?: true;
    tokenB?: true;
    initialTvl?: true;
    discoveredAt?: true;
    status?: true;
    poolData?: true;
    _all?: true;
};
export type DiscoveredPoolAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Filter which DiscoveredPool to aggregate.
     */
    where?: Prisma.DiscoveredPoolWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of DiscoveredPools to fetch.
     */
    orderBy?: Prisma.DiscoveredPoolOrderByWithRelationInput | Prisma.DiscoveredPoolOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: Prisma.DiscoveredPoolWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` DiscoveredPools from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` DiscoveredPools.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned DiscoveredPools
     **/
    _count?: true | DiscoveredPoolCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: DiscoveredPoolAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: DiscoveredPoolSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: DiscoveredPoolMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: DiscoveredPoolMaxAggregateInputType;
};
export type GetDiscoveredPoolAggregateType<T extends DiscoveredPoolAggregateArgs> = {
    [P in keyof T & keyof AggregateDiscoveredPool]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateDiscoveredPool[P]> : Prisma.GetScalarType<T[P], AggregateDiscoveredPool[P]>;
};
export type DiscoveredPoolGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.DiscoveredPoolWhereInput;
    orderBy?: Prisma.DiscoveredPoolOrderByWithAggregationInput | Prisma.DiscoveredPoolOrderByWithAggregationInput[];
    by: Prisma.DiscoveredPoolScalarFieldEnum[] | Prisma.DiscoveredPoolScalarFieldEnum;
    having?: Prisma.DiscoveredPoolScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: DiscoveredPoolCountAggregateInputType | true;
    _avg?: DiscoveredPoolAvgAggregateInputType;
    _sum?: DiscoveredPoolSumAggregateInputType;
    _min?: DiscoveredPoolMinAggregateInputType;
    _max?: DiscoveredPoolMaxAggregateInputType;
};
export type DiscoveredPoolGroupByOutputType = {
    id: string;
    address: string;
    dexType: string;
    tokenA: string;
    tokenB: string;
    initialTvl: runtime.Decimal;
    discoveredAt: Date;
    status: string;
    poolData: runtime.JsonValue | null;
    _count: DiscoveredPoolCountAggregateOutputType | null;
    _avg: DiscoveredPoolAvgAggregateOutputType | null;
    _sum: DiscoveredPoolSumAggregateOutputType | null;
    _min: DiscoveredPoolMinAggregateOutputType | null;
    _max: DiscoveredPoolMaxAggregateOutputType | null;
};
type GetDiscoveredPoolGroupByPayload<T extends DiscoveredPoolGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<DiscoveredPoolGroupByOutputType, T['by']> & {
    [P in keyof T & keyof DiscoveredPoolGroupByOutputType]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], DiscoveredPoolGroupByOutputType[P]> : Prisma.GetScalarType<T[P], DiscoveredPoolGroupByOutputType[P]>;
}>>;
export type DiscoveredPoolWhereInput = {
    AND?: Prisma.DiscoveredPoolWhereInput | Prisma.DiscoveredPoolWhereInput[];
    OR?: Prisma.DiscoveredPoolWhereInput[];
    NOT?: Prisma.DiscoveredPoolWhereInput | Prisma.DiscoveredPoolWhereInput[];
    id?: Prisma.StringFilter<'DiscoveredPool'> | string;
    address?: Prisma.StringFilter<'DiscoveredPool'> | string;
    dexType?: Prisma.StringFilter<'DiscoveredPool'> | string;
    tokenA?: Prisma.StringFilter<'DiscoveredPool'> | string;
    tokenB?: Prisma.StringFilter<'DiscoveredPool'> | string;
    initialTvl?: Prisma.DecimalFilter<'DiscoveredPool'> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    discoveredAt?: Prisma.DateTimeFilter<'DiscoveredPool'> | Date | string;
    status?: Prisma.StringFilter<'DiscoveredPool'> | string;
    poolData?: Prisma.JsonNullableFilter<'DiscoveredPool'>;
};
export type DiscoveredPoolOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    address?: Prisma.SortOrder;
    dexType?: Prisma.SortOrder;
    tokenA?: Prisma.SortOrder;
    tokenB?: Prisma.SortOrder;
    initialTvl?: Prisma.SortOrder;
    discoveredAt?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    poolData?: Prisma.SortOrderInput | Prisma.SortOrder;
};
export type DiscoveredPoolWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    address?: string;
    AND?: Prisma.DiscoveredPoolWhereInput | Prisma.DiscoveredPoolWhereInput[];
    OR?: Prisma.DiscoveredPoolWhereInput[];
    NOT?: Prisma.DiscoveredPoolWhereInput | Prisma.DiscoveredPoolWhereInput[];
    dexType?: Prisma.StringFilter<'DiscoveredPool'> | string;
    tokenA?: Prisma.StringFilter<'DiscoveredPool'> | string;
    tokenB?: Prisma.StringFilter<'DiscoveredPool'> | string;
    initialTvl?: Prisma.DecimalFilter<'DiscoveredPool'> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    discoveredAt?: Prisma.DateTimeFilter<'DiscoveredPool'> | Date | string;
    status?: Prisma.StringFilter<'DiscoveredPool'> | string;
    poolData?: Prisma.JsonNullableFilter<'DiscoveredPool'>;
}, 'id' | 'address'>;
export type DiscoveredPoolOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    address?: Prisma.SortOrder;
    dexType?: Prisma.SortOrder;
    tokenA?: Prisma.SortOrder;
    tokenB?: Prisma.SortOrder;
    initialTvl?: Prisma.SortOrder;
    discoveredAt?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    poolData?: Prisma.SortOrderInput | Prisma.SortOrder;
    _count?: Prisma.DiscoveredPoolCountOrderByAggregateInput;
    _avg?: Prisma.DiscoveredPoolAvgOrderByAggregateInput;
    _max?: Prisma.DiscoveredPoolMaxOrderByAggregateInput;
    _min?: Prisma.DiscoveredPoolMinOrderByAggregateInput;
    _sum?: Prisma.DiscoveredPoolSumOrderByAggregateInput;
};
export type DiscoveredPoolScalarWhereWithAggregatesInput = {
    AND?: Prisma.DiscoveredPoolScalarWhereWithAggregatesInput | Prisma.DiscoveredPoolScalarWhereWithAggregatesInput[];
    OR?: Prisma.DiscoveredPoolScalarWhereWithAggregatesInput[];
    NOT?: Prisma.DiscoveredPoolScalarWhereWithAggregatesInput | Prisma.DiscoveredPoolScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<'DiscoveredPool'> | string;
    address?: Prisma.StringWithAggregatesFilter<'DiscoveredPool'> | string;
    dexType?: Prisma.StringWithAggregatesFilter<'DiscoveredPool'> | string;
    tokenA?: Prisma.StringWithAggregatesFilter<'DiscoveredPool'> | string;
    tokenB?: Prisma.StringWithAggregatesFilter<'DiscoveredPool'> | string;
    initialTvl?: Prisma.DecimalWithAggregatesFilter<'DiscoveredPool'> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    discoveredAt?: Prisma.DateTimeWithAggregatesFilter<'DiscoveredPool'> | Date | string;
    status?: Prisma.StringWithAggregatesFilter<'DiscoveredPool'> | string;
    poolData?: Prisma.JsonNullableWithAggregatesFilter<'DiscoveredPool'>;
};
export type DiscoveredPoolCreateInput = {
    id?: string;
    address: string;
    dexType: string;
    tokenA: string;
    tokenB: string;
    initialTvl: runtime.Decimal | runtime.DecimalJsLike | number | string;
    discoveredAt?: Date | string;
    status?: string;
    poolData?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type DiscoveredPoolUncheckedCreateInput = {
    id?: string;
    address: string;
    dexType: string;
    tokenA: string;
    tokenB: string;
    initialTvl: runtime.Decimal | runtime.DecimalJsLike | number | string;
    discoveredAt?: Date | string;
    status?: string;
    poolData?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type DiscoveredPoolUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    address?: Prisma.StringFieldUpdateOperationsInput | string;
    dexType?: Prisma.StringFieldUpdateOperationsInput | string;
    tokenA?: Prisma.StringFieldUpdateOperationsInput | string;
    tokenB?: Prisma.StringFieldUpdateOperationsInput | string;
    initialTvl?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    discoveredAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    status?: Prisma.StringFieldUpdateOperationsInput | string;
    poolData?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type DiscoveredPoolUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    address?: Prisma.StringFieldUpdateOperationsInput | string;
    dexType?: Prisma.StringFieldUpdateOperationsInput | string;
    tokenA?: Prisma.StringFieldUpdateOperationsInput | string;
    tokenB?: Prisma.StringFieldUpdateOperationsInput | string;
    initialTvl?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    discoveredAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    status?: Prisma.StringFieldUpdateOperationsInput | string;
    poolData?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type DiscoveredPoolCreateManyInput = {
    id?: string;
    address: string;
    dexType: string;
    tokenA: string;
    tokenB: string;
    initialTvl: runtime.Decimal | runtime.DecimalJsLike | number | string;
    discoveredAt?: Date | string;
    status?: string;
    poolData?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type DiscoveredPoolUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    address?: Prisma.StringFieldUpdateOperationsInput | string;
    dexType?: Prisma.StringFieldUpdateOperationsInput | string;
    tokenA?: Prisma.StringFieldUpdateOperationsInput | string;
    tokenB?: Prisma.StringFieldUpdateOperationsInput | string;
    initialTvl?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    discoveredAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    status?: Prisma.StringFieldUpdateOperationsInput | string;
    poolData?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type DiscoveredPoolUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    address?: Prisma.StringFieldUpdateOperationsInput | string;
    dexType?: Prisma.StringFieldUpdateOperationsInput | string;
    tokenA?: Prisma.StringFieldUpdateOperationsInput | string;
    tokenB?: Prisma.StringFieldUpdateOperationsInput | string;
    initialTvl?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    discoveredAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    status?: Prisma.StringFieldUpdateOperationsInput | string;
    poolData?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type DiscoveredPoolCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    address?: Prisma.SortOrder;
    dexType?: Prisma.SortOrder;
    tokenA?: Prisma.SortOrder;
    tokenB?: Prisma.SortOrder;
    initialTvl?: Prisma.SortOrder;
    discoveredAt?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    poolData?: Prisma.SortOrder;
};
export type DiscoveredPoolAvgOrderByAggregateInput = {
    initialTvl?: Prisma.SortOrder;
};
export type DiscoveredPoolMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    address?: Prisma.SortOrder;
    dexType?: Prisma.SortOrder;
    tokenA?: Prisma.SortOrder;
    tokenB?: Prisma.SortOrder;
    initialTvl?: Prisma.SortOrder;
    discoveredAt?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
};
export type DiscoveredPoolMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    address?: Prisma.SortOrder;
    dexType?: Prisma.SortOrder;
    tokenA?: Prisma.SortOrder;
    tokenB?: Prisma.SortOrder;
    initialTvl?: Prisma.SortOrder;
    discoveredAt?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
};
export type DiscoveredPoolSumOrderByAggregateInput = {
    initialTvl?: Prisma.SortOrder;
};
export type DiscoveredPoolSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    address?: boolean;
    dexType?: boolean;
    tokenA?: boolean;
    tokenB?: boolean;
    initialTvl?: boolean;
    discoveredAt?: boolean;
    status?: boolean;
    poolData?: boolean;
}, ExtArgs['result']['discoveredPool']>;
export type DiscoveredPoolSelectCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    address?: boolean;
    dexType?: boolean;
    tokenA?: boolean;
    tokenB?: boolean;
    initialTvl?: boolean;
    discoveredAt?: boolean;
    status?: boolean;
    poolData?: boolean;
}, ExtArgs['result']['discoveredPool']>;
export type DiscoveredPoolSelectUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    address?: boolean;
    dexType?: boolean;
    tokenA?: boolean;
    tokenB?: boolean;
    initialTvl?: boolean;
    discoveredAt?: boolean;
    status?: boolean;
    poolData?: boolean;
}, ExtArgs['result']['discoveredPool']>;
export type DiscoveredPoolSelectScalar = {
    id?: boolean;
    address?: boolean;
    dexType?: boolean;
    tokenA?: boolean;
    tokenB?: boolean;
    initialTvl?: boolean;
    discoveredAt?: boolean;
    status?: boolean;
    poolData?: boolean;
};
export type DiscoveredPoolOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<'id' | 'address' | 'dexType' | 'tokenA' | 'tokenB' | 'initialTvl' | 'discoveredAt' | 'status' | 'poolData', ExtArgs['result']['discoveredPool']>;
export type $DiscoveredPoolPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: 'DiscoveredPool';
    objects: {};
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        address: string;
        dexType: string;
        tokenA: string;
        tokenB: string;
        initialTvl: runtime.Decimal;
        discoveredAt: Date;
        status: string;
        poolData: runtime.JsonValue | null;
    }, ExtArgs['result']['discoveredPool']>;
    composites: {};
};
export type DiscoveredPoolGetPayload<S extends boolean | null | undefined | DiscoveredPoolDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$DiscoveredPoolPayload, S>;
export type DiscoveredPoolCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<DiscoveredPoolFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: DiscoveredPoolCountAggregateInputType | true;
};
export interface DiscoveredPoolDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['DiscoveredPool'];
        meta: {
            name: 'DiscoveredPool';
        };
    };
    /**
     * Find zero or one DiscoveredPool that matches the filter.
     * @param {DiscoveredPoolFindUniqueArgs} args - Arguments to find a DiscoveredPool
     * @example
     * // Get one DiscoveredPool
     * const discoveredPool = await prisma.discoveredPool.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends DiscoveredPoolFindUniqueArgs>(args: Prisma.SelectSubset<T, DiscoveredPoolFindUniqueArgs<ExtArgs>>): Prisma.Prisma__DiscoveredPoolClient<runtime.Types.Result.GetResult<Prisma.$DiscoveredPoolPayload<ExtArgs>, T, 'findUnique', GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    /**
     * Find one DiscoveredPool that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {DiscoveredPoolFindUniqueOrThrowArgs} args - Arguments to find a DiscoveredPool
     * @example
     * // Get one DiscoveredPool
     * const discoveredPool = await prisma.discoveredPool.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends DiscoveredPoolFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, DiscoveredPoolFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__DiscoveredPoolClient<runtime.Types.Result.GetResult<Prisma.$DiscoveredPoolPayload<ExtArgs>, T, 'findUniqueOrThrow', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Find the first DiscoveredPool that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiscoveredPoolFindFirstArgs} args - Arguments to find a DiscoveredPool
     * @example
     * // Get one DiscoveredPool
     * const discoveredPool = await prisma.discoveredPool.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends DiscoveredPoolFindFirstArgs>(args?: Prisma.SelectSubset<T, DiscoveredPoolFindFirstArgs<ExtArgs>>): Prisma.Prisma__DiscoveredPoolClient<runtime.Types.Result.GetResult<Prisma.$DiscoveredPoolPayload<ExtArgs>, T, 'findFirst', GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    /**
     * Find the first DiscoveredPool that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiscoveredPoolFindFirstOrThrowArgs} args - Arguments to find a DiscoveredPool
     * @example
     * // Get one DiscoveredPool
     * const discoveredPool = await prisma.discoveredPool.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends DiscoveredPoolFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, DiscoveredPoolFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__DiscoveredPoolClient<runtime.Types.Result.GetResult<Prisma.$DiscoveredPoolPayload<ExtArgs>, T, 'findFirstOrThrow', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Find zero or more DiscoveredPools that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiscoveredPoolFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all DiscoveredPools
     * const discoveredPools = await prisma.discoveredPool.findMany()
     *
     * // Get first 10 DiscoveredPools
     * const discoveredPools = await prisma.discoveredPool.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const discoveredPoolWithIdOnly = await prisma.discoveredPool.findMany({ select: { id: true } })
     *
     */
    findMany<T extends DiscoveredPoolFindManyArgs>(args?: Prisma.SelectSubset<T, DiscoveredPoolFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$DiscoveredPoolPayload<ExtArgs>, T, 'findMany', GlobalOmitOptions>>;
    /**
     * Create a DiscoveredPool.
     * @param {DiscoveredPoolCreateArgs} args - Arguments to create a DiscoveredPool.
     * @example
     * // Create one DiscoveredPool
     * const DiscoveredPool = await prisma.discoveredPool.create({
     *   data: {
     *     // ... data to create a DiscoveredPool
     *   }
     * })
     *
     */
    create<T extends DiscoveredPoolCreateArgs>(args: Prisma.SelectSubset<T, DiscoveredPoolCreateArgs<ExtArgs>>): Prisma.Prisma__DiscoveredPoolClient<runtime.Types.Result.GetResult<Prisma.$DiscoveredPoolPayload<ExtArgs>, T, 'create', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Create many DiscoveredPools.
     * @param {DiscoveredPoolCreateManyArgs} args - Arguments to create many DiscoveredPools.
     * @example
     * // Create many DiscoveredPools
     * const discoveredPool = await prisma.discoveredPool.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends DiscoveredPoolCreateManyArgs>(args?: Prisma.SelectSubset<T, DiscoveredPoolCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Create many DiscoveredPools and returns the data saved in the database.
     * @param {DiscoveredPoolCreateManyAndReturnArgs} args - Arguments to create many DiscoveredPools.
     * @example
     * // Create many DiscoveredPools
     * const discoveredPool = await prisma.discoveredPool.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many DiscoveredPools and only return the `id`
     * const discoveredPoolWithIdOnly = await prisma.discoveredPool.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends DiscoveredPoolCreateManyAndReturnArgs>(args?: Prisma.SelectSubset<T, DiscoveredPoolCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$DiscoveredPoolPayload<ExtArgs>, T, 'createManyAndReturn', GlobalOmitOptions>>;
    /**
     * Delete a DiscoveredPool.
     * @param {DiscoveredPoolDeleteArgs} args - Arguments to delete one DiscoveredPool.
     * @example
     * // Delete one DiscoveredPool
     * const DiscoveredPool = await prisma.discoveredPool.delete({
     *   where: {
     *     // ... filter to delete one DiscoveredPool
     *   }
     * })
     *
     */
    delete<T extends DiscoveredPoolDeleteArgs>(args: Prisma.SelectSubset<T, DiscoveredPoolDeleteArgs<ExtArgs>>): Prisma.Prisma__DiscoveredPoolClient<runtime.Types.Result.GetResult<Prisma.$DiscoveredPoolPayload<ExtArgs>, T, 'delete', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Update one DiscoveredPool.
     * @param {DiscoveredPoolUpdateArgs} args - Arguments to update one DiscoveredPool.
     * @example
     * // Update one DiscoveredPool
     * const discoveredPool = await prisma.discoveredPool.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends DiscoveredPoolUpdateArgs>(args: Prisma.SelectSubset<T, DiscoveredPoolUpdateArgs<ExtArgs>>): Prisma.Prisma__DiscoveredPoolClient<runtime.Types.Result.GetResult<Prisma.$DiscoveredPoolPayload<ExtArgs>, T, 'update', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Delete zero or more DiscoveredPools.
     * @param {DiscoveredPoolDeleteManyArgs} args - Arguments to filter DiscoveredPools to delete.
     * @example
     * // Delete a few DiscoveredPools
     * const { count } = await prisma.discoveredPool.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends DiscoveredPoolDeleteManyArgs>(args?: Prisma.SelectSubset<T, DiscoveredPoolDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Update zero or more DiscoveredPools.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiscoveredPoolUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many DiscoveredPools
     * const discoveredPool = await prisma.discoveredPool.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends DiscoveredPoolUpdateManyArgs>(args: Prisma.SelectSubset<T, DiscoveredPoolUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Update zero or more DiscoveredPools and returns the data updated in the database.
     * @param {DiscoveredPoolUpdateManyAndReturnArgs} args - Arguments to update many DiscoveredPools.
     * @example
     * // Update many DiscoveredPools
     * const discoveredPool = await prisma.discoveredPool.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more DiscoveredPools and only return the `id`
     * const discoveredPoolWithIdOnly = await prisma.discoveredPool.updateManyAndReturn({
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
    updateManyAndReturn<T extends DiscoveredPoolUpdateManyAndReturnArgs>(args: Prisma.SelectSubset<T, DiscoveredPoolUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$DiscoveredPoolPayload<ExtArgs>, T, 'updateManyAndReturn', GlobalOmitOptions>>;
    /**
     * Create or update one DiscoveredPool.
     * @param {DiscoveredPoolUpsertArgs} args - Arguments to update or create a DiscoveredPool.
     * @example
     * // Update or create a DiscoveredPool
     * const discoveredPool = await prisma.discoveredPool.upsert({
     *   create: {
     *     // ... data to create a DiscoveredPool
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the DiscoveredPool we want to update
     *   }
     * })
     */
    upsert<T extends DiscoveredPoolUpsertArgs>(args: Prisma.SelectSubset<T, DiscoveredPoolUpsertArgs<ExtArgs>>): Prisma.Prisma__DiscoveredPoolClient<runtime.Types.Result.GetResult<Prisma.$DiscoveredPoolPayload<ExtArgs>, T, 'upsert', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Count the number of DiscoveredPools.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiscoveredPoolCountArgs} args - Arguments to filter DiscoveredPools to count.
     * @example
     * // Count the number of DiscoveredPools
     * const count = await prisma.discoveredPool.count({
     *   where: {
     *     // ... the filter for the DiscoveredPools we want to count
     *   }
     * })
     **/
    count<T extends DiscoveredPoolCountArgs>(args?: Prisma.Subset<T, DiscoveredPoolCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], DiscoveredPoolCountAggregateOutputType> : number>;
    /**
     * Allows you to perform aggregations operations on a DiscoveredPool.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiscoveredPoolAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends DiscoveredPoolAggregateArgs>(args: Prisma.Subset<T, DiscoveredPoolAggregateArgs>): Prisma.PrismaPromise<GetDiscoveredPoolAggregateType<T>>;
    /**
     * Group by DiscoveredPool.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiscoveredPoolGroupByArgs} args - Group by arguments.
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
    groupBy<T extends DiscoveredPoolGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: DiscoveredPoolGroupByArgs['orderBy'];
    } : {
        orderBy?: DiscoveredPoolGroupByArgs['orderBy'];
    }, OrderFields extends Prisma.ExcludeUnderscoreKeys<Prisma.Keys<Prisma.MaybeTupleToUnion<T['orderBy']>>>, ByFields extends Prisma.MaybeTupleToUnion<T['by']>, ByValid extends Prisma.Has<ByFields, OrderFields>, HavingFields extends Prisma.GetHavingFields<T['having']>, HavingValid extends Prisma.Has<ByFields, HavingFields>, ByEmpty extends T['by'] extends never[] ? Prisma.True : Prisma.False, InputErrors extends ByEmpty extends Prisma.True ? `Error: "by" must not be empty.` : HavingValid extends Prisma.False ? {
        [P in HavingFields]: P extends ByFields ? never : P extends string ? `Error: Field "${P}" used in "having" needs to be provided in "by".` : [Error, 'Field ', P, ` in "having" needs to be provided in "by"`];
    }[HavingFields] : 'take' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "take", you also need to provide "orderBy"' : 'skip' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "skip", you also need to provide "orderBy"' : ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, DiscoveredPoolGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetDiscoveredPoolGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the DiscoveredPool model
     */
    readonly fields: DiscoveredPoolFieldRefs;
}
/**
 * The delegate class that acts as a "Promise-like" for DiscoveredPool.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export interface Prisma__DiscoveredPoolClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
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
 * Fields of the DiscoveredPool model
 */
export interface DiscoveredPoolFieldRefs {
    readonly id: Prisma.FieldRef<'DiscoveredPool', 'String'>;
    readonly address: Prisma.FieldRef<'DiscoveredPool', 'String'>;
    readonly dexType: Prisma.FieldRef<'DiscoveredPool', 'String'>;
    readonly tokenA: Prisma.FieldRef<'DiscoveredPool', 'String'>;
    readonly tokenB: Prisma.FieldRef<'DiscoveredPool', 'String'>;
    readonly initialTvl: Prisma.FieldRef<'DiscoveredPool', 'Decimal'>;
    readonly discoveredAt: Prisma.FieldRef<'DiscoveredPool', 'DateTime'>;
    readonly status: Prisma.FieldRef<'DiscoveredPool', 'String'>;
    readonly poolData: Prisma.FieldRef<'DiscoveredPool', 'Json'>;
}
/**
 * DiscoveredPool findUnique
 */
export type DiscoveredPoolFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiscoveredPool
     */
    select?: Prisma.DiscoveredPoolSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the DiscoveredPool
     */
    omit?: Prisma.DiscoveredPoolOmit<ExtArgs> | null;
    /**
     * Filter, which DiscoveredPool to fetch.
     */
    where: Prisma.DiscoveredPoolWhereUniqueInput;
};
/**
 * DiscoveredPool findUniqueOrThrow
 */
export type DiscoveredPoolFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiscoveredPool
     */
    select?: Prisma.DiscoveredPoolSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the DiscoveredPool
     */
    omit?: Prisma.DiscoveredPoolOmit<ExtArgs> | null;
    /**
     * Filter, which DiscoveredPool to fetch.
     */
    where: Prisma.DiscoveredPoolWhereUniqueInput;
};
/**
 * DiscoveredPool findFirst
 */
export type DiscoveredPoolFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiscoveredPool
     */
    select?: Prisma.DiscoveredPoolSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the DiscoveredPool
     */
    omit?: Prisma.DiscoveredPoolOmit<ExtArgs> | null;
    /**
     * Filter, which DiscoveredPool to fetch.
     */
    where?: Prisma.DiscoveredPoolWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of DiscoveredPools to fetch.
     */
    orderBy?: Prisma.DiscoveredPoolOrderByWithRelationInput | Prisma.DiscoveredPoolOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for DiscoveredPools.
     */
    cursor?: Prisma.DiscoveredPoolWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` DiscoveredPools from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` DiscoveredPools.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of DiscoveredPools.
     */
    distinct?: Prisma.DiscoveredPoolScalarFieldEnum | Prisma.DiscoveredPoolScalarFieldEnum[];
};
/**
 * DiscoveredPool findFirstOrThrow
 */
export type DiscoveredPoolFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiscoveredPool
     */
    select?: Prisma.DiscoveredPoolSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the DiscoveredPool
     */
    omit?: Prisma.DiscoveredPoolOmit<ExtArgs> | null;
    /**
     * Filter, which DiscoveredPool to fetch.
     */
    where?: Prisma.DiscoveredPoolWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of DiscoveredPools to fetch.
     */
    orderBy?: Prisma.DiscoveredPoolOrderByWithRelationInput | Prisma.DiscoveredPoolOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for DiscoveredPools.
     */
    cursor?: Prisma.DiscoveredPoolWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` DiscoveredPools from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` DiscoveredPools.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of DiscoveredPools.
     */
    distinct?: Prisma.DiscoveredPoolScalarFieldEnum | Prisma.DiscoveredPoolScalarFieldEnum[];
};
/**
 * DiscoveredPool findMany
 */
export type DiscoveredPoolFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiscoveredPool
     */
    select?: Prisma.DiscoveredPoolSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the DiscoveredPool
     */
    omit?: Prisma.DiscoveredPoolOmit<ExtArgs> | null;
    /**
     * Filter, which DiscoveredPools to fetch.
     */
    where?: Prisma.DiscoveredPoolWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of DiscoveredPools to fetch.
     */
    orderBy?: Prisma.DiscoveredPoolOrderByWithRelationInput | Prisma.DiscoveredPoolOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing DiscoveredPools.
     */
    cursor?: Prisma.DiscoveredPoolWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` DiscoveredPools from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` DiscoveredPools.
     */
    skip?: number;
    distinct?: Prisma.DiscoveredPoolScalarFieldEnum | Prisma.DiscoveredPoolScalarFieldEnum[];
};
/**
 * DiscoveredPool create
 */
export type DiscoveredPoolCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiscoveredPool
     */
    select?: Prisma.DiscoveredPoolSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the DiscoveredPool
     */
    omit?: Prisma.DiscoveredPoolOmit<ExtArgs> | null;
    /**
     * The data needed to create a DiscoveredPool.
     */
    data: Prisma.XOR<Prisma.DiscoveredPoolCreateInput, Prisma.DiscoveredPoolUncheckedCreateInput>;
};
/**
 * DiscoveredPool createMany
 */
export type DiscoveredPoolCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * The data used to create many DiscoveredPools.
     */
    data: Prisma.DiscoveredPoolCreateManyInput | Prisma.DiscoveredPoolCreateManyInput[];
    skipDuplicates?: boolean;
};
/**
 * DiscoveredPool createManyAndReturn
 */
export type DiscoveredPoolCreateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiscoveredPool
     */
    select?: Prisma.DiscoveredPoolSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the DiscoveredPool
     */
    omit?: Prisma.DiscoveredPoolOmit<ExtArgs> | null;
    /**
     * The data used to create many DiscoveredPools.
     */
    data: Prisma.DiscoveredPoolCreateManyInput | Prisma.DiscoveredPoolCreateManyInput[];
    skipDuplicates?: boolean;
};
/**
 * DiscoveredPool update
 */
export type DiscoveredPoolUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiscoveredPool
     */
    select?: Prisma.DiscoveredPoolSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the DiscoveredPool
     */
    omit?: Prisma.DiscoveredPoolOmit<ExtArgs> | null;
    /**
     * The data needed to update a DiscoveredPool.
     */
    data: Prisma.XOR<Prisma.DiscoveredPoolUpdateInput, Prisma.DiscoveredPoolUncheckedUpdateInput>;
    /**
     * Choose, which DiscoveredPool to update.
     */
    where: Prisma.DiscoveredPoolWhereUniqueInput;
};
/**
 * DiscoveredPool updateMany
 */
export type DiscoveredPoolUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * The data used to update DiscoveredPools.
     */
    data: Prisma.XOR<Prisma.DiscoveredPoolUpdateManyMutationInput, Prisma.DiscoveredPoolUncheckedUpdateManyInput>;
    /**
     * Filter which DiscoveredPools to update
     */
    where?: Prisma.DiscoveredPoolWhereInput;
    /**
     * Limit how many DiscoveredPools to update.
     */
    limit?: number;
};
/**
 * DiscoveredPool updateManyAndReturn
 */
export type DiscoveredPoolUpdateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiscoveredPool
     */
    select?: Prisma.DiscoveredPoolSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the DiscoveredPool
     */
    omit?: Prisma.DiscoveredPoolOmit<ExtArgs> | null;
    /**
     * The data used to update DiscoveredPools.
     */
    data: Prisma.XOR<Prisma.DiscoveredPoolUpdateManyMutationInput, Prisma.DiscoveredPoolUncheckedUpdateManyInput>;
    /**
     * Filter which DiscoveredPools to update
     */
    where?: Prisma.DiscoveredPoolWhereInput;
    /**
     * Limit how many DiscoveredPools to update.
     */
    limit?: number;
};
/**
 * DiscoveredPool upsert
 */
export type DiscoveredPoolUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiscoveredPool
     */
    select?: Prisma.DiscoveredPoolSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the DiscoveredPool
     */
    omit?: Prisma.DiscoveredPoolOmit<ExtArgs> | null;
    /**
     * The filter to search for the DiscoveredPool to update in case it exists.
     */
    where: Prisma.DiscoveredPoolWhereUniqueInput;
    /**
     * In case the DiscoveredPool found by the `where` argument doesn't exist, create a new DiscoveredPool with this data.
     */
    create: Prisma.XOR<Prisma.DiscoveredPoolCreateInput, Prisma.DiscoveredPoolUncheckedCreateInput>;
    /**
     * In case the DiscoveredPool was found with the provided `where` argument, update it with this data.
     */
    update: Prisma.XOR<Prisma.DiscoveredPoolUpdateInput, Prisma.DiscoveredPoolUncheckedUpdateInput>;
};
/**
 * DiscoveredPool delete
 */
export type DiscoveredPoolDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiscoveredPool
     */
    select?: Prisma.DiscoveredPoolSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the DiscoveredPool
     */
    omit?: Prisma.DiscoveredPoolOmit<ExtArgs> | null;
    /**
     * Filter which DiscoveredPool to delete.
     */
    where: Prisma.DiscoveredPoolWhereUniqueInput;
};
/**
 * DiscoveredPool deleteMany
 */
export type DiscoveredPoolDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Filter which DiscoveredPools to delete
     */
    where?: Prisma.DiscoveredPoolWhereInput;
    /**
     * Limit how many DiscoveredPools to delete.
     */
    limit?: number;
};
/**
 * DiscoveredPool without action
 */
export type DiscoveredPoolDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiscoveredPool
     */
    select?: Prisma.DiscoveredPoolSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the DiscoveredPool
     */
    omit?: Prisma.DiscoveredPoolOmit<ExtArgs> | null;
};
export {};
//# sourceMappingURL=DiscoveredPool.d.ts.map