import { useState, useEffect } from "react";
import {
    Page,
    Layout,
    Text,
    Card,
    BlockStack,
    DataTable,
    TextField,
    Button,
    InlineStack,
    InlineGrid,
    Select,
    Banner
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";

import VisualSwitch from "../components/VisualSwitch";

const styles = `
  .centered-heading th {
    text-align: center !important;
  }
  .centered-cell {
    text-align: center !important;
  }

  table {
    background-color: #364151;
    color: white !important;
  }

  table th {
    color: white !important;
    background-color: #364151;
    font-weight: bold !important;
    text-align: center !important;
    font-size: 14px !important;
  }

  table input {
    text-align: center !important;
  }
`;

// Función auxiliar para procesar metaobjects de forma segura
const processMetaobjects = (metaobjectsData, fieldMappings) => {
  if (!metaobjectsData?.data?.metaobjects?.edges || metaobjectsData.data.metaobjects.edges.length === 0) {
    return [];
  }

  return metaobjectsData.data.metaobjects.edges.map(edge => {
    const fields = edge.node.fields;
    const processedItem = {};
    
    Object.keys(fieldMappings).forEach(key => {
      const fieldKey = fieldMappings[key];
      const field = fields.find(f => f.key === fieldKey);
      processedItem[key] = field ? field.value : '';
    });
    
    return processedItem;
  });
};

// Función para obtener un valor único de metaobject
const getSingleMetaobjectValue = (metaobjectsData, fieldName) => {
    //console.log(">>> DEBUG Single Metaobject Data:", metaobjectsData);
    console.log(">>> DEBUG Single Metaobject Field Name:", fieldName);
  if (!metaobjectsData?.data?.metaobjects?.edges || metaobjectsData.data.metaobjects.edges.length === 0) {
    return null;
  }

  const fields = metaobjectsData.data.metaobjects.edges[0].node.fields;
  const field = fields.find(f => f.key === fieldName);

  console.log(">>> DEBUG Single Metaobject Fields:", fields); // DEBUG
  console.log(">>> DEBUG Single Metaobject Field:", field); // DEBUG
  return field ? field.value : null;
};

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const preSaleExtraDiscountQuery = `
      query {
        metaobjects(type: "pre_sale_extra_tier_discount", first: 10) {
          edges {
            node {
              fields {
                key
                value
              }
            }
          }
        }
      }
    `;

    const preSaleExtraDiscountResponse = await admin.graphql(preSaleExtraDiscountQuery);
    const preSaleExtraDiscountData = await preSaleExtraDiscountResponse.json();

    const isPreSaleConfigQuery = `
      query {
        metaobjects(type: "is_pre_sale_enabled", first: 10) {
          edges {
            node {
              fields {
                key
                value
              }
            }
          }
        }
      }
    `;

    const isPreSaleResponse = await admin.graphql(isPreSaleConfigQuery);
    const isPreSaleData = await isPreSaleResponse.json();

    const preSaleConfigQuery = `
      query {
        metaobjects(type: "presale_info_imp", first: 10) {
          edges {
            node {
              fields {
                key
                value
              }
            }
          }
        }
      }
    `;

    const preSaleResponse = await admin.graphql(preSaleConfigQuery);
    const preSaleData = await preSaleResponse.json();

    const normalConfigQuery = `
      query {
        metaobjects(type: "normal_info_imp", first: 10) {
          edges {
            node {
              fields {
                key
                value
              }
            }
          }
        }
      }
    `;

    const normalResponse = await admin.graphql(normalConfigQuery);
    const normalConfigData = await normalResponse.json();

    const tiersQuery = `
      query {
        metaobjects(type: "tiers_info_imp", first: 10) {
          edges {
            node {
              fields {
                key
                value
              }
            }
          }
        }
      }
    `;

    const tiersResponse = await admin.graphql(tiersQuery);
    const tiersData = await tiersResponse.json();

    const productsQuery = `
      query {
        metaobjects(type: "product_discounts_info_imp", first: 10) {
          edges {
            node {
              fields {
                key
                value
              }
            }
          }
        }
      }
    `;

    const productsResponse = await admin.graphql(productsQuery);
    const productsData = await productsResponse.json();

    const isPreSaleEnabled = getSingleMetaobjectValue(isPreSaleData, "ispresaleenabled");

    // Procesar los datos de forma segura
    const preSaleExtraDiscountInfo = getSingleMetaobjectValue(preSaleExtraDiscountData, "amount") || "0";

    const normalInfo = processMetaobjects(normalConfigData, {
      product: "product",
      discount: "discount",
      discount_type: "discount_type"
    });

    const preSaleInfo = processMetaobjects(preSaleData, {
      product: "product",
      discount: "discount",
      discount_type: "discount_type"
    });

    const tiersInfo = processMetaobjects(tiersData, {
      tier: "tier",
      min: "min",
      max: "max"
    });

    const productsInfo = processMetaobjects(productsData, {
      tier: "tier",
      _75i: "_75i",
      _45i: "_45i",
      _35i: "_35i",
      _25i: "_25i",
      _flex: "_flex"
    });

    console.log(">>> Loaded data:", {
      isPreSaleEnabled,
      preSaleExtraDiscountInfo,
      normalInfoLength: normalInfo.length,
      preSaleInfoLength: preSaleInfo.length,
      tiersInfoLength: tiersInfo.length,
      productsInfoLength: productsInfo.length,
    });

    return json({ 
      tiersInfo, 
      productsInfo, 
      normalInfo, 
      preSaleInfo, 
      preSaleExtraDiscountInfo ,
      isPreSaleEnabled
    });

  } catch (error) {
    console.error("Error in loader:", error);
    
    // Retornar valores por defecto en caso de error
    return json({
      tiersInfo: [],
      productsInfo: [],
      normalInfo: [],
      preSaleInfo: [],
      preSaleExtraDiscountInfo: "0",
      isPreSaleEnabled: false
    });
  }
};

// Valores por defecto fuera del componente
const defaultPreSaleInfo = [
  { product: '75i', discount: '0', discount_type: 'percentage' },
  { product: '45i', discount: '0', discount_type: 'percentage' },
  { product: '35i', discount: '0', discount_type: 'percentage' },
  { product: '25i', discount: '0', discount_type: 'percentage' }
];

const defaultNormalInfo = [
  { product: '75i', discount: '0', discount_type: 'percentage' },
  { product: '45i', discount: '0', discount_type: 'percentage' },
  { product: '35i', discount: '0', discount_type: 'percentage' },
  { product: '25i', discount: '0', discount_type: 'percentage' }
];

const defaultProductsInfo = [
  { tier: 'Tier 1', _75i: '0', _45i: '0', _35i: '0', _25i: '0', _flex: '0' },
];

const defaultTiersInfo = [
  { tier: 'Tier 1', min: '99999999', max: '99999999999' },
];

export default function Index() {
    const loaderData = useLoaderData();
    const [saveStatus, setSaveStatus] = useState({ success: null, message: '' });
    const fetcher = useFetcher();
    const [isSaving, setIsSaving] = useState(false);

    console.log(">>> Initial loader data:", loaderData);

    // Inicializar estados con los datos del loader o valores por defecto
    const [extraPreSaleDiscount, setExtraPreSaleDiscount] = useState(
      loaderData.preSaleExtraDiscountInfo || "0"
    );

    const [preSaleInfoState, setPreSaleInfoState] = useState(
      () => loaderData.preSaleInfo && loaderData.preSaleInfo.length > 0 
        ? loaderData.preSaleInfo 
        : defaultPreSaleInfo
    );

    const [normalInfoState, setNormalInfoState] = useState(
      () => loaderData.normalInfo && loaderData.normalInfo.length > 0 
        ? loaderData.normalInfo 
        : defaultNormalInfo
    );

    const [productsInfo, setProductsInfo] = useState(
      () => loaderData.productsInfo && loaderData.productsInfo.length > 0 
        ? loaderData.productsInfo 
        : defaultProductsInfo
    );

    const [tiersInfoState, setTiersInfoState] = useState(
      () => loaderData.tiersInfo && loaderData.tiersInfo.length > 0 
        ? loaderData.tiersInfo 
        : defaultTiersInfo
    );

    const [isPreSaleEnabled, setIsPreSaleEnabled] = useState(
      () => loaderData.isPreSaleEnabled !== undefined 
        ? loaderData.isPreSaleEnabled 
        : false
    );

    // Efecto para actualizar cuando cambian los datos del loader
    useEffect(() => {
      console.log(">>> Loader data updated:", loaderData);
      
      if (loaderData.preSaleExtraDiscountInfo) {
        setExtraPreSaleDiscount(loaderData.preSaleExtraDiscountInfo);
      }

      if (loaderData.normalInfo && loaderData.normalInfo.length > 0) {
        setNormalInfoState(loaderData.normalInfo);
      }

      if (loaderData.preSaleInfo && loaderData.preSaleInfo.length > 0) {
        setPreSaleInfoState(loaderData.preSaleInfo);
      }

      if (loaderData.tiersInfo && loaderData.tiersInfo.length > 0) {
        setTiersInfoState(loaderData.tiersInfo);
      }

      if (loaderData.productsInfo && loaderData.productsInfo.length > 0) {
        setProductsInfo(loaderData.productsInfo);
      }

      if (loaderData.isPreSaleEnabled !== undefined) {
        setIsPreSaleEnabled(JSON.parse(loaderData.isPreSaleEnabled));
      }
    }, [loaderData]);

    useEffect(() => {
        if (fetcher.data) {
            setSaveStatus({ success: fetcher.data.success, message: fetcher.data.message });
            setIsSaving(false);
            
            // Si la guardada fue exitosa, podrías recargar los datos aquí
            if (fetcher.data.success) {
              // Opcional: recargar la página para obtener datos frescos
              // window.location.reload();
            }
        }
    }, [fetcher.data]);

    const handleNormalChange = (value, product, type) => {
        const newData = normalInfoState.map(row => {
            if (row.product === product) {
                return {
                    ...row,
                    [type]: value || 'percentage'
                };
            }
            return row;
        });
        setNormalInfoState(newData);
    }

    const handlePreSaleChange = (value, product, type) => {
        const newData = preSaleInfoState.map(row => {
            if (row.product === product) {
                return {
                    ...row,
                    [type]: value || 'percentage'
                };
            }
            return row;
        });
        setPreSaleInfoState(newData);
    }

    const handlePercentageChange = (value, tier, product) => {
        const newData = productsInfo.map(row => {
            if (row.tier === tier) {
                return {
                    ...row,
                    [product]: value || '0'
                };
            }
            return row;
        });
        setProductsInfo(newData);
    };

    const handleTierQtyChange = (value, tier, type) => {
        const newData = tiersInfoState.map(row => {
            if (row.tier === tier) {
                return {
                    ...row,
                    [type]: value || '0'
                };
            }
            return row;
        });
        setTiersInfoState(newData);
    };

    const addNewTier = () => {
        const newTierNumber = tiersInfoState.length + 1;
        const newTierName = `Tier ${newTierNumber}`;

        const newTier = {
            tier: newTierName,
            min: '0',
            max: '0'
        };
        setTiersInfoState([...tiersInfoState, newTier]);

        const newDiscountRow = {
            tier: newTierName,
            _75i: '0',
            _45i: '0',
            _35i: '0',
            _25i: '0',
            _flex: '0'
        };
        setProductsInfo([...productsInfo, newDiscountRow]);
    };

    const removeLastTier = () => {
        if (tiersInfoState.length > 1) {
            setTiersInfoState(tiersInfoState.slice(0, -1));
            setProductsInfo(productsInfo.slice(0, -1));
        }
    };

    const saveConfiguration = () => {
        setIsSaving(true);
        fetcher.submit(
            {
                tiersInfo: JSON.stringify(tiersInfoState),
                productsInfo: JSON.stringify(productsInfo),
                normalInfo: JSON.stringify(normalInfoState),
                preSaleInfoState: JSON.stringify(preSaleInfoState),
                extraPreSaleDiscount: extraPreSaleDiscount.toString(),
                isPreSaleEnabled: isPreSaleEnabled ? "true" : "false"
            },
            { method: "POST", action: "/app" }
        );
    };

    return (
        <Page>
            <style>
                {styles}
            </style>

            <TitleBar title="Product Discounts per Tier" />
            <Layout>
                <Layout.Section>
                {saveStatus.message && (
                    <Banner status={saveStatus.success ? "success" : "critical"}>
                        {saveStatus.message}
                    </Banner>
                )}
                </Layout.Section>

                {/* Botones de acción */}
                <Layout.Section>
                    <InlineGrid columns={2}>
                        <InlineStack align="start">
                            <Button
                                variant="primary"
                                tone="success"
                                size="large"
                                onClick={saveConfiguration}
                                loading={isSaving}
                                disabled={isSaving}
                            >
                                Save configuration
                            </Button>
                        </InlineStack>
                        <InlineStack align="end" gap="200">
                            <Button variant="primary" tone="critical" size="large" onClick={removeLastTier} disabled={tiersInfoState.length <= 1}>
                                - Remove Tier
                            </Button>
                            <Button variant="primary" tone="info" size="large" onClick={addNewTier}>
                                + Add Tier
                            </Button>
                        </InlineStack>
                    </InlineGrid>
                </Layout.Section>

                {/* Tabla Normal Discount Configuration */}
                <Layout.Section>
                    <Card>
                        <BlockStack gap="500">
                            <Text as="h2" variant="headingMd">
                                Normal Discount Configuration
                            </Text>
                            <DataTable
                                columnContentTypes={['text', 'numeric', 'text']}
                                headings={['Product', 'Discount', 'Type']}
                                rows={
                                    normalInfoState.map(row => [
                                        row.product,
                                        <div className="centered-cell">
                                            <TextField
                                                type="number"
                                                value={row.discount}
                                                onChange={(value) => handleNormalChange(value, row.product, 'discount')}
                                            />
                                        </div>,
                                        <div className="centered-cell">
                                            <Select
                                                label="Discount type"
                                                labelHidden
                                                options={[
                                                    {label: 'Percentage', value: 'percentage'},
                                                    {label: 'Fixed amount', value: 'amount'}
                                                ]}
                                                value={row.discount_type}
                                                onChange={(value) => handleNormalChange(value, row.product, 'discount_type')}
                                            />
                                        </div>
                                    ])
                                }
                            />
                        </BlockStack>
                    </Card>
                </Layout.Section>

                {/* Sección de 2 columnas para el resto de tablas */}
                <Layout.Section>
                    <InlineGrid columns={2} gap="400">
                        {/* Columna izquierda */}
                        <BlockStack gap="400">
                            {/* Tiers Definition */}
                            <Card>
                                <BlockStack gap="500">
                                    <Text as="h2" variant="headingMd">
                                        Tiers Definition
                                    </Text>
                                    <DataTable
                                        columnContentTypes={['text', 'numeric', 'numeric']}
                                        headings={['Tier #', 'Minimum', 'Maximum']}
                                        rows={
                                            tiersInfoState.map(row => [
                                                row.tier,
                                                <div className="centered-cell">
                                                    <TextField
                                                        type="number"
                                                        value={row.min.toString()}
                                                        onChange={(value) => handleTierQtyChange(value, row.tier, 'min')}
                                                    />
                                                </div>,
                                                <div className="centered-cell">
                                                    <TextField
                                                        type="number"
                                                        value={row.max.toString()}
                                                        onChange={(value) => handleTierQtyChange(value, row.tier, 'max')}
                                                    />
                                                </div>
                                            ])
                                        }
                                    />
                                </BlockStack>
                            </Card>

                            {/* Discounts Table */}
                            <Card>
                                <BlockStack gap="500">
                                    <Text as="h2" variant="headingMd">
                                        Discounts Table
                                    </Text>
                                    <DataTable
                                        columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'numeric', 'numeric']}
                                        headings={['Tier #', '75i', '45i', '35i', '25i', 'FLEX']}
                                        rows={
                                            productsInfo.map(row => [
                                                row.tier,
                                                <div className="centered-cell">
                                                    <TextField
                                                        type="number"
                                                        value={row._75i}
                                                        onChange={(value) => handlePercentageChange(value, row.tier, '_75i')}
                                                    />
                                                </div>,
                                                <div className="centered-cell">
                                                    <TextField
                                                        type="number"
                                                        value={row._45i}
                                                        onChange={(value) => handlePercentageChange(value, row.tier, '_45i')}
                                                    />
                                                </div>,
                                                <div className="centered-cell">
                                                    <TextField
                                                        type="number"
                                                        value={row._35i}
                                                        onChange={(value) => handlePercentageChange(value, row.tier, '_35i')}
                                                    />
                                                </div>,

                                                <div className="centered-cell">
                                                    <TextField
                                                        type="number"
                                                        value={row._25i}
                                                        onChange={(value) => handlePercentageChange(value, row.tier, '_25i')}
                                                    />
                                                </div>,
                                                <div className="centered-cell">
                                                    <TextField
                                                        type="number"
                                                        value={row._flex}
                                                        onChange={(value) => handlePercentageChange(value, row.tier, '_flex')}
                                                    />
                                                </div>
                                            ])
                                        }
                                    />
                                </BlockStack>
                            </Card>
                            <Card>
                                <BlockStack gap="500">
                                    <Text as="h2" variant="headingMd">
                                        Pre-Sale State
                                    </Text>
                                    <VisualSwitch
                                        checked={isPreSaleEnabled}
                                        onChange={(newValue) => {
                                            console.log(">>> Toggle Pre-Sale Enabled:", newValue);
                                            setIsPreSaleEnabled(newValue);
                                        }}
                                    />
                                </BlockStack>
                            </Card>
                        </BlockStack>

                        {/* Columna derecha */}
                        <BlockStack gap="400">
                            {/* Pre-Sale Extra Tier Configuration */}
                            <Card>
                                <BlockStack gap="500">
                                    <Text as="h2" variant="headingMd">
                                        Pre-Sale Extra Tier Configuration
                                    </Text>
                                    <DataTable
                                        columnContentTypes={['numeric']}
                                        headings={['Extra Discount Amount']}
                                        rows={[
                                            [
                                                <div className="centered-cell">
                                                    <TextField
                                                        type="number"
                                                        value={extraPreSaleDiscount}
                                                        onChange={(value) => setExtraPreSaleDiscount(value)}
                                                    />
                                                </div>
                                            ]
                                        ]}
                                    />
                                </BlockStack>
                            </Card>

                            {/* Pre-Sale Configuration (original) */}
                            <Card>
                                <BlockStack gap="500">
                                    <Text as="h2" variant="headingMd">
                                        Pre-Sale Configuration
                                    </Text>
                                    <DataTable
                                        columnContentTypes={['text', 'numeric', 'text']}
                                        headings={['Product', 'Discount', 'Type']}
                                        rows={
                                            preSaleInfoState.map(row => [
                                                row.product,
                                                <div className="centered-cell">
                                                    <TextField
                                                        type="number"
                                                        value={row.discount}
                                                        onChange={(value) => handlePreSaleChange(value, row.product, 'discount')}
                                                    />
                                                </div>,
                                                <div className="centered-cell">
                                                    <Select
                                                        label="Discount type"
                                                        labelHidden
                                                        options={[
                                                            {label: 'Percentage', value: 'percentage'},
                                                            {label: 'Fixed amount', value: 'amount'}
                                                        ]}
                                                        value={row.discount_type}
                                                        onChange={(value) => handlePreSaleChange(value, row.product, 'discount_type')}
                                                    />
                                                </div>
                                            ])
                                        }
                                    />
                                </BlockStack>
                            </Card>
                        </BlockStack>
                    </InlineGrid>
                </Layout.Section>
            </Layout>
        </Page>
    );
}