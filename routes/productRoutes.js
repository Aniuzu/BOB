import express from 'express';
import Product from '../models/productModel.js';
import { body, param, validationResult } from 'express-validator';

const router = express.Router();

/**
 * @route   GET /api/v1/products
 * @desc    Get all products with optional filtering
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // Build query object
    const queryObj = {};

    // Filter by category if provided
    if (req.query.category) {
      queryObj.category = req.query.category;
    }

    // Filter by name search if provided
    if (req.query.search) {
      queryObj.name = { $regex: req.query.search, $options: 'i' };
    }

    // Execute query
    const products = await Product.find(queryObj).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (err) {
    console.error(err);
    console.error("Route error:", err);
    res.status(500).send("Server error");
    res.status(500).json({
      success: false,
      message: 'Server error while fetching products'
    });
  }
});

/**
 * @route   GET /api/v1/products/category/:category
 * @desc    Get products by specific category
 * @access  Public
 */
router.get(
  '/category/:category',
  [
    param('category')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Category must be a valid string')
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const products = await Product.find({
        category: req.params.category.toLowerCase()
      });

      if (products.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No products found in category '${req.params.category}'`
        });
      }

      res.status(200).json({
        success: true,
        count: products.length,
        data: products
      });
    } catch (err) {
      console.error(err);
      console.error("Route error:", err);
      res.status(500).send("Server error");
      res.status(500).json({
        success: false,
        message: 'Server error while fetching products by category'
      });
    }
  }
);

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get single product by ID
 * @access  Public
 */
router.get(
  '/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid product ID format')
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const product = await Product.findById(req.params.id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.status(200).json({
        success: true,
        data: product
      });
    } catch (err) {
      console.error(err);
      console.error("Route error:", err);
      res.status(500).send("Server error");
      res.status(500).json({
        success: false,
        message: 'Server error while fetching product'
      });
    }
  }
);

export default router;