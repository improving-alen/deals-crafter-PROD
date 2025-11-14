import {
  Box,
  Card,
  Layout,
  Thumbnail,
  Modal,
  Page,
  Text,
  BlockStack,
  Button,
  Autocomplete,
  Badge,
  InlineStack,
  Icon,
  TextField,
  Select,
  Banner
} from "@shopify/polaris";
import { DeleteIcon, SearchIcon, PlusIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState, useCallback } from "react";

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);

    const GET_BUNDLE_PRODUCTS = `
      query {
        products(first: 100, query: "tag:deals-crafter-bundle") {
          edges {
            node {
              id
              title
              handle
              featuredImage {
                url
              }
              bundleProductsImproving: metafield(namespace: "custom", key: "bundle_products_improving") {
                id
                value
              }
              bundleCrafterConfiguration: metafield(namespace: "custom", key: "bundle_crafter_configuration") {
                id
                value
              }
            }
          }
        }
      }
    `;

    const GET_AIR_PURIFIERS = `
      query {
        products(first: 100, query: "product_type:'Air Purifier' AND -tag:deals-crafter-bundle") {
          edges {
            node {
              id
              title
              handle
              featuredImage {
                url
              }
            }
          }
        }
      }
    `;

    const [bundleResponse, purifiersResponse] = await Promise.all([
      admin.graphql(GET_BUNDLE_PRODUCTS),
      admin.graphql(GET_AIR_PURIFIERS)
    ]);

    const [bundleData, purifiersData] = await Promise.all([
      bundleResponse.json(),
      purifiersResponse.json()
    ]);

    return json({
      bundleProducts: bundleData.data?.products?.edges.map(edge => {
        const productsInBundle = edge.node.bundleProductsImproving?.value
          ? JSON.parse(edge.node.bundleProductsImproving.value)
          : [];

        const bundleConfig = edge.node.bundleCrafterConfiguration?.value
          ? JSON.parse(edge.node.bundleCrafterConfiguration.value)
          : { items: [] };

        return {
          ...edge.node,
          bundleProducts: productsInBundle,
          bundleConfig
        };
      }) || [],
      airPurifiers: purifiersData.data?.products?.edges.map(edge => edge.node) || []
    });

  } catch (error) {
    console.error("Error fetching products:", error);
    return json({ error: "Failed to load products" }, { status: 500 });
  }
};

export default function BundleCrafter() {
  const { bundleProducts, airPurifiers, error } = useLoaderData();
  const [activeProduct, setActiveProduct] = useState(null);
  const [editedProducts, setEditedProducts] = useState([]);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const fetcher = useFetcher();

  console.log(">>> BUNDLE PRODUCTS: ", JSON.stringify(bundleProducts));
  console.log(">>> AIR PURIFIERS: ", JSON.stringify(airPurifiers));

  const getAirPurifierOptions = useCallback(() => {

    console.log(">>> Starting to get Air Purifier Options");

    return airPurifiers
      .filter(product =>
        product.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .map(product => ({
        value: product.id,
        label: (
          <InlineStack align="center" gap="200">
            <Thumbnail
              source={product.featuredImage?.url || ''}
              alt={product.title}
              size="small"
            />
            <Text as="span">{product.title}</Text>
          </InlineStack>
        ),
        rawLabel: product.title,
        image: product.featuredImage?.url,
        handle: product.handle
      }));
  }, [airPurifiers, searchQuery]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Productos únicos para bundle_products_improving
      const uniqueProducts = [...new Set(
        editedProducts
          .filter(p => p.id && p.id.trim() !== '')
          .map(({ id }) => id)
      )];

      // Todos los items con sus configuraciones para bundle_crafter_configuration
      const configToSave = {
        items: editedProducts
          .filter(p => p.id && p.id.trim() !== '')
          .map(product => {
            const productData = airPurifiers.find(p => p.id === product.id);
            return {
              product: product.id,
              handle: productData?.handle || '',
              amount: parseFloat(product.discountValue) || 0,
              preSaleAmount: parseFloat(product.discountPreSaleValue) || 0,
              type: product.discountType || 'percentage'
            };
          })
      };

      const formData = new FormData();
      formData.append('productId', activeProduct.id);
      formData.append('productHandle', activeProduct.handle);
      formData.append('bundleProducts', JSON.stringify(uniqueProducts));
      formData.append('bundleConfig', JSON.stringify(configToSave));

      await fetcher.submit(formData, {
        method: "POST",
        action: "/app/bundle-crafter-save",
        encType: "multipart/form-data"
      });

      if (fetcher.data?.error) {
        throw new Error(fetcher.data.error);
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setActiveProduct(null);
        setEditedProducts([]);
        setSaveSuccess(false);
        navigate('.', { replace: true });
      }, 1500);

    } catch (error) {
      console.error("Error saving changes:", error);
      setSaveError(error.message || "Failed to save bundle configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const renderProductItem = (productId, index) => {
    const product = airPurifiers.find(p => p.id === productId);
    const currentProduct = editedProducts[index];

    const productConfig = activeProduct?.bundleConfig?.items?.find((item, i) =>
      item.product === productId && i === index
    ) || {
      amount: 0,
      preSaleAmount: 0,
      type: 'percentage'
    };

    return product ? (
      <Box key={index} padding="200" border="divider" borderRadius="200" width="100%" marginBlockStart="200">
        <InlineStack align="space-between" blockAlign="center" gap="400">
          <InlineStack gap="300" blockAlign="center">
            <Thumbnail
              source={product.featuredImage?.url || ''}
              alt={product.title}
              size="small"
            />
            <Text as="span" variant="bodyMd" fontWeight="medium">
              {product.title}
            </Text>
          </InlineStack>

          <InlineStack gap="200" blockAlign="center">
            <Box minWidth="120px">
              <TextField
                type="number"
                value={currentProduct?.discountValue ?? productConfig.amount}
                onChange={(value) => {
                  const updated = [...editedProducts];
                  updated[index] = {
                    ...updated[index],
                    discountValue: parseFloat(value) || 0
                  };
                  setEditedProducts(updated);
                }}
                min={0}
                max={currentProduct?.discountType === 'percentage' ? 100 : undefined}
                suffix={currentProduct?.discountType === 'percentage' ? '%' : ''}
              />
              <Badge tone="subdued" size="small" marginBlockStart="100">
                Normal
              </Badge>
            </Box>

            <Box minWidth="120px">
              <TextField
                type="number"
                value={currentProduct?.discountPreSaleValue ?? productConfig.preSaleAmount}
                onChange={(value) => {
                  const updated = [...editedProducts];
                  updated[index] = {
                    ...updated[index],
                    discountPreSaleValue: parseFloat(value) || 0
                  };
                  setEditedProducts(updated);
                }}
                min={0}
                max={currentProduct?.discountType === 'percentage' ? 100 : undefined}
                suffix={currentProduct?.discountType === 'percentage' ? '%' : ''}
              />
              <Badge tone="subdued" size="small" marginBlockStart="100">
                Pre-Sale
              </Badge>
            </Box>

            <Box minWidth="140px">
              <Select
                options={[
                  {label: 'Percentage', value: 'percentage'},
                  {label: 'Fixed Amount', value: 'fixed_amount'}
                ]}
                value={currentProduct?.discountType ?? productConfig.type}
                onChange={(value) => {
                  const updated = [...editedProducts];
                  updated[index] = {
                    ...updated[index],
                    discountType: value
                  };
                  setEditedProducts(updated);
                }}
              />
                <Badge tone="subdued" >
                    Discount Type
                </Badge>
            </Box>

            <Button
              icon={DeleteIcon}
              onClick={() => setEditedProducts(editedProducts.filter((_, i) => i !== index))}
              variant="plain"
              tone="critical"
              disabled={isSaving}
            />
          </InlineStack>
        </InlineStack>
      </Box>
    ) : null;
  };

  if (error) {
    return <Text as="p" color="critical">{error}</Text>;
  }

  return (
    <Page>
      <TitleBar title="Bundle Crafter" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                Configure bundles (BOGO, BTGO, SmartBundle) by selecting products
                and setting discounts. Start by editing an existing bundle or create a new one.
              </Text>
              <Badge tone="info">
                {bundleProducts.length} bundles configured
              </Badge>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #dfe3e8' }}>
                    <th style={{ textAlign: 'left', padding: '16px', fontWeight: '600' }}>Image</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontWeight: '600' }}>Product</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontWeight: '600' }}>Items in Bundle</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontWeight: '600' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bundleProducts.map((product) => (
                    <tr key={product.id} style={{ borderBottom: '1px solid #dfe3e8' }}>
                      <td style={{ padding: '16px' }}>
                        <Thumbnail
                          source={product.featuredImage?.url || ''}
                          alt={product.title}
                          size="small"
                        />
                      </td>
                      <td style={{ padding: '16px' }}>
                        <Text as="span" variant="bodyMd" fontWeight="bold">
                          {product.title}
                        </Text>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <Badge tone={product.bundleConfig.items.length ? 'success' : 'warning'}>
                          {product.bundleConfig.items.length || 'No'} items
                        </Badge>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <Button
                          onClick={() => {
                            setActiveProduct(product);
                            setEditedProducts(
                              product.bundleConfig?.items?.map(item => ({
                                id: item.product,
                                discountValue: item.amount,
                                discountPreSaleValue: item.preSaleAmount,
                                discountType: item.type
                              })) || []
                            );
                          }}
                          variant="primary"
                        >
                          Edit Bundle
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Layout.Section>
      </Layout>

      {activeProduct && (
        <Modal
          open={true}
          onClose={() => setActiveProduct(null)}
          title={`Editing Bundle: ${activeProduct.title}`}
          primaryAction={{
            content: 'Save Changes',
            onAction: handleSave,
            loading: isSaving,
            disabled: isSaving
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setActiveProduct(null),
              disabled: isSaving
            }
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              {saveSuccess && (
                <Banner
                  title="Changes saved successfully"
                  status="success"
                  onDismiss={() => setSaveSuccess(false)}
                />
              )}

              {saveError && (
                <Banner
                  title="Error saving changes"
                  status="critical"
                  onDismiss={() => setSaveError(null)}
                >
                  {saveError}
                </Banner>
              )}

              <Text as="h3" variant="headingMd">Bundle Composition</Text>

              <BlockStack gap="500" dividers >
                {editedProducts.map((product, index) => (
                  <Box key={index}>
                    <Autocomplete
                      options={getAirPurifierOptions()}
                      selected={[product.id]}
                      onSelect={(selected) => {
                        const updated = [...editedProducts];
                        updated[index] = {
                          ...updated[index],
                          id: selected[0]
                        };
                        setEditedProducts(updated);
                      }}
                      textField={
                        <Autocomplete.TextField
                          labelHidden
                          placeholder="Search air purifiers..."
                          value={airPurifiers.find(p => p.id === product.id)?.title || ''}
                          onChange={setSearchQuery}
                          prefix={<SearchIcon />}
                        />
                      }
                      emptyState={
                        <Box padding="200">
                          <Text as="p" color="subdued">No products found</Text>
                        </Box>
                      }
                    />
                    {product.id && renderProductItem(product.id, index)}
                  </Box>
                ))}
              </BlockStack>

              <Box paddingBlockStart="200">
                <Button
                  onClick={() => setEditedProducts([...editedProducts, {
                    id: '',
                    discountValue: 0,
                    discountPreSaleValue: 0,
                    discountType: 'percentage'
                  }])}
                  variant="plain"
                  tone="success"
                  disabled={isSaving}
                  size="slim"
                >
                  <InlineStack gap="100" blockAlign="center">
                    <Icon source={PlusIcon} tone="success" />
                    <Text as="span" variant="bodySm" fontWeight="medium">Add product</Text>
                  </InlineStack>
                </Button>
              </Box>
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
