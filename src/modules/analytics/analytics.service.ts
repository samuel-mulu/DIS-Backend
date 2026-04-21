import { MedicationStatus, RoleName } from '@prisma/client';
import { prisma } from '../../config/db';

export interface DashboardSummary {
  totalMedications: number;
  availableCount: number;
  outOfStockCount: number;
  unavailableCount: number;
}

export interface RecentStatusChange {
  id: string;
  medication: {
    id: string;
    code: string;
    genericName: string;
  };
  oldStatus: MedicationStatus;
  newStatus: MedicationStatus;
  reason: string | null;
  changedBy: {
    id: string;
    fullName: string;
  };
  changedAt: Date;
}

export interface OutOfStockInsightItem {
  id: string;
  code: string;
  genericName: string;
  location: {
    id: string;
    name: string;
  };
}

export interface MostFrequentlyOutOfStock {
  medicationId: string;
  code: string;
  genericName: string;
  outOfStockChangeCount: number;
}

export interface StatusBreakdown {
  AVAILABLE: number;
  OUT_OF_STOCK: number;
  UNAVAILABLE: number;
}

export interface OutOfStockInsights {
  currentlyOutOfStock: OutOfStockInsightItem[];
  mostFrequentlyOutOfStock: MostFrequentlyOutOfStock[];
  statusBreakdown: StatusBreakdown;
}

export interface AnalyticsActor {
  role: RoleName;
  departmentId?: string;
}

function buildMedicationScope(actor: AnalyticsActor, locationId?: string) {
  if (actor.role === RoleName.MEDICATION_MANAGER) {
    return { locationId: actor.departmentId };
  }
  if (locationId) {
    return { locationId };
  }
  return {};
}

export async function getDashboardSummary(actor: AnalyticsActor, locationId?: string): Promise<DashboardSummary> {
  const medicationScope = buildMedicationScope(actor, locationId);
  const [total, available, outOfStock, unavailable] = await Promise.all([
    prisma.medication.count({ where: medicationScope }),
    prisma.medication.count({ where: { ...medicationScope, status: MedicationStatus.AVAILABLE } }),
    prisma.medication.count({ where: { ...medicationScope, status: MedicationStatus.OUT_OF_STOCK } }),
    prisma.medication.count({ where: { ...medicationScope, status: MedicationStatus.UNAVAILABLE } }),
  ]);

  return {
    totalMedications: total,
    availableCount: available,
    outOfStockCount: outOfStock,
    unavailableCount: unavailable,
  };
}

export async function getRecentStatusChanges(
  actor: AnalyticsActor,
  limit: number = 10,
  locationId?: string
): Promise<RecentStatusChange[]> {
  const medicationScope = buildMedicationScope(actor, locationId);
  const statusChanges = await prisma.statusHistory.findMany({
    take: limit,
    orderBy: { changedAt: 'desc' },
    where: {
      medication: medicationScope,
    },
    include: {
      medication: {
        select: {
          id: true,
          code: true,
          genericName: true,
        },
      },
      changedBy: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });

  return statusChanges.map((change) => ({
    id: change.id,
    medication: {
      id: change.medication.id,
      code: change.medication.code,
      genericName: change.medication.genericName,
    },
    oldStatus: change.oldStatus,
    newStatus: change.newStatus,
    reason: change.reason,
    changedBy: {
      id: change.changedBy.id,
      fullName: change.changedBy.fullName,
    },
    changedAt: change.changedAt,
  }));
}

export async function getOutOfStockInsights(actor: AnalyticsActor, locationId?: string): Promise<OutOfStockInsights> {
  const medicationScope = buildMedicationScope(actor, locationId);
  const [currentlyOutOfStock, statusBreakdown] = await Promise.all([
    prisma.medication.findMany({
      where: { ...medicationScope, status: MedicationStatus.OUT_OF_STOCK },
      select: {
        id: true,
        code: true,
        genericName: true,
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.medication.groupBy({
      by: ['status'],
      where: medicationScope,
      _count: true,
    }),
  ]);

  const breakdown: StatusBreakdown = {
    AVAILABLE: 0,
    OUT_OF_STOCK: 0,
    UNAVAILABLE: 0,
  };

  statusBreakdown.forEach((item) => {
    breakdown[item.status as keyof StatusBreakdown] = item._count;
  });

  // Get most frequently out-of-stock medications
  const outOfStockChanges = await prisma.statusHistory.groupBy({
    by: ['medicationId'],
    where: {
      newStatus: MedicationStatus.OUT_OF_STOCK,
      medication: medicationScope,
    },
    _count: {
      medicationId: true,
    },
    orderBy: {
      _count: {
        medicationId: 'desc',
      },
    },
    take: 10,
  });

  const medicationIds = outOfStockChanges.map((item) => item.medicationId);
  const medications = await prisma.medication.findMany({
    where: { id: { in: medicationIds } },
    select: {
      id: true,
      code: true,
      genericName: true,
    },
  });

  const medicationMap = new Map(medications.map((m) => [m.id, m]));

  const mostFrequentlyOutOfStock: MostFrequentlyOutOfStock[] = outOfStockChanges
    .map((item) => {
      const medication = medicationMap.get(item.medicationId);
      if (!medication) return null;
      return {
        medicationId: item.medicationId,
        code: medication.code,
        genericName: medication.genericName,
        outOfStockChangeCount: item._count.medicationId,
      };
    })
    .filter((item): item is MostFrequentlyOutOfStock => item !== null)
    .slice(0, 10);

  return {
    currentlyOutOfStock: currentlyOutOfStock.map((med) => ({
      id: med.id,
      code: med.code,
      genericName: med.genericName,
      location: med.location,
    })),
    mostFrequentlyOutOfStock,
    statusBreakdown: breakdown,
  };
}
