// routes/posts.js
const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const User = require('../models/User');

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


// @route   GET api/posts/homepage-data
// @desc    دریافت پست‌های پربازدید و کاربران با بیشترین دنبال‌کننده
// @access  Public
router.get('/homepage-data', async (req, res) => {
    try {
        // پست‌های پربازدید (مثلاً ۱۰ پست برتر)
        const popularPosts = await Post.find()
            .sort({ views: -1 }) // بر اساس بازدید از بیشترین به کمترین
            .limit(10) // ۱۰ پست اول
            .populate('user', ['name', 'avatar']); // اطلاعات نویسنده رو هم لود میکنه

        // کاربران با بیشترین دنبال‌کننده (مثلاً ۵ کاربر برتر)
        const topUsers = await User.aggregate([
            {
                $project: {
                    name: 1,
                    avatar: 1,
                    followersCount: { $size: "$followers" } // تعداد فالوورها رو میشماره
                }
            },
            {
                $sort: { followers: -1 } // بر اساس تعداد فالوور از بیشترین به کمترین
            },
            {
                $limit: 10 // ۵ کاربر برتر
            }
        ]);
      console.log(topUsers,popularPosts)

        res.json({ popularPosts, topUsers });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطای سرور');
    }
});


// @route   POST api/posts
// @desc    ایجاد یک پست جدید (حالا شامل آپلود تصویر هم می‌شود)
// @access  Private
router.post(
    '/',
    auth,
    upload.single('image'), // <-- Multer اینجا استفاده می‌شود. 'image' نام فیلد در فرانت‌اند است.
    [
        check('title', 'عنوان پست الزامی است').not().isEmpty(),
        check('text', 'متن پست الزامی است').not().isEmpty()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // اگر خطای اعتبارسنجی بود و فایلی آپلود شده بود، فایل را حذف کن
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const user = await User.findById(req.user).select('-password');

            const newPost = new Post({
                title: req.body.title,
                text: req.body.text,
                user: user
            });

            // اگر فایلی توسط Multer آپلود شده باشد، اطلاعات آن در req.file قرار می‌گیرد
            if (req.file) {
                newPost.image = `http://localhost:5000/uploads/${req.file.filename}`; // ذخیره مسیر فایل در دیتابیس
            }

            const post = await newPost.save();
            res.json(post);
        } catch (err) {
            console.error(err.message);
            // اگر در ذخیره پست خطایی رخ داد، فایل آپلود شده را حذف کن
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).send('خطای سرور');
        }
    }
);

// @route   delete api/posts/:id
// @desc    حذف کردن پست
// @access  Private
router.delete(
    '/:id',
    auth,
    async (req, res) => {

        try {
            let post = await Post.findById(req.params.id);





            // بررسی اینکه آیا کاربر فعلی صاحب این پست است
            if (post.user._id != req.user) {
                return res.status(401).json({ msg: 'اجازه ویرایش این پست را ندارید.' });
            }



            await Post.findByIdAndDelete(post._id);
            res.json({
                msg: "ok"
            })

        } catch (err) {
            console.error("got an error while delteing the post : ", err.message);
            if (err.kind === 'ObjectId') {
                return res.status(404).json({ msg: 'پست یافت نشد.' });
            }
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).send('خطای سرور');
        }
    }
);


// @route   PUT api/posts/:id
// @desc    ویرایش یک پست (حالا شامل آپلود تصویر هم می‌شود)
// @access  Private
router.put(
    '/:id',
    auth,
    upload.single('image'), // <-- Multer اینجا هم برای آپدیت تصویر استفاده می‌شود
    [
        check('title', 'عنوان پست الزامی است').not().isEmpty(),
        check('text', 'متن پست الزامی است').not().isEmpty()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            let post = await Post.findById(req.params.id);

            console.log("post : ", post)


            if (!post) {
                if (req.file) {
                    fs.unlinkSync(req.file.path);
                }
                return res.status(404).json({ msg: 'پست یافت نشد.' });
            }


            // بررسی اینکه آیا کاربر فعلی صاحب این پست است
            if (post.user != req.user) {
                if (req.file) {
                    fs.unlinkSync(req.file.path);
                }
                return res.status(401).json({ msg: 'اجازه ویرایش این پست را ندارید.' });
            }





            // اگر تصویر جدیدی آپلود شده و تصویر قبلی وجود داشته، تصویر قبلی را حذف کن
            if (req.file && post.image) {
                const oldImagePath = path.join(__dirname, '..', post.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }

            // به‌روزرسانی پست
            post.title = req.body.title;
            post.text = req.body.text;
            if (req.file) { // اگر تصویر جدیدی آپلود شده
                post.image = `http://localhost:5000/uploads/${req.file.filename}`;
            } else if (req.body.image === '') { // اگر فرانت‌اند explicitly image رو خالی فرستاده (مثلاً کاربر عکس رو حذف کرده)
                // اگر تصویر قبلی وجود داشت، حذف کن
                if (post.image) {
                    const oldImagePath = path.join(__dirname, '..', post.image);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);
                    }
                }
                post.image = '';
            }


            await post.save();
            res.json(post);
        } catch (err) {
            console.error(err.message);
            if (err.kind === 'ObjectId') {
                return res.status(404).json({ msg: 'پست یافت نشد.' });
            }
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).send('خطای سرور');
        }
    }
);



// @route   GET api/posts
// @desc    دریافت همه پست‌ها (صفحه اصلی)
// @access  Public
router.get('/', async (req, res) => {
    try {
        const posts = await Post.find().sort({ date: -1 }).populate('user', ['name', 'avatar']);
        res.json(posts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطای سرور');
    }
});

// @route   GET api/posts/:id
// @desc    دریافت یک پست خاص
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        let post = await Post.findById(req.params.id).populate('user', ['name', 'avatar']);

        if (post === null) {
            return res.status(404).send({ msg: 'پست یافت نشد.' });
        }

        // افزایش تعداد بازدید
        post.views += 1;
        await post.save();

        res.json(post);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'پست یافت نشد.' });
        }
        res.status(500).send('خطای سرور');
    }
});
// @route   GET api/posts/search/post_name
// @desc    دریافت یک پست خاص
// @access  Public
router.get('/search/:post_name', async (req, res) => {
    try {
        let posts = await Post.find({ title: req.params.post_name }).populate('user', ['name', 'avatar']);
        if (posts.length == 0) {
            return res.status(404).send(posts);
        }

        res.json(posts);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'پست یافت نشد.' });
        }
        res.status(500).send('خطای سرور');
    }
});

// @route   PUT api/posts/like/:id
// @desc    لایک کردن یک پست
// @access  Private
router.put('/like/:id', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ msg: 'پست یافت نشد.' });
        }

        // بررسی اینکه کاربر قبلاً این پست رو لایک کرده یا نه
        if (post.likes.filter((like) => like.user === req.user).length > 0) {
            return res.status(400).json({ msg: 'شما قبلاً این پست را لایک کرده‌اید.' });
        }

        post.likes.unshift({ user: req.user });
        await post.save();
        res.json(post.likes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطای سرور');
    }
});

// @route   PUT api/posts/unlike/:id
// @desc    آنلایک کردن یک پست
// @access  Private
router.put('/unlike/:id', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ msg: 'پست یافت نشد.' });
        }

        // بررسی اینکه کاربر این پست رو لایک کرده یا نه
        if (post.likes.filter((like) => like.user == req.user).length === 0) {
            return res.status(400).json({ msg: 'شما این پست را لایک نکرده‌اید.' });
        }

        // حذف لایک
        const removeIndex = post.likes.map((likeId, index) => {
            if (likeId == req.user) return index
        })
        post.likes.splice(removeIndex - 1, 1);

        await post.save();
        res.json(post.likes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطای سرور');
    }
});

// @route   POST api/posts/comment/:id
// @desc    افزودن کامنت به یک پست
// @access  Private
router.post(
    '/comment/:id',
    auth,
    [check('text', 'متن کامنت الزامی است').not().isEmpty()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const user = await User.findById(req.user).select('-password');
            const post = await Post.findById(req.params.id);

            if (!post) {
                return res.status(404).json({ msg: 'پست یافت نشد.' });
            }

            const newComment = {
                text: req.body.text,
                user: req.user,
                name: user.name,
                avatar: user.avatar
            };

            post.comments.unshift(newComment);
            await post.save();
            res.json(post.comments);
        } catch (err) {
            console.error(err.message);
            res.status(500).send('خطای سرور');
        }
    }
);

// @route   DELETE api/posts/comment/:post_id/:comment_id
// @desc    حذف یک کامنت از یک پست
// @access  Private
router.delete('/comment/:post_id/:comment_id', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.post_id);
// console.log("post : ",post)
        if (!post) {
            return res.status(404).json({ msg: 'پست یافت نشد.' });
        }

        // پیدا کردن کامنت مورد نظر
        const comment = post.comments.find(
            (comment) => comment.id.toString() === req.params.comment_id
        );
// console.log("comment : ",comment)
        // بررسی وجود کامنت
        if (!comment) {
            return res.status(404).json({ msg: 'کامنت یافت نشد.' });
        }

        // بررسی اینکه آیا کاربر حذف کننده، صاحب کامنت است
        if (comment.user != req.user) {
            return res.status(401).json({ msg: 'اجازه حذف این کامنت را ندارید.' });
        }

        // حذف کامنت
        post.comments = post.comments.filter(
            ({ id }) => id.toString() !== req.params.comment_id
        );

        await post.save();
        res.json(post.comments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطای سرور');
    }
});















module.exports = router;