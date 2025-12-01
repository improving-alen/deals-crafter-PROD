import {DiscountClass} from '../generated/api';

const GLOBAL_CONFIG = {
    PRODUCT_TYPE: "Air Purifier",
    MODEL_CODES: ["_25i","_35i", "_45i", "_75i", "_flex"],
    DEFAULT_DISCOUNT_PREFIX: "[DC] - ",
    DEFAULT_BUNDLE_DISCOUNT_PREFIX: "Deals Crafter Code",
    DEFAULT_NORMAL_DISCOUNT_PREFIX: "Promo Discount",
    DEFAULT_PRE_SALE_PREFIX: "Pre-Sale Discount",
    DEFAULT_CRAFTER_ATTRIBUTE: "crafterBundle",
    IS_PRESALE_ENABLED: false,
    IS_FUNCTION_ENABLED: true,
    AVOID_BUNDLE_TITLE: "BG"
};

export function cartLinesDiscountsGenerateRun(input) {

    if(GLOBAL_CONFIG.IS_FUNCTION_ENABLED === false) {
        return {operations: []};
    }
    if (!input.cart.lines.length) {
        throw new Error('No cart lines found');
    }

    const hasProductDiscountClass = input.discount.discountClasses.includes(DiscountClass.Product);

    if (!hasProductDiscountClass) {
        return {operations: []};
    }

    const configuredDiscounts           = findValidConfiguration(input.cart.lines);
    const { crafterBundles, cartItems } = getCrafterBundles(input.cart.lines);
    const totalQuantity                 = calculateRelevantQuantity(cartItems);

    GLOBAL_CONFIG.IS_PRESALE_ENABLED = input.cart.lines.some(line => line.isPreSaleProduct?.value?.toString() === 'true');

    const operations = calculateDiscounts(cartItems, crafterBundles, configuredDiscounts, totalQuantity);

    if (hasProductDiscountClass && operations.length > 0) {
        return {operations: operations};
    } else {
        return {operations: []};
    }
}

function getCrafterBundles(lines) {
    const accumulator = lines.reduce((acc, line) => {
        
      const crafterBundleName = line.crafterBundleName?.value;
      const bundleConfigStr = line.merchandise.product.crafterBundleConfig?.value;
  
      if (!bundleConfigStr || !crafterBundleName) {
        (acc.cartItems ||= []).push(line);
      } else {
        try {
          const parsedConfig = JSON.parse(bundleConfigStr); // { bundles: [...] }
  
          const bundleEntry = parsedConfig.bundles?.find(
            b => b.handle === crafterBundleName
          );
  
          if (!bundleEntry || !bundleEntry.config?.items) {
            console.warn(`⚠️ Bundle config not found for handle: ${crafterBundleName}`);
            (acc.cartItems ||= []).push(line);
          } else {
            acc.crafterBundles[crafterBundleName] = acc.crafterBundles[crafterBundleName] || {
              items: null,
              ids: []
            };
  
            acc.crafterBundles[crafterBundleName].items = bundleEntry.config.items;
            acc.crafterBundles[crafterBundleName].ids.push({
              handle: line.merchandise.product.handle,
              price: line.cost.subtotalAmount.amount,
              id: line.id
            });
          }
        } catch (e) {
          console.error(">>> Error parsing crafterBundleConfig JSON:", e);
          (acc.cartItems ||= []).push(line);
        }
      }
  
      return acc;
    }, { crafterBundles: {}, cartItems: [] });
  
    return accumulator;
}
  

function findValidConfiguration(lines) {
    for (const line of lines) {
        const product = line.merchandise?.product;
        const hasPickyBundle = product?.title?.includes(GLOBAL_CONFIG.AVOID_BUNDLE_TITLE);

        if (product?.productType === GLOBAL_CONFIG.PRODUCT_TYPE && !hasPickyBundle) {
            try {
                const tiers = safeParseJson(product.tiersConfig?.value);
                const discounts = safeParseJson(product.discountsConfig?.value);
                const normalDiscounts = safeParseJson(product.normalConfig?.value);
                const preSaleConfig = safeParseJson(product.presaleConfig?.value);
                const preSaleExtraTierConfig = safeParseJson(product.presaleExtraTierConfig?.value);

                return { tiers, discounts, normalDiscounts, preSaleConfig, preSaleExtraTierConfig };
            } catch (error) {
                console.error("Error parsing metafields:", error);
            }
        }
    }
    return null;
}

function safeParseJson(jsonString) {
    try {
        return jsonString ? JSON.parse(jsonString) : null;
    } catch (error) {
        console.error("JSON parse error:", error);
        return null;
    }
}

function calculateRelevantQuantity(lines) {
    return lines.reduce((total, line) => {

        const product = line.merchandise?.product;
        const hasPickyBundle = product?.title?.includes(GLOBAL_CONFIG.AVOID_BUNDLE_TITLE);

        return product?.productType === GLOBAL_CONFIG.PRODUCT_TYPE && !hasPickyBundle
            ? total + line.quantity
            : total;
    }, 0);
}

function calculateDiscounts(lines, crafterBundles = [],configuration, totalQuantity) {

    let isTierDiscount = false;
    let applyableDiscounts = [];
    let preSaleExtraTierConfig = 0;
    let preSaleConfig = [];

    const currentTier = configuration.tiers.find(tier =>
        totalQuantity >= tier.min && totalQuantity <= tier.max
    );

    if (!currentTier) {
        applyableDiscounts = configuration.normalDiscounts;
        if (!applyableDiscounts) {
            return [];
        }
    } else {
        applyableDiscounts = configuration.discounts.find(d => d.tier === currentTier.tier);
        if (!applyableDiscounts) {
            return [];
        }
        isTierDiscount = true;
    }

    if(GLOBAL_CONFIG.IS_PRESALE_ENABLED) {
        preSaleExtraTierConfig = Number(configuration.preSaleExtraTierConfig.amount);
        preSaleConfig = configuration.preSaleConfig;
    }

   const bundleCandidates = Object.entries(crafterBundles).flatMap(([discountKey, bundleData]) => {
        try {
            const remainingItems = [...bundleData.items];
            
            let amount = 0;
            const operations = [];

            for (const idData of bundleData.ids) {
                const itemIndex = remainingItems.findIndex(item =>
                    item.handle.toLowerCase() === idData.handle.toLowerCase()
                );

                if (itemIndex !== -1) {
                    const item = remainingItems[itemIndex];

                    if (GLOBAL_CONFIG.IS_PRESALE_ENABLED && preSaleExtraTierConfig) {
                        GLOBAL_CONFIG.DEFAULT_DISCOUNT_PREFIX = '[DC - PB] ';
                        if (item.type.trim() === "percentage") {
                            amount = Number(item.preSaleAmount);

                            if (amount > 100) {
                                amount = 100;
                            }
                            
                        } else {
                            amount = Number(item.preSaleAmount);
                        }
                    } else {
                        GLOBAL_CONFIG.DEFAULT_DISCOUNT_PREFIX = '[DC - NB] ';
                        amount = Number(item.amount);
                    }

                    const MAX_LENGTH = 50;
                    const randomLetters = generateRandomLetters(6);
                    let couponName = GLOBAL_CONFIG.DEFAULT_DISCOUNT_PREFIX + "Bundle" + randomLetters;
                    couponName = couponName.slice(0, MAX_LENGTH);
                    
                    operations.push({
                        message: couponName,
                        targets: [{
                            cartLine: {
                                id: idData.id
                            }
                        }],
                        value: item.type.trim() === "fixed_amount"
                            ? { fixedAmount: { amount: parseFloat(amount) } }
                            : { percentage: { value: parseFloat(amount) } }
                    });

                    remainingItems.splice(itemIndex, 1);
                }
            }

            return operations;
        } catch (error) {
            console.error(`Error processing bundle with key ${discountKey}:`, error);
            return [];
        }
    });

    const candidates = lines.reduce((acc, line) => {

        try {
            let discountToApply = null;
            let discountType = 'percentage';
            let originalDiscount = null;
            let discountCopy = '';

            const product = line.merchandise?.product;

            const modelCode = determineModelCode(product.title);

            if(product?.title?.includes(GLOBAL_CONFIG.AVOID_BUNDLE_TITLE))return acc;

            if (product?.productType !== GLOBAL_CONFIG.PRODUCT_TYPE) return acc;

            if(isTierDiscount) {
                
                if(GLOBAL_CONFIG.IS_PRESALE_ENABLED && line.isPreSaleProduct.value.toString() == 'true') {
                    GLOBAL_CONFIG.DEFAULT_DISCOUNT_PREFIX = '[DC - PT] ';
                    preSaleExtraTierConfig = Number(configuration.preSaleExtraTierConfig.amount);
                    originalDiscount = Number(applyableDiscounts[modelCode]);
                    discountToApply = Number(preSaleExtraTierConfig + originalDiscount);

                    if(discountType == 'percentage')
                        discountCopy = `${discountCopy} ${originalDiscount}% OFF`;
                    else
                        discountCopy = `${discountCopy} $${originalDiscount} OFF`;

                } else {
                    GLOBAL_CONFIG.DEFAULT_DISCOUNT_PREFIX = '[DC - NT] ';
                    discountToApply = Number(applyableDiscounts[modelCode]);
                    if(discountType == 'percentage')
                        discountCopy = `${GLOBAL_CONFIG.DEFAULT_BUNDLE_DISCOUNT_PREFIX} ${discountToApply}% OFF`;
                    else
                        discountCopy = `${GLOBAL_CONFIG.DEFAULT_BUNDLE_DISCOUNT_PREFIX} $${discountToApply} OFF`;
                }
            } else {
                
                let discountConfig = [];

                
                
                if(GLOBAL_CONFIG.IS_PRESALE_ENABLED && line.isPreSaleProduct.value.toString() == 'true') {
                    GLOBAL_CONFIG.DEFAULT_DISCOUNT_PREFIX = '[DC - PD] ';
                    discountConfig = preSaleConfig.find(d => d.product === determineModelCode(product.title).replace('_',''));
                    discountType = discountConfig.discount_type;
                    discountToApply = Number(discountConfig.discount);

                    if(discountType == 'percentage')
                        discountCopy = `${GLOBAL_CONFIG.DEFAULT_PRE_SALE_PREFIX} ${discountToApply}% OFF`;
                    else
                        discountCopy = `${GLOBAL_CONFIG.DEFAULT_PRE_SALE_PREFIX} $${discountToApply} OFF`;

                } else {
                    GLOBAL_CONFIG.DEFAULT_DISCOUNT_PREFIX = '[DC - ND] ';
                    discountConfig = applyableDiscounts.find(d => d.product === determineModelCode(product.title).replace('_',''));
                    discountType = discountConfig.discount_type;
                    discountToApply = Number(discountConfig.discount);

                    if(discountType === 'amount') {
                        discountCopy = `${GLOBAL_CONFIG.DEFAULT_NORMAL_DISCOUNT_PREFIX}`;
                    } else {
                        discountCopy = `${GLOBAL_CONFIG.DEFAULT_NORMAL_DISCOUNT_PREFIX} ${discountToApply}% OFF`;
                    }
                }


                discountType = discountConfig.discount_type;
                
            }

            if(discountToApply > 0) {
                if (typeof discountToApply !== 'number') {
                    return acc;
                }

                acc.push({
                    message: GLOBAL_CONFIG.DEFAULT_DISCOUNT_PREFIX + discountCopy,
                    targets: [{ cartLine: { id: line.id } }],
                    value: discountType === "amount"
                        ? { fixedAmount: { amount: parseFloat(discountToApply) } }
                        : { percentage: { value: parseFloat(discountToApply) } }
                });
            }

            return acc;
        } catch (error) {
            console.error("Discount application error:", error);
            return acc;
        }
    }, []);

    const combinedCandidates = [...bundleCandidates, ...candidates];

    if (combinedCandidates.length === 0) return [];

    return [{
        productDiscountsAdd: {
            candidates: combinedCandidates,
            selectionStrategy: "ALL"
        }
    }];
}

function determineModelCode(productTitle) {
    const normalizedTitle = productTitle.toLowerCase().replace(/\s+/g, '');
    const foundCode = GLOBAL_CONFIG.MODEL_CODES.find(code =>
        normalizedTitle.includes(code.replace('_', '').toLowerCase())
    );
    return foundCode || null;
}

function generateRandomLetters(length = 5) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return result;
}

