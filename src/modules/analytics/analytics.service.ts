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
    strength: string;
    dosageForm: string;
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
  strength: string;
  dosageForm: string;
  location: {
    id: string;
    name: string;
  };
}

export interface MostFrequentlyOutOfStock {
  medicationId: string;
  strength: string;
  dosageForm: string;
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

export interface DashboardOverview {
  summary: DashboardSummary;
  recentStatusChanges: RecentStatusChange[];
  outOfStockInsights: OutOfStockInsights;
}

export interface AnalyticsActor {
  role: RoleName;
  departmentId?: string;
}

const DEFAULT_RECENT_CHANGES_LIMIT = 10;
const DEFAULT_OUT_OF_STOCK_LIMIT = 10;

function buildMedicationScope(actor: AnalyticsActor, locationId?: string) {
  if (actor.role === RoleName.MEDICATION_MANAGER) {
    return { locationId: actor.departmentId };
  }
  if (locationId) {
    return { locationId };
  }
  return {};
}

function buildStatusBreakdown(
  groupedStatuses: Array<{
    status: MedicationStatus;
    _count: number;
  }>
): StatusBreakdown {
  const breakdown: StatusBreakdown = {
    AVAILABLE: 0,
    OUT_OF_STOCK: 0,
    UNAVAILABLE: 0,
  };

  groupedStatuses.forEach((item) => {
    breakdown[item.status as keyof StatusBreakdown] = item._count;
  });

  return breakdown;
}

function buildDashboardSummaryFromBreakdown(statusBreakdown: StatusBreakdown): DashboardSummary {
  const totalMedications =
    statusBreakdown.AVAILABLE + statusBreakdown.OUT_OF_STOCK + statusBreakdown.UNAVAILABLE;

  return {
    totalMedications,
    availableCount: statusBreakdown.AVAILABLE,
    outOfStockCount: statusBreakdown.OUT_OF_STOCK,
    unavailableCount: statusBreakdown.UNAVAILABLE,
  };
}

async function getCurrentlyOutOfStockItems(
  medicationScope: ReturnType<typeof buildMedicationScope>,
  limit: number
): Promise<OutOfStockInsightItem[]> {
  const medications = await prisma.medication.findMany({
    where: { ...medicationScope, status: MedicationStatus.OUT_OF_STOCK },
    select: {
      id: true,
      strength: true,
      dosageForm: true,
      location: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  return medications.map((medication) => ({
    id: medication.id,
    strength: medication.strength,
    dosageForm: medication.dosageForm,
    location: medication.location,
  }));
}

async function getMostFrequentlyOutOfStockItems(
  medicationScope: ReturnType<typeof buildMedicationScope>
): Promise<MostFrequentlyOutOfStock[]> {
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

  if (outOfStockChanges.length === 0) {
    return [];
  }

  const medicationIds = outOfStockChanges.map((item) => item.medicationId);
  const medications = await prisma.medication.findMany({
    where: { id: { in: medicationIds } },
    select: {
      id: true,
      strength: true,
      dosageForm: true,
    },
  });

  const medicationMap = new Map(medications.map((medication) => [medication.id, medication]));

  return outOfStockChanges
    .map((item) => {
      const medication = medicationMap.get(item.medicationId);
      if (!medication) {
        return null;
      }

      return {
        medicationId: item.medicationId,
        strength: medication.strength,
        dosageForm: medication.dosageForm,
        outOfStockChangeCount: item._count.medicationId,
      };
    })
    .filter((item): item is MostFrequentlyOutOfStock => item !== null)
    .slice(0, 10);
}

async function getStatusBreakdown(actor: AnalyticsActor, locationId?: string): Promise<StatusBreakdown> {
  const medicationScope = buildMedicationScope(actor, locationId);
  const groupedStatuses = await prisma.medication.groupBy({
    by: ['status'],
    where: medicationScope,
    _count: {
      status: true,
    },
  });

  return buildStatusBreakdown(
    groupedStatuses.map((item) => ({
      status: item.status,
      _count: item._count.status,
    }))
  );
}

export async function getDashboardSummary(actor: AnalyticsActor, locationId?: string): Promise<DashboardSummary> {
  const statusBreakdown = await getStatusBreakdown(actor, locationId);
  return buildDashboardSummaryFromBreakdown(statusBreakdown);
}

export async function getRecentStatusChanges(
  actor: AnalyticsActor,
  limit: number = DEFAULT_RECENT_CHANGES_LIMIT,
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
          strength: true,
          dosageForm: true,
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
      strength: change.medication.strength,
      dosageForm: change.medication.dosageForm,
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

export async function getOutOfStockInsights(
  actor: AnalyticsActor,
  locationId?: string,
  currentlyOutOfStockLimit: number = DEFAULT_OUT_OF_STOCK_LIMIT
): Promise<OutOfStockInsights> {
  const medicationScope = buildMedicationScope(actor, locationId);
  const [currentlyOutOfStock, statusBreakdown, mostFrequentlyOutOfStock] = await Promise.all([
    getCurrentlyOutOfStockItems(medicationScope, currentlyOutOfStockLimit),
    getStatusBreakdown(actor, locationId),
    getMostFrequentlyOutOfStockItems(medicationScope),
  ]);

  return {
    currentlyOutOfStock,
    mostFrequentlyOutOfStock,
    statusBreakdown,
  };
}

export async function getDashboardOverview(
  actor: AnalyticsActor,
  locationId?: string,
  recentStatusChangeLimit: number = DEFAULT_RECENT_CHANGES_LIMIT,
  currentlyOutOfStockLimit: number = DEFAULT_OUT_OF_STOCK_LIMIT
): Promise<DashboardOverview> {
  const medicationScope = buildMedicationScope(actor, locationId);
  const [statusBreakdown, recentStatusChanges, currentlyOutOfStock, mostFrequentlyOutOfStock] = await Promise.all([
    getStatusBreakdown(actor, locationId),
    getRecentStatusChanges(actor, recentStatusChangeLimit, locationId),
    getCurrentlyOutOfStockItems(medicationScope, currentlyOutOfStockLimit),
    getMostFrequentlyOutOfStockItems(medicationScope),
  ]);

  return {
    summary: buildDashboardSummaryFromBreakdown(statusBreakdown),
    recentStatusChanges,
    outOfStockInsights: {
      currentlyOutOfStock,
      mostFrequentlyOutOfStock,
      statusBreakdown,
    },
  };
}
