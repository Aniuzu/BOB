import express from 'express';
import Quote from '../models/Quote.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { body, validationResult } from 'express-validator';
import validator from 'validator'; // Add this import
import nodemailer from 'nodemailer';

const router = express.Router();

// Email configuration (move to config file in production)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ogwuawuri@gmail.com',
    pass: 'rcdzrxsedmlxiutd' // Use 16-digit app password
  }
});

// Verify connection configuration
transporter.verify(function (error, success) {
  if (error) {
    console.log('SMTP Connection Error:', error);
  } else {
    console.log('SMTP Server is ready to take our messages');
  }
});


/**
 * @route   POST /api/v1/quotes
 * @desc    Create a new quote request
 * @access  Public
 */
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email')
      .isEmail()
      .withMessage('Please include a valid email (e.g., user@example.com)')
      .normalizeEmail()
      .customSanitizer(email => {
        console.log('Validated email:', email);
        return email;
      }),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('projectDetails').trim().notEmpty().withMessage('Project details are required'),
    body('products').isArray({ min: 1 }).withMessage('At least one product is required'),
    body('products.*.product').notEmpty().withMessage('Product ID is required'),
    body('products.*.quantity').isInt({ min: 1 }).withMessage('Valid quantity is required')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { name, email, phone, projectDetails, products } = req.body;

      // Create quote
      const quote = new Quote({
        name,
        email,
        phone,
        projectDetails,
        products,
        status: 'pending' // pending/processed/completed
      });

      const createdQuote = await quote.save();

      // Send confirmation email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your Building Materials Quote Request',
        html: `
          <h2>Thank you for your quote request, ${name}!</h2>
          <p>We've received your request for the following materials:</p>
          <ul>
            ${products.map(p => `<li>${p.quantity} x ${p.product}</li>`).join('')}
          </ul>
          <p><strong>Project Details:</strong> ${projectDetails}</p>
          <p>Our team will review your request and get back to you within 24 hours.</p>
          <p>Quote Reference: ${createdQuote._id}</p>
        `
      };

      await transporter.sendMail(mailOptions);

      res.status(201).json({
        success: true,
        data: createdQuote,
        message: 'Quote request submitted successfully'
      });

    } catch (error) {
      console.error('Quote creation error:', error);
      console.error("Route error:", err);
      res.status(500).send("Server error");
      res.status(500).json({
        success: false,
        message: 'Error creating quote request',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/v1/quotes
 * @desc    Get all quotes (Admin only)
 * @access  Private/Admin
 */
router.get('/', protect, admin, async (req, res) => {
  try {
    const { status, sort } = req.query;

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }

    // Build sort
    const sortOptions = {};
    if (sort === 'newest') {
      sortOptions.createdAt = -1;
    } else if (sort === 'oldest') {
      sortOptions.createdAt = 1;
    }

    const quotes = await Quote.find(query)
      .sort(sortOptions)
      .populate('products.product', 'name price category');

    res.json({
      success: true,
      count: quotes.length,
      data: quotes
    });

  } catch (error) {
    console.error('Get quotes error:', error);
    console.error("Route error:", err);
    res.status(500).send("Server error");
    res.status(500).json({
      success: false,
      message: 'Server error retrieving quotes'
    });
  }
});

/**
 * @route   GET /api/v1/quotes/:id
 * @desc    Get single quote by ID
 * @access  Private/Admin
 */
router.get('/:id', protect, admin, async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id)
      .populate('products.product', 'name price category');

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    res.json({
      success: true,
      data: quote
    });

  } catch (error) {
    console.error('Get quote error:', error);
    console.error("Route error:", err);
    res.status(500).send("Server error");
    res.status(500).json({
      success: false,
      message: 'Server error retrieving quote'
    });
  }
});

/**
 * @route   PUT /api/v1/quotes/:id/status
 * @desc    Update quote status (Admin only)
 * @access  Private/Admin
 */
router.put(
  '/:id/status',
  protect,
  admin,
  [
    body('status')
      .isIn(['pending', 'processed', 'completed'])
      .withMessage('Invalid status value'),
    body('adminNotes').optional().trim()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const quote = await Quote.findById(req.params.id);

      if (!quote) {
        return res.status(404).json({
          success: false,
          message: 'Quote not found'
        });
      }

      quote.status = req.body.status;
      if (req.body.adminNotes) {
        quote.adminNotes = req.body.adminNotes;
      }

      const updatedQuote = await quote.save();

      // Send status update email
      if (updatedQuote.email) {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: updatedQuote.email,
          subject: `Your Quote Request Status Update (${updatedQuote.status})`,
          html: `
            <h2>Quote Request Update</h2>
            <p>Your quote request (Ref: ${updatedQuote._id}) has been updated to: ${updatedQuote.status}</p>
            ${updatedQuote.adminNotes ? `<p><strong>Admin Notes:</strong> ${updatedQuote.adminNotes}</p>` : ''}
            <p>Thank you for choosing our building materials services.</p>
          `
        };

        await transporter.sendMail(mailOptions);
      }

      res.json({
        success: true,
        data: updatedQuote,
        message: 'Quote status updated successfully'
      });

    } catch (error) {
      console.error('Update quote error:', error);
      console.error("Route error:", err);
    res.status(500).send("Server error");
      res.status(500).json({
        success: false,
        message: 'Error updating quote status',
        error: error.message
      });
    }
  }
);

export default router;