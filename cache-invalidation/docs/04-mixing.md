# Mixing : Time-based Expiration + Change-driven Invalidation

Combining Time-based Expiration with Change-driven Invalidation can create a robust caching strategy that leverages the strengths of both approaches. This hybrid strategy ensures data freshness and consistency while also efficiently managing cache space and reducing unnecessary data fetching.

## Example 1 : Product Catalog with Price Updates

Consider an e-commerce platform where product details, including prices, are frequently accessed but only occasionally updated. You want to ensure that product information is served quickly (using time-based expiration) and remains accurate when prices change (using change-driven invalidation).

- Time-based Expiration: Set a reasonable TTL for product data to ensure cached items are automatically refreshed at intervals, reducing the load on the backend systems.
- Change-driven Invalidation: Implement a mechanism to invalidate or update the cache immediately when a product's price changes.

```js
//set up
const redis = require("redis");
const client = redis.createClient({ url: "redis://localhost:6379" });
client.on("error", (err) => console.log("Redis Client Error", err));

async function start() {
  await client.connect();
}

start();
```

```js
//Time-based Expiration

// Function to cache product data with a TTL
async function cacheProductData(productId, productData, ttl) {
  const key = `product:${productId}`;
  await client.setEx(key, ttl, JSON.stringify(productData));
  console.log(`Cached product ${productId} with TTL of ${ttl} seconds.`);
}
```

```js
//Change-driven Invalidation

// Function to update product price and invalidate the cache
async function updateProductPrice(productId, newPrice) {
  const key = `product:${productId}`;
  // Fetch product data, update the price, and refresh the cache
  let productData = await client.get(key);
  if (productData) {
    productData = JSON.parse(productData);
    productData.price = newPrice;
    await client.setEx(key, 3600, JSON.stringify(productData)); // Re-cache with new TTL
    console.log(`Updated price for product ${productId} and refreshed cache.`);
  } else {
    // Handle case where product is not in cache
    console.log(
      `Product ${productId} not found in cache. Fetching and caching.`
    );
    // Fetch from DB (simulated here as a function call)
    productData = await fetchProductFromDB(productId);
    productData.price = newPrice;
    await client.setEx(key, 3600, JSON.stringify(productData));
  }
}

async function fetchProductFromDB(productId) {
  // Simulate fetching product data from the database
  return { id: productId, name: "Product Name", price: "Product Price" };
}
```

**Combining the Strategies**

- Products are initially cached with a TTL, ensuring they are not stored indefinitely and are periodically refreshed.
- When a product's price changes, the cache is immediately invalidated or updated with the new price, ensuring that users always see the latest information.

This approach ensures that the cache does not serve stale data for longer than necessary, while also avoiding constant hits to the database for data that does not change frequently.

**Key Points**

- The time-based expiration handles the majority of the read load, providing quick access to product data and offloading the database.
- The change-driven invalidation ensures data integrity, updating the cache instantly when product prices change.
- Combining these strategies provides both performance efficiency and data accuracy, catering to the dynamic needs of e-commerce platforms.

---

## Example 2 : News Article Management

Consider a scenario where a news platform caches articles for quick access. While the core content of an article remains constant, certain elements like breaking news tags, editor's notes, or corrections might change.

- Time-based Expiration: Cache articles with a TTL to ensure they are automatically refreshed periodically, reducing the load on the content management system (CMS).
- Change-driven Invalidation: Implement a mechanism to invalidate or update the cache immediately when an article is updated or corrected.

```js
//setup
const redis = require("redis");
const client = redis.createClient({ url: "redis://localhost:6379" });
client.on("error", (err) => console.log("Redis Client Error", err));

async function start() {
  await client.connect();
}

start();
```

```js
// Time-based Expiration for Articles

// Function to cache article data with a TTL
async function cacheArticleData(articleId, articleData, ttl) {
  const key = `article:${articleId}`;
  await client.setEx(key, ttl, JSON.stringify(articleData));
  console.log(`Cached article ${articleId} with TTL of ${ttl} seconds.`);
}
```

```js
// Change-driven Invalidation for Article Updates

// Function to update article content and invalidate the cache
async function updateArticleContent(articleId, updatedContent) {
  const key = `article:${articleId}`;
  // Fetch article data, update the content, and refresh the cache
  let articleData = await client.get(key);
  if (articleData) {
    articleData = JSON.parse(articleData);
    articleData.content = updatedContent;
    await client.setEx(key, 3600, JSON.stringify(articleData)); // Re-cache with new TTL
    console.log(
      `Updated content for article ${articleId} and refreshed cache.`
    );
  } else {
    console.log(
      `Article ${articleId} not found in cache. Fetching and caching.`
    );
    // Fetch from CMS (simulated here as a function call)
    articleData = await fetchArticleFromCMS(articleId);
    articleData.content = updatedContent;
    await client.setEx(key, 3600, JSON.stringify(articleData));
  }
}

async function fetchArticleFromCMS(articleId) {
  // Simulate fetching article data from the CMS
  return { id: articleId, title: "Article Title", content: "Original Content" };
}
```

Key Points

- Efficiency in Access: Cached articles are quickly accessible, improving the reader's experience by reducing load times.
- Accuracy in Updates: When an article is updated, the cache is immediately invalidated or updated, ensuring that readers have access to the latest content without delay.
- Balanced Load: The combination of strategies balances the load on the CMS, ensuring that it is not overwhelmed with requests for fresh content.

By leveraging this hybrid approach, the news platform can efficiently manage the high demand for articles while ensuring that content updates are reflected in real-time, maintaining both performance and content accuracy.
