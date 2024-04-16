## What is Cache Invalidation?

Cache invalidation is a critical concept in caching strategy, essentially involving the process of removing or updating outdated data in a cache. When cached data is no longer valid due to changes in the underlying data it represents, it must be invalidated to ensure consistency between the cache and the source data.

Different strategies can be employed for cache invalidation, depending on the nature of the data and the requirements of the application. Some common cache invalidation strategies include:

- [Time-based Expiration](./01-time-based-expiration.md)

- [Change driven Invalidation](./02-change-driven-invalidation.md)

- [State while Revalidate](./03-state-while-revalidate.md)

- [Mixing strategies](./04-mixing.md)
