# Change-driven Invalidation

Change-driven invalidation is a caching strategy where cache entries are invalidated or updated immediately following a change in the underlying data. This approach ensures that the cached data is always in sync with the source data, providing high data consistency and freshness.

In change-driven invalidation, we can actively monitors for changes in the underlying data
through various mechanisms, such as `database triggers`, `application-level hooks`, or by using a `publish/subscribe` model and then invalidate or update the corresponding cache entry when a change is detected.

## Advantages

- **High data consistency**: Ensures that the cache reflects the most up-to-date state of the data, minimizing the risk of serving stale data.

- **Efficient use of cache**: By updating the cache only when changes occur, this strategy prevents unnecessary cache refreshes, making it an efficient use of caching resources.

- **Reduced backend load**: By keeping the cache up-to-date, it reduces the need for users to fetch data directly from the backend, thereby reducing load.

- **Improved user experience**: Users get the most current data at speed, which is particularly important for applications where data freshness is critical.

## Disadvantages

- **Complexity**: Implementing a robust change-driven invalidation system can be complex, requiring additional infrastructure and logic to detect changes and update the cache accordingly.

- **Potential performance overhead**: Depending on the implementation, monitoring for changes and updating the cache in real-time can introduce performance overhead, especially if changes are frequent.

- **Scalability concerns**: For applications with a large number of data entities that frequently change, scaling the invalidation mechanism can be challenging.

## When to use ?

> It's optimal for ensuring high data consistency and freshness, but can be complex to implement and manage.

- **Data freshness is critical**: For applications that cannot tolerate stale data, such as financial stock trading platforms or real-time analytics.

- **Data changes are infrequent**: Ideal for data that doesn't change often, but when it does, the changes need to be reflected immediately.

- **High consistency requirement**: Applications where data consistency between the cache and the database is paramount, such as e-commerce platforms displaying product availability.

## Good Example : Inventory Management System

Imagine an inventory management system for an e-commerce platform. Products have quantities that change frequently due to customer purchases or stock updates. It's crucial that the cache reflects the most current inventory levels to prevent selling products that are out of stock.

### Using Redis Streams for Change Detection

Redis Streams offer a robust way to handle change events, providing persistence, fan-out to multiple consumers, and the ability to process messages that were added to the stream even if the consumer is temporarily down.

```js title="publisher.js"
//The publisher will add messages to a Redis Stream instead of publishing to a channel.

const redis = require("redis");
const client = redis.createClient();

async function start() {
  await client.connect();
}

start();

async function publishInventoryUpdate(productId, newQuantity) {
  const message = JSON.stringify({ productId, newQuantity });
  const streamName = "inventoryUpdates";

  // Add the message to the stream
  await client.xAdd(streamName, "*", { message });
  console.log(`Published inventory update for product ${productId} to stream`);
}

// Example of publishing an update
publishInventoryUpdate("product123", 10);
```

In this example, xAdd is used to add a message to the Redis Stream named inventoryUpdates. Each message in the stream is a key-value pair, where the key is a field name (message in this case) and the value is the JSON string of the update information.

```js title="subscriber.js"
//The subscriber will read messages from the Redis Stream and process them.

const redis = require("redis");
const client = redis.createClient();
const cacheClient = redis.createClient();

async function start() {
  await client.connect();
  await cacheClient.connect();
}

start();

async function subscribeToInventoryUpdates() {
  const streamName = "inventoryUpdates";
  let lastId = "0"; // Start reading from the beginning of the stream

  while (true) {
    const stream = await client.xRead({
      block: 1000,
      streams: [streamName, lastId],
    });

    if (stream) {
      const messages = stream[0].messages;
      lastId = messages[messages.length - 1].id;

      for (const message of messages) {
        const { productId, newQuantity } = JSON.parse(message.fields.message);
        console.log(
          `Received inventory update for product ${productId}. New quantity: ${newQuantity}`
        );

        const productCacheKey = `productCache:${productId}`;
        const cachedProduct = await cacheClient.get(productCacheKey);

        if (cachedProduct) {
          const productData = JSON.parse(cachedProduct);
          productData.quantity = newQuantity;
          await cacheClient.set(productCacheKey, JSON.stringify(productData));
          console.log(
            `Product cache updated for ${productId} with new quantity: ${newQuantity}`
          );
        } else {
          console.log(
            `No existing cache entry found for product ${productId}. Consider adding to cache.`
          );
        }
      }
    }
  }
}

subscribeToInventoryUpdates();
```

### Key Changes and Considerations:

Stream Consumption: The subscriber uses xRead to read messages from the stream. It processes each message and updates the cache accordingly. The block option is used to wait for new messages if the stream is empty.
Message Processing: Each message in the Redis Stream contains the data as fields. In this case, we stored the entire update information as a JSON string in the message field.
Persistent and Ordered: Redis Streams ensure that messages are stored persistently and processed in the order they were added, which is crucial for maintaining the consistency and correctness of the cache.

## Bad Example : Complex Relational Data Example

- complex relational data in cache, have to update all entries (nested JSON - de-normalized)

### E-Commerce Product Catalog with Relational Data

Consider an e-commerce platform with a product catalog where each **product has associated** categories, reviews, and inventory levels. These relationships are inherently complex and interdependent. For example, a single product might belong to multiple categories and have numerous reviews.

**Caching Nested JSON of Product Information** : When caching this product information, you might choose to store it as nested JSON objects to reduce the number of database calls for fetching related information. A single cache entry for a product could include its details, category information, reviews, and current inventory levels all nested together.

### The Problem with Change-driven Invalidation

- **Complexity in Detecting Relevant Changes**: When any piece of this complex data changes (e.g., a new review is added, or the inventory level changes), determining which cache entries need to be invalidated becomes challenging. If you're invalidating based on product updates, you must also consider how changes to categories or reviews might affect the cached data.

- **High Overhead in Maintaining Cache Consistency**: With complex relational data, a change in one entity might necessitate updating multiple cache entries to maintain consistency. For instance, adding a new review requires not only updating the cache for that specific product but potentially also for any cache entries that aggregate reviews or ratings across products.

- **Risk of Stale Data Due to Overlooked Dependencies**: In a relational database, entities are often interconnected in ways that might not be immediately apparent. A change in one table (like a category name update) could affect cached data in a non-obvious way, leading to stale data if the cache isn't properly invalidated.

```js
//Consider a cache entry for a product stored as nested JSON:

{
  "productId": "123",
  "name": "Smartphone",
  "categories": ["Electronics", "Mobile Phones"],
  "reviews": [{ "reviewId": "1", "content": "Great phone!" }],
  "inventoryLevel": 100
}
```

Now, imagine a new review is added or a category name changes. Detecting and invalidating the cache correctly involves understanding all potential relationships, which can be highly complex and error-prone.

To address the complexity of managing nested JSON data in a cache, especially in a change-driven invalidation context, you can consider either normalizing or denormalizing the data, depending on the specific requirements and characteristics of your application.

### Normalizing Cache Data

Normalization involves structuring the cache so that each logical piece of data is stored separately and references to other pieces of data are maintained through identifiers. This approach reduces redundancy and can simplify updates because only the specific piece of data that has changed needs to be updated in the cache.

- Advantages: Easier to manage updates and maintain consistency, especially for data that is frequently updated or has complex relationships.
- Drawbacks: May require additional lookups to reconstruct the full data view, potentially leading to more complex retrieval logic.

```js
//Instead of caching the entire product object with all its nested data, you would cache individual components separately, like product details, categories, and reviews:

// Cache product details
await client.set(`productDetail:${productId}`, JSON.stringify(productDetails));

// Cache categories
await client.set(`productCategories:${productId}`, JSON.stringify(categories));

// Cache reviews
await client.set(`productReviews:${productId}`, JSON.stringify(reviews));
```

### DeNormalizing Cache Data

DeNormalization involves combining related data into a single cache entry, which can simplify retrieval by reducing the number of lookups required to obtain a complete view of the data.

- Advantages: Simplifies data retrieval by reducing the number of cache lookups and can improve read performance.
- Drawbacks: Makes updating the cache more complex because a single change can require updating large, nested cache entries.

```js
//You would cache the entire product object, including all its nested data, in a single cache entry:

// Cache the entire product object, including details, categories, and reviews
await client.set(
  `productComplete:${productId}`,
  JSON.stringify({
    details: productDetails,
    categories: categories,
    reviews: reviews,
  })
);
```

### Choosing Between Normalization and DeNormalization

- Normalization is often preferred when data updates are frequent, and the relationships between data entities are complex.
- DeNormalization may be more appropriate when read performance is critical, and data updates are less frequent or less complex.

In some cases, a hybrid approach might be the most effective, where some data is normalized and other data is deNormalized to balance the benefits and drawbacks of each approach.
