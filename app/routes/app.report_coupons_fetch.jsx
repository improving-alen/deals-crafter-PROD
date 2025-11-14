// app/routes/app.report_coupons_fetch.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// POST endpoint to fetch coupon orders [DC]
export const action = async ({ request }) => {
    try {
        const { admin } = await authenticate.admin(request);

        const body = await request.json();
        const { startDate, endDate } = body;

        if (!startDate || !endDate) {
        return json({ error: "Start and End dates are required." }, { status: 400 });
        }

        const GET_COUPON_ORDERS = `
            {
                orders(
                    first: 100,
                    reverse: true,
                    query: "created_at:>=${startDate} AND created_at:<=${endDate}",
                    sortKey: ID
                ) 
                {
                    edges {
                        node {
                            id
                            name
                            createdAt
                            currentTotalPriceSet {
                                shopMoney {
                                amount
                                currencyCode
                                }
                            }
                            totalDiscountsSet {
                                shopMoney {
                                amount
                                currencyCode
                                }
                            }
                            discountApplications(first: 10) {
                                edges {
                                    node {
                                        __typename
                                        ... on AutomaticDiscountApplication {
                                            title
                                            value {
                                                __typename
                                                ... on PricingPercentageValue {
                                                    percentage
                                                }
                                                ... on MoneyV2 {
                                                    amount
                                                    currencyCode
                                                }
                                            }
                                        }
                                        ... on DiscountCodeApplication {
                                            code
                                            value {
                                                __typename
                                                ... on PricingPercentageValue {
                                                    percentage
                                                }
                                                ... on MoneyV2 {
                                                    amount
                                                    currencyCode
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            lineItems(first: 50) {
                                edges {
                                    node {
                                        name
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `;

        const response = await admin.graphql(GET_COUPON_ORDERS);
        const data = await response.json();

        // Map and filter orders with coupons starting with [DC -]
        const orders = data.data.orders.edges
            .map(edge => {
                const coupons = edge.node.discountApplications.edges
                .map(e => {
                    let couponTitle = '';
                    let amount = null;
                    let percentage = null;
                    let currencyCode = null;

                    if (e.node.__typename === "AutomaticDiscountApplication") {
                        couponTitle = e.node.title;
                        if (e.node.value?.__typename === "MoneyV2") {
                            amount = e.node.value.amount;
                            currencyCode = e.node.value.currencyCode;
                        } else if (e.node.value?.__typename === "PricingPercentageValue") {
                            percentage = e.node.value.percentage;
                        }
                    } else if (e.node.__typename === "DiscountCodeApplication") {
                        couponTitle = e.node.code || '';
                        if (e.node.value?.__typename === "MoneyV2") {
                            amount = e.node.value.amount;
                            currencyCode = e.node.value.currencyCode;
                        } else if (e.node.value?.__typename === "PricingPercentageValue") {
                            percentage = e.node.value.percentage;
                        }
                    }

                    return couponTitle ? {
                        title: couponTitle,
                        amount: amount ? parseFloat(amount) : null,
                        percentage: percentage ? parseFloat(percentage) : null,
                        currency: currencyCode
                    } : null;
                }).filter(Boolean);

                const total = parseFloat(edge.node.currentTotalPriceSet.shopMoney.amount);
                const discounts = parseFloat(edge.node.totalDiscountsSet.shopMoney.amount);
                const revenue = total - discounts;

                const items = edge.node.lineItems.edges.map(i => i.node.name);

                return {
                    id: edge.node.id,
                    name: edge.node.name,
                    createdAt: edge.node.createdAt,
                    total,
                    discounts,
                    revenue,
                    currency: edge.node.currentTotalPriceSet.shopMoney.currencyCode,
                    coupons,
                    items,
                };
            })
            .filter(order => order.coupons.some(c => 
                c.title && c.title.match(/^\[DC\s*-\s*(NB|PB|NT|PT|ND|PD)\]/)
            ));

        return json({ orders });
    } catch (error) {
        console.error("Error fetching coupon orders:", error);
        return json({ error: "Failed to fetch coupon orders." }, { status: 500 });
    }
};

export const loader = () => {
    return json({});
};