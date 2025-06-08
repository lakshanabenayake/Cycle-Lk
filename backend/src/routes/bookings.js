const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Bike = require('../models/Bike');
const { auth, checkRole } = require('../middleware/auth');

// Get all bookings for a user
router.get('/my-bookings', auth, async (req, res) => {
    try {
        const bookings = await Booking.find({ customer: req.user._id })
            .populate('bike')
            .sort({ createdAt: -1 });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all bookings for a rental service
router.get('/rental-service-bookings', [
    auth,
    checkRole(['rental_service'])
], async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate({
                path: 'bike',
                match: { rentalService: req.user._id }
            })
            .populate('customer', 'firstName lastName email phone')
            .sort({ createdAt: -1 });

        // Filter out bookings where bike is null (not owned by this rental service)
        const filteredBookings = bookings.filter(booking => booking.bike);
        
        res.json(filteredBookings);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create new booking
router.post('/', [
    auth,
    checkRole(['customer']),
    body('bike').isMongoId(),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
    body('pickupLocation.coordinates').isArray().isLength(2),
    body('dropoffLocation.coordinates').isArray().isLength(2)
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { bike: bikeId, startDate, endDate, pickupLocation, dropoffLocation } = req.body;

        // Check if bike exists and is available
        const bike = await Bike.findById(bikeId);
        if (!bike || !bike.isAvailable) {
            return res.status(400).json({ message: 'Bike is not available' });
        }

        // Check for overlapping bookings
        const overlappingBooking = await Booking.findOne({
            bike: bikeId,
            status: { $in: ['pending', 'confirmed', 'in_progress'] },
            $or: [
                {
                    startDate: { $lte: new Date(endDate) },
                    endDate: { $gte: new Date(startDate) }
                }
            ]
        });

        if (overlappingBooking) {
            return res.status(400).json({ message: 'Bike is already booked for these dates' });
        }

        // Calculate total price
        const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
        const totalPrice = days * bike.pricePerDay;

        const booking = new Booking({
            customer: req.user._id,
            bike: bikeId,
            startDate,
            endDate,
            totalPrice,
            pickupLocation,
            dropoffLocation
        });

        await booking.save();

        // Update bike availability
        bike.isAvailable = false;
        await bike.save();

        res.status(201).json(booking);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update booking status
router.patch('/:id/status', [
    auth,
    body('status').isIn(['confirmed', 'in_progress', 'completed', 'cancelled'])
], async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('bike');

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Check if user has permission to update status
        if (req.user.role === 'customer' && booking.customer.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (req.user.role === 'rental_service' && booking.bike.rentalService.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const oldStatus = booking.status;
        booking.status = req.body.status;

        // Handle bike availability based on status change
        if (oldStatus === 'pending' && req.body.status === 'confirmed') {
            booking.bike.isAvailable = false;
            await booking.bike.save();
        } else if (['completed', 'cancelled'].includes(req.body.status)) {
            booking.bike.isAvailable = true;
            await booking.bike.save();
        }

        await booking.save();
        res.json(booking);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get booking by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('bike')
            .populate('customer', 'firstName lastName email phone');

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Check if user has permission to view booking
        if (req.user.role === 'customer' && booking.customer._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (req.user.role === 'rental_service' && booking.bike.rentalService.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        res.json(booking);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 