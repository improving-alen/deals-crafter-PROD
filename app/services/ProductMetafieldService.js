// Service for handling product metafield operations
export class ProductMetafieldService {
  constructor(admin) {
    this.admin = admin;
  }

  // Helper function to execute GraphQL queries
  async executeGraphQL(query, variables = {}) {
    console.log(`>>> [ProductMetafieldService] Executing GraphQL query...`);
    const response = await this.admin.graphql(query, { variables });
    const result = await response.json();
    
    if (result.errors) {
      console.error(`>>> [ProductMetafieldService] GraphQL ERROR:`, JSON.stringify(result.errors, null, 2));
    }
    
    return result;
  }

  // Get products by tag with their metafields
  async getProductsByTag(tag, first = 250) {
    const query = `
      query GetProductsWithTag($tag: String!, $first: Int!) {
        products(first: $first, query: $tag) {
          edges {
            node {
              id
              metafields(first: 10, namespace: "custom") {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result = await this.executeGraphQL(query, { tag, first });
    return result.data?.products?.edges || [];
  }

  // Delete specific metafields from products in batches
  async deleteProductMetafields(products, metafieldKeys) {
    console.log(`>>> [ProductMetafieldService] Deleting metafields from ${products.length} products`);
    
    const deleteMutation = `
      mutation MetafieldDelete($id: ID!) {
        metafieldDelete(id: $id) {
          deletedId
          userErrors {
            field
            message
          }
        }
      }
    `;

    let deletedCount = 0;

    for (const productEdge of products) {
      const product = productEdge.node;

      for (const metafield of product.metafields.edges) {
        if (metafieldKeys.includes(metafield.node.key)) {
          console.log(`>>> [ProductMetafieldService] Deleting metafield: ${metafield.node.key} from product: ${product.id}`);
          
          try {
            await this.executeGraphQL(deleteMutation, { id: metafield.node.id });
            deletedCount++;
          } catch (error) {
            console.log(`>>> [ProductMetafieldService] Could not delete metafield ${metafield.node.key}, continuing...`);
          }
        }
      }
    }

    console.log(`>>> [ProductMetafieldService] Successfully deleted ${deletedCount} metafields`);
    return deletedCount;
  }

  // Set multiple metafields on products in batches (MAX 25 per operation)
  async setProductMetafields(products, metafieldsConfig) {
    console.log(`>>> [ProductMetafieldService] Setting metafields on ${products.length} products`);
    
    const mutation = `
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Calculate total metafields to create
    const totalMetafields = products.length * metafieldsConfig.length;
    console.log(`>>> [ProductMetafieldService] Total metafields to create: ${totalMetafields}`);

    // Process in batches of 5 products at a time (5 products * 5 metafields = 25)
    const BATCH_SIZE = 5;
    let successfulBatches = 0;
    let failedBatches = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      console.log(`>>> [ProductMetafieldService] Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(products.length/BATCH_SIZE)}`);

      const metafieldsInput = [];

      for (const productEdge of batch) {
        const product = productEdge.node;

        for (const config of metafieldsConfig) {
          metafieldsInput.push({
            namespace: "custom",
            key: config.key,
            ownerId: product.id,
            type: "json",
            value: JSON.stringify(config.value)
          });
        }
      }

      console.log(`>>> [ProductMetafieldService] Creating ${metafieldsInput.length} metafields in this batch`);

      try {
        const result = await this.executeGraphQL(mutation, { metafields: metafieldsInput });

        if (result.errors || result.data?.metafieldsSet?.userErrors?.length > 0) {
          console.error('>>> [ProductMetafieldService] Error setting metafields in batch:', result.errors || result.data?.metafieldsSet?.userErrors);
          failedBatches++;
        } else {
          console.log(`>>> [ProductMetafieldService] Successfully set ${metafieldsInput.length} metafields in batch`);
          successfulBatches++;
        }
      } catch (error) {
        console.error('>>> [ProductMetafieldService] Error in batch operation:', error);
        failedBatches++;
      }

      // Small delay to avoid rate limiting
      if (i + BATCH_SIZE < products.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`>>> [ProductMetafieldService] Batch processing completed: ${successfulBatches} successful, ${failedBatches} failed`);
    
    return failedBatches === 0;
  }

  // Alternative method: Process one product at a time (slower but more reliable)
  async setProductMetafieldsSequential(products, metafieldsConfig) {
    console.log(`>>> [ProductMetafieldService] Setting metafields sequentially on ${products.length} products`);
    
    const mutation = `
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    let successfulProducts = 0;
    let failedProducts = 0;

    for (let i = 0; i < products.length; i++) {
      const productEdge = products[i];
      const product = productEdge.node;

      console.log(`>>> [ProductMetafieldService] Processing product ${i + 1} of ${products.length}: ${product.id}`);

      const metafieldsInput = metafieldsConfig.map(config => ({
        namespace: "custom",
        key: config.key,
        ownerId: product.id,
        type: "json",
        value: JSON.stringify(config.value)
      }));

      try {
        const result = await this.executeGraphQL(mutation, { metafields: metafieldsInput });

        if (result.errors || result.data?.metafieldsSet?.userErrors?.length > 0) {
          console.error(`>>> [ProductMetafieldService] Error setting metafields for product ${product.id}:`, result.errors || result.data?.metafieldsSet?.userErrors);
          failedProducts++;
        } else {
          console.log(`>>> [ProductMetafieldService] Successfully set metafields for product ${product.id}`);
          successfulProducts++;
        }
      } catch (error) {
        console.error(`>>> [ProductMetafieldService] Error processing product ${product.id}:`, error);
        failedProducts++;
      }

      // Delay between products to avoid rate limiting
      if (i < products.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`>>> [ProductMetafieldService] Sequential processing completed: ${successfulProducts} successful, ${failedProducts} failed`);
    
    return failedProducts === 0;
  }
}