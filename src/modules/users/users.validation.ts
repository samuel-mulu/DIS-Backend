import { z } from 'zod';

export const createUserSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  roleId: z.string().min(1, 'Role is required'),
  departmentId: z.string().min(1, 'Department is required').optional(),
  departmentIds: z.array(z.string().min(1, 'Department is required')).max(2, 'Viewer can only have up to 2 departments').optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').optional(),
  email: z.string().email('Invalid email address').optional(),
  roleId: z.string().min(1, 'Role is required').optional(),
  departmentId: z.string().min(1, 'Department is required').nullable().optional(),
  departmentIds: z.array(z.string().min(1, 'Department is required')).max(2, 'Viewer can only have up to 2 departments').optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
