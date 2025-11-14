import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { BundleConfigurationService } from "../services/BundleConfigurationService.js";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  console.log(">>> [BundleAction] Processing form data");

  const configuration = {
    productId: formData.get("productId"),
    productHandle: formData.get("productHandle"),
    bundleProducts: JSON.parse(formData.get("bundleProducts")),
    bundleConfig: JSON.parse(formData.get("bundleConfig"))
  };

  try {
    const bundleConfigService = new BundleConfigurationService(admin);
    const result = await bundleConfigService.saveBundleConfiguration(configuration);
    
    if (result.success) {
      return json(result);
    } else {
      return json(result, { status: 500 });
    }

  } catch (error) {
    console.error(">>> [BundleAction] Error in action:", error);
    return json({
      success: false,
      error: error.message || "Failed to save bundle configuration"
    }, { status: 500 });
  }
};