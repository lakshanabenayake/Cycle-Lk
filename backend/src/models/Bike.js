const mongoose = require('mongoose');

const bikeSchema = new mongoose.Schema({
    rentalService: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    model: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['mountain', 'road', 'hybrid', 'electric'],
        required: true
    },
    condition: {
        type: String,
        enum: ['excellent', 'good', 'fair', 'needs_maintenance'],
        required: true
    },
    pricePerDay: {
        type: Number,
        required: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    images: [{
        type: String
    }],
    features: [{
        type: String
    }],
    description: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for geospatial queries
bikeSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Bike', bikeSchema); 