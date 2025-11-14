// app/routes/app.report_coupons.jsx
import { useState } from "react";
import {
  Page,
  Card,
  Text,
  Badge,
  TextField,
  Button,
  BlockStack,
  Spinner,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

// Dictionary to map snake_case keys to human readable names
const groupLabels = {
    "[DC - NB]": "Normal Bundle",
    "[DC - PB]": "PreSale Bundle",
    "[DC - NT]": "Normal Tier",
    "[DC - PT]": "PreSale Tier",
    "[DC - ND]": "Normal Discount",
    "[DC - PD]": "PreSale Discount",
};

// Helper to count coupon usage
const countCouponUsage = (orders) => {
    const couponCount = {};
  
    orders.forEach(order => {
        order.coupons.forEach(coupon => {
            if (coupon.title.startsWith("[DC -")) {
                const couponType = coupon.title.split(']')[0] + ']';
                if (!couponCount[couponType]) {
                    couponCount[couponType] = 0;
                }
                couponCount[couponType]++;
            }
        });
    });
  
    return couponCount;
};

export default function CouponReports() {
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [error, setError] = useState("");

    // Function to fetch orders with coupon [DC] within the selected dates
    const fetchOrders = async () => {
        if (!startDate || !endDate) {
            setError("Please select both start and end dates.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const res = await fetch("/app/report_coupons_fetch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startDate, endDate }),
            });

            const data = await res.json();
            console.log(">>> API RESPONSE:", data);

            if (data.error) {
                setError(data.error);
                setOrders([]);
            } else {
                const filteredOrders = data.orders;
                console.log(">>> FILTERED ORDERS:", filteredOrders);

                if (filteredOrders.length === 0) {
                    setError("No orders found for the selected date range.");
                } else {
                    setError("");
                }
                setOrders(filteredOrders);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to fetch orders.");
            setOrders([]);
        } finally {
            setLoading(false);
        }
    };

    // Format currency
    const formatCurrency = (amount, currency) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    // Function to download Excel report
    const downloadExcelReport = async () => {
        if (orders.length === 0) {
            setError("No data to export.");
            return;
        }

        setExportLoading(true);

        try {
            // Dynamic import to avoid server-side issues
            const XLSX = await import('xlsx');
            
            // Create workbook
            const workbook = XLSX.utils.book_new();
            
            // Remove duplicate orders for the main list
            const uniqueOrders = orders.filter((order, index, self) =>
                index === self.findIndex(o => o.id === order.id)
            );

            // Create main orders sheet
            const ordersData = [
                ['Order Name', 'Order Date', 'Coupons', 'Products', 'Total', 'Discounts', 'Revenue', 'Currency', 'Coupon Types']
            ];

            uniqueOrders.forEach(order => {
                const couponsText = order.coupons.map(c => 
                    `${c.title}${c.percentage ? ` (${c.percentage}%)` : ''}${c.amount ? ` (${formatCurrency(c.amount, c.currency || order.currency)})` : ''}`
                ).join('; ');

                // Extract coupon types for filtering
                const couponTypes = order.coupons
                    .filter(c => c.title.startsWith("[DC -"))
                    .map(c => c.title.split(']')[0] + ']')
                    .join(', ');

                ordersData.push([
                    order.name,
                    new Date(order.createdAt).toLocaleDateString(),
                    couponsText,
                    order.items.join('; '),
                    order.total,
                    order.discounts,
                    order.revenue,
                    order.currency,
                    couponTypes
                ]);
            });

            const ordersSheet = XLSX.utils.aoa_to_sheet(ordersData);
            XLSX.utils.book_append_sheet(workbook, ordersSheet, 'All Orders');

            // Create coupon summary sheet
            const couponUsage = countCouponUsage(orders);
            const summaryData = [
                ['Coupon Type', 'Usage Count']
            ];

            // Add coupon counts
            Object.entries(couponUsage).forEach(([couponType, count]) => {
                summaryData.push([groupLabels[couponType], count]);
            });

            // Add total orders
            summaryData.push(['', '']);
            summaryData.push(['Total Unique Orders', uniqueOrders.length]);
            summaryData.push(['Total Discount Amount', formatCurrency(
                orders.reduce((sum, order) => sum + order.discounts, 0),
                orders[0]?.currency || 'USD'
            )]);
            summaryData.push(['Total Revenue', formatCurrency(
                orders.reduce((sum, order) => sum + order.revenue, 0),
                orders[0]?.currency || 'USD'
            )]);

            const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Coupon Summary');

            // Generate filename
            const formattedStartDate = startDate.replace(/-/g, '');
            const formattedEndDate = endDate.replace(/-/g, '');
            const fileName = `deals_crafter_report_${formattedStartDate}_${formattedEndDate}.xlsx`;

            // Download file
            XLSX.writeFile(workbook, fileName);

        } catch (error) {
            console.error('Error generating Excel report:', error);
            setError('Failed to generate Excel report.');
        } finally {
            setExportLoading(false);
        }
    };

    // Remove duplicate orders for display
    const uniqueOrders = orders.filter((order, index, self) =>
        index === self.findIndex(o => o.id === order.id)
    );

    const couponUsage = countCouponUsage(orders);

    return (
        <Page title="Coupon Reports">
            <TitleBar title="Coupon Reports" />

            {/* Filter Card */}
            <Card sectioned title="Generate Report" style={{ marginBottom: "20px" }}>
                <BlockStack spacing="loose">
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
                        <div style={{ flex: "1", minWidth: "200px" }}>
                            <TextField
                                type="date"
                                label="Start Date"
                                value={startDate}
                                onChange={setStartDate}
                                autoComplete="off"
                            />
                        </div>
                        <div style={{ flex: "1", minWidth: "200px" }}>
                            <TextField
                                type="date"
                                label="End Date"
                                value={endDate}
                                onChange={setEndDate}
                                autoComplete="off"
                            />
                        </div>
                        <InlineStack gap="200">
                            <Button
                                primary
                                onClick={fetchOrders}
                                disabled={loading}
                                style={{ backgroundColor: "#28a745", height: "40px", minWidth: "140px" }}
                            >
                                {loading ? <Spinner size="small" /> : "Generate Report"}
                            </Button>
                            {orders.length > 0 && (
                                <Button
                                    onClick={downloadExcelReport}
                                    disabled={loading || exportLoading}
                                    tone="success"
                                    style={{ 
                                        backgroundColor: "#28a745", 
                                        borderColor: "#28a745",
                                        height: "40px", 
                                        minWidth: "140px" 
                                    }}
                                >
                                    {exportLoading ? <Spinner size="small" /> : "Download Excel"}
                                </Button>
                            )}
                        </InlineStack>
                    </div>

                    {error && (
                        <Text variant="bodyMd" color="critical">
                            {error}
                        </Text>
                    )}
                </BlockStack>
            </Card>

            {/* Coupon Usage Summary */}
            {uniqueOrders.length > 0 && (
                <Card sectioned title="Coupon Usage Summary" style={{ marginBottom: "20px" }}>
                    <BlockStack spacing="tight">
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
                            <Card sectioned>
                                <Text variant="headingMd" as="h3">Total Orders</Text>
                                <Text variant="headingXl" as="p" fontWeight="bold">
                                    {uniqueOrders.length}
                                </Text>
                            </Card>
              
                            <Card sectioned>
                                <Text variant="headingMd" as="h3">Total Discount</Text>
                                <Text variant="headingXl" as="p" fontWeight="bold" color="critical">
                                    -{formatCurrency(
                                        orders.reduce((sum, order) => sum + order.discounts, 0),
                                        orders[0]?.currency || 'USD'
                                    )}
                                </Text>
                            </Card>
              
                            <Card sectioned>
                                <Text variant="headingMd" as="h3">Total Revenue</Text>
                                <Text variant="headingXl" as="p" fontWeight="bold">
                                    {formatCurrency(
                                        orders.reduce((sum, order) => sum + order.revenue, 0),
                                        orders[0]?.currency || 'USD'
                                    )}
                                </Text>
                            </Card>
                        </div>

                        <Card sectioned>
                            <Text variant="headingMd" as="h3" style={{ marginTop: "12px",marginBottom: "12px" }}>Coupon Types Used</Text>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                {Object.entries(couponUsage).map(([couponType, count]) => (
                                <Badge key={couponType} tone="info">
                                    {groupLabels[couponType]}: {count}
                                </Badge>
                                ))}
                            </div>
                        </Card>
                    </BlockStack>
                </Card>
            )}

            {/* All Orders List */}
            {uniqueOrders.length > 0 ? (
                <Card sectioned title={`All Orders (${uniqueOrders.length})`}>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
                            <thead>
                                <tr style={{ borderBottom: "2px solid #dfe3e8" }}>
                                <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Order</th>
                                <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Coupons</th>
                                <th style={{ padding: "12px", textAlign: "right", fontWeight: "bold" }}>Total</th>
                                <th style={{ padding: "12px", textAlign: "right", fontWeight: "bold" }}>Discounts</th>
                                <th style={{ padding: "12px", textAlign: "right", fontWeight: "bold" }}>Revenue</th>
                                <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Date</th>
                                <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Products</th>
                                </tr>
                            </thead>
                            <tbody>
                                {uniqueOrders.map(order => (
                                    <tr key={order.id} style={{ borderBottom: "1px solid #f0f3f5" }}>
                                        <td style={{ padding: "12px", verticalAlign: "top" }}>
                                            <Text variant="bodyMd" fontWeight="medium">
                                                {order.name}
                                            </Text>
                                        </td>
                                        <td style={{ padding: "12px", verticalAlign: "top" }}>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                                {order.coupons.map((c, i) => (
                                                <Badge key={i} tone="info">
                                                    {c.title}
                                                    {c.percentage !== null ? ` (${c.percentage}%)` : ''}
                                                    {c.amount !== null ? ` (${formatCurrency(c.amount, c.currency || order.currency)})` : ''}
                                                </Badge>
                                                ))}
                                            </div>
                                        </td>
                                        <td style={{ padding: "12px", textAlign: "right", verticalAlign: "top" }}>
                                            <Text variant="bodyMd" numeric>
                                                {formatCurrency(order.total, order.currency)}
                                            </Text>
                                        </td>
                                        <td style={{ padding: "12px", textAlign: "right", verticalAlign: "top" }}>
                                            <Text variant="bodyMd" numeric color="critical">
                                                -{formatCurrency(order.discounts, order.currency)}
                                            </Text>
                                        </td>
                                        <td style={{ padding: "12px", textAlign: "right", verticalAlign: "top" }}>
                                            <Text variant="bodyMd" numeric fontWeight="bold">
                                                {formatCurrency(order.revenue, order.currency)}
                                            </Text>
                                        </td>
                                        <td style={{ padding: "12px", verticalAlign: "top" }}>
                                            <Text variant="bodyMd">
                                                {new Date(order.createdAt).toLocaleDateString()}
                                            </Text>
                                        </td>
                                        <td style={{ padding: "12px", verticalAlign: "top" }}>
                                            <div style={{ maxWidth: "200px" }}>
                                                <Text variant="bodyMd">
                                                {order.items.join(", ")}
                                                </Text>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ) : (
                !loading && !error && (
                    <Card sectioned>
                        <Text variant="bodyMd" alignment="center" color="subdued">
                        Select a date range and click "Generate Report" to see coupon data.
                        </Text>
                    </Card>
                )
            )}

            {loading && (
                <Card sectioned>
                <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}>
                    <Spinner size="large" />
                </div>
                </Card>
            )}
        </Page>
    );
}