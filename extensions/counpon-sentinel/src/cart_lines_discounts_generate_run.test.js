import { describe, test, expect } from 'vitest';
import { defineConfig } from 'vitest/config';
import { cartLinesDiscountsGenerateRun } from './cart_lines_discounts_generate_run';
import { DiscountClass } from '../generated/api';


// Mock console para evitar logs en los tests
const originalConsole = console;

export default defineConfig({
    test: {
        logConsole: true,
        reporters: 'verbose'
    }
});



describe('cartLinesDiscountsGenerateRun', () => {
    // Test: carrito vacío
    test('should throw error when no cart lines are found', () => {
        console.log('+ Testing: Empty cart should throw error');

        const input = {
            cart: { lines: [] },
            discount: { discountClasses: [DiscountClass.Product] }
        };

        expect(() => cartLinesDiscountsGenerateRun(input)).toThrow('No cart lines found');

        console.log(" ");
        console.log("*************************************");
        console.log("    >>> Test passed: Empty Cart");
        console.log("*************************************");
    });

    test('Should return opearations for Normal Discounts', () => {
        console.log('+ Testing: Normal Discounts');

        const input = {
            cart: {
                lines: [
                    {
                        id: 'gid://shopify/CartLine/0',
                        quantity: 1,
                        merchandise: {
                            product: {
                                title: 'Air Purifier 35i',
                                productType: 'Air Purifier',
                                tiersConfig: { value: JSON.stringify([{"tier":"Tier 1","min":"2","max":"2"},{"tier":"Tier 2","min":"3","max":"3"},{"tier":"Tier 3","min":"4","max":"4"},{"tier":"Tier 4","min":"5","max":"5"},{"tier":"Tier 5","min":"6","max":"999999999"}]) },
                                discountsConfig: { value: JSON.stringify([{"tier":"Tier 1","_75i":"15","_45i":"0","_35i":"15","_flex":"0"},{"tier":"Tier 2","_75i":"15","_45i":"0","_35i":"15","_flex":"0"},{"tier":"Tier 3","_75i":"17","_45i":"0","_35i":"17","_flex":"0"},{"tier":"Tier 4","_75i":"19","_45i":"0","_35i":"19","_flex":"0"},{"tier":"Tier 5","_75i":"21","_45i":"0","_35i":"21","_flex":"0"}]) },
                                normalConfig: { value: JSON.stringify([{"product":"75i","discount":"0","discount_type":"percentage"},{"product":"45i","discount":"0","discount_type":"percentage"},{"product":"35i","discount":"10","discount_type":"percentage"},{"product":"flex","discount":"100","discount_type":"amount"}]) },
                            }
                        },
                        cost: {
                            subtotalAmount: {
                                amount: 269
                            }
                        }
                    }
                ]
            },
            discount: {
                discountClasses: [DiscountClass.Product]
            }
        };
        const result = cartLinesDiscountsGenerateRun(input);

        expect(result).toEqual({
            operations: [
                {
                    productDiscountsAdd: {
                        candidates: [
                            {
                                message: "[DC - ND] Promo Testing Discount 10% OFF",
                                targets: [{ cartLine: { id: "gid://shopify/CartLine/0" } }],
                                value: { percentage: { value: 10 } }
                            }
                        ],
                        selectionStrategy: "ALL"
                    }   
                }
            ]
        });

        console.log(" ");
        console.log("********************************************");
        console.log("    >>> Test passed: Normal Discounts");
        console.log("********************************************");

    });

    test('Should return opearations for Tier Discounts', () => {
        console.log('+ Testing: Tier Discounts');

        const input = {
            cart: {
                lines: [
                    {
                        id: 'gid://shopify/CartLine/0',
                        quantity: 2,
                        merchandise: {
                            product: {
                                title: 'Air Purifier 35i',
                                productType: 'Air Purifier',
                                tiersConfig: { value: JSON.stringify([{"tier":"Tier 1","min":"2","max":"2"},{"tier":"Tier 2","min":"3","max":"3"},{"tier":"Tier 3","min":"4","max":"4"},{"tier":"Tier 4","min":"5","max":"5"},{"tier":"Tier 5","min":"6","max":"999999999"}]) },
                                discountsConfig: { value: JSON.stringify([{"tier":"Tier 1","_75i":"15","_45i":"0","_35i":"15","_flex":"0"},{"tier":"Tier 2","_75i":"15","_45i":"0","_35i":"15","_flex":"0"},{"tier":"Tier 3","_75i":"17","_45i":"0","_35i":"17","_flex":"0"},{"tier":"Tier 4","_75i":"19","_45i":"0","_35i":"19","_flex":"0"},{"tier":"Tier 5","_75i":"21","_45i":"0","_35i":"21","_flex":"0"}]) },
                                normalConfig: { value: JSON.stringify([{"product":"75i","discount":"0","discount_type":"percentage"},{"product":"45i","discount":"0","discount_type":"percentage"},{"product":"35i","discount":"10","discount_type":"percentage"},{"product":"flex","discount":"100","discount_type":"amount"}]) },
                            }
                        },
                        cost: {
                            subtotalAmount: {
                                amount: 269
                            }
                        }
                    }
                ]
            },
            discount: {
                discountClasses: [DiscountClass.Product]
            }
        };
        const result = cartLinesDiscountsGenerateRun(input);

        expect(result).toEqual({
            operations: [
                {
                    productDiscountsAdd: {
                        candidates: [
                            {
                                message: "[DC - NT] Deals Crafter Code 15% OFF",
                                targets: [{ cartLine: { id: "gid://shopify/CartLine/0" } }],
                                value: { percentage: { value: 15 } }
                            }
                        ],
                        selectionStrategy: "ALL"
                    }   
                }
            ]
        });

        console.log(" ");
        console.log("********************************************");
        console.log("    >>> Test passed: Tier Discounts");
        console.log("********************************************");

    });

    test('Should return operations for Bundle Discounts', () => {
        console.log('+ Testing: Bundle Discounts');
    
        const input = {
            cart: {
                lines: [
                    {
                        id: 'gid://shopify/CartLine/0',
                        quantity: 1,
                        merchandise: {
                            product: {
                                id: 'gid://shopify/Product/1385884450929',
                                title: 'BreatheSmart 75i',
                                handle: 'alen-breathesmart-75i-air-purifier',
                                productType: 'Air Purifier',
                                crafterBundleConfig: {
                                    value: JSON.stringify({
                                        bundles: [{
                                            handle: 'deals-crafter-test-bundle',
                                            config: {
                                                items: [
                                                    {
                                                        product: 'gid://shopify/Product/1385884450929',
                                                        handle: 'alen-breathesmart-75i-air-purifier',
                                                        amount: 20,
                                                        type: 'percentage'
                                                    },
                                                    {
                                                        product: 'gid://shopify/Product/1416213921905',
                                                        handle: 'alen-breathesmart-45i-air-purifier',
                                                        amount: 10,
                                                        type: 'percentage'
                                                    }
                                                ]
                                            }
                                        }]
                                    })
                                },
                                normalConfig: {
                                    value: JSON.stringify([
                                        { product: '75i', discount: '0', discount_type: 'percentage' },
                                        { product: '45i', discount: '0', discount_type: 'percentage' },
                                        { product: '35i', discount: '0', discount_type: 'percentage' },
                                        { product: 'flex', discount: '100', discount_type: 'amount' }
                                    ])
                                },
                                tiersConfig: {
                                    value: JSON.stringify([
                                        { tier: 'Tier 1', min: '2', max: '2' },
                                        { tier: 'Tier 2', min: '3', max: '3' },
                                        { tier: 'Tier 3', min: '4', max: '4' },
                                        { tier: 'Tier 4', min: '5', max: '5' },
                                        { tier: 'Tier 5', min: '6', max: '999999999' }
                                    ])
                                },
                                discountsConfig: {
                                    value: JSON.stringify([
                                        { tier: 'Tier 1', _75i: '15', _45i: '0', _35i: '15', _flex: '0' },
                                        { tier: 'Tier 2', _75i: '15', _45i: '0', _35i: '15', _flex: '0' },
                                        { tier: 'Tier 3', _75i: '17', _45i: '0', _35i: '17', _flex: '0' },
                                        { tier: 'Tier 4', _75i: '19', _45i: '0', _35i: '19', _flex: '0' },
                                        { tier: 'Tier 5', _75i: '21', _45i: '0', _35i: '21', _flex: '0' }
                                    ])
                                }
                            }
                        },
                        cost: {
                            subtotalAmount: {
                                amount: 799.0
                            }
                        },
                        crafterBundleName: {
                            value: 'deals-crafter-test-bundle'
                        },
                        isPreSaleProduct: {
                            value: 'false'
                        }
                    },
                    {
                        id: 'gid://shopify/CartLine/1',
                        quantity: 1,
                        merchandise: {
                            product: {
                                id: 'gid://shopify/Product/1416213921905',
                                title: 'BreatheSmart 45i',
                                handle: 'alen-breathesmart-45i-air-purifier',
                                productType: 'Air Purifier',
                                crafterBundleConfig: {
                                    value: JSON.stringify({
                                        bundles: [{
                                            handle: 'deals-crafter-test-bundle',
                                            config: {
                                                items: [
                                                    {
                                                        product: 'gid://shopify/Product/1385884450929',
                                                        handle: 'alen-breathesmart-75i-air-purifier',
                                                        amount: 20,
                                                        type: 'percentage'
                                                    },
                                                    {
                                                        product: 'gid://shopify/Product/1416213921905',
                                                        handle: 'alen-breathesmart-45i-air-purifier',
                                                        amount: 10,
                                                        type: 'percentage'
                                                    }
                                                ]
                                            }
                                        }]
                                    })
                                },
                                normalConfig: {
                                    value: JSON.stringify([
                                        { product: '75i', discount: '0', discount_type: 'percentage' },
                                        { product: '45i', discount: '0', discount_type: 'percentage' },
                                        { product: '35i', discount: '0', discount_type: 'percentage' },
                                        { product: 'flex', discount: '100', discount_type: 'amount' }
                                    ])
                                },
                                tiersConfig: {
                                    value: JSON.stringify([
                                        { tier: 'Tier 1', min: '2', max: '2' },
                                        { tier: 'Tier 2', min: '3', max: '3' },
                                        { tier: 'Tier 3', min: '4', max: '4' },
                                        { tier: 'Tier 4', min: '5', max: '5' },
                                        { tier: 'Tier 5', min: '6', max: '999999999' }
                                    ])
                                },
                                discountsConfig: {
                                    value: JSON.stringify([
                                        { tier: 'Tier 1', _75i: '15', _45i: '0', _35i: '15', _flex: '0' },
                                        { tier: 'Tier 2', _75i: '15', _45i: '0', _35i: '15', _flex: '0' },
                                        { tier: 'Tier 3', _75i: '17', _45i: '0', _35i: '17', _flex: '0' },
                                        { tier: 'Tier 4', _75i: '19', _45i: '0', _35i: '19', _flex: '0' },
                                        { tier: 'Tier 5', _75i: '21', _45i: '0', _35i: '21', _flex: '0' }
                                    ])
                                }
                            }
                        },
                        cost: {
                            subtotalAmount: {
                                amount: 488.0
                            }
                        },
                        crafterBundleName: {
                            value: 'deals-crafter-test-bundle'
                        },
                        isPreSaleProduct: {
                            value: 'false'
                        }
                    }
                ]
            },
            discount: {
                discountClasses: [DiscountClass.Product, DiscountClass.Order, DiscountClass.Shipping]
            }
        };
    
        const result = cartLinesDiscountsGenerateRun(input);
    
        expect(result).toEqual({
            operations: [
                {
                    productDiscountsAdd: {
                        candidates: [
                            {
                                message: "[DC - NB] deals-crafter-test-bundle",
                                targets: [{ cartLine: { id: "gid://shopify/CartLine/0" } }],
                                value: { percentage: { value: 20 } }
                            },
                            {
                                message: "[DC - NB] deals-crafter-test-bundle",
                                targets: [{ cartLine: { id: "gid://shopify/CartLine/1" } }],
                                value: { percentage: { value: 10 } }
                            }
                        ],
                        selectionStrategy: "ALL"
                    }
                }
            ]
        });
    
        console.log(" ");
        console.log("********************************************");
        console.log("    >>> Test passed: Bundle Discounts");
        console.log("********************************************");
    });
});