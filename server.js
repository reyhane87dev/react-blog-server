// server.js
const express = require('express');
const connectDB = require('./config/db'); // مسیر صحیح اتصال به دیتابیس شما
const path = require('path');             // این خط رو اضافه کنید تا path قابل استفاده باشه
const cors = require('cors');             // اگر از CORS استفاده می‌کنید، این خط رو نگه دارید

const app = express();

// اتصال به دیتابیس
app.set("view engine","ejs");
app.use(express.static('public'))
// میدل‌ویرهای عمومی
// برای پردازش درخواست‌های JSON
app.use(express.json({ extended: false }));
// فعال کردن CORS برای دسترسی بین دامنه‌ای (اگه فرانت‌اند و بک‌اند روی پورت‌های مختلف هستن)
app.use(cors());

// <<-- این خط رو اضافه کنید (یا مطمئن بشید که هست) تا تصاویر آپلود شده قابل دسترسی باشن
// این خط به Express میگه که فایل‌های موجود در پوشه 'uploads' رو در آدرس '/uploads' در دسترس قرار بده.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// تعریف مسیرهای اصلی API
// این خطوط، درخواست‌ها رو به فایل‌های مسیرهای مخصوص خودشون هدایت می‌کنن
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));




////////////////////////////////////////////////////////////////



// --- Multer Configuration START ---
const multer = require('multer');

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


// end multer 


app.post("/api/uploadImage",upload.single("image"),(req,res)=>{
    res.send("the image sucessfully uploaded")
})








/////////////////////////////////////////////////////////////////


app.get("/",(req,res)=>{
    res.render('index')
})




// تعیین پورت سرور
const PORT = 5000

async function connction() {
    await connectDB();
    // راه‌اندازی سرور
     app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
}

connction()
