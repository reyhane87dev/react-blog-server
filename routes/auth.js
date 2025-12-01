const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth'); // برای گرفتن اطلاعات کاربر فعلی

// @route   GET api/auth
// @desc    دریافت اطلاعات کاربر احراز هویت شده
// @access  Private
router.get('/', auth, async (req, res) => {
        const user = await User.findById(req.user).select('-password'); // رمز عبور رو برنمی‌گردونه
        res.json(user);
});

// @route   POST api/auth/register
// @desc    ثبت نام کاربر
// @access  Public
router.post(
    '/register',
    [
        check('name', 'نام الزامی است').not().isEmpty(),
        check('email', 'لطفاً یک ایمیل معتبر وارد کنید').isEmail(),
        check('password', 'لطفاً یک رمز عبور با حداقل 8 کاراکتر وارد کنید').isLength({ min: 8 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password } = req.body;

        try {
            let user = await User.find({ email : req.body.email });

            if (user.length !== 0) {
                return res.status(400).json({ msg: 'کاربری با این ایمیل از قبل وجود دارد.' });
            }

            user = new User({
                name,
                email,
                password
            });

            await user.save();


            const token = jwt.sign(
                user.id,
                process.env.JWT_SECRET,
            );
            res.json({
                token
            })
        } catch (err) {
            console.error(err.message);
            res.status(500).send('خطای سرور');
        }
    }
);

// @route   POST api/auth/login
// @desc    ورود کاربر
// @access  Public
router.post(
    '/login',
    [
        check('email', 'لطفاً یک ایمیل معتبر وارد کنید').isEmail(),
        check('password', 'رمز عبور الزامی است').exists()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        try {
            let user = await User.findOne({ email });

            if (!user) {
                return res.status(400).json({ msg: 'اطلاعات نامعتبر است.' });
            }

            const isMatch = await user.matchPassword(password);

            if (!isMatch) {
                return res.status(400).json({ msg: 'اطلاعات نامعتبر است.' });
            }


            const token = jwt.sign(
                user.id,
                process.env.JWT_SECRET,

            );
            res.json({
                token
            })
        } catch (err) {
            console.error(err.message);
            res.status(500).send('خطای سرور');
        }
    }
);

module.exports = router;