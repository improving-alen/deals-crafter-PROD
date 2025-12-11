// services/BundleConfigurationService.js
import { BundleService } from './BundleService.js';
import { PrismaConfigurationService } from "./PrismaConfigurationService.js";

export class BundleConfigurationService {
  constructor(admin) {
    this.bundleService = new BundleService(admin);
    this.prisma = new PrismaConfigurationService();
  }

  /** SAVE MAIN CONFIGURATION (metafields + prisma mirror) */
  async saveBundleConfiguration(configuration) {
    const {
      productId,
      productHandle,
      bundleProducts,
      bundleConfig
    } = configuration;

    console.log(">>> [BundleConfigurationService] Starting to save bundle configuration");

    try {
      // 1. Save metafields (existing flow)
      const overwriteSuccess = await this.bundleService.overwriteBundleMetafields(
        productId,
        bundleProducts,
        bundleConfig
      );

      if (!overwriteSuccess) {
        throw new Error("Failed to save bundle metafields");
      }

      // 2. Update single unit metafields (existing flow)
      await this.updateSingleUnitConfigurations(bundleConfig.items, productHandle, bundleConfig);

      // 3. SAVE MIRROR COPY IN PRISMA (NEW)
      try {
        await this.prisma.save(configuration.productHandle, configuration);
        console.log(">>> Prisma bundle saved OK.");
      } catch (err) {
        console.warn("⚠️ Prisma bundle save FAILED:", err);
      }

      return {
        success: true,
        message: "Bundle configuration saved successfully"
      };

    } catch (error) {
      console.error('>>> [BundleConfigurationService] Error saving bundle:', error);

      return {
        success: false,
        error: error.message || "Failed to save bundle configuration"
      };
    }
  }

  /** Update single unit configuration for each item inside bundle */
  async updateSingleUnitConfigurations(bundleItems, productHandle, bundleConfig) {
    console.log(`>>> Updating single unit configs for ${bundleItems.length} products`);

    const updatePromises = bundleItems.map(async item => {
      const productIdInBundle = item.product;

      try {
        const success = await this.bundleService.updateSingleUnitMetafield(
          productIdInBundle,
          productHandle,
          bundleConfig
        );

        return { productId: productIdInBundle, success };
      } catch (error) {
        console.error(`>>> Error updating single unit for ${productIdInBundle}:`, error);
        return { productId: productIdInBundle, success: false };
      }
    });

    return await Promise.all(updatePromises);
  }

  /** Load configuration (metafields only for now) */
  async loadBundleConfiguration(productId) {
    console.log(`>>> Loading bundle configuration for product: ${productId}`);

    try {
      const metafields = await this.bundleService.getProductMetafields(productId);

      const bundleProductsMf = metafields.find(edge => edge.node.key === "bundle_products_improving");
      const bundleConfigMf   = metafields.find(edge => edge.node.key === "bundle_crafter_configuration");

      const configuration = {};

      if (bundleProductsMf)
        configuration.bundleProducts = JSON.parse(bundleProductsMf.node.value);

      if (bundleConfigMf)
        configuration.bundleConfig = JSON.parse(bundleConfigMf.node.value);

      return configuration;

    } catch (error) {
      console.error(`>>> Error loading bundle configuration for ${productId}:`, error);
      return {};
    }
  }
}
