const Cart = require("../Model/Cart");
const User = require("../Model/User");
const Product = require("../Model/ProductModel");
// Add item to cart
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, price, weightOptionId, unit, cuttingType } = req.body;
    const userId = req.user._id;

    console.log("[addToCart] body:", { productId, quantity, price, weightOptionId, unit, userId, cuttingType });

    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    let chosenOption = null;
    if (Array.isArray(product.weightOptions) && product.weightOptions.length > 0) {
      if (weightOptionId) {
        chosenOption = product.weightOptions.find(o => o._id && o._id.toString() === weightOptionId.toString());
      }
      if (!chosenOption) chosenOption = product.weightOptions[0];
    }

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

    const chosenWeightOptionId = chosenOption?._id || null;
    const chosenWeight = chosenOption?.weight ?? null;
    const chosenDiscount = chosenOption?.discountPrice ?? null;
    const chosenUnit = unit ?? chosenOption?.unit ?? null;

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
          cuttingType: cuttingType || "",            // ← cuttingType
        }],
      });
    } else {
      const itemIndex = cart.items.findIndex(item => {
        const itemProduct = item.product?.toString();
        const itemWeightOpt = item.weightOption ? item.weightOption.toString() : "";
        const itemUnit = item.unit ?? "";
        const itemCut = item.cuttingType ?? "";

        const matchW = String(itemWeightOpt) === String(chosenWeightOptionId || "");
        const matchU = String(itemUnit) === String(chosenUnit || "");
        const matchC = String(itemCut) === String(cuttingType || ""); // ← match by cuttingType too

        return itemProduct === productId.toString() && matchW && matchU && matchC;
      });

      if (itemIndex > -1) {
        cart.items[itemIndex].quantity = (cart.items[itemIndex].quantity || 0) + qtyToAdd;
      } else {
        cart.items.push({
          product: productId,
          quantity: qtyToAdd,
          price: finalPrice,
          weightOption: chosenWeightOptionId,
          weight: chosenWeight,
          unit: chosenUnit,
          discountPrice: chosenDiscount,
          cuttingType: cuttingType || "",         // ← cuttingType
        });
      }

      const map = new Map();
      for (const it of cart.items) {
        const pid = it.product?.toString();
        const wopt = it.weightOption ? it.weightOption.toString() : "";
        const u = it.unit ?? "";
        const c = it.cuttingType ?? "";           // ← include in key

        const key = `${pid}_${wopt}_${u}_${c}`;   // ← include cuttingType in dedupe

        if (!map.has(key)) {
          map.set(key, {
            product: it.product,
            quantity: it.quantity || 0,
            price: it.price,
            weightOption: it.weightOption || null,
            weight: it.weight || null,
            unit: it.unit || null,
            discountPrice: it.discountPrice || null,
            cuttingType: it.cuttingType || "",   // ← keep value
            _id: it._id,
          });
        } else {
          const existing = map.get(key);
          existing.quantity = (existing.quantity || 0) + (it.quantity || 0);
          map.set(key, existing);
        }
      }

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