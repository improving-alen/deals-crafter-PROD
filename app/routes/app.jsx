import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { ConfigurationService } from "../services/ConfigurationService.js";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    const configService = new ConfigurationService(admin);
    const configurations = await configService.loadAllConfigurations();
    
    return json({ 
      apiKey: process.env.SHOPIFY_API_KEY || "",
      ...configurations
    });
  } catch (error) {
    console.error('Error in loader:', error);
    return json({ 
      apiKey: process.env.SHOPIFY_API_KEY || "",
      preSaleExtraDiscountInfo: "0",
      preSaleInfo: [],
      normalInfo: [],
      tiersInfo: [],
      productsInfo: []
    });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const configurations = {
    tiersInfo: JSON.parse(formData.get("tiersInfo")),
    productsInfo: JSON.parse(formData.get("productsInfo")),
    normalInfo: JSON.parse(formData.get("normalInfo")),
    preSaleInfoState: JSON.parse(formData.get("preSaleInfoState")),
    extraPreSaleDiscount: formData.get("extraPreSaleDiscount")
  };

  try {
    const configService = new ConfigurationService(admin);
    const result = await configService.saveAllConfigurations(configurations);
    
    return json(result);
  } catch (error) {
    console.error('Error in action:', error);
    return json({
      success: false,
      message: "An unexpected error occurred during configuration save."
    });
  }
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/bundle_crafter">Bundle crafter</Link>
        <Link to="/app/report_coupons">Coupon Reports</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};