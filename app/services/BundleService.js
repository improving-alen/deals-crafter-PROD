// Service for handling bundle-related operations
export class BundleService {
  constructor(admin) {
    this.admin = admin;
  }

  // Helper function to execute GraphQL queries
  async executeGraphQL(query, variables = {}) {
    console.log(`>>> [BundleService] Executing GraphQL query...`);
    const response = await this.admin.graphql(query, { variables });
    const result = await response.json();
    
    if (result.errors) {
      console.error(`>>> [BundleService] GraphQL ERROR:`, JSON.stringify(result.errors, null, 2));
    }
    
    return result;
  }

  // Get product metafields by product ID
  async getProductMetafields(productId) {
    const query = `
      query GetProductMetafields($id: ID!) {
        product(id: $id) {
          metafields(first: 10, namespace: "custom") {
            edges {
              node {
                id
                key
                value
              }
            }
          }
        }
      }
    `;

    const result = await this.executeGraphQL(query, { id: productId });
    return result.data?.product?.metafields?.edges || [];
  }

  // Delete specific metafields from a product - CORREGIDO para API 2025-07
  async deleteProductMetafields(productId, metafieldKeys) {
    console.log(`>>> [BundleService] Deleting metafields from product: ${productId}`);
    
    const metafields = await this.getProductMetafields(productId);
    const metafieldsToDelete = metafields
      .filter(edge => metafieldKeys.includes(edge.node.key))
      .map(edge => edge.node.id);

    if (metafieldsToDelete.length === 0) {
      console.log(`>>> [BundleService] No metafields to delete for product: ${productId}`);
      return true;
    }

    // MUTATION CORREGIDA - Usando metafieldDelete sin wrapper 'input'
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

    for (const metafieldId of metafieldsToDelete) {
      console.log(`>>> [BundleService] Deleting metafield: ${metafieldId}`);
      
      try {
        const deleteResult = await this.executeGraphQL(deleteMutation, { id: metafieldId });

        if (deleteResult.errors || deleteResult.data?.metafieldDelete?.userErrors?.length > 0) {
          console.error('>>> [BundleService] Error deleting metafield:', deleteResult.errors || deleteResult.data?.metafieldDelete?.userErrors);
          // Continuamos aunque falle una eliminación
        }
      } catch (error) {
        console.error(`>>> [BundleService] Could not delete metafield ${metafieldId}, continuing...`);
        // Continuamos aunque falle una eliminación
      }
    }

    console.log(`>>> [BundleService] Completed deletion attempts for ${metafieldsToDelete.length} metafields from product: ${productId}`);
    return true;
  }

  // Create bundle metafields on a product
  async createBundleMetafields(productId, bundleProducts, bundleConfig) {
    console.log(`>>> [BundleService] Creating bundle metafields for product: ${productId}`);

    const mutation = `
      mutation CreateBundleMetafields($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
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

    const variables = {
      metafields: [
        {
          ownerId: productId,
          namespace: "custom",
          key: "bundle_products_improving",
          value: JSON.stringify(bundleProducts),
          type: "list.product_reference"
        },
        {
          ownerId: productId,
          namespace: "custom",
          key: "bundle_crafter_configuration",
          value: JSON.stringify(bundleConfig),
          type: "json"
        }
      ]
    };

    const result = await this.executeGraphQL(mutation, variables);

    if (result.errors || result.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error('>>> [BundleService] Error creating bundle metafields:', result.errors || result.data?.metafieldsSet?.userErrors);
      return false;
    }

    console.log(`>>> [BundleService] Successfully created bundle metafields for product: ${productId}`);
    return true;
  }

  // Get single unit metafield for a product
  async getSingleUnitMetafield(productId) {
    const query = `
      query GetSingleUnitMetafield($id: ID!) {
        product(id: $id) {
          metafield(namespace: "custom", key: "bundle_crafter_config_single_unit_json") {
            id
            value
          }
        }
      }
    `;

    const result = await this.executeGraphQL(query, { id: productId });
    return result.data?.product?.metafield;
  }

  // Update single unit metafield for bundle products
  async updateSingleUnitMetafield(productId, productHandle, bundleConfig) {
    console.log(`>>> [BundleService] Updating single unit metafield for product: ${productId}`);

    try {
      const existingMetafield = await this.getSingleUnitMetafield(productId);
      
      let bundlesArray = [];

      if (existingMetafield?.value) {
        const parsed = JSON.parse(existingMetafield.value);
        bundlesArray = Array.isArray(parsed.bundles) ? parsed.bundles : [];
      }

      // Add or update entry for this bundle handle
      const updatedBundles = [
        ...bundlesArray.filter(b => b.handle !== productHandle),
        {
          handle: productHandle,
          config: bundleConfig
        }
      ];

      const finalValue = JSON.stringify({
        bundles: updatedBundles
      });

      // Save the updated metafield
      const mutation = `
        mutation SaveSingleUnitMetafield($metafield: MetafieldsSetInput!) {
          metafieldsSet(metafields: [$metafield]) {
            metafields {
              id
              key
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const saveResult = await this.executeGraphQL(mutation, {
        metafield: {
          ownerId: productId,
          namespace: "custom",
          key: "bundle_crafter_config_single_unit_json",
          value: finalValue,
          type: "json"
        }
      });

      if (saveResult.data?.metafieldsSet?.userErrors?.length > 0) {
        console.warn(">>> [BundleService] User errors saving single unit config:", saveResult.data.metafieldsSet.userErrors);
        return false;
      }

      console.log(`>>> [BundleService] Successfully updated single unit metafield for product: ${productId}`);
      return true;

    } catch (error) {
      console.error(`>>> [BundleService] Error updating single unit metafield for product ${productId}:`, error);
      return false;
    }
  }

  // Alternative approach: Use metafieldsSet to overwrite instead of delete + create
  async overwriteBundleMetafields(productId, bundleProducts, bundleConfig) {
    console.log(`>>> [BundleService] Overwriting bundle metafields for product: ${productId}`);

    const mutation = `
      mutation OverwriteBundleMetafields($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
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

    const variables = {
      metafields: [
        {
          ownerId: productId,
          namespace: "custom",
          key: "bundle_products_improving",
          value: JSON.stringify(bundleProducts),
          type: "list.product_reference"
        },
        {
          ownerId: productId,
          namespace: "custom",
          key: "bundle_crafter_configuration",
          value: JSON.stringify(bundleConfig),
          type: "json"
        }
      ]
    };

    const result = await this.executeGraphQL(mutation, variables);

    if (result.errors || result.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error('>>> [BundleService] Error overwriting bundle metafields:', result.errors || result.data?.metafieldsSet?.userErrors);
      return false;
    }

    console.log(`>>> [BundleService] Successfully overwrote bundle metafields for product: ${productId}`);
    return true;
  }
}