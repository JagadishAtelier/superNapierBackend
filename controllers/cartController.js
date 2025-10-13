const Cart = require("../Model/Cart");
const User = require("../Model/User");
const Product = require("../Model/ProductModel");
// Add item to cart
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, price, weightOptionId, unit } = req.body;
    const userId = req.user._id;

    console.log("[addToCart] body:", { productId, quantity, price, weightOptionId, unit, userId });

    // fetch product
    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    // resolve chosen weight option
    let chosenOption = null;
    if (Array.isArray(product.weightOptions) && product.weightOptions.length > 0) {
      if (weightOptionId) {
        chosenOption = product.weightOptions.find(o => o._id && o._id.toString() === weightOptionId.toString());
      }
      if (!chosenOption) chosenOption = product.weightOptions[0]; // fallback
    }

    // determine final price
    let finalPrice = price;
    if (finalPrice === undefined || finalPrice === null) {
      if (chosenOption && chosenOption.price != null) finalPrice = chosenOption.price;
      else if (product.weightOptions && product.weightOptions.length > 0) finalPrice = product.weightOptions[0].price;
    }
    if (finalPrice === undefined || finalPrice === null) {
      return res.status(400).json({ success: false, message: "Price not available for this product" });
    }
    finalPrice = Number(finalPrice);
    if (Number.isNaN(finalPrice)) return res.status(400).json({ success: false, message: "Invalid price value" });

    // build chosen metadata
    const chosenWeightOptionId = chosenOption?._id || null;
    const chosenWeight = chosenOption?.weight ?? null;
    const chosenDiscount = chosenOption?.discountPrice ?? null;

    // decide chosenUnit: prefer explicit request unit, otherwise fallback to weightOption.unit (if available)
    const chosenUnit = unit ?? chosenOption?.unit ?? null;

    // find or create cart
    let cart = await Cart.findOne({ user: userId });
    const qtyToAdd = Number(quantity) || 1;

    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [{
          product: productId,
          quantity: qtyToAdd,
          price: finalPrice,
          weightOption: chosenWeightOptionId,
          weight: chosenWeight,
          unit: chosenUnit,
          discountPrice: chosenDiscount,
        }],
      });
    } else {
      // Update existing item if product + weightOption + unit matches
      const itemIndex = cart.items.findIndex(item => {
        const itemProduct = item.product?.toString();
        const itemWeightOpt = item.weightOption ? item.weightOption.toString() : "";
        const itemUnit = item.unit ?? "";
        const matchWeightOpt = String(itemWeightOpt || "") === String(chosenWeightOptionId || "");
        const matchUnit = String(itemUnit) === String(chosenUnit || "");
        return itemProduct === productId.toString() && matchWeightOpt && matchUnit;
      });

      if (itemIndex > -1) {
        cart.items[itemIndex].quantity = (cart.items[itemIndex].quantity || 0) + qtyToAdd;
        // optionally update price snapshot:
        // cart.items[itemIndex].price = finalPrice;
      } else {
        // push as a new line (different weightOption or unit)
        cart.items.push({
          product: productId,
          quantity: qtyToAdd,
          price: finalPrice,
          weightOption: chosenWeightOptionId,
          weight: chosenWeight,
          unit: chosenUnit,          // <- persist unit
          discountPrice: chosenDiscount,
        });
      }

      // DEDUPE existing duplicates for same product + weightOption + unit (safety)
      // Build map key = `${productId}_${weightOptionId||''}_${unit||''}`
      const map = new Map();
      for (const it of cart.items) {
        const pid = it.product?.toString();
        const wopt = it.weightOption ? it.weightOption.toString() : "";
        const u = it.unit ?? "";
        const key = `${pid}_${wopt}_${u}`;
        if (!map.has(key)) {
          map.set(key, {
            product: it.product,
            quantity: it.quantity || 0,
            price: it.price,
            weightOption: it.weightOption || null,
            weight: it.weight || null,
            unit: it.unit || null,
            discountPrice: it.discountPrice || null,
            _id: it._id, // keep first id (mongoose will handle _id)
          });
        } else {
          // merge quantities (and keep first price/metadata)
          const existing = map.get(key);
          existing.quantity = (existing.quantity || 0) + (it.quantity || 0);
          map.set(key, existing);
        }
      }

      // replace cart.items with deduped items array
      cart.items = Array.from(map.values());
    }

    const saved = await cart.save();
    return res.status(200).json({ success: true, data: saved });
  } catch (err) {
    console.error("addToCart error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


  // Get user's cart
  exports.getCart = async (req, res) => {
    try {
      const userId = req.user._id;
      const cart = await Cart.findOne({ user: userId }).populate("items.product", "name price image");
  
      if (!cart) return res.status(404).json({ message: "Cart is empty" });
      res.status(200).json({ success: true, data: cart });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
  
  // Remove item from cart
  exports.removeFromCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params; // cart item _id

    const result = await Cart.findOneAndUpdate(
      { user: userId },
      { $pull: { items: { _id: productId } } },
      { new: true } // returns updated document
    );

    if (!result) {
      return res.status(404).json({ success: false, message: "Cart or item not found" });
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};




  // get card by user id
exports.getCartByUserId = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    const cart = await Cart.findOne({ user: userId }).populate(
      "items.product",
      "name price images weightOptions"
    );

    if (!cart)
      return res.status(404).json({ success: false, message: "Cart is empty" });

    // Add stock info for each cart item based on weightOption
    const itemsWithStock = cart.items.map((item) => {
      const product = item.product;
      let stock = 0;

      if (product?.weightOptions?.length && item.weightOption) {
        const weightOption = product.weightOptions.find(
          (w) => w._id.toString() === item.weightOption.toString()
        );
        stock = weightOption?.stock || 0;
      }

      // Also optionally update price and discountPrice from selected weightOption
      const selectedOption = product?.weightOptions?.find(
        (w) => w._id.toString() === item.weightOption?.toString()
      );
      const price = selectedOption?.price ?? item.price;
      const discountPrice = selectedOption?.discountPrice ?? item.discountPrice;

      return {
        ...item.toObject(),
        stock,
        price,
        discountPrice,
      };
    });

    res.status(200).json({
      success: true,
      data: { ...cart.toObject(), items: itemsWithStock },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};




  exports.updateCartItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { itemId } = req.params; // the _id of the cart item
    const { quantity, price, weightOptionId, discountPrice } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) return res.status(404).json({ success: false, message: "Item not found in cart" });

    // Update fields if provided
    if (quantity !== undefined) cart.items[itemIndex].quantity = quantity;
    if (price !== undefined) cart.items[itemIndex].price = price;
    if (weightOptionId !== undefined) cart.items[itemIndex].weightOption = weightOptionId;
    if (discountPrice !== undefined) cart.items[itemIndex].discountPrice = discountPrice;

    const updatedCart = await cart.save();

    // populate product info for frontend convenience
    const populatedCart = await Cart.findById(updatedCart._id).populate("items.product", "name price images");

    res.status(200).json({ success: true, data: populatedCart });
  } catch (error) {
    console.error("updateCartItem error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};