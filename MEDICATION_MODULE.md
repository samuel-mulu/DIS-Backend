# Medication Module Documentation

## Overview
The Medication Module provides full CRUD operations for managing medications in the drug information system. It includes status tracking with history, audit logging, and role-based access control.

## Backend Implementation

### File Structure
```
server/src/modules/
├── medications/
│   ├── medications.validation.ts  # Zod validation schemas
│   ├── medications.service.ts      # Business logic and Prisma queries
│   ├── medications.controller.ts   # Express route handlers
│   └── medications.routes.ts       # Express route definitions
└── status-history/
    ├── status-history.service.ts   # Status history queries
    ├── status-history.controller.ts
    └── status-history.routes.ts
```

### API Endpoints

#### Medication Routes (`/api/medications`)

| Method | Endpoint | Description | Protected By |
|--------|----------|-------------|--------------|
| GET | `/api/medications` | List medications with filters and pagination | `authenticate` |
| GET | `/api/medications/:id` | Get medication details | `authenticate` |
| POST | `/api/medications` | Create new medication | `authenticate` + `authorize(SYSTEM_ADMIN, MEDICATION_MANAGER)` |
| PUT | `/api/medications/:id` | Update medication (excluding status) | `authenticate` + `authorize(SYSTEM_ADMIN, MEDICATION_MANAGER)` |
| PATCH | `/api/medications/:id/status` | Change medication status | `authenticate` + `authorize(SYSTEM_ADMIN, MEDICATION_MANAGER)` |
| GET | `/api/medications/:id/status-history` | Get medication status history | `authenticate` |

#### Status History Routes (`/api/status-history`)

| Method | Endpoint | Description | Protected By |
|--------|----------|-------------|--------------|
| GET | `/api/status-history/:medicationId` | Get status history for a medication | `authenticate` |

### Validation Schemas

#### Create Medication
- `code` (required, string): Unique medication code
- `genericName` (required, string): Generic drug name
- `brandName` (required, string): Brand drug name
- `strength` (required, string): Dosage strength (e.g., "500mg")
- `dosageForm` (required, string): Form (e.g., "Tablet", "Capsule")
- `category` (required, string): Drug category
- `manufacturer` (required, string): Manufacturer name
- `description` (optional, string): Description
- `locationId` (required, string): Location ID
- `status` (optional, enum): `AVAILABLE`, `OUT_OF_STOCK`, `UNAVAILABLE` (default: `AVAILABLE`)

#### Update Medication
All fields optional (same as create, except status)

#### Change Status
- `newStatus` (required, enum): New medication status
- `reason` (required, string): Reason for status change

### Service Functions

#### `getMedications(filters)`
- Filters: `search`, `status`, `locationId`, `page`, `limit`
- Returns paginated list with medication details
- Includes related Location, CreatedBy, UpdatedBy users

#### `getMedicationById(id)`
- Returns single medication with all relations

#### `createMedication(input, userId)`
- Validates duplicate code
- Creates medication with audit log (CREATE action)
- Returns created medication

#### `updateMedication(id, input, userId)`
- Validates duplicate code (if code changed)
- Updates medication with audit log (UPDATE action)
- Returns updated medication

#### `changeMedicationStatus(id, input, userId)`
- Validates status is different from current
- Creates StatusHistory record
- Updates medication status with audit log (STATUS_CHANGE action)
- Returns updated medication

#### `getMedicationStatusHistory(medicationId)`
- Returns all status history records for a medication
- Ordered by changedAt descending

### Audit Logging
All write operations create audit logs:
- CREATE: When a medication is created
- UPDATE: When a medication is updated
- STATUS_CHANGE: When medication status changes

Audit logs include:
- `userId`: User who performed the action
- `action`: Type of action
- `entityType`: `MEDICATION`
- `entityId`: Medication ID
- `oldValue` / `newValue`: JSON string of changes

### Role-Based Access Control

| Role | Read Access | Write Access |
|------|-------------|--------------|
| SYSTEM_ADMIN | ✓ | ✓ |
| MEDICATION_MANAGER | ✓ | ✓ |
| VIEWER | ✓ | ✗ |
| EXECUTIVE_VIEWER | ✓ | ✗ |

## Frontend Implementation

### File Structure
```
client/features/medications/
├── types/
│   └── index.ts                    # TypeScript types
├── api/
│   ├── get-medications.ts
│   ├── get-medication-by-id.ts
│   ├── create-medication.ts
│   ├── update-medication.ts
│   ├── change-medication-status.ts
│   └── get-status-history.ts
├── hooks/
│   ├── useMedications.ts
│   ├── useMedication.ts
│   ├── useCreateMedication.ts
│   ├── useUpdateMedication.ts
│   ├── useChangeMedicationStatus.ts
│   └── useMedicationStatusHistory.ts
└── components/
    ├── medication-form.tsx         # Reusable form for create/edit
    └── change-status-modal.tsx      # Status change modal
```

### Pages
```
client/app/(dashboard)/medications/
├── page.tsx                        # Medication list with filters
├── new/
│   └── page.tsx                    # Create medication
└── [id]/
    ├── page.tsx                    # Medication details
    └── edit/
        └── page.tsx                # Edit medication
```

### React Query Hooks

#### `useMedications(filters)`
- Fetches paginated medication list
- Accepts search, status, locationId filters

#### `useMedication(id)`
- Fetches single medication details
- Auto-enabled when id is provided

#### `useCreateMedication()`
- Mutation hook for creating medications
- Invalidates medication queries on success

#### `useUpdateMedication(id)`
- Mutation hook for updating medications
- Invalidates specific medication and list queries

#### `useChangeMedicationStatus(id)`
- Mutation hook for status changes
- Invalidates medication and status history queries

#### `useMedicationStatusHistory(id)`
- Fetches status history for a medication

### Components

#### MedicationForm
- Reusable form for create and edit modes
- Validates all required fields
- Shows inline error messages
- Handles loading states

#### ChangeStatusModal
- Modal for changing medication status
- Requires reason for status change
- Validates new status differs from current

### UI Features

#### List Page
- Search by code, generic name, or brand
- Filter by status (Available, Out of Stock, Unavailable)
- Filter by location
- Pagination support
- Clickable rows to view details
- Status badges with color coding

#### Detail Page
- Full medication information display
- Metadata (created/updated by, timestamps)
- Status history table
- Edit and Change Status buttons (for authorized roles)
- Role-based UI (edit controls only for SYSTEM_ADMIN and MEDICATION_MANAGER)

#### Create/Edit Pages
- Form with all medication fields
- Validation on submit
- Cancel button to go back
- Loading state during submission

## Database Models

### Medication
```prisma
model Medication {
  id            String         @id @default(cuid())
  code          String         @unique
  genericName   String
  brandName     String
  strength      String
  dosageForm    String
  category      String
  manufacturer  String
  description   String?
  status        MedicationStatus @default(AVAILABLE)
  locationId    String
  location      Location       @relation(fields: [locationId], references: [id])
  createdById   String
  createdBy     User           @relation("MedicationCreator", fields: [createdById], references: [id])
  updatedById   String
  updatedBy     User           @relation("MedicationUpdater", fields: [updatedById], references: [id])
  statusHistory StatusHistory[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}
```

### StatusHistory
```prisma
model StatusHistory {
  id           String          @id @default(cuid())
  medicationId String
  medication   Medication      @relation(fields: [medicationId], references: [id])
  oldStatus    MedicationStatus
  newStatus    MedicationStatus
  reason       String?
  changedById  String
  changedBy    User            @relation(fields: [changedById], references: [id])
  changedAt    DateTime        @default(now())
}
```

## Status Flow

### MedicationStatus Enum
- `AVAILABLE`: Medication is available for use
- `OUT_OF_STOCK`: Medication is temporarily out of stock
- `UNAVAILABLE`: Medication is unavailable (discontinued, recalled, etc.)

### Status Change Process
1. User with write permissions initiates status change
2. System validates new status differs from current
3. User provides reason for change
4. StatusHistory record is created
5. Medication status is updated
6. Audit log is created
7. Related queries are invalidated

## Testing Recommendations

### Backend Tests
- Test all CRUD operations
- Test validation errors (duplicate code, missing fields)
- Test role-based access control
- Test audit log creation
- Test status history tracking

### Frontend Tests
- Test page navigation
- Test form validation
- Test loading states
- Test error handling
- Test role-based UI visibility
- Test status change modal

## Future Enhancements
- Add barcode/QR code support
- Add expiry date tracking
- Add batch number tracking
- Add medication interactions
- Add dosage instructions
- Add image upload for medication packaging
