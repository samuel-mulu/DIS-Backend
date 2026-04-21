import { prisma } from '../config/db';
import { AuditAction, EntityType } from '@prisma/client';

export interface AuditLogOptions {
  userId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  oldValue?: any;
  newValue?: any;
}

/**
 * Creates an audit log entry in the database.
 * standardizes the format of old and new values as JSON strings.
 */
export async function createAuditLog(options: AuditLogOptions) {
  const { userId, action, entityType, entityId, oldValue, newValue } = options;

  return prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
    },
  });
}
