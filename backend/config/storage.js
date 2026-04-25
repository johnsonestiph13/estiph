const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const uploadDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter
});

let s3Client = null;

const initS3 = () => {
    if (!process.env.S3_BUCKET) {
        console.log('S3 not configured, using local storage');
        return null;
    }
    
    s3Client = new S3Client({
        region: process.env.S3_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY,
            secretAccessKey: process.env.S3_SECRET_KEY
        }
    });
    
    console.log('✅ S3 client initialized');
    return s3Client;
};

const uploadToS3 = async (file, key) => {
    if (!s3Client) return null;
    
    const fileContent = fs.readFileSync(file.path);
    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: fileContent,
        ContentType: file.mimetype
    });
    
    await s3Client.send(command);
    fs.unlinkSync(file.path);
    
    return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
};

const deleteFromS3 = async (key) => {
    if (!s3Client) return false;
    
    const command = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key
    });
    
    await s3Client.send(command);
    return true;
};

const getFileUrl = (filename) => {
    return `/uploads/${filename}`;
};

const deleteLocalFile = (filepath) => {
    if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
    }
};

module.exports = {
    upload,
    initS3,
    uploadToS3,
    deleteFromS3,
    getFileUrl,
    deleteLocalFile
};