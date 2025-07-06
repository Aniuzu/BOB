import express from 'express';
import Quote from '../models/Quote.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { body, validationResult } from 'express-validator';
import nodemailer from 'nodemailer';
import mg from 'nodemailer-mailgun-transport';

const router = express.Router();

// ==============================================
// EMAIL TRANSPORTER CONFIGURATION
// ==============================================

let transporter;
let emailServiceReady = false;

/**
 * Initializes the email transporter with appropriate configuration
 * based on environment variables.
 */
const initializeEmailTransporter = () => {
  try {
    // Configuration for Mailgun service
    if (process.env.EMAIL_SERVICE === 'Mailgun') {
      if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
        throw new Error('Mailgun API key and domain are required');
      }

      transporter = nodemailer.createTransport(mg({
        auth: {
          api_key: process.env.MAILGUN_API_KEY,
          domain: process.env.MAILGUN_DOMAIN
        },
        host: 'api.mailgun.net'
      }));
    } 
    // Configuration for standard SMTP
    else {
      if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        throw new Error('SMTP host, user and password are required');
      }

      transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        },
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production'
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100
      });
    }

    // Verify connection
    transporter.verify((error) => {
      if (error) {
        console.error('❌ Email service connection error:', error.message);
        emailServiceReady = false;
      } else {
        console.log('✅ Email service ready');
        emailServiceReady = true;
      }
    });

    // Handle transporter errors
    transporter.on('error', (error) => {
      console.error('❌ Email transporter error:', error.message);
      emailServiceReady = false;
    });

  } catch (err) {
    console.error('❌ Email configuration error:', err.message);
    emailServiceReady = false;
  }
};

// Initialize on startup
initializeEmailTransporter();

// ==============================================
// HELPER FUNCTIONS
// ==============================================

/**
 * Sends an email with retry logic
 * @param {Object} mailOptions - Nodemailer mail options
 * @param {number} retries - Number of retry attempts
 * @returns {Promise} Resolves when email is sent or all retries fail
 */
const sendEmailWithRetry = async (mailOptions, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!emailServiceReady) {
        throw new Error('Email service not ready');
      }
      
      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully (attempt ${attempt})`);
      return info;
    } catch (error) {
      console.error(`Email attempt ${attempt} failed:`, error.message);
      
      if (attempt === retries) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
};

/**
 * Generates customer confirmation email HTML
 */
const generateCustomerEmail = (quote) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">Thank you for your request, ${quote.name}!</h2>
      <p>We've received your quote request and will process it shortly.</p>
      
      <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #2c3e50; margin-top: 0;">Request Details</h3>
        <p><strong>Reference ID:</strong> ${quote._id}</p>
        <p><strong>Project:</strong> ${quote.projectDetails}</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
        <h3 style="color: #2c3e50; margin-top: 0;">Requested Products</h3>
        <ul style="padding-left: 20px;">
          ${quote.products.map(p => `<li>${p.quantity} × ${p.productId}</li>`).join('')}
        </ul>
      </div>
      
      <p style="margin-top: 20px;">Our team will review your request within 24 hours.</p>
      
      <p style="font-size: 0.9em; color: #7f8c8d; margin-top: 30px;">
        If you have any questions, please reply to this email.
      </p>
    </div>
  `;
};

/**
 * Generates admin notification email HTML
 */
const generateAdminEmail = (quote) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">New Quote Request Received</h2>
      
      <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #2c3e50; margin-top: 0;">Customer Information</h3>
        <p><strong>Name:</strong> ${quote.name}</p>
        <p><strong>Email:</strong> ${quote.email}</p>
        <p><strong>Phone:</strong> ${quote.phone}</p>
        <p><strong>Reference ID:</strong> ${quote._id}</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h3 style="color: #2c3e50; margin-top: 0;">Project Details</h3>
        <p>${quote.projectDetails}</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
        <h3 style="color: #2c3e50; margin-top: 0;">Products Requested</h3>
        <ul style="padding-left: 20px;">
          ${quote.products.map(p => `<li>${p.quantity} × ${p.productId}</li>`).join('')}
        </ul>
      </div>
      
      <p style="margin-top: 20px;">
        <a href="${process.env.ADMIN_PANEL_URL}/quotes/${quote._id}" 
           style="background: #3498db; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">
          View in Admin Panel
        </a>
      </p>
    </div>
  `;
};

// ==============================================
// ROUTES
// ==============================================

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

      // Only attempt to send emails if transporter is configured and ready
      if (transporter && emailServiceReady) {
        try {
          const customerEmail = {
            from: `"${process.env.EMAIL_SENDER_NAME || 'Your Company'}" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: `Your Quote Request #${savedQuote._id}`,
            html: generateCustomerEmail(savedQuote)
          };

          const adminEmail = {
            from: `"${process.env.EMAIL_SENDER_NAME || 'Your Company'}" <${process.env.EMAIL_FROM}>`,
            to: process.env.ADMIN_EMAIL,
            subject: `New Quote Request: ${name}`,
            html: generateAdminEmail(savedQuote)
          };

          // Send emails with retry logic
          await sendEmailWithRetry(customerEmail);
          await sendEmailWithRetry(adminEmail);
          
          savedQuote.emailStatus = 'sent';
          await savedQuote.save();
          
        } catch (emailError) {
          console.error('Email delivery error:', emailError);
          savedQuote.emailStatus = 'failed';
          savedQuote.emailError = emailError.message;
          await savedQuote.save();
          
          // Still respond successfully but note email failure
          return res.status(201).json({
            success: true,
            data: savedQuote,
            message: 'Quote submitted but email notification failed',
            warning: 'Could not send confirmation email'
          });
        }
      } else {
        console.warn('Email service not configured or ready - skipping email notifications');
        savedQuote.emailStatus = 'skipped';
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

      // Send status update email if email service is ready
      if (transporter && emailServiceReady) {
        try {
          await sendEmailWithRetry({
            from: `"${process.env.EMAIL_SENDER_NAME || 'Your Company'}" <${process.env.EMAIL_FROM}>`,
            to: updatedQuote.email,
            subject: `Your Quote #${updatedQuote._id} Status Update`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50;">Quote Status Updated</h2>
                <p>Your quote request <strong>#${updatedQuote._id}</strong> has been updated to:</p>
                <h3 style="color: ${
                  status === 'completed' ? '#27ae60' : 
                  status === 'cancelled' ? '#e74c3c' : '#3498db'
                }">${status.toUpperCase()}</h3>
                
                ${adminNotes ? `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <h4 style="color: #2c3e50; margin-top: 0;">Administrator Notes:</h4>
                  <p>${adminNotes}</p>
                </div>
                ` : ''}
                
                <p>If you have any questions, please contact our support team.</p>
              </div>
            `
          });
        } catch (emailError) {
          console.error('Status email failed:', emailError);
        }
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