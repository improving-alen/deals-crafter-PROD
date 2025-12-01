// app/routes/app.report_coupons_fetch.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);

    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return json({ error: "Start and End dates are required." }, { status: 400 });
    }

    let hasNextPage = true;
    let cursor = null;
    let allOrders = [];

    while (hasNextPage) {
      const GET_COUPON_ORDERS = `
        {
          orders(
            first: 100
            reverse: true
            sortKey: ID
            query: "created_at:>=${startDate} AND created_at:<=${endDate}"
            ${cursor ? `after: "${cursor}"` : ""}
          ) {
            edges {
              cursor
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
                totalTaxSet {
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
                          ... on PricingPercentageValue { percentage }
                          ... on MoneyV2 { amount, currencyCode }
                        }
                      }
                      ... on DiscountCodeApplication {
                        code
                        value {
                          __typename
                          ... on PricingPercentageValue { percentage }
                          ... on MoneyV2 { amount, currencyCode }
                        }
                      }
                    }
                  }
                }
                lineItems(first: 50) {
                  edges { node { name } }
                }
              }
            }
            pageInfo {
              hasNextPage
            }
          }
        }
      `;

      const response = await admin.graphql(GET_COUPON_ORDERS);
      const data = await response.json();

      const batch = data.data.orders.edges;

      // Procesar estos resultados igual que antes
      const orders = batch
        .map(edge => {
          const coupons = edge.node.discountApplications.edges
            .map(e => {
              let couponTitle = "";
              let amount = null;
              let percentage = null;
              let currencyCode = null;

              if (e.node.__typename === "AutomaticDiscountApplication") {
                couponTitle = e.node.title;
                const v = e.node.value;
                if (v?.__typename === "MoneyV2") {
                  amount = parseFloat(v.amount);
                  currencyCode = v.currencyCode;
                } else if (v?.__typename === "PricingPercentageValue") {
                  percentage = parseFloat(v.percentage);
                }
              } else if (e.node.__typename === "DiscountCodeApplication") {
                couponTitle = e.node.code || "";
                const v = e.node.value;
                if (v?.__typename === "MoneyV2") {
                  amount = parseFloat(v.amount);
                  currencyCode = v.currencyCode;
                } else if (v?.__typename === "PricingPercentageValue") {
                  percentage = parseFloat(v.percentage);
                }
              }

              return couponTitle
                ? { title: couponTitle, amount, percentage, currency: currencyCode }
                : null;
            })
            .filter(Boolean);

          const total = parseFloat(edge.node.currentTotalPriceSet.shopMoney.amount);
          const discounts = parseFloat(edge.node.totalDiscountsSet.shopMoney.amount);
          const taxes = parseFloat(edge.node.totalTaxSet.shopMoney.amount || 0);
          const revenue = total - taxes;

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
        .filter(order =>
          order.coupons.some(c =>
            c.title && c.title.match(/^\[DC\s*-\s*(NB|PB|NT|PT|ND|PD)\]/)
          )
        );

      // Guardar resultados globales
      allOrders.push(...orders);

      // Preparar siguiente página
      hasNextPage = data.data.orders.pageInfo.hasNextPage;

      if (hasNextPage) {
        cursor = batch[batch.length - 1].cursor;
      }
    }

    return json({ orders: allOrders });
  } catch (error) {
    console.error("Error fetching coupon orders:", error);
    return json({ error: "Failed to fetch coupon orders." }, { status: 500 });
  }
};

export const loader = () => json({});
