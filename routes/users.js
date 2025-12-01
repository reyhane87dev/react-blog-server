// routes/users.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const Post = require('../models/Post'); // برای نمایش پست‌های کاربر

// --- Multer Configuration START ---
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // برای حذف فایل در صورت بروز خطا

// تنظیمات ذخیره‌سازی برای Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // تصاویر در پوشه 'uploads' ذخیره می‌شوند
    },
    filename: (req, file, cb) => {
        // نام‌گذاری فایل برای جلوگیری از تکرار: fieldname-timestamp.ext
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);

    }
});

// فیلتر برای اطمینان از اینکه فقط تصاویر آپلود می‌شوند
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('فقط فایل‌های تصویری مجاز هستند!'), false);
    }
};

// پیکربندی نهایی Multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 1024 * 1024 * 5 // حداکثر سایز فایل: 5 مگابایت
    }
});
// --- Multer Configuration END ---


// @route   GET api/users/:user_id
// @desc    دریافت پروفایل کاربر (شامل تعداد فالوور، فالووینگ و پست‌ها)
// @access  Public
router.get('/:user_id', async (req, res) => {
    try {
        const user = await User.findById(req.params.user_id).select('-password');
        if (!user) {
            return res.status(404).json({ msg: 'کاربر یافت نشد.' });
        }

        // تعداد پست‌ها
        const postCount = await Post.countDocuments({ user: req.params.user_id });
        const posts = await Post.find({ user: req.params.user_id });

        res.json({
            posts,
            ...user.toObject(), // تبدیل Mongoose Document به Object ساده
            followersCount: user.followers.length,
            followingCount: user.following.length,
            postCount: postCount
        });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'کاربر یافت نشد.' });
        }
        res.status(500).send('خطای سرور');
    }
});







// @route   GET api/users/search/user_name (name query)
// @desc    دریافت پروفایل کاربر (شامل تعداد فالوور، فالووینگ و پست‌ها)
// @access  Public
router.get('/search/:user_name', async (req, res) => {
    try {
        const user = await User.find({
            name: req.params.user_name
        }).select('-password');


        if (user.length === 0) {
            return res.status(404).json(user);
        }



        res.json(
            user
        );
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json(user);
        }
        res.status(500).send('خطای سرور');
    }
});






// @route   PUT api/users/profile
// @desc    ویرایش پروفایل کاربر (فقط برای صاحب پروفایل، شامل آپلود آواتار)
// @access  Private
router.put(
    '/profile',
    auth,
    upload.single('avatar'), // <-- Multer اینجا استفاده می‌شود. 'avatar' نام فیلد در فرانت‌اند است.
    [
        check('name', 'نام الزامی است').not().isEmpty(),
        // می‌تونید برای bio و occupation هم محدودیت تعریف کنید
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.send({
                error: errors.array()
            })
        }
        const { name, bio, occupation } = req.body;

        const profileFields = {};
        if (name) profileFields.name = name;
        if (bio) profileFields.bio = bio;
        if (occupation) profileFields.occupation = occupation;
        // اگر فایلی آپلود شده باشد (آواتار جدید)
        if (req.file && req.file !== "http://localhost:5000/profile.jpg") {
            profileFields.avatar = `http://localhost:5000/uploads/${req.file.filename}`; // ذخیره مسیر فایل جدید
        }

        try {
            let user = await User.findById(req.user);



            // به‌روزرسانی کاربر
            await User.updateOne(
                { _id: req.user },
                { $set: profileFields },
                { new: true }
            );
            user = await User.findOne({ _id: req.user }).select({ password: 0 })
            res.json(user);
        } catch (err) {
            console.error(err.message);
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).send('خطای سرور');
        }
    }
);















// ... (existing imports and other routes) ...

// @route   PUT api/users/follow/:id
// @desc    فالو کردن یک کاربر
// @access  Private
router.put('/follow/:id', auth, async (req, res) => {
    try {
        const userToFollow = await User.findById(req.params.id).select('-password');
        // The `auth` middleware attaches the user ID to `req.user.id`.
        // So, fetch the current user using req.user.id.
        const currentUser = await User.findById(req.user).select('-password'); 
        
        if (!userToFollow) {
            return res.status(404).json({ msg: 'کاربر یافت نشد.' });
        }

        // Compare ObjectIds safely by converting to string
        if (userToFollow._id.toString() === currentUser._id.toString()) {
            return res.status(400).json({ msg: 'نمی‌توانید خودتان را فالو کنید.' });
        }

        // Check if the user is already following
        // Use .toString() for reliable comparison of ObjectIds
        if (userToFollow.followers.some(follower => follower.user.toString() === req.user)) {
            return res.status(400).json({ msg: 'شما قبلاً این کاربر را فالو کرده‌اید.' });
        }

        // Add to followers and following lists
        userToFollow.followers.unshift({ user: currentUser._id });
        currentUser.following.unshift({ user: userToFollow._id });

        await userToFollow.save();
        await currentUser.save();

        res.json({ msg: 'کاربر با موفقیت فالو شد.' });
    } catch (err) {
        console.error("error while follow : ", err);
        res.status(500).send('خطای سرور');
    }
});

// @route   PUT api/users/unfollow/:id
// @desc    آنفالو کردن یک کاربر
// @access  Private
router.put('/unfollow/:id', auth, async (req, res) => {
    try {
        const userToUnfollow = await User.findById(req.params.id).select('-password');
        const currentUser = await User.findById(req.user).select('-password'); 

        if (!userToUnfollow) {
            return res.status(404).json({ msg: 'کاربر یافت نشد.' });
        }

        // Compare ObjectIds safely
        if (userToUnfollow._id.toString() === currentUser._id.toString()) {
            return res.status(400).json({ msg: 'نمی‌توانید خودتان را آنفالو کنید.' });
        }
        
        // Corrected logic: Check if the user is *not* following before attempting to unfollow
        // Use .toString() for reliable comparison
        const isFollowing = userToUnfollow.followers.some(follower => follower.user.toString() === currentUser._id.toString());
        
        if (!isFollowing) { // If the current user is NOT following, return an error
            return res.status(400).json({ msg: 'شما این کاربر را فالو نکرده‌اید.' });
        }

        // Remove the current user from the unfollowed user's followers list
        // Use filter() for cleaner code and correct ObjectId comparison
        userToUnfollow.followers = userToUnfollow.followers.filter(
            (follower) => follower.user.toString() !== currentUser._id.toString()
        );

        // Remove the unfollowed user from the current user's following list
        // Use filter() for cleaner code and correct ObjectId comparison
        currentUser.following = currentUser.following.filter(
            (following) => following.user.toString() !== userToUnfollow._id.toString()
        );

        await userToUnfollow.save();
        await currentUser.save();

        res.json({ msg: 'کاربر با موفقیت آنفالو شد.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطای سرور');
    }
});

// ... (export router) ...
module.exports = router;