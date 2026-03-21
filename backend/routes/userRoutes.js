const express = require('express');
const router = express.Router();
const { updateUserProfile, registerUser } = require('../controllers/userController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.route('/').post(protect, admin, registerUser);
router.route('/profile').put(protect, updateUserProfile);

module.exports = router;
