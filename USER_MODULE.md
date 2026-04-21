# User Management Module Documentation

## Overview
The User Management module provides functionality for managing system users, including creating, viewing, editing, activating, and deactivating users. This module is restricted to users with the `SYSTEM_ADMIN` role only.

## Backend Implementation

### File Structure
```
server/src/modules/
├── users/
│   ├── users.validation.ts    # Zod validation schemas
│   ├── users.service.ts        # Business logic and database operations
│   ├── users.controller.ts     # Request handlers
│   └── users.routes.ts         # Route definitions with middleware
└── roles/
    ├── roles.service.ts        # Role data access
    ├── roles.controller.ts     # Role request handlers
    └── roles.routes.ts         # Role route definitions
```

### API Endpoints

#### Users
- **GET /api/users** - List all users with optional filters
  - Query params: `search`, `role`, `isActive`, `page`, `limit`
  - Requires: Authentication + SYSTEM_ADMIN role
  - Response: `{ data: User[], meta: { page, limit, total } }`

- **GET /api/users/:id** - Get user by ID
  - Requires: Authentication + SYSTEM_ADMIN role
  - Response: `{ data: User }`

- **POST /api/users** - Create new user
  - Body: `{ fullName, email, password, roleId }`
  - Requires: Authentication + SYSTEM_ADMIN role
  - Response: `{ data: User }`

- **PUT /api/users/:id** - Update user
  - Body: `{ fullName?, email?, roleId? }`
  - Requires: Authentication + SYSTEM_ADMIN role
  - Response: `{ data: User }`

- **PATCH /api/users/:id/activate** - Activate user
  - Requires: Authentication + SYSTEM_ADMIN role
  - Response: `{ data: User }`

- **PATCH /api/users/:id/deactivate** - Deactivate user
  - Requires: Authentication + SYSTEM_ADMIN role
  - Response: `{ data: User }`

#### Roles
- **GET /api/roles** - List all roles
  - Requires: Authentication + SYSTEM_ADMIN role
  - Response: `{ data: Role[] }`

### Validation
User creation and update operations use Zod schemas:
- **CreateUserSchema**: Validates fullName (required), email (required, valid email), password (required, min 6 chars), roleId (required)
- **UpdateUserSchema**: Validates fullName (optional), email (optional, valid email), roleId (optional)

### Service Functions
- `getUsers(filters)` - Fetch users with search, role, and status filters
- `getUserById(id)` - Fetch single user by ID
- `createUser(input)` - Create new user with password hashing
- `updateUser(id, input)` - Update user details
- `activateUser(id)` - Mark user as active
- `deactivateUser(id)` - Mark user as inactive

### Audit Logging
All user management operations are logged to the AuditLog table:
- `CREATE_USER` - When a new user is created
- `UPDATE_USER` - When user details are updated
- `ACTIVATE_USER` - When a user is activated
- `DEACTIVATE_USER` - When a user is deactivated

### Role-Based Access Control
All user management endpoints require:
1. Authentication (valid JWT token)
2. SYSTEM_ADMIN role (via `authorize('SYSTEM_ADMIN')` middleware)

## Frontend Implementation

### File Structure
```
client/features/users/
├── types/
│   └── index.ts                    # TypeScript interfaces
├── api/
│   ├── get-users.ts                # Fetch users list
│   ├── get-user-by-id.ts           # Fetch single user
│   ├── create-user.ts              # Create user
│   ├── update-user.ts              # Update user
│   ├── activate-user.ts            # Activate user
│   ├── deactivate-user.ts          # Deactivate user
│   └── get-roles.ts                # Fetch roles
├── hooks/
│   ├── useUsers.ts                 # React Query hook for users list
│   ├── useUser.ts                  # React Query hook for single user
│   ├── useCreateUser.ts            # Mutation hook for creating user
│   ├── useUpdateUser.ts            # Mutation hook for updating user
│   ├── useActivateUser.ts          # Mutation hook for activating user
│   ├── useDeactivateUser.ts        # Mutation hook for deactivating user
│   └── useRoles.ts                 # React Query hook for roles
├── components/
│   ├── user-form.tsx               # Reusable form for create/edit
│   └── user-status-action.tsx      # Activate/deactivate button
└── pages (app/(dashboard)/users/)
    ├── page.tsx                    # Users list with filters
    ├── new/page.tsx                # Create user page
    ├── [id]/page.tsx               # User detail page
    └── [id]/edit/page.tsx          # Edit user page
```

### Types
```typescript
type RoleName = 'SYSTEM_ADMIN' | 'MEDICATION_MANAGER' | 'VIEWER' | 'EXECUTIVE_VIEWER';

interface Role {
  id: string;
  name: RoleName;
  description?: string;
}

interface User {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  role: Role;
  createdAt: string;
  updatedAt: string;
}
```

### React Query Hooks
- `useUsers(filters)` - Fetch users with filters
- `useUser(id)` - Fetch single user by ID
- `useCreateUser()` - Create user mutation
- `useUpdateUser(id)` - Update user mutation
- `useActivateUser(id)` - Activate user mutation
- `useDeactivateUser(id)` - Deactivate user mutation
- `useRoles()` - Fetch all roles

All hooks automatically invalidate relevant queries on success.

### Components

#### UserForm
Reusable form component for creating and editing users.
- Props: `mode` ('create' | 'edit'), `initialValues`, `onSubmit`, `loading`, `availableRoles`
- Features: Client-side validation, error display, role dropdown

#### UserStatusAction
Button component to activate or deactivate a user.
- Props: `isActive`, `onActivate`, `onDeactivate`, `loading`
- Displays: "Activate" (green) or "Deactivate" (red) button based on status

#### AdminRouteProtection
Wrapper component to protect admin-only pages.
- Checks if user is authenticated
- Checks if user has SYSTEM_ADMIN role
- Redirects to login if not authenticated
- Redirects to dashboard if not admin

### Pages

#### Users List Page (`/users`)
- Search by name or email
- Filter by role and status (active/inactive)
- Pagination (10 users per page)
- Click row to view user details
- "Add User" button to create new user

#### Create User Page (`/users/new`)
- UserForm component in create mode
- Password field required
- Role dropdown populated from API
- Redirects to users list on success

#### User Detail Page (`/users/:id`)
- Displays user information (name, email, role, status)
- Shows metadata (created/updated dates)
- Actions: Back, Edit, Activate/Deactivate
- Status badge (green for active, red for inactive)

#### Edit User Page (`/users/:id/edit`)
- UserForm component in edit mode
- Pre-filled with current user data
- No password field (password not editable)
- Redirects to user detail on success

### Route Protection
All user management pages are wrapped with `AdminRouteProtection` to ensure only SYSTEM_ADMIN users can access them.

## Database Models

### User Model
```prisma
model User {
  id           String   @id @default(cuid())
  fullName     String
  email        String   @unique
  passwordHash String
  isActive     Boolean  @default(true)
  roleId       String
  role         Role     @relation(fields: [roleId], references: [id])
  medicationsCreated Medication[] @relation("MedicationCreator")
  medicationsUpdated Medication[] @relation("MedicationUpdater")
  statusHistory StatusHistory[]
  auditLogs    AuditLog[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([email])
  @@index([roleId])
  @@index([isActive])
}
```

### Role Model
```prisma
model Role {
  id          String   @id @default(cuid())
  name        RoleName @unique
  description String?
  users       User[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## User Roles
- **SYSTEM_ADMIN**: Full system access, can manage users
- **MEDICATION_MANAGER**: Can manage medications and their status
- **VIEWER**: Read-only access to medications and reports
- **EXECUTIVE_VIEWER**: Read-only access to dashboard and analytics

## Security Considerations
1. All endpoints require authentication
2. User management restricted to SYSTEM_ADMIN only
3. Passwords are hashed using bcryptjs (10 rounds)
4. Audit logging for all user management operations
5. Frontend route protection as additional security layer

## Testing
Run seed to populate sample data:
```bash
npm run seed
```

Sample users created:
- admin@example.com / Admin123! (SYSTEM_ADMIN)
- john.manager@example.com / Manager123! (MEDICATION_MANAGER)
- sarah.viewer@example.com / Viewer123! (VIEWER)
- mike.executive@example.com / Executive123! (EXECUTIVE_VIEWER)
- jane.medication@example.com / Medication123! (MEDICATION_MANAGER, inactive)

## Future Enhancements
- Password reset functionality
- Email verification for new users
- User profile management (self-service)
- Bulk user operations
- User groups/teams
- Activity history per user
