import {describe, it, expect} from "vitest";

import {cartDeliveryOptionsDiscountsGenerateRun} from "./cart_delivery_options_discounts_generate_run";
import {
  DeliveryDiscountSelectionStrategy,
  DiscountClass,
} from "../generated/api";

/**
  * @typedef {import("../generated/api").CartDeliveryOptionsDiscountsGenerateRunResult} CartDeliveryOptionsDiscountsGenerateRunResult
  * @typedef {import("../generated/api").DeliveryInput} DeliveryInput
  */