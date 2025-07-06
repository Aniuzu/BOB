import express from 'express';
import Quote from '../models/Quote.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { body, validationResult } from 'express-validator';
import nodemailer from 'nodemailer';
import mg from 'nodemailer-mailgun-transport';

const router = express.Router();

// Initialize email transporter
let transporter;

try {
  const emailConfig = {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  };

  if (process.env.EMAIL_SERVICE === 'Mailgun') {
    transporter = nodemailer.createTransport(mg({
      auth: {
        api_key: process.env.EMAIL_API_KEY,
        domain: process.env.MAILGUN_DOMAIN
      }
    }));
  } else {
    transporter = nodemailer.createTransport(emailConfig);
  }

  // Verify connection
  transporter.verify((error) => {
    if (error) {
      console.error('❌ SMTP Connection Error:', error.message);
    } else {
      console.log('✅ SMTP Server ready');
    }
  });
} catch (err) {
  console.error('❌ Email config error:', err.message);
}

/**
 * @route   POST /api/v1/quotes
 * @desc    Create a new quote request
 * @access  Public
 */
router.post(
  '/',
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Full name is required')
      .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
      
    body('email')
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail(),
      
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required')
      .isMobilePhone().withMessage('Please provide a valid phone number'),
      
    body('projectDetails')
      .trim()
      .notEmpty().withMessage('Project details are required')
      .isLength({ max: 2000 }).withMessage('Details cannot exceed 2000 characters'),
      
    body('products')
      .isArray({ min: 1 }).withMessage('At least one product is required'),
      
    body('products.*.productId')
      .notEmpty().withMessage('Product ID is required'),
      
    body('products.*.quantity')
      .isInt({ min: 1 }).withMessage('Quantity must be at least 1')
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
      const { name, email, phone, projectDetails, products } = req.body;

      // Create new quote
      const newQuote = new Quote({
        name,
        email,
        phone,
        projectDetails,
        products,
        status: 'pending',
        emailStatus: 'pending'
      });

      const savedQuote = await newQuote.save();

      // Email templates
      const customerEmail = {
        from: `"Your Company Name" <${process.env.EMAIL_FROM}>`,
        to: email,
        subject: `Your Quote Request #${savedQuote._id}`,
        html: `
          <h2>Thank you for your request, ${name}!</h2>
          <p>We've received your quote request and will process it shortly.</p>
          <h3>Request Details:</h3>
          <p><strong>Reference ID:</strong> ${savedQuote._id}</p>
          <p><strong>Project:</strong> ${projectDetails}</p>
          <h3>Requested Products:</h3>
          <ul>
            ${products.map(p => `<li>${p.quantity} × ${p.productId}</li>`).join('')}
          </ul>
          <p>Our team will review your request within 24 hours.</p>
        `
      };

      const adminEmail = {
        from: `"Your Company Name" <${process.env.EMAIL_FROM}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `New Quote Request: ${name}`,
        html: `
          <h2>New Quote Request Received</h2>
          <p><strong>Customer:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Reference ID:</strong> ${savedQuote._id}</p>
          <h3>Project Details:</h3>
          <p>${projectDetails}</p>
          <h3>Products Requested:</h3>
          <ul>
            ${products.map(p => `<li>${p.quantity} × ${p.productId}</li>`).join('')}
          </ul>
        `
      };

      // Send emails with error handling
      try {
        await transporter.sendMail(customerEmail);
        await transporter.sendMail(adminEmail);
        savedQuote.emailStatus = 'sent';
        await savedQuote.save();
      } catch (emailError) {
        console.error('Email delivery error:', emailError);
        savedQuote.emailStatus = 'failed';
        await savedQuote.save();
      }

      res.status(201).json({
        success: true,
        data: savedQuote,
        message: 'Quote request submitted successfully'
      });

    } catch (error) {
      console.error('Quote creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create quote request',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
    const { status, sort, page = 1, limit = 10 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    
    const sortOptions = sort === 'oldest' 
      ? { createdAt: 1 } 
      : { createdAt: -1 };

    const quotes = await Quote.find(query)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('products.product', 'name price');

    const total = await Quote.countDocuments(query);

    res.json({
      success: true,
      count: quotes.length,
      total,
      pages: Math.ceil(total / limit),
      data: quotes
    });

  } catch (error) {
    console.error('Get quotes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quotes'
    });
  }
});

/**
 * @route   GET /api/v1/quotes/:id
 * @desc    Get single quote by ID (Admin only)
 * @access  Private/Admin
 */
router.get('/:id', protect, admin, async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id)
      .populate('products.product', 'name description price');

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
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quote'
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
      .isIn(['pending', 'processed', 'completed', 'cancelled'])
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

      const { status, adminNotes } = req.body;
      quote.status = status;
      if (adminNotes) quote.adminNotes = adminNotes;

      const updatedQuote = await quote.save();

      // Send status update email
      try {
        await transporter.sendMail({
          from: `"${process.env.EMAIL_SENDER_NAME}" <${process.env.EMAIL_FROM}>`,
          to: updatedQuote.email,
          subject: `Your Quote #${updatedQuote._id} Status Update`,
          html: `
            <h2>Quote Status Updated</h2>
            <p>Your quote request <strong>#${updatedQuote._id}</strong> has been updated to:</p>
            <h3>${updatedQuote.status.toUpperCase()}</h3>
            
            ${adminNotes ? `
            <h4>Administrator Notes:</h4>
            <p>${adminNotes}</p>
            ` : ''}
            
            <p>If you have any questions, please contact our support team.</p>
          `
        });
      } catch (emailError) {
        console.error('Status email failed:', emailError);
      }

      res.json({
        success: true,
        data: updatedQuote,
        message: 'Quote status updated successfully'
      });

    } catch (error) {
      console.error('Update quote error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update quote status'
      });
    }
  }
);

export default router;