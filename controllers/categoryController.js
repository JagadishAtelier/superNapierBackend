const Category = require("../Model/categoryModel");

// ✅ Create Category
exports.createCategory = async (req, res) => {
  try {
    const { name, image } = req.body;

    if (!name?.en) {
      return res.status(400).json({ message: "English name is required" });
    }

    const existing = await Category.findOne({ "name.en": name.en });
    if (existing) {
      return res.status(400).json({ message: "Category already exists" });
    }

    const category = await Category.create({
      name,
      image: image || [],
    });

    res.status(201).json({
      message: "Category created successfully",
      category,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get all categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });

    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get category by ID
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Update category
exports.updateCategory = async (req, res) => {
  try {
    const { name, image } = req.body;

    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      {
        ...(name && { name }),
        ...(image && { image }),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json({
      message: "Category updated successfully",
      updated,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ✅ Delete category
exports.deleteCategory = async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Add a subcategory by name
exports.addSubcategory = async (req, res) => {
  try {
    const { name, description, image } = req.body;
    const category = await Category.findById(req.params.id);

    if (!category) return res.status(404).json({ message: "Category not found" });

    // Prevent duplicate subcategory names
    if (category.subcategories.some((sub) => sub.name === name)) {
      return res.status(400).json({ message: "Subcategory already exists" });
    }

    category.subcategories.push({ name, description, image });
    await category.save();

    res.status(201).json({ message: "Subcategory added", category });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ✅ Remove a subcategory by name
exports.removeSubcategory = async (req, res) => {
  try {
    const { id, subName } = req.params;
    const category = await Category.findById(id);

    if (!category) return res.status(404).json({ message: "Category not found" });

    const index = category.subcategories.findIndex((sub) => sub.name === subName);
    if (index === -1) {
      return res.status(404).json({ message: "Subcategory not found" });
    }

    category.subcategories.splice(index, 1);
    await category.save();

    res.json({ message: "Subcategory removed", category });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
