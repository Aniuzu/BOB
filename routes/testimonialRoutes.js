import express from 'express';
import Testimonial from '../models/Testimonials.js';
import { body, validationResult } from 'express-validator';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route   GET /api/v1/testimonials
 * @desc    Get all approved testimonials
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { limit, featured } = req.query;
    let query = { approved: true };
    
    if (featured === 'true') {
      query.featured = true;
    }

    let testimonialsQuery = Testimonial.find(query)
      .sort({ createdAt: -1 });

    if (limit) {
      testimonialsQuery = testimonialsQuery.limit(parseInt(limit));
    }

    const testimonials = await testimonialsQuery.exec();

    res.status(200).json({
      success: true,
      count: testimonials.length,
      data: testimonials
    });
  } catch (error) {
    console.error('Get testimonials error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving testimonials'
    });
  }
});

/**
 * @route   POST /api/v1/testimonials
 * @desc    Create a new testimonial
 * @access  Public
 */
router.post(
  '/',
  [
    body('authorName').trim().notEmpty().withMessage('Name is required'),
    body('authorTitle').optional().trim(),
    body('content').trim().notEmpty().withMessage('Testimonial content is required')
      .isLength({ min: 20 }).withMessage('Testimonial must be at least 20 characters'),
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1-5')
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
      const { authorName, authorTitle, content, rating } = req.body;

      const testimonial = new Testimonial({
        authorName,
        authorTitle,
        content,
        rating: rating || null,
        approved: false, // Requires admin approval
        featured: false,
        createdAt: new Date()
      });

      const savedTestimonial = await testimonial.save();

      res.status(201).json({
        success: true,
        data: savedTestimonial,
        message: 'Thank you for your testimonial! It will be reviewed by our team.'
      });
    } catch (error) {
      console.error('Create testimonial error:', error);
      res.status(500).json({
        success: false,
        message: 'Error submitting testimonial',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/v1/testimonials/pending
 * @desc    Get pending testimonials (Admin only)
 * @access  Private/Admin
 */
router.get('/pending', protect, admin, async (req, res) => {
  try {
    const testimonials = await Testimonial.find({ approved: false })
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: testimonials.length,
      data: testimonials
    });
  } catch (error) {
    console.error('Get pending testimonials error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving pending testimonials'
    });
  }
});

/**
 * @route   PUT /api/v1/testimonials/:id/approve
 * @desc    Approve a testimonial (Admin only)
 * @access  Private/Admin
 */
router.put('/:id/approve', protect, admin, async (req, res) => {
  try {
    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      { 
        approved: true,
        approvedAt: new Date(),
        approvedBy: req.user._id 
      },
      { new: true }
    );

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    res.status(200).json({
      success: true,
      data: testimonial,
      message: 'Testimonial approved successfully'
    });
  } catch (error) {
    console.error('Approve testimonial error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving testimonial',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/v1/testimonials/:id/feature
 * @desc    Toggle featured status (Admin only)
 * @access  Private/Admin
 */
router.put('/:id/feature', protect, admin, async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    testimonial.featured = !testimonial.featured;
    const updatedTestimonial = await testimonial.save();

    res.status(200).json({
      success: true,
      data: updatedTestimonial,
      message: `Testimonial ${updatedTestimonial.featured ? 'featured' : 'unfeatured'} successfully`
    });
  } catch (error) {
    console.error('Feature testimonial error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating featured status',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/v1/testimonials/:id
 * @desc    Delete a testimonial (Admin only)
 * @access  Private/Admin
 */
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Testimonial deleted successfully'
    });
  } catch (error) {
    console.error('Delete testimonial error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting testimonial',
      error: error.message
    });
  }
});

export default router;