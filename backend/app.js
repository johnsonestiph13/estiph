/**
 * ESTIF HOME ULTIMATE - EXPRESS APP CONFIGURATION
 * Centralized Express application setup with middleware, routes, and error handling
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// DEPENDENCIES
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// ============================================
// INITIALIZATION
// ============================================

const app = express();

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
            connectSrc: ["'self'", "ws:", "wss:"],
            imgSrc: ["'self'", "data:", "https:"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

// Compression
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));
app.use(express.raw({ limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp({
    whitelist: ['sort', 'page', 'limit', 'fields', 'search', 'filter']
}));

// Logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined', {
        skip: (req, res) => res.statusCode < 400
    }));
}

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress;
    },
    skip: (req) => {
        // Skip rate limiting for health checks and internal services
        return req.path === '/api/health' || req.path === '/api/status';
    }
});
app.use('/api/', limiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 requests per hour
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/auth/', authLimiter);

// Request timeout
app.use((req, res, next) => {
    req.setTimeout(30000, () => {
        res.status(408).json({ success: false, message: 'Request timeout' });
    });
    res.setTimeout(30000, () => {
        res.status(408).json({ success: false, message: 'Response timeout' });
    });
    next();
});

// Request ID middleware
app.use((req, res, next) => {
    req.requestId = req.headers['x-request-id'] || 
                    require('crypto').randomBytes(16).toString('hex');
    res.setHeader('X-Request-Id', req.requestId);
    next();
});

// ============================================
// STATIC FILES
// ============================================

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: '1y',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        } else if (path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

// Serve service worker with no-cache
app.use('/sw.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Service-Worker-Allowed', '/');
    res.sendFile(path.join(__dirname, '../public/sw.js'));
});

// Serve manifest
app.use('/manifest.json', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(__dirname, '../public/manifest.json'));
});

// ============================================
// API ROUTES
// ============================================

// Import route modules
const authRoutes = require('./api/v1/auth');
const userRoutes = require('./api/v1/users');
const homeRoutes = require('./api/v1/homes');
const deviceRoutes = require('./api/v1/devices');
const automationRoutes = require('./api/v1/automations');
const scheduleRoutes = require('./api/v1/schedules');
const energyRoutes = require('./api/v1/energy');
const analyticsRoutes = require('./api/v1/analytics');
const notificationRoutes = require('./api/v1/notifications');
const voiceRoutes = require('./api/v1/voice');
const esp32Routes = require('./api/v1/esp32');
const webhookRoutes = require('./api/v1/webhooks');

// API version prefix
const apiV1 = '/api/v1';

// Mount routes
app.use(apiV1 + '/auth', authRoutes);
app.use(apiV1 + '/users', userRoutes);
app.use(apiV1 + '/homes', homeRoutes);
app.use(apiV1 + '/devices', deviceRoutes);
app.use(apiV1 + '/automations', automationRoutes);
app.use(apiV1 + '/schedules', scheduleRoutes);
app.use(apiV1 + '/energy', energyRoutes);
app.use(apiV1 + '/analytics', analyticsRoutes);
app.use(apiV1 + '/notifications', notificationRoutes);
app.use(apiV1 + '/voice', voiceRoutes);
app.use(apiV1 + '/esp32', esp32Routes);
app.use(apiV1 + '/webhooks', webhookRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: require('./package.json').version,
        environment: process.env.NODE_ENV || 'development',
        services: {
            database: mongoose.connection.readyState === 1,
            redis: redis?.status === 'ready',
            mqtt: mqttClient?.connected || false
        }
    });
});

// Status endpoint (more detailed)
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        status: 'operational',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        version: require('./package.json').version
    });
});

// ============================================
// WEBHOOK HANDLERS
// ============================================

// GitHub webhook (for auto-deployment)
app.post('/webhooks/github', express.raw({ type: 'application/json' }), (req, res) => {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];
    
    // Verify signature (implement signature verification)
    // Process webhook event
    
    if (event === 'push') {
        // Trigger deployment
        console.log('GitHub push event received, triggering deployment...');
    }
    
    res.json({ success: true });
});

// Stripe webhook (for payments)
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];
    // Verify and process stripe webhook
    res.json({ received: true });
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Cannot ${req.method} ${req.url}`,
        error: 'Not Found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    // Log error
    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        requestId: req.requestId
    });
    
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors
        });
    }
    
    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(409).json({
            success: false,
            message: `${field} already exists`,
            field
        });
    }
    
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expired'
        });
    }
    
    // Rate limit error
    if (err.status === 429) {
        return res.status(429).json({
            success: false,
            message: 'Too many requests, please try again later',
            retryAfter: err.retryAfter
        });
    }
    
    // Default error
    const status = err.status || 500;
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message;
    
    res.status(status).json({
        success: false,
        message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        requestId: req.requestId
    });
});

// ============================================
// GRACEFUL SHUTDOWN HANDLERS
// ============================================

process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing HTTP server...');
    app.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close();
        redis.quit();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, closing HTTP server...');
    app.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close();
        redis.quit();
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Graceful shutdown
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Graceful shutdown
    process.exit(1);
});

// ============================================
// EXPORT APP
// ============================================

module.exports = app;