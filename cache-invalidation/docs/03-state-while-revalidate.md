# State while Revalidate

The **State while Revalidate** strategy involves serving data from the cache even if it is stale (i.e., past its expiration time) while asynchronously fetching the updated data from the source. Once the updated data is available, it is stored in the cache and served for subsequent requests.

This approach provides an excellent balance between fast response times and data freshness. It's particularly useful in situations where it's acceptable to serve slightly outdated content to improve performance or reduce backend load.

## Advantages

- **Improved user experience**: By serving stale content immediately and updating the cache in the background, users experience faster load times, improving the overall user experience.

- **Reduced backend load**: This strategy can significantly reduce the load on backend services, as it avoids simultaneous requests from overwhelming the server, spreading out the cache refreshes over time.

- **Balance between freshness and performance**: Offers a compromise between serving the most up-to-date content and maintaining fast response times, especially in scenarios where absolute data freshness is not critically urgent.

- **High availability**: Even if the source data is temporarily unavailable, the application can continue serving stale content, ensuring that the system remains functional.

## Disadvantages

- **Potential for stale data**: There's a risk of serving outdated information until the cache is updated, which may not be acceptable for all types of applications, especially those requiring real-time data accuracy.

- **Complexity in implementation**: Implementing a background update mechanism can add complexity to the caching logic, requiring careful management to ensure that updates are handled correctly.

- **Resource usage for background updates**: The process of updating stale content in the background can consume additional resources and may require rate limiting or other controls to manage the load on backend services effectively.

## When to Use?

> State while Revalidate is a good choice when a balance between performance and data freshness is required.

- **Performance is a priority**: Ideal for applications where response time is critical, and slight data staleness is acceptable.

- **Data updates are not real-time**: Suitable for content that does not require real-time accuracy, such as news articles or blog posts.

- **High traffic volumes**: In high-traffic situations, it helps in smoothing out spikes in backend load by serving stale content and updating the cache asynchronously.

## Good Example : News Article Content Delivery

On a news website, articles are frequently accessed by readers worldwide. While the core content of published articles changes infrequently, the associated metadata (e.g., number of comments, related articles) can change more dynamically. Implementing "Stale-While-Revalidate" ensures that readers receive instant content delivery while the system updates the cache in the background with the latest data, such as new comments or recommendations.

**Key Components**:

- Article Fetching Service: This component is responsible for retrieving article data either from the cache or the primary data store (e.g., a database).
- Cache Update Mechanism: A background process that updates cached articles with fresh data.

```js
const redis = require("redis");
const { promisify } = require("util");
const client = redis.createClient({ url: "redis://localhost:6379" });
client.on("connect", () => console.log("Connected to Redis"));
client.on("error", (err) => console.log("Redis Client Error", err));

const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);
const delAsync = promisify(client.del).bind(client);

async function getArticle(articleId) {
  const cacheKey = `article:${articleId}`;
  let articleData = await getAsync(cacheKey);

  if (articleData) {
    articleData = JSON.parse(articleData);
    console.log("Serving stale article:", articleData.article);

    // Check if we should update the cache based on the last update timestamp
    const lastUpdateDiff =
      Date.now() - new Date(articleData.lastUpdated).getTime();
    const updateThreshold = 15 * 60 * 1000; // 15 minutes in milliseconds

    if (lastUpdateDiff > updateThreshold) {
      console.log(
        "Threshold exceeded. Updating article cache in the background..."
      );
      updateArticleCache(articleId); // Update cache in the background asynchronously
    }
  } else {
    console.log("Cache miss. Fetching article from source...");
    articleData = {};
    articleData.article = await fetchArticleFromSource(articleId);
    updateArticleCache(articleId); // Update cache in the background asynchronously
  }

  return articleData?.article;
}

async function updateArticleCache(articleId) {
  const cacheUpdatingKey = `cacheUpdating:${articleId}`;
  let isCacheUpdateInProgress = await getAsync(cacheStampedeKey);

  // to prevent cache stampede
  if (!isCacheUpdateInProgress) {
    await setAsync(cacheUpdatingKey, true);

    // say time taking fetchArticle call
    const articleContent = await fetchArticleFromSource(articleId);
    const cacheKey = `article:${articleId}`;
    const cacheValue = JSON.stringify({
      article: articleContent,
      lastUpdated: new Date().toISOString(),
    });

    await setAsync(cacheKey, cacheValue, "EX", 3600); // 1 hour TTL for example
    console.log("Article cache updated:", articleId);

    await delAsync(cacheUpdatingKey);
  }
}

async function fetchArticleFromSource(articleId) {
  // Simulate fetching article content (could be a database or external API call)
  return {
    id: articleId,
    title: "Updated News Article",
    content: "Updated content of the article.",
  };
}

// Example usage
getArticle("123").then((article) => {
  console.log("Fetched article:", article);
});
```

**Key Points**:

- Instant Content Delivery: The user immediately receives article content, even if it's slightly outdated, enhancing the reading experience by ensuring zero wait time.
- Background Cache Update: Fresh data is fetched and the cache is updated in the background, ready for the next access, ensuring the article content and metadata remain up-to-date for subsequent readers.

## Bad Example : Real-time Stock Trading Application

In a real-time stock trading application, serving slightly stale data can lead to significant financial consequences. In such applications, the freshness of data is critical, as stock prices can fluctuate rapidly within seconds. Using "Stale-While-Revalidate" in this context may not be suitable because even a small delay in serving the latest data could result in outdated information being used for trading decisions.

In a stock trading platform, traders rely on real-time data to make buy or sell decisions. Serving them stale data while revalidating in the background can lead to missed opportunities or financial losses if the market moves unfavorably during the stale period.

```js
const redis = require("redis");
const fetchStockPrice = require("./stockApi"); // Assume this is a real-time stock price fetching service

const client = redis.createClient({ url: "redis://localhost:6379" });
client.on("error", (err) => console.log("Redis Client Error", err));

async function getStockPriceWithStaleWhileRevalidate(stockSymbol) {
  const cacheKey = `stockPrice:${stockSymbol}`;
  let priceData = await client.get(cacheKey);

  if (priceData) {
    console.log(`Serving stale price for ${stockSymbol}`);
    updateStockPriceInBackground(stockSymbol); // Revalidate in the background
  } else {
    console.log(`Cache miss. Fetching real-time price for ${stockSymbol}`);
    priceData = await fetchStockPrice(stockSymbol);
    updateStockPriceInBackground(stockSymbol); // Revalidate in the background
  }

  return priceData;
}

async function updateStockPriceInBackground(stockSymbol) {
  const realTimePrice = await fetchStockPrice(stockSymbol);
  await client.set(`stockPrice:${stockSymbol}`, realTimePrice, "EX", 30);
  console.log(`Updated real-time price for ${stockSymbol} in cache`);
}

// Simulated real-time stock price fetching function
async function fetchStockPrice(stockSymbol) {
  // This function would fetch the real-time price from a stock price API
  return `Price of ${stockSymbol} at ${new Date().toISOString()}`;
}

// Example usage
getStockPriceWithStaleWhileRevalidate("AAPL").then((price) => {
  console.log("Stock price:", price);
});
```

**Disadvantages Highlighted by This Code:**

- Timing Issues: The critical flaw here is the potential delay between serving the stale data and updating it with the real-time price. In the context of stock trading, even a few seconds can lead to significant financial impact.
- Complexity in Real-time Data Handling: Implementing "Stale-While-Revalidate" in environments requiring real-time data processing adds complexity without solving the fundamental need for immediate data freshness.
- Inadequate for Fast-moving Markets: In fast-moving markets, the revalidation process might not be quick enough to ensure data freshness, rendering the stale data not just outdated but potentially misleading.
