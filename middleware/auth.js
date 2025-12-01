const jwt = require('jsonwebtoken');
const User = require('../models/User'); // برای بررسی وجود کاربر (اختیاری)
require('dotenv').config();

module.exports = async (req, res, next) => {
    // گرفتن توکن از هدر
    const token = req.header('x-auth-token');

    // بررسی وجود توکن
    if (!token) {
        return res.status(401).json({ msg: 'توکن یافت نشد، احراز هویت ناموفق.' });
    }

    try {
        // وریفای کردن توکن
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // اضافه کردن کاربر به شی درخواست
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'توکن نامعتبر است.' });
    }
};