const mongoose = require("mongoose");
const Product = require("../Model/ProductModel");
const Category = require("../Model/categoryModel");
// 📌 Create Product
exports.createProduct = async (req, res) => {
  try {
    let products;

    // If body is an array → Insert many
    if (Array.isArray(req.body)) {
      products = await Product.insertMany(req.body);
    } 
    // If body is single object → Insert one
    else {
      const product = new Product(req.body);
      products = await product.save();
    }

    res.status(201).json({
      success: true,
      data: products
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 📌 Get All Products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate({
        path: "category",
        select: "name tamilName imageUrl", // Only select the fields you need from the Category model
      })
      // No need to populate for discountPrice as it's an embedded field
      .lean(); // Use .lean() for faster query results if you don't need Mongoose documents

    // Optional: You can add logic here to calculate a 'best' discount or
    // format the products if needed before sending.

    res.json({ success: true, data: products });
  } catch (error) {
    console.error("Error fetching products:", error); // Log the actual error for debugging
    res.status(500).json({ success: false, message: "Failed to fetch products.", error: error.message });
  }
};


// 📌 Get Product by ID
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if valid ObjectId
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { id }] }
      : { id };

    const product = await Product.findOne(query);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, data: product });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const products = await Product.find({ category });
    res.json({ success: true, data: products });
  }
  catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📌 Update Product
// 📌 Update Product
exports.updateProduct = async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(
      req.params.id,   // uses Mongo _id
      req.body,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }


    res.json({ success: true, data: updated });
    console.log("Updated Product:", updated);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};


// 📌 Delete Product
exports.deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id); // use _id
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    res.json({ success: true, message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

