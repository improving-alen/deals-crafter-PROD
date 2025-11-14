import { BundleService } from './BundleService.js';

// Main service that orchestrates bundle configuration operations
export class BundleConfigurationService {
  constructor(admin) {
    this.bundleService = new BundleService(admin);
  }

  // Save complete bundle configuration
  async saveBundleConfiguration(configuration) {
    const {
      productId,
      productHandle,
      bundleProducts,
      bundleConfig
    } = configuration;

    console.log(">>> [BundleConfigurationService] Starting to save bundle configuration");

    try {
      // ENFOQUE SIMPLIFICADO: Usar overwrite en lugar de delete + create
      // Esto evita problemas con la mutation de delete
      const overwriteSuccess = await this.bundleService.overwriteBundleMetafields(
        productId, 
        bundleProducts, 
        bundleConfig
      );

      if (!overwriteSuccess) {
        throw new Error("Failed to save bundle metafields");
      }

      // Update single unit metafields for all bundle products
      await this.updateSingleUnitConfigurations(bundleConfig.items, productHandle, bundleConfig);

      console.log(">>> [BundleConfigurationService] Bundle configuration saved successfully!");
      return { 
        success: true, 
        message: "Bundle configuration saved successfully" 
      };

    } catch (error) {
      console.error('>>> [BundleConfigurationService] Error saving bundle configuration:', error);
      return { 
        success: false, 
        error: error.message || "Failed to save bundle configuration" 
      };
    }
  }

  // Alternative method with delete + create (if needed)
  async saveBundleConfigurationWithDelete(configuration) {
    const {
      productId,
      productHandle,
      bundleProducts,
      bundleConfig
    } = configuration;

    console.log(">>> [BundleConfigurationService] Starting to save bundle configuration (with delete)");

    try {
      // 1. Delete existing bundle metafields
      const metafieldKeysToDelete = [
        "bundle_products_improving",
        "bundle_crafter_configuration"
      ];

      // Intentamos eliminar, pero continuamos incluso si falla
      await this.bundleService.deleteProductMetafields(productId, metafieldKeysToDelete);

      // 2. Create new bundle metafields
      const createSuccess = await this.bundleService.createBundleMetafields(
        productId, 
        bundleProducts, 
        bundleConfig
      );

      if (!createSuccess) {
        throw new Error("Failed to create bundle metafields");
      }

      // 3. Update single unit metafields for all bundle products
      await this.updateSingleUnitConfigurations(bundleConfig.items, productHandle, bundleConfig);

      console.log(">>> [BundleConfigurationService] Bundle configuration saved successfully!");
      return { 
        success: true, 
        message: "Bundle configuration saved successfully" 
      };

    } catch (error) {
      console.error('>>> [BundleConfigurationService] Error saving bundle configuration:', error);
      return { 
        success: false, 
        error: error.message || "Failed to save bundle configuration" 
      };
    }
  }

  // Update single unit configurations for all products in the bundle
  async updateSingleUnitConfigurations(bundleItems, productHandle, bundleConfig) {
    console.log(`>>> [BundleConfigurationService] Updating single unit configurations for ${bundleItems.length} products`);

    const updatePromises = bundleItems.map(async (item) => {
      const productIdInBundle = item.product;
      
      try {
        const success = await this.bundleService.updateSingleUnitMetafield(
          productIdInBundle,
          productHandle,
          bundleConfig
        );

        if (!success) {
          console.warn(`>>> [BundleConfigurationService] Failed to update single unit config for product: ${productIdInBundle}`);
        }

        return { productId: productIdInBundle, success };
      } catch (error) {
        console.error(`>>> [BundleConfigurationService] Error processing product ${productIdInBundle}:`, error);
        return { productId: productIdInBundle, success: false, error: error.message };
      }
    });

    const results = await Promise.all(updatePromises);
    
    const successfulUpdates = results.filter(r => r.success).length;
    const failedUpdates = results.filter(r => !r.success).length;

    console.log(`>>> [BundleConfigurationService] Single unit updates completed: ${successfulUpdates} successful, ${failedUpdates} failed`);
    
    return results;
  }

  // Load bundle configuration from product metafields
  async loadBundleConfiguration(productId) {
    console.log(`>>> [BundleConfigurationService] Loading bundle configuration for product: ${productId}`);

    try {
      const metafields = await this.bundleService.getProductMetafields(productId);
      
      const bundleProductsMetafield = metafields.find(edge => 
        edge.node.key === "bundle_products_improving"
      );
      
      const bundleConfigMetafield = metafields.find(edge => 
        edge.node.key === "bundle_crafter_configuration"
      );

      const configuration = {};

      if (bundleProductsMetafield) {
        configuration.bundleProducts = JSON.parse(bundleProductsMetafield.node.value);
      }

      if (bundleConfigMetafield) {
        configuration.bundleConfig = JSON.parse(bundleConfigMetafield.node.value);
      }

      console.log(`>>> [BundleConfigurationService] Successfully loaded bundle configuration for product: ${productId}`);
      return configuration;

    } catch (error) {
      console.error(`>>> [BundleConfigurationService] Error loading bundle configuration for product ${productId}:`, error);
      return {};
    }
  }
}