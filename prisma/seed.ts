import { PrismaClient } from '@prisma/client';
import { RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Seed roles
  console.log('Seeding roles...');
  const roles = [
    { name: RoleName.SYSTEM_ADMIN, description: 'Full system access' },
    { name: RoleName.MEDICATION_MANAGER, description: 'Manage medications in assigned department' },
    { name: RoleName.VIEWER, description: 'Read-only access to dashboard and analytics' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
      },
      create: role,
    });
  }

  console.log('Roles seeded successfully');

  // Seed locations
  console.log('Seeding locations...');
  const locations = [
    { name: 'Store Pharmacy', description: 'Primary store pharmacy department' },
    { name: 'In Patient Pharmacy', description: 'In-patient pharmacy department' },
    { name: 'OPD Pharmacy', description: 'Out-patient pharmacy department' },
    { name: 'OR Pharmacy', description: 'Operating room pharmacy department' },
    { name: 'Emergency Pharmacy', description: 'Emergency pharmacy department' },
  ];

  for (const location of locations) {
    await prisma.location.upsert({
      where: { name: location.name },
      update: {
        description: location.description,
      },
      create: location,
    });
  }

  console.log('Locations seeded successfully');

  // Seed admin user
  console.log('Seeding admin user...');
  const adminRole = await prisma.role.findUnique({
    where: { name: RoleName.SYSTEM_ADMIN },
  });

  if (adminRole) {
    const passwordHash = await bcrypt.hash('Admin123!', 10);
    await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {
        fullName: 'System Admin',
        passwordHash,
        roleId: adminRole.id,
        departmentId: null,
        isActive: true,
      },
      create: {
        fullName: 'System Admin',
        email: 'admin@example.com',
        passwordHash,
        roleId: adminRole.id,
        departmentId: null,
        isActive: true,
      },
    });
    console.log('Admin user seeded successfully');
    console.log('Admin credentials: admin@example.com / Admin123!');
  }

  // Seed sample users with different roles
  console.log('Seeding sample users...');
  const medicationManagerRole = await prisma.role.findUnique({
    where: { name: RoleName.MEDICATION_MANAGER },
  });
  const viewerRole = await prisma.role.findUnique({
    where: { name: RoleName.VIEWER },
  });
  const storePharmacy = await prisma.location.findUnique({
    where: { name: 'Store Pharmacy' },
  });
  const inPatientPharmacy = await prisma.location.findUnique({
    where: { name: 'In Patient Pharmacy' },
  });
  const opdPharmacy = await prisma.location.findUnique({
    where: { name: 'OPD Pharmacy' },
  });
  const emergencyPharmacy = await prisma.location.findUnique({
    where: { name: 'Emergency Pharmacy' },
  });

  if (medicationManagerRole && viewerRole && storePharmacy && inPatientPharmacy && opdPharmacy && emergencyPharmacy) {
    const sampleUsers = [
      {
        fullName: 'John Manager',
        email: 'john.manager@example.com',
        passwordHash: await bcrypt.hash('Manager123!', 10),
        roleId: medicationManagerRole.id,
        departmentId: storePharmacy.id,
        isActive: true,
      },
      {
        fullName: 'Dina Store',
        email: 'dina.store@example.com',
        passwordHash: await bcrypt.hash('Manager123!', 10),
        roleId: medicationManagerRole.id,
        departmentId: storePharmacy.id,
        isActive: true,
      },
      {
        fullName: 'Sarah Viewer',
        email: 'sarah.viewer@example.com',
        passwordHash: await bcrypt.hash('Viewer123!', 10),
        roleId: viewerRole.id,
        isActive: true,
      },
      {
        fullName: 'Omar InPatient',
        email: 'omar.inpatient@example.com',
        passwordHash: await bcrypt.hash('Manager123!', 10),
        roleId: medicationManagerRole.id,
        departmentId: inPatientPharmacy.id,
        isActive: true,
      },
      {
        fullName: 'Lina OPD',
        email: 'lina.opd@example.com',
        passwordHash: await bcrypt.hash('Manager123!', 10),
        roleId: medicationManagerRole.id,
        departmentId: opdPharmacy.id,
        isActive: true,
      },
      {
        fullName: 'Jane Medication',
        email: 'jane.medication@example.com',
        passwordHash: await bcrypt.hash('Medication123!', 10),
        roleId: medicationManagerRole.id,
        departmentId: emergencyPharmacy.id,
        isActive: false,
      },
    ];

    for (const user of sampleUsers) {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {
          fullName: user.fullName,
          passwordHash: user.passwordHash,
          roleId: user.roleId,
          departmentId: user.departmentId ?? null,
          isActive: user.isActive,
        },
        create: user,
      });
    }
    console.log('Sample users seeded successfully');
  }

  // Seed sample medications
  console.log('Seeding sample medications...');
  const storeLocation = await prisma.location.findUnique({
    where: { name: 'Store Pharmacy' },
  });
  const inPatientLocation = await prisma.location.findUnique({
    where: { name: 'In Patient Pharmacy' },
  });
  const opdLocation = await prisma.location.findUnique({
    where: { name: 'OPD Pharmacy' },
  });
  const orLocation = await prisma.location.findUnique({
    where: { name: 'OR Pharmacy' },
  });
  const emergencyLocation = await prisma.location.findUnique({
    where: { name: 'Emergency Pharmacy' },
  });

  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
  });
  const storeManager = await prisma.user.findUnique({
    where: { email: 'john.manager@example.com' },
  });
  const inPatientManager = await prisma.user.findUnique({
    where: { email: 'omar.inpatient@example.com' },
  });
  const opdManager = await prisma.user.findUnique({
    where: { email: 'lina.opd@example.com' },
  });
  const emergencyManager = await prisma.user.findUnique({
    where: { email: 'jane.medication@example.com' },
  });

  if (
    adminUser &&
    storeManager &&
    inPatientManager &&
    opdManager &&
    emergencyManager &&
    storeLocation &&
    inPatientLocation &&
    opdLocation &&
    orLocation &&
    emergencyLocation
  ) {
    const medications = [
      {
        code: 'MED-001',
        genericName: 'Paracetamol',
        brandName: 'Panadol',
        strength: '500mg',
        dosageForm: 'Tablet',
        category: 'Analgesic',
        manufacturer: 'GSK',
        description: 'Pain reliever and fever reducer',
        locationId: storeLocation.id,
        status: 'AVAILABLE',
        createdById: storeManager.id,
        updatedById: storeManager.id,
      },
      {
        code: 'MED-002',
        genericName: 'Ibuprofen',
        brandName: 'Advil',
        strength: '400mg',
        dosageForm: 'Tablet',
        category: 'Analgesic',
        manufacturer: 'Pfizer',
        description: 'Non-steroidal anti-inflammatory drug',
        locationId: inPatientLocation.id,
        status: 'AVAILABLE',
        createdById: inPatientManager.id,
        updatedById: inPatientManager.id,
      },
      {
        code: 'MED-003',
        genericName: 'Amoxicillin',
        brandName: 'Amoxil',
        strength: '250mg',
        dosageForm: 'Capsule',
        category: 'Antibiotic',
        manufacturer: 'GSK',
        description: 'Broad-spectrum antibiotic',
        locationId: emergencyLocation.id,
        status: 'AVAILABLE',
        createdById: emergencyManager.id,
        updatedById: emergencyManager.id,
      },
      {
        code: 'MED-004',
        genericName: 'Omeprazole',
        brandName: 'Prilosec',
        strength: '20mg',
        dosageForm: 'Capsule',
        category: 'Antacid',
        manufacturer: 'AstraZeneca',
        description: 'Proton pump inhibitor',
        locationId: opdLocation.id,
        status: 'OUT_OF_STOCK',
        createdById: opdManager.id,
        updatedById: opdManager.id,
      },
      {
        code: 'MED-005',
        genericName: 'Metformin',
        brandName: 'Glucophage',
        strength: '500mg',
        dosageForm: 'Tablet',
        category: 'Antidiabetic',
        manufacturer: 'Merck',
        description: 'Blood glucose control medication',
        locationId: orLocation.id,
        status: 'AVAILABLE',
        createdById: adminUser.id,
        updatedById: adminUser.id,
      },
      {
        code: 'MED-006',
        genericName: 'Lisinopril',
        brandName: 'Prinivil',
        strength: '10mg',
        dosageForm: 'Tablet',
        category: 'Antihypertensive',
        manufacturer: 'Merck',
        description: 'ACE inhibitor for blood pressure',
        locationId: emergencyLocation.id,
        status: 'AVAILABLE',
        createdById: emergencyManager.id,
        updatedById: emergencyManager.id,
      },
      {
        code: 'MED-007',
        genericName: 'Atorvastatin',
        brandName: 'Lipitor',
        strength: '20mg',
        dosageForm: 'Tablet',
        category: 'Statin',
        manufacturer: 'Pfizer',
        description: 'Cholesterol-lowering medication',
        locationId: storeLocation.id,
        status: 'UNAVAILABLE',
        createdById: storeManager.id,
        updatedById: storeManager.id,
      },
      {
        code: 'MED-008',
        genericName: 'Cetirizine',
        brandName: 'Zyrtec',
        strength: '10mg',
        dosageForm: 'Tablet',
        category: 'Antihistamine',
        manufacturer: 'Johnson & Johnson',
        description: 'Allergy relief medication',
        locationId: inPatientLocation.id,
        status: 'AVAILABLE',
        createdById: inPatientManager.id,
        updatedById: inPatientManager.id,
      },
    ];

    for (const medication of medications) {
      await prisma.medication.upsert({
        where: { code: medication.code },
        update: {
          genericName: medication.genericName,
          brandName: medication.brandName,
          strength: medication.strength,
          dosageForm: medication.dosageForm,
          category: medication.category,
          manufacturer: medication.manufacturer,
          description: medication.description,
          locationId: medication.locationId,
          status: medication.status as any,
          createdById: medication.createdById,
          updatedById: medication.updatedById,
        },
        create: medication,
      });
    }
    console.log('Sample medications seeded successfully');
  }

  console.log('Database seeding completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
