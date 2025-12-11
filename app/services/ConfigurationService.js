import { MetaObjectService } from './MetaObjectService.js';
import { ProductMetafieldService } from './ProductMetafieldService.js';

// Main service that orchestrates configuration saving
export class ConfigurationService {
  constructor(admin) {
    this.metaobjectService = new MetaObjectService(admin);
    this.metafieldService = new ProductMetafieldService(admin);
  }

  // Save all configurations to both metaobjects and product metafields
  async saveAllConfigurations(configurations) {
    const {
      tiersInfo,
      productsInfo,
      normalInfo,
      preSaleInfoState,
      extraPreSaleDiscount,
      isPreSaleEnabled
    } = configurations;

    console.log(">>> [ConfigurationService] Starting to save all configurations");

    try {
      // 1. Save configurations to metaobjects
      await this.saveToMetaobjects({
        tiersInfo,
        productsInfo,
        normalInfo,
        preSaleInfoState,
        extraPreSaleDiscount,
        isPreSaleEnabled
      });

      // 2. Save configurations to product metafields
      await this.saveToProductMetafields({
        tiersInfo,
        productsInfo,
        normalInfo,
        preSaleInfoState,
        extraPreSaleDiscount,
        isPreSaleEnabled
      });

      console.log(">>> [ConfigurationService] All configurations saved successfully!");
      return { success: true, message: "All configurations saved successfully in metaobjects and product metafields!" };

    } catch (error) {
      console.error('>>> [ConfigurationService] Error saving configurations:', error);
      return { success: false, message: "An unexpected error occurred during configuration save." };
    }
  }

  // Save configurations to metaobjects
  async saveToMetaobjects(configurations) {
    const {
      tiersInfo,
      productsInfo,
      normalInfo,
      preSaleInfoState,
      extraPreSaleDiscount,
      isPreSaleEnabled
    } = configurations;

    console.log(">>> [ConfigurationService] Saving configurations to metaobjects");

    // 1. Extra discount configuration
    await this.metaobjectService.deleteMetaobjectsByType("pre_sale_extra_tier_discount");
    await this.metaobjectService.upsertMetaobject(
      "pre_sale_extra_tier_discount",
      `extra-discount-${Date.now()}`,
      [{ key: "amount", value: extraPreSaleDiscount.toString() }]
    );

    await this.metaobjectService.deleteMetaobjectsByType("is_pre_sale_enabled");
    await this.metaobjectService.upsertMetaobject(
        "is_pre_sale_enabled",
        `is-pre-sale-enabled-${Date.now()}`,
        [
          { 
            key: "ispresaleenabled", 
            value: isPreSaleEnabled ? "true" : "false" 
          }
        ]
      ); 

    console.log(">>>>>> [ConfigurationService] IS PRE SALE ENABLED:", isPreSaleEnabled);

    // 2. Presale configuration
    await this.metaobjectService.deleteMetaobjectsByType("presale_info_imp");
    for (const preSaleItem of preSaleInfoState) {
      await this.metaobjectService.upsertMetaobject(
        "presale_info_imp",
        `${preSaleItem.product.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        [
          { key: "product", value: preSaleItem.product.toString() },
          { key: "discount", value: preSaleItem.discount.toString() },
          { key: "discount_type", value: preSaleItem.discount_type.toString() }
        ]
      );
    }

    // 3. Normal configuration
    await this.metaobjectService.deleteMetaobjectsByType("normal_info_imp");
    for (const normalConfigItem of normalInfo) {
      await this.metaobjectService.upsertMetaobject(
        "normal_info_imp",
        `${normalConfigItem.product.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        [
          { key: "product", value: normalConfigItem.product.toString() },
          { key: "discount", value: normalConfigItem.discount.toString() },
          { key: "discount_type", value: normalConfigItem.discount_type.toString() }
        ]
      );
    }

    // 4. Tiers configuration
    await this.metaobjectService.deleteMetaobjectsByType("tiers_info_imp");
    for (const tier of tiersInfo) {
      await this.metaobjectService.upsertMetaobject(
        "tiers_info_imp",
        `${tier.tier.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
        [
          { key: "tier", value: tier.tier.toString() },
          { key: "min", value: tier.min.toString() },
          { key: "max", value: tier.max.toString() }
        ]
      );
    }

    // 5. Products discount configuration
    await this.metaobjectService.deleteMetaobjectsByType("product_discounts_info_imp");
    for (const product of productsInfo) {
      await this.metaobjectService.upsertMetaobject(
        "product_discounts_info_imp",
        `${product.tier.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
        [
          { key: "tier", value: product.tier.toString() },
          { key: "_75i", value: product._75i.toString() },
          { key: "_45i", value: product._45i.toString() },
          { key: "_35i", value: product._35i.toString() },
          { key: "_25i", value: product._25i.toString() },
          { key: "_flex", value: product._flex.toString() }
        ]
      );
    }

    console.log(">>> [ConfigurationService] Successfully saved all configurations to metaobjects");
  }

  // Save configurations to product metafields
  async saveToProductMetafields(configurations) {
    const {
      tiersInfo,
      productsInfo,
      normalInfo,
      preSaleInfoState,
      extraPreSaleDiscount,
      isPreSaleEnabled
    } = configurations;

    console.log(">>> [ConfigurationService] Saving configurations to product metafields");

    // Get products with the specific tag
    const products = await this.metafieldService.getProductsByTag("tag:own-bundle-app");
    console.log(`>>> [ConfigurationService] Found ${products.length} products to update`);

    if (products.length === 0) {
      console.log(">>> [ConfigurationService] No products found to update");
      return;
    }

    // Define metafields to delete
    const metafieldKeysToDelete = [
      "presale_info_improving",
      "presale_extra_tier_configuration", 
      "tiers_configuration",
      "product_discounts_configuration",
      "normal_info_imp",
      "presale_info_imp",
      "is_pre_sale_enabled"
    ];

    // Delete existing metafields
    await this.metafieldService.deleteProductMetafields(products, metafieldKeysToDelete);

    // Define new metafields configuration
    const metafieldsConfig = [
      { key: "normal_info_imp", value: normalInfo },
      { key: "presale_info_imp", value: preSaleInfoState },
      { key: "presale_extra_tier_configuration", value: { amount: extraPreSaleDiscount } },
      { key: "tiers_configuration", value: tiersInfo },
      { key: "product_discounts_configuration", value: productsInfo },
      { key: "is_pre_sale_enabled", value: isPreSaleEnabled }
    ];

    // Set new metafields
    const success = await this.metafieldService.setProductMetafieldsSequential(products, metafieldsConfig);

    if (!success) {
      throw new Error("Failed to set product metafields");
    }

    console.log(">>> [ConfigurationService] Successfully saved configurations to product metafields");
  }

  // Load all configurations from metaobjects
  async loadAllConfigurations() {
    console.log(">>> [ConfigurationService] Loading all configurations from metaobjects");

    const configurations = {};

    try {
      // Load extra discount
      const extraDiscount = await this.metaobjectService.loadConfiguration(
        "pre_sale_extra_tier_discount",
        { amount: "amount" }
      );
      configurations.preSaleExtraDiscountInfo = extraDiscount[0]?.amount || "0";

      // Load presale info
      configurations.preSaleInfo = await this.metaobjectService.loadConfiguration(
        "presale_info_imp",
        {
          product: "product",
          discount: "discount",
          discount_type: "discount_type"
        }
      );

      // Load normal info
      configurations.normalInfo = await this.metaobjectService.loadConfiguration(
        "normal_info_imp",
        {
          product: "product",
          discount: "discount",
          discount_type: "discount_type"
        }
      );

      // Load tiers info
      configurations.tiersInfo = await this.metaobjectService.loadConfiguration(
        "tiers_info_imp",
        {
          tier: "tier",
          min: "min",
          max: "max"
        }
      );

      // Load products info
      configurations.productsInfo = await this.metaobjectService.loadConfiguration(
        "product_discounts_info_imp",
        {
          tier: "tier",
          _75i: "_75i",
          _45i: "_45i",
          _35i: "_35i",
          _25i: "_25i",
          _flex: "_flex"
        }
      );

      // Load isPreSaleEnabled
      configurations.isPreSaleEnabled = await this.metaobjectService.loadConfiguration(
        "is_pre_sale_enabled",
        {
          isPreSaleEnabled: "isPreSaleEnabled"
        }
      );

      console.log(">>> [ConfigurationService] Successfully loaded all configurations");
      return configurations;

    } catch (error) {
      console.error('>>> [ConfigurationService] Error loading configurations:', error);
      // Return default configurations if loading fails
      return this.getDefaultConfigurations();
    }
  }

  // Get default configurations (fallback)
  getDefaultConfigurations() {
    return {
      preSaleExtraDiscountInfo: "0",
      preSaleInfo: [],
      normalInfo: [],
      tiersInfo: [],
      productsInfo: [],
      isPreSaleEnabled: false
    };
  }
}