function setPagination(req, res, next) {
    try {
        const skip = Number(req.query.skip) || env.DEFAULT_SKIP;
        const limit = Number(req.query.limit) || env.MAX_LIMIT;
        const search = req.query.search || '';
        let order = env.DEFAULT_SORT_DIRECTION;
        let orderBy = 'date_created_utc';
        if (req.query.sortBy) {
            order = req.query.sortBy === 'asc' ? 1 : -1;
        }
        if (req.query.order !== undefined && req.query.order !== null && req.query.order !== '') {
            const parsedOrder = Number(req.query.order);
            if (Number.isFinite(parsedOrder)) {
                order = parsedOrder;
            }
        }
        if (req.query.orderBy) {
            orderBy = req.query.orderBy;
        }
        const hasSearch = Boolean(req.query.search && String(req.query.search).trim());
        if (hasSearch && (!req.query.orderBy || req.query.orderBy === 'relevance')) {
            orderBy = 'relevance';
        } else if (!hasSearch && orderBy === 'relevance') {
            orderBy = 'date_created_utc';
            order = -1;
        }

        req.paginationOptions = {
            skip: (skip - 1) * limit,
            limit,
            order,
            orderBy,
            search
        }

        req.nextPageOptions = (items, total, extras = {}) => {
            const safeTotal = Number(total) || 0;
            const safeLimit = Number(limit) || 1;
            const { hasMore, ...othersMeta } = extras || {};
            const others = Object.keys(othersMeta || {}).length ? othersMeta : null;
            return {
                total: safeTotal,
                items,
                skip,
                limit: safeLimit,
                totalPages: Math.ceil(safeTotal / safeLimit) || 0,
                ...(typeof hasMore === "boolean" ? { hasMore } : {}),
                others,
            };
        };
        return next();
    } catch (error) {
        res.error("SOMETHING WENT WRONG");
    }

}

module.exports = setPagination

