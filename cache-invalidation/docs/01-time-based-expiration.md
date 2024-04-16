# Time-based Expiration

Time-based Expiration, also known as `TTL (Time-To-Live)` is a widely used caching strategy that automatically invalidates cache entries after a predetermined time interval.

This is useful for data that changes infrequently or has a predictable update cycle.

## Advantages

- **Simplicity and ease of implementation**: One of the biggest advantages is its simplicity. Implementing TTL requires minimal logic and can be easily managed by the caching system (e.g., Redis) without additional overhead on the application.

- **Reduced staleness risk**: By automatically expiring data after a set period, there's a reduced risk of serving stale data to the user. This is particularly effective for data that updates at predictable intervals.

- **Efficient resource utilization**: TTL can help in automatically managing the cache size by ensuring that unused or less frequently accessed data is expired, thus freeing up space for more relevant data.

- **Predictable load patterns**: Since data expiration is predictable, it can help in managing load patterns, especially in scenarios where cache repopulation might cause spikes in database load.

## Disadvantages

- **Potential for stale data**: If the data changes before the TTL expires, there's a risk of serving stale data until the cache is refreshed. This can be problematic for highly dynamic data.

- **Inefficient use of cache for stable data**: For data that doesn't change frequently, setting a TTL can lead to unnecessary invalidation and recaching, increasing the load on the database and the network without any real benefit.

- **Difficulty in choosing optimal TTL values**: Determining the right TTL value can be challenging, especially for data with unpredictable change frequencies. A value too short could lead to frequent cache misses, while a value too long might serve outdated data.

- **Cache stampede risk**: When a popular cache item expires and is subsequently requested by many users at the same time, this can lead to a cache stampede, where multiple instances of the application attempt to regenerate the cache simultaneously, causing high load on the backend systems.

## When to use ?

> It's easy to implement and manage, but may not be optimal for all scenarios.

Given these advantages and disadvantages, time-based expiration is best suited for scenarios where:

- **Data changes at predictable intervals**: For example, daily weather reports, where the data updates once a day.

- **Consistency requirements are not strict**: Applications that can tolerate a degree of data staleness, such as news feeds or social media posts, where immediate consistency is not critical.

- **Cache resources are limited**: When there's a need to efficiently manage cache storage by regularly purging old data.

- **Load patterns need to be managed**: To avoid sudden spikes in backend load by spreading out cache refreshes.

## Good Example : Session Management with Sliding Expiration

```sh
npm install redis
```

```js title="session-manager.js"
const redis = require("redis");
const client = redis.createClient({
  url: "redis://localhost:6379", // Adjust if your Redis server has a different configuration
});

client.on("error", (err) => console.log("Redis Client Error", err));

async function start() {
  await client.connect();
}

start();

// Save or update a user session with sliding expiration
async function saveOrUpdateSession(sessionId, sessionData, ttl) {
  const key = `session:${sessionId}`;
  await client.setEx(key, ttl, JSON.stringify(sessionData));
  console.log(`Session saved/updated with TTL of ${ttl} seconds.`);
}

// Retrieve a user session and refresh its TTL if it's below a certain threshold
async function getSessionWithSlidingExpiration(sessionId, ttlLimit, threshold) {
  const key = `session:${sessionId}`;
  const sessionData = await client.get(key);

  if (sessionData) {
    const remainingTTL = await client.ttl(key);

    // Check if the remaining TTL is below the threshold
    if (remainingTTL <= threshold) {
      // Refresh the session's TTL
      await client.expire(key, ttlLimit);
      console.log(
        `Session TTL refreshed for another ${ttlLimit} seconds as it was below the ${threshold} seconds threshold.`
      );
    } else {
      console.log(
        `Session TTL not refreshed. Remaining TTL: ${remainingTTL} seconds.`
      );
    }

    return JSON.parse(sessionData);
  }

  return null;
}

// Example usage
(async () => {
  const sessionId = "user123";
  const sessionData = {
    userId: "123",
    username: "johnDoe",
    lastLogin: new Date().toISOString(),
  };
  const ttlLimit = 300; // Session expires in 5 minutes
  const threshold = 60; // Threshold set to 1 minute

  await saveOrUpdateSession(sessionId, sessionData, ttlLimit);

  setTimeout(async () => {
    const session = await getSessionWithSlidingExpiration(
      sessionId,
      ttlLimit,
      threshold
    );
    if (session) {
      console.log("Session retrieved:", session);
    } else {
      console.log("Session expired or does not exist.");
    }
  }, 240000); // Trying to access the session after 4 minutes
})();
```

### How It Works:

- **Redis Setup and Connection**: Initializes and connects to the Redis client.
- **saveOrUpdateSession Function**: Saves a new session or updates an existing one with a specified TTL (Time To Live).
- **getSessionWithSlidingExpiration Function**: Retrieves a session and checks its remaining TTL against a threshold. If the TTL is below this threshold, it refreshes the TTL.
- **Example Usage**: Demonstrates saving a session and then attempting to retrieve it after 4 minutes. If the retrieval happens within the last minute of the 5-minute TTL, the session's TTL is refreshed to ensure it lasts another full 5 minutes from the point of access.

## Bad example : Stock Market Data Example

Time-based expiration may not be suitable for highly dynamic and frequently updated data like stock market prices. In such scenarios, the data changes occur at unpredictable intervals and can be triggered by numerous market factors, often requiring real-time or near-real-time updates to reflect the most current state.

### Stock Price Caching

Let's consider a scenario where a financial application caches stock prices. Using a fixed TTL approach for such rapidly changing information could lead to serving outdated data, which is undesirable in financial contexts where timely and accurate data is critical.

```js
const redis = require("redis");
const client = redis.createClient({ url: "redis://localhost:6379" });
client.on("error", (err) => console.log("Redis Client Error", err));

async function start() {
  await client.connect();
}

start();

// Simulating stock price fetching from an external API
async function fetchStockPrice(stockSymbol) {
  // This is a mock function. In a real application, this would make an API call to a stock price service
  return (Math.random() * 100).toFixed(2); // Random stock price for demonstration
}

async function updateStockPriceInCache(stockSymbol, ttlLimit) {
  const cacheKey = `stockPrice:${stockSymbol}`;
  const newPrice = await fetchStockPrice(stockSymbol);

  await client.set(cacheKey, newPrice, "EX", ttlLimit);
  console.log(`Updated ${stockSymbol} price to $${newPrice} in the cache`);
}

// Example usage: Updating stock price in cache every 5 seconds
const stockSymbol = "AAPL";
const ttlLimit = 5; // stock expires in 5 seconds

setInterval(async () => {
  await updateStockPriceInCache(stockSymbol, ttlLimit);
}, 5000); // Update price every 5 seconds
```

### Key Considerations:

- High Data Volatility: Stock prices can fluctuate significantly within short periods, making a fixed TTL approach inefficient.
- Risk of Stale Data: Even a short TTL can lead to situations where the cached data becomes outdated, as stock prices can change in a matter of seconds during market hours.
- Market Reactivity: Financial decisions are often made based on current market conditions. Serving stale data, even if only a few seconds old, can lead to poor decision-making and potential financial loss.
