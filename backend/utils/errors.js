class AppError extends Error {
    constructor(message, statusCode, errorCode = null) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, errors = []) {
        super(message, 400, 'VALIDATION_ERROR');
        this.errors = errors;
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

class AuthorizationError extends AppError {
    constructor(message = 'You do not have permission') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
    }
}

class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409, 'CONFLICT_ERROR');
    }
}

class RateLimitError extends AppError {
    constructor(message = 'Too many requests, please try again later') {
        super(message, 429, 'RATE_LIMIT_ERROR');
    }
}

class ServerError extends AppError {
    constructor(message = 'Internal server error') {
        super(message, 500, 'SERVER_ERROR');
    }
}

class DatabaseError extends AppError {
    constructor(message = 'Database error occurred') {
        super(message, 500, 'DATABASE_ERROR');
    }
}

class ValidationError extends AppError {
    constructor(message, errors = []) {
        super(message, 400, 'VALIDATION_ERROR');
        this.errors = errors;
    }
}

const handleError = (err, req, res, next) => {
    const { statusCode = 500, message, errorCode, errors, isOperational } = err;
    
    const response = {
        success: false,
        message: message || 'Something went wrong',
        errorCode: errorCode || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        requestId: req.requestId
    };
    
    if (errors) {
        response.errors = errors;
    }
    
    if (process.env.NODE_ENV === 'development' && !isOperational) {
        response.stack = err.stack;
    }
    
    console.error(`[ERROR] ${statusCode} - ${message} - ${req.method} ${req.path} - ${req.ip}`);
    
    res.status(statusCode).json(response);
};

const notFoundHandler = (req, res) => {
    throw new NotFoundError(`Cannot ${req.method} ${req.path}`);
};

const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

const formatJoiError = (error) => {
    return error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
    }));
};

const extractErrorMessages = (error) => {
    if (error.errors) {
        return Object.values(error.errors).map(err => err.message);
    }
    return [error.message];
};

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    ServerError,
    DatabaseError,
    handleError,
    notFoundHandler,
    asyncHandler,
    formatJoiError,
    extractErrorMessages
};