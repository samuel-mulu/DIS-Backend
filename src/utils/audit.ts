import { AuditAction, EntityType, Prisma } from '@prisma/client';
import { prisma } from '../config/db';

export interface AuditLogOptions {
  userId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  oldValue?: any;
  newValue?: any;
}

type AuditLogClient = Pick<typeof prisma, 'auditLog'> | Pick<Prisma.TransactionClient, 'auditLog'>;

/**
 * Creates an audit log entry in the database.
 * standardizes the format of old and new values as JSON strings.
 */
export async function createAuditLog(options: AuditLogOptions, db: AuditLogClient = prisma) {
  const { userId, action, entityType, entityId, oldValue, newValue } = options;

  return db.auditLog.create({
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
