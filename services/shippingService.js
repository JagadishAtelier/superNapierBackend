const Product = require("../Model/ProductModel");
const GlobalSettings = require("../Model/GlobalSettings");
const { getShippingRegion } = require("../utils/shippingRegion");

const roundMoney = (val) => Math.round((val + Number.EPSILON) * 100) / 100;

/**
 * Centrally calculates backend authoritative shipping charges based on database products and regional settings.
 * @param {Array} items - Array of { productId, weightOptionId, quantity }
 * @param {string} stateCode - Normalized state code (e.g., "TN", "KA")
 * @returns {Object} - Detailed shipping breakdown & settings snapshot
 */
const calculateShipping = async (items, stateCode) => {
  if (!stateCode) {
    throw new Error("Shipping state is required.");
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error("Cart items are required for shipping calculation.");
  }

  const region = getShippingRegion(stateCode);

  // Fetch settings or fallback to default values
  let settings = await GlobalSettings.findOne({ settingsId: "site_settings" });
  if (!settings) {
    settings = {
      seedCourierTN: 60,
      seedCourierSouth: 130,
      seedCourierRest: 160,
      napierTransitTNRate: 0,
      napierTransitSouthRate: 25,
      napierTransitRestRate: 50
    };
  }

  let totalCuttingsValue = 0;
  let totalSeedsWeight = 0;

  for (const item of items) {
    if (!item.productId || !item.weightOptionId || !item.quantity) {
      throw new Error("Invalid item structure: missing product ID, option ID, or quantity.");
    }
    const quantity = Number(item.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      throw new Error("Item quantity must be a positive number.");
    }

    const product = await Product.findById(item.productId);
    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }

    const weightOption = product.weightOptions.find(
      (w) => w._id.toString() === item.weightOptionId.toString()
    );
    if (!weightOption) {
      throw new Error(`Weight option not found for product: ${product.name.en}`);
    }

    if (weightOption.price < 0 || weightOption.weight < 0) {
      throw new Error("Price and weight must be non-negative values.");
    }

    // Determine type: cuttings vs seeds based on unit
    if (product.unit === "piece" || weightOption.unit === "piece" || weightOption.unit === "pack") {
      // Cuttings: based on price and quantity from DB (secure, no client tampering)
      totalCuttingsValue += weightOption.price * quantity;
    } else {
      // Seeds: calculate total weight in kg
      let weightInKg = 0;
      if (weightOption.unit === "kg" || !weightOption.unit) {
        weightInKg = weightOption.weight * quantity;
      } else if (weightOption.unit === "g") {
        weightInKg = (weightOption.weight / 1000) * quantity;
      }
      totalSeedsWeight += weightInKg;
    }
  }

  // Calculate Seed Courier Cost
  let seedRate = settings.seedCourierRest;
  if (region === "TN") {
    seedRate = settings.seedCourierTN;
  } else if (region === "SOUTH") {
    seedRate = settings.seedCourierSouth;
  }
  const seedShippingCost = totalSeedsWeight * seedRate;

  // Calculate Cuttings Transportation Cost
  let cuttingRatePercent = settings.napierTransitRestRate; // default 50%

  if (region === "TN") {
    cuttingRatePercent = settings.napierTransitTNRate; // default 0%
  } else if (region === "SOUTH") {
    cuttingRatePercent = settings.napierTransitSouthRate; // default 25%
  }

  const cuttingShippingCost = totalCuttingsValue * (cuttingRatePercent / 100);

  const totalShipping = seedShippingCost + cuttingShippingCost;

  return {
    region,
    seedShipping: {
      amount: roundMoney(seedShippingCost),
      weightKg: roundMoney(totalSeedsWeight),
      ratePerKg: seedRate
    },
    cuttingShipping: {
      amount: roundMoney(cuttingShippingCost),
      cuttingValue: roundMoney(totalCuttingsValue),
      ratePercent: cuttingRatePercent
    },
    totalShipping: roundMoney(totalShipping),
    settingsSnapshot: {
      seedCourierTN: settings.seedCourierTN,
      seedCourierSouth: settings.seedCourierSouth,
      seedCourierRest: settings.seedCourierRest,
      napierTransitTNRate: settings.napierTransitTNRate,
      napierTransitSouthRate: settings.napierTransitSouthRate,
      napierTransitRestRate: settings.napierTransitRestRate
    }
  };
};

module.exports = {
  calculateShipping
};
