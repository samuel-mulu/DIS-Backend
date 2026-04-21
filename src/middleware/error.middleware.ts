import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  statusCode?: number;
  errors?: Record<string, string>;

  constructor(message: string, statusCode: number = 500, errors?: Record<string, string>) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (err instanceof ZodError) {
    const validationErrors = err.issues.reduce<Record<string, string>>((acc, issue) => {
      const key = issue.path.join('.') || 'root';
      acc[key] = issue.message;
      return acc;
    }, {});

    return res.status(400).json({
      message: 'Validation failed',
      errors: validationErrors,
      ...(isDevelopment ? { stack: err.stack } : {}),
    });
  }

  const appError = err instanceof AppError ? err : new AppError('Internal server error');
  const statusCode = appError.statusCode || 500;

  if (statusCode >= 500) {
    console.error('Server error:', err);
  }

  const response: { message: string; errors?: Record<string, string>; stack?: string } = {
    message: appError.message || 'Internal server error',
  };

  if (appError.errors) {
    response.errors = appError.errors;
  }

  if (isDevelopment) {
    response.stack = appError.stack;
  }

  res.status(statusCode).json(response);
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', errors?: Record<string, string>) {
    super(message, 400, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}
