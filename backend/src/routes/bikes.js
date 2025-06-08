const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Bike = require('../models/Bike');
const { auth, checkRole } = require('../middleware/auth');

// Get all bikes (with filters)
router.get('/', async (req, res) => {
    try {
        const { type, minPrice, maxPrice, location, radius } = req.query;
        let query = { isAvailable: true };

        if (type) query.type = type;
        if (minPrice || maxPrice) {
            query.pricePerDay = {};
            if (minPrice) query.pricePerDay.$gte = Number(minPrice);
            if (maxPrice) query.pricePerDay.$lte = Number(maxPrice);
        }

        if (location && radius) {
            const [lng, lat] = location.split(',').map(Number);
            query.location = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    },
                    $maxDistance: Number(radius) * 1000 // Convert km to meters
                }
            };
        }

        const bikes = await Bike.find(query)
            .populate('rentalService', 'businessName businessAddress')
            .sort({ createdAt: -1 });

        res.json(bikes);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Add new bike (rental service only)
router.post('/', [
    auth,
    checkRole(['rental_service']),
    body('model').trim().notEmpty(),
    body('type').isIn(['mountain', 'road', 'hybrid', 'electric']),
    body('condition').isIn(['excellent', 'good', 'fair', 'needs_maintenance']),
    body('pricePerDay').isNumeric(),
    body('location.coordinates').isArray().isLength(2),
    body('features').isArray()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const bike = new Bike({
            ...req.body,
            rentalService: req.user._id
        });

        await bike.save();
        res.status(201).json(bike);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update bike (rental service only)
router.put('/:id', [
    auth,
    checkRole(['rental_service'])
], async (req, res) => {
    try {
        const bike = await Bike.findOne({
            _id: req.params.id,
            rentalService: req.user._id
        });

        if (!bike) {
            return res.status(404).json({ message: 'Bike not found' });
        }

        Object.assign(bike, req.body);
        await bike.save();

        res.json(bike);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete bike (rental service only)
router.delete('/:id', [
    auth,
    checkRole(['rental_service'])
], async (req, res) => {
    try {
        const bike = await Bike.findOneAndDelete({
            _id: req.params.id,
            rentalService: req.user._id
        });

        if (!bike) {
            return res.status(404).json({ message: 'Bike not found' });
        }

        res.json({ message: 'Bike deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get bike by ID
router.get('/:id', async (req, res) => {
    try {
        const bike = await Bike.findById(req.params.id)
            .populate('rentalService', 'businessName businessAddress phone');

        if (!bike) {
            return res.status(404).json({ message: 'Bike not found' });
        }

        res.json(bike);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 