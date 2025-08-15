// backend/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { SERVER_MIN_BIRTH_YEAR, SERVER_MAX_BIRTH_YEAR } = require('../config/env');

router.get('/getBirthYearRange', (req, res) => {
    res.status(200).json({
        success: true,
        minBirthYear: SERVER_MIN_BIRTH_YEAR,
        maxBirthYear: SERVER_MAX_BIRTH_YEAR
    });
});

router.get('/current-year', (req, res) => {
    const currentYear = new Date().getFullYear();
    res.json({ 
        success: true,
        currentYear: currentYear 
    });
});


module.exports = router;