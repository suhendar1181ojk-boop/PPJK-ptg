import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_MODULE_META,
  buildAutoBillingFields,
  buildAutoSuratJalanFields,
  buildCustomerBillingMessage,
  buildDefaultBillingItems,
  buildOwnerBillingMessage,
  buildUserMonitoringRows,
  calculateBillingTotals,
  calculateCountdownEta,
  canEditPhase,
  canPerformAction,
  canUserAccessModule,
  canUserEditAnyPhase,
  canUserEditPhase,
  computeBillingSummary,
  computeCheckerSummaries,
  computeDashboardStats,
  computeDoReadinessSummary,
  computeGasPinHash,
  computeImportirSummaries,
  computeNopenRecapSummary,
  computeSha256Hex,
  createEmptyChecklist,
  DEFAULT_CHECKLIST_ITEMS,
  DEFAULT_GAS_DEPLOY_PIN,
  DEFAULT_PENGATURAN,
  DEFAULT_STATUS_LIST,
  filterBillingShipments,
  filterDoShipments,
  filterNopenRecapShipments,
  filterShipments,
  formatContainerSummary,
  formatCurrencyTotals,
  formatNopenPeriodLabel,
  formatRupiah,
  generateNextKodeOS,
  generateSuratJalanNomor,
  generateSuratPenagihanNomor,
  getAllowedFieldsForPermissions,
  getBillingEligibilityReason,
  getCountdownBadgeMeta,
  getCurrentMonthKey,
  getDefaultModuleAccessForRole,
  getDefaultPhasePermissions,
  getDoValidityMeta,
  getFirstAccessibleModule,
  getMonthDateBounds,
  getPpjkIdentity,
  getPreviousMonthKey,
  getRelativeDateRange,
  getShipmentProcessSignal,
  getStatusDokumenBadgeMeta,
  getStatusDoPelayaranMeta,
  getStatusGateOutMeta,
  getStatusGatePassMeta,
  getStatusPenagihanMeta,
  getStatusSuratJalanMeta,
  getStatusTruckingMeta,
  hasSptnpIssue,
  isContainerGateOut,
  isOwnerSuperAdmin,
  isShipmentBillingEligible,
  isShipmentOutstanding,
  isUrgentMissingAju,
  normalizeGatePassJenis,
  normalizeStatusDokumen,
  normalizeStatusDoPelayaran,
  normalizeStatusGateOut,
  normalizeStatusGatePass,
  normalizeStatusPenagihan,
  normalizeStatusSuratJalan,
  normalizeStatusTrucking,
  normalizeWhatsAppNumber,
  parseBmPdriAmount,
  parseCustomerContact,
  PHASE_1_FIELDS,
  PHASE_2_FIELDS,
  reconcileAllShipmentsDerivedState,
  reconcileSeqByMonth,
  reconcileShipmentDerivedFields,
  resolveNopenDateRange,
  resolveUserModuleAccess,
  resolveUserPhasePermissions,
  validateGasPinFormat,
  validateShipmentInput,
  verifyGasDeployPin,
} from './ppjkLogic';
import type { KontainerItem, LogPerubahan, Pengaturan, Shipment, UserAccount } from '../types/ppjk';

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
  const fullChecklist = createEmptyChecklist(DEFAULT_CHECKLIST_ITEMS);
  return {
    kodeOs: 'OS-2611-0001',
    ship: 'MV EVERGREEN 01',
    kodeCustomer: 'CUST-001',
    namaCustomer: 'PT Maju Jaya',
    tglTerimaDok: '2026-11-01',
    terimaDok: fullChecklist,
    noPackinglist: 'PL-001',
    noBl: 'BL-998811',
    etd: '2026-11-05',
    eta: '2026-11-15',
    countDownEta: 2,
    noCont: 'EGHU1234567 (40HC)',
    noAju: '',
    tglAju: '',
    status: 'Dokumen Diterima',
    nopen: '',
    tglNopen: '',
    jalur: '',
    kodeImportir: 'IMP-001',
    shipper: 'Shanghai Co Ltd',
    description: 'Mesin Industri',
    negaraAsal: 'China',
    currency: 'USD',
    kurs: 15800,
    invoice: 25000,
    bmPdri: 'Rp 45.000.000',
    sptnp: 'Tidak',
    noSppb: '',
    tglSppb: '',
    dokumenChecker: 'Budi Santoso',
    noSptnp: '',
    tglSptnp: '',
    pfpb: '',
    tglPfpb: '',
    pfpd: '',
    tglPfpd: '',
    eslah: '',
    tglEslah: '',
    dokumenOs: createEmptyChecklist(DEFAULT_CHECKLIST_ITEMS),
    createdAt: '2026-11-01T08:00:00Z',
    createdBy: 'admin',
    updatedAt: '2026-11-01T08:00:00Z',
    updatedBy: 'admin',
    ...overrides,
  };
}

test('calculateCountdownEta computes exact day differences', () => {
  const ref = new Date(2026, 10, 13); // 2026-11-13
  assert.equal(calculateCountdownEta('2026-11-23', ref), 10);
  assert.equal(calculateCountdownEta('2026-11-13', ref), 0);
  assert.equal(calculateCountdownEta('2026-11-10', ref), -3);
  assert.equal(calculateCountdownEta('', ref), null);
});

test('getCountdownBadgeMeta matches color rules (>7 green, 4-7 yellow, 0-3 orange, <0 red)', () => {
  assert.match(getCountdownBadgeMeta(10).bgClass, /emerald/);
  assert.match(getCountdownBadgeMeta(5).bgClass, /amber/);
  assert.match(getCountdownBadgeMeta(2).bgClass, /orange/);
  assert.match(getCountdownBadgeMeta(-1).bgClass, /red/);
});

test('generateNextKodeOS formats OS-YYMM-NNNN and resets per month', () => {
  const seq = { '2610': 14 };
  const nov = new Date(2026, 10, 13);
  const res1 = generateNextKodeOS(seq, nov);
  assert.equal(res1.kodeOs, 'OS-2611-0001');
  assert.equal(res1.monthKey, '2611');
  assert.equal(res1.nextSeq, 1);

  const res2 = generateNextKodeOS({ '2611': 9 }, nov);
  assert.equal(res2.kodeOs, 'OS-2611-0010');
});

test('isShipmentOutstanding detects incomplete SPPB or Dokumen OS', () => {
  const incomplete = makeShipment({ status: 'Proses PIB/AJU', noSppb: '' });
  assert.equal(isShipmentOutstanding(incomplete), true);

  const doneChecklist = createEmptyChecklist(DEFAULT_CHECKLIST_ITEMS);
  for (const k of DEFAULT_CHECKLIST_ITEMS) doneChecklist.items[k] = true;

  const complete = makeShipment({
    status: 'Selesai',
    noSppb: 'SPPB-123',
    tglSppb: '2026-11-12',
    dokumenOs: doneChecklist,
  });
  assert.equal(isShipmentOutstanding(complete), false);

  const missingOsDocs = makeShipment({
    status: 'Selesai',
    noSppb: 'SPPB-123',
    tglSppb: '2026-11-12',
  });
  assert.equal(isShipmentOutstanding(missingOsDocs), true);
});

test('isUrgentMissingAju flags ETA < 3 days without No. AJU', () => {
  const ref = new Date(2026, 10, 13);
  const urgent = makeShipment({ eta: '2026-11-15', noAju: '' });
  assert.equal(isUrgentMissingAju(urgent, ref), true);

  const safeWithAju = makeShipment({ eta: '2026-11-15', noAju: '000001-123456' });
  assert.equal(isUrgentMissingAju(safeWithAju, ref), false);

  const safeFarEta = makeShipment({ eta: '2026-11-25', noAju: '' });
  assert.equal(isUrgentMissingAju(safeFarEta, ref), false);
});

test('validateShipmentInput enforces required fields, numeric kurs/invoice, and ETA >= ETD', () => {
  const bad = validateShipmentInput({
    kodeCustomer: '',
    noBl: '',
    etd: '2026-11-20',
    eta: '2026-11-10',
    kurs: -5 as unknown as number,
    invoice: 'abc' as unknown as number,
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.kodeCustomer);
  assert.ok(bad.errors.noBl);
  assert.ok(bad.errors.eta);
  assert.ok(bad.errors.kurs);
  assert.ok(bad.errors.invoice);

  const good = validateShipmentInput({
    kodeCustomer: 'CUST-001',
    noBl: 'BL-001',
    etd: '2026-11-10',
    eta: '2026-11-15',
    kurs: 15800,
    invoice: 12000,
  });
  assert.equal(good.valid, true);
});

test('RBAC permissions enforce distinct limits for Admin, Checker, Drafter, Operasional, and Manajer', () => {
  // Admin: full access
  assert.equal(canPerformAction('Admin', 'manage_users'), true);
  assert.equal(canPerformAction('Admin', 'delete_shipment'), true);
  assert.equal(canPerformAction('Admin', 'view_gas_code'), true);
  assert.equal(canEditPhase('Admin', 1), true);
  assert.equal(canEditPhase('Admin', 2), true);
  assert.equal(canEditPhase('Admin', 3), true);
  assert.equal(canEditPhase('Admin', 4), true);

  // Checker: create shipment, master data, phases 1 & 4 only; no delete, no user/settings
  assert.equal(canPerformAction('Checker', 'create_shipment'), true);
  assert.equal(canPerformAction('Checker', 'manage_master'), true);
  assert.equal(canPerformAction('Checker', 'delete_shipment'), false);
  assert.equal(canPerformAction('Checker', 'manage_users'), false);
  assert.equal(canPerformAction('Checker', 'view_gas_code'), false);
  assert.equal(canEditPhase('Checker', 1), true);
  assert.equal(canEditPhase('Checker', 2), false);
  assert.equal(canEditPhase('Checker', 3), false);
  assert.equal(canEditPhase('Checker', 4), true);

  // Drafter: edit phases 2 & 3 only; cannot create, delete, manage master or users
  assert.equal(canPerformAction('Drafter', 'create_shipment'), false);
  assert.equal(canPerformAction('Drafter', 'edit_shipment'), true);
  assert.equal(canPerformAction('Drafter', 'delete_shipment'), false);
  assert.equal(canPerformAction('Drafter', 'manage_master'), false);
  assert.equal(canPerformAction('Drafter', 'manage_users'), false);
  assert.equal(canEditPhase('Drafter', 1), false);
  assert.equal(canEditPhase('Drafter', 2), true);
  assert.equal(canEditPhase('Drafter', 3), true);
  assert.equal(canEditPhase('Drafter', 4), false);

  // Operasional & Manajer
  assert.equal(canPerformAction('Operasional', 'create_shipment'), false);
  assert.equal(canPerformAction('Operasional', 'edit_shipment'), true);
  assert.equal(canEditPhase('Operasional', 2), true);
  assert.equal(canEditPhase('Operasional', 4), false);
  assert.equal(canPerformAction('Manajer', 'edit_shipment'), false);
  assert.equal(canPerformAction('Manajer', 'export_report'), true);
});

test('formatContainerSummary and computeSha256Hex work deterministically', async () => {
  const summary = formatContainerSummary([
    { id: '1', kodeOs: 'OS-2611-0001', noCont: 'MSCU1112223', ukuranTipe: '40HC' },
    { id: '2', kodeOs: 'OS-2611-0001', noCont: 'TEMU4445556', ukuranTipe: '20FT' },
  ]);
  assert.equal(summary, 'MSCU1112223 (40HC), TEMU4445556 (20FT)');

  const h1 = await computeSha256Hex('salt:Admin123!');
  const h2 = await computeSha256Hex('salt:Admin123!');
  assert.equal(h1.length, 64);
  assert.equal(h1, h2);
});

test('computeDashboardStats aggregates totals accurately', () => {
  const ref = new Date(2026, 10, 13);
  const s1 = makeShipment({
    kodeOs: 'OS-2611-0001',
    eta: '2026-11-15',
    jalur: 'Merah',
    noAju: '',
    statusDokumen: 'Draft',
  });
  const s2 = makeShipment({
    kodeOs: 'OS-2611-0002',
    eta: '2026-11-25',
    jalur: 'Hijau',
    noAju: '00001',
    statusDokumen: 'Ready',
  });
  const stats = computeDashboardStats([s1, s2], DEFAULT_CHECKLIST_ITEMS, ref);
  assert.equal(stats.total, 2);
  assert.equal(stats.outstanding, 2);
  assert.equal(stats.draftCount, 1);
  assert.equal(stats.readyCount, 1);
  assert.equal(stats.etaNext7Days, 1);
  assert.equal(stats.urgentMissingAju, 1);
  assert.equal(stats.byJalur.Merah, 1);
  assert.equal(stats.byJalur.Hijau, 1);
});

test('computeCheckerSummaries aggregates all statuses globally and per checker card', () => {
  const ref = new Date(2026, 10, 13);
  const doneChecklist = createEmptyChecklist(DEFAULT_CHECKLIST_ITEMS);
  for (const k of DEFAULT_CHECKLIST_ITEMS) doneChecklist.items[k] = true;

  const s1 = makeShipment({
    kodeOs: 'OS-2611-0001',
    dokumenChecker: ' Rina Kusuma ',
    status: 'Dokumen Diterima',
    eta: '2026-11-14',
    noAju: '',
  });
  const s2 = makeShipment({
    kodeOs: 'OS-2611-0002',
    dokumenChecker: 'Rina Kusuma',
    status: 'Selesai',
    noSppb: 'SPPB-001',
    tglSppb: '2026-11-12',
    dokumenOs: doneChecklist,
    jalur: 'Hijau',
    noAju: '00001',
  });
  const s3 = makeShipment({
    kodeOs: 'OS-2611-0003',
    dokumenChecker: 'Dewi Lestari',
    status: 'Proses PIB/AJU',
    eta: '2026-11-18',
    jalur: 'Kuning',
    noAju: '00002',
  });
  const s4 = makeShipment({
    kodeOs: 'OS-2611-0004',
    dokumenChecker: '',
    status: 'Custom Status Baru',
    eta: '2026-11-22',
  });

  const summary = computeCheckerSummaries(
    [s1, s2, s3, s4],
    DEFAULT_STATUS_LIST,
    DEFAULT_CHECKLIST_ITEMS,
    ref
  );

  assert.equal(summary.totalDocuments, 4);
  assert.equal(summary.totalOutstanding, 3);
  assert.equal(summary.totalCompleted, 1);
  assert.equal(summary.totalUrgent, 1);
  assert.equal(summary.totalCheckers, 2); // excludes 'Belum Ditugaskan'

  // Every configured status + custom status is present in global recap
  const statusMap = Object.fromEntries(summary.byStatus.map((x) => [x.status, x.count]));
  assert.equal(statusMap['Dokumen Diterima'], 1);
  assert.equal(statusMap['Proses PIB/AJU'], 1);
  assert.equal(statusMap['Menunggu Jalur'], 0);
  assert.equal(statusMap['Selesai'], 1);
  assert.equal(statusMap['Custom Status Baru'], 1);

  // Checker grouping & sorting (Rina & Dewi first, Belum Ditugaskan last)
  assert.equal(summary.checkers.length, 3);
  const rina = summary.checkers.find((c) => c.checkerName === 'Rina Kusuma');
  assert.ok(rina);
  assert.equal(rina.total, 2);
  assert.equal(rina.outstanding, 1);
  assert.equal(rina.completed, 1);
  assert.equal(rina.completionRate, 50);
  assert.equal(rina.urgentMissingAju, 1);
  assert.equal(rina.byStatus['Dokumen Diterima'], 1);
  assert.equal(rina.byStatus['Selesai'], 1);

  assert.equal(summary.checkers[2].checkerName, 'Belum Ditugaskan');
});

test('per-user manual phase toggle permissions override role defaults cleanly', () => {
  // Default permissions per role
  assert.deepEqual(getDefaultPhasePermissions('Checker'), {
    phase1: true,
    phase2: false,
    phase3: false,
    phase4: true,
  });
  assert.deepEqual(getDefaultPhasePermissions('Drafter'), {
    phase1: false,
    phase2: true,
    phase3: true,
    phase4: false,
  });

  // Checker dengan Fase 2 diaktifkan manual oleh Admin
  const checkerWithPhase2 = resolveUserPhasePermissions('Checker', { phase2: true });
  assert.deepEqual(checkerWithPhase2, {
    phase1: true,
    phase2: true,
    phase3: false,
    phase4: true,
  });
  assert.equal(canUserEditPhase({ role: 'Checker', phasePermissions: checkerWithPhase2 }, 2), true);
  assert.equal(canUserEditPhase({ role: 'Checker', phasePermissions: checkerWithPhase2 }, 3), false);
  const checkerFields = getAllowedFieldsForPermissions(checkerWithPhase2);
  assert.ok(checkerFields.includes('eta'));
  assert.ok(checkerFields.includes('noCont'));
  assert.ok(!checkerFields.includes('noAju'));

  // Drafter dengan Fase 3 dimatikan manual oleh Admin
  const drafterWithoutPhase3 = resolveUserPhasePermissions('Drafter', { phase3: false });
  assert.equal(canUserEditPhase({ role: 'Drafter', phasePermissions: drafterWithoutPhase3 }, 2), true);
  assert.equal(canUserEditPhase({ role: 'Drafter', phasePermissions: drafterWithoutPhase3 }, 3), false);
  assert.equal(canUserEditAnyPhase({ role: 'Drafter', phasePermissions: drafterWithoutPhase3 }), true);

  // Semua fase dimatikan manual -> canUserEditAnyPhase = false
  const allOff = { phase1: false, phase2: false, phase3: false, phase4: false };
  assert.equal(canUserEditAnyPhase({ role: 'Drafter', phasePermissions: allOff }), false);
  assert.deepEqual(getAllowedFieldsForPermissions(allOff), []);

  // Manajer diberi akses Fase 2 manual oleh Admin
  assert.equal(
    canUserEditAnyPhase({ role: 'Manajer', phasePermissions: { phase1: false, phase2: true, phase3: false, phase4: false } }),
    true
  );
  assert.equal(
    canUserEditPhase({ role: 'Manajer', phasePermissions: { phase1: false, phase2: true, phase3: false, phase4: false } }, 2),
    true
  );
});

test('Status Dokumen Checker (Draft/Ready) normalizes, summarizes per checker, and belongs to Phase 1', () => {
  assert.equal(normalizeStatusDokumen(undefined), 'Draft');
  assert.equal(normalizeStatusDokumen(''), 'Draft');
  assert.equal(normalizeStatusDokumen('Draft'), 'Draft');
  assert.equal(normalizeStatusDokumen('Ready'), 'Ready');

  assert.equal(getStatusDokumenBadgeMeta(undefined).label, 'Draft');
  assert.match(getStatusDokumenBadgeMeta('Draft').bgClass, /yellow/);
  assert.equal(getStatusDokumenBadgeMeta('Ready').label, 'Ready');
  assert.match(getStatusDokumenBadgeMeta('Ready').bgClass, /emerald/);
  assert.ok(PHASE_1_FIELDS.includes('statusDokumen'));

  const s1 = makeShipment({ kodeOs: 'OS-2611-0001', dokumenChecker: 'Rina', statusDokumen: 'Draft' });
  const s2 = makeShipment({ kodeOs: 'OS-2611-0002', dokumenChecker: 'Rina', statusDokumen: 'Ready' });
  const s3 = makeShipment({ kodeOs: 'OS-2611-0003', dokumenChecker: 'Dewi', statusDokumen: 'Ready' });

  const summary = computeCheckerSummaries([s1, s2, s3], DEFAULT_STATUS_LIST, DEFAULT_CHECKLIST_ITEMS);
  assert.equal(summary.totalDraft, 1);
  assert.equal(summary.totalReady, 2);

  const rina = summary.checkers.find((c) => c.checkerName === 'Rina');
  assert.ok(rina);
  assert.equal(rina.draftCount, 1);
  assert.equal(rina.readyCount, 1);
});

test('filterShipments filters accurately by ETD/ETA date ranges and Draft/Ready statusDokumen', () => {
  const s1 = makeShipment({
    kodeOs: 'OS-2611-0001',
    etd: '2026-11-01',
    eta: '2026-11-12',
    statusDokumen: 'Draft',
  });
  const s2 = makeShipment({
    kodeOs: 'OS-2611-0002',
    etd: '2026-11-08',
    eta: '2026-11-20',
    statusDokumen: 'Ready',
  });
  const s3 = makeShipment({
    kodeOs: 'OS-2611-0003',
    etd: '2026-11-15',
    eta: '2026-11-28',
    statusDokumen: 'Ready',
  });

  // Filter rentang ETD
  const etdFiltered = filterShipments([s1, s2, s3], {
    mode: 'all',
    dateField: 'etd',
    dateFrom: '2026-11-05',
    dateTo: '2026-11-15',
  });
  assert.deepEqual(
    etdFiltered.map((x) => x.kodeOs),
    ['OS-2611-0002', 'OS-2611-0003']
  );

  // Filter rentang ETA
  const etaFiltered = filterShipments([s1, s2, s3], {
    mode: 'all',
    dateField: 'eta',
    dateFrom: '2026-11-10',
    dateTo: '2026-11-22',
  });
  assert.deepEqual(
    etaFiltered.map((x) => x.kodeOs),
    ['OS-2611-0001', 'OS-2611-0002']
  );

  // Filter Status Dokumen Draft vs Ready
  const draftOnly = filterShipments([s1, s2, s3], {
    mode: 'all',
    filterStatusDokumen: 'Draft',
  });
  assert.deepEqual(draftOnly.map((x) => x.kodeOs), ['OS-2611-0001']);

  const readyAndEtd = filterShipments([s1, s2, s3], {
    mode: 'all',
    filterStatusDokumen: 'Ready',
    dateField: 'etd',
    dateFrom: '2026-11-01',
    dateTo: '2026-11-10',
  });
  assert.deepEqual(readyAndEtd.map((x) => x.kodeOs), ['OS-2611-0002']);
});

test('getShipmentProcessSignal flags ETA Tiba and BC 1.1 Manifes Terbit and clears after SPPB/Selesai', () => {
  const ref = new Date(2026, 10, 13); // 2026-11-13

  // 1. ETA tiba (<= 0 hari) tanpa SPPB -> reason: 'eta'
  const etaArrivedOnly = makeShipment({
    kodeOs: 'OS-2611-0101',
    eta: '2026-11-13',
    status: 'Menunggu Jalur',
    noSppb: '',
    bc11Terbit: false,
  });
  const sigEta = getShipmentProcessSignal(etaArrivedOnly, ref);
  assert.equal(sigEta.active, true);
  assert.equal(sigEta.reason, 'eta');
  assert.equal(sigEta.etaArrived, true);
  assert.equal(sigEta.bc11Issued, false);

  // 2. ETA masih jauh tapi BC 1.1 Manifes sudah terbit -> reason: 'bc11'
  const bc11Only = makeShipment({
    kodeOs: 'OS-2611-0102',
    eta: '2026-11-20',
    status: 'Proses PIB/AJU',
    bc11Terbit: true,
    noBc11: '004819',
    tglBc11: '2026-11-13',
  });
  const sigBc11 = getShipmentProcessSignal(bc11Only, ref);
  assert.equal(sigBc11.active, true);
  assert.equal(sigBc11.reason, 'bc11');
  assert.equal(sigBc11.bc11Issued, true);

  // 3. No BC 1.1 terisi saja (tanpa boolean bc11Terbit) tetap terdeteksi terbit
  const bc11ByNumber = makeShipment({
    kodeOs: 'OS-2611-0103',
    eta: '2026-11-22',
    status: 'Dokumen Diterima',
    noBc11: '005100',
  });
  assert.equal(getShipmentProcessSignal(bc11ByNumber, ref).reason, 'bc11');

  // 4. ETA tiba + BC 1.1 terbit -> reason: 'both'
  const bothActive = makeShipment({
    kodeOs: 'OS-2611-0104',
    eta: '2026-11-11',
    status: 'Proses Pemeriksaan',
    bc11Terbit: true,
    noBc11: '004900',
  });
  const sigBoth = getShipmentProcessSignal(bothActive, ref);
  assert.equal(sigBoth.active, true);
  assert.equal(sigBoth.reason, 'both');

  // 5. Sudah SPPB Terbit / Pasca-SPPB / Selesai / No SPPB terisi -> sinyal berhenti (false)
  const sppbIssued = makeShipment({
    kodeOs: 'OS-2611-0105',
    eta: '2026-11-10',
    bc11Terbit: true,
    status: 'Pasca-SPPB',
    noSppb: 'SPPB-9988',
  });
  assert.equal(getShipmentProcessSignal(sppbIssued, ref).active, false);

  const completed = makeShipment({
    kodeOs: 'OS-2611-0106',
    eta: '2026-11-10',
    bc11Terbit: true,
    status: 'Selesai',
  });
  assert.equal(getShipmentProcessSignal(completed, ref).active, false);

  // 6. ETA jauh dan BC 1.1 belum terbit -> sinyal tidak aktif
  const calm = makeShipment({
    kodeOs: 'OS-2611-0107',
    eta: '2026-11-25',
    bc11Terbit: false,
    noBc11: '',
  });
  assert.equal(getShipmentProcessSignal(calm, ref).active, false);

  // 7. Agregasi Dashboard & Checker summaries menghitung urgentProcessSignal & totalProcessSignal
  const stats = computeDashboardStats([etaArrivedOnly, bc11Only, sppbIssued, calm], DEFAULT_CHECKLIST_ITEMS, ref);
  assert.equal(stats.urgentProcessSignal, 2);

  const summary = computeCheckerSummaries([etaArrivedOnly, bc11Only, sppbIssued, calm], DEFAULT_STATUS_LIST, DEFAULT_CHECKLIST_ITEMS, ref);
  assert.equal(summary.totalProcessSignal, 2);
});

test('filterShipments supports onlyProcessSignal filter and search by No. BC 1.1', () => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const sEtaNow = makeShipment({
    kodeOs: 'OS-2611-0201',
    eta: todayIso,
    status: 'Dokumen Diterima',
  });
  const sBc11 = makeShipment({
    kodeOs: 'OS-2611-0202',
    eta: '2099-12-31',
    status: 'Proses PIB/AJU',
    bc11Terbit: true,
    noBc11: 'BC11-887766',
  });
  const sDone = makeShipment({
    kodeOs: 'OS-2611-0203',
    eta: todayIso,
    status: 'SPPB Terbit',
    noSppb: 'SPPB-11',
  });

  const onlySignal = filterShipments([sEtaNow, sBc11, sDone], {
    mode: 'all',
    onlyProcessSignal: true,
  });
  assert.deepEqual(
    onlySignal.map((x) => x.kodeOs),
    ['OS-2611-0201', 'OS-2611-0202']
  );

  const searchBc11 = filterShipments([sEtaNow, sBc11, sDone], {
    mode: 'all',
    search: '887766',
  });
  assert.deepEqual(
    searchBc11.map((x) => x.kodeOs),
    ['OS-2611-0202']
  );
});

test('D/O Pelayaran readiness normalizes Sedia/Belum, detects validity/extension warnings, and filters cleanly', () => {
  const ref = new Date(2026, 10, 14); // 2026-11-14
  assert.equal(normalizeStatusDoPelayaran(undefined), 'Belum');
  assert.equal(normalizeStatusDoPelayaran('Sedia'), 'Sedia');
  assert.match(getStatusDoPelayaranMeta('Sedia').bgClass, /emerald/);
  assert.match(getStatusDoPelayaranMeta('Belum').bgClass, /amber/);
  assert.ok(PHASE_2_FIELDS.includes('doPelayaranStatus'));
  assert.ok(PHASE_2_FIELDS.includes('doBerlakuSampai'));
  assert.ok(PHASE_2_FIELDS.includes('doCatatanPerpanjangan'));

  const expiredValidity = getDoValidityMeta('2026-11-12', 'Pasca-SPPB', ref);
  assert.equal(expiredValidity.state, 'expired');
  assert.equal(expiredValidity.needsExtension, true);

  const soonValidity = getDoValidityMeta('2026-11-16', 'SPPB Terbit', ref);
  assert.equal(soonValidity.state, 'expiring_soon');
  assert.equal(soonValidity.needsExtension, true);

  const okValidity = getDoValidityMeta('2026-11-22', 'SPPB Terbit', ref);
  assert.equal(okValidity.state, 'valid');
  assert.equal(okValidity.needsExtension, false);

  const doneValidity = getDoValidityMeta('2026-11-10', 'Selesai', ref);
  assert.equal(doneValidity.state, 'completed');
  assert.equal(doneValidity.needsExtension, false);

  const sReadyGateOut = makeShipment({
    kodeOs: 'OS-2611-0301',
    status: 'SPPB Terbit',
    noSppb: 'SPPB-301',
    doPelayaranStatus: 'Sedia',
    doBerlakuSampai: '2026-11-20',
    doCatatanPerpanjangan: 'Perpanjangan D/O ke-1 aktif',
  });
  const sSppbBelumDo = makeShipment({
    kodeOs: 'OS-2611-0302',
    status: 'Pasca-SPPB',
    noSppb: 'SPPB-302',
    doPelayaranStatus: 'Belum',
    doBerlakuSampai: '2026-11-15',
    doCatatanPerpanjangan: 'Menunggu telex release OOCL',
  });
  const sExpired = makeShipment({
    kodeOs: 'OS-2611-0303',
    status: 'Proses Pemeriksaan',
    doPelayaranStatus: 'Belum',
    doBerlakuSampai: '2026-11-11',
    doCatatanPerpanjangan: 'Free time habis, ajukan perpanjangan MSC',
  });
  const sDone = makeShipment({
    kodeOs: 'OS-2611-0304',
    status: 'Selesai',
    noSppb: 'SPPB-304',
    doPelayaranStatus: 'Sedia',
    doBerlakuSampai: '2026-11-09',
  });

  const all = [sReadyGateOut, sSppbBelumDo, sExpired, sDone];
  const sum = computeDoReadinessSummary(all, ref);
  assert.equal(sum.total, 4);
  assert.equal(sum.sediaCount, 2);
  assert.equal(sum.belumCount, 2);
  assert.equal(sum.siapKeluarCount, 2);
  assert.equal(sum.sppbMenungguDoCount, 1);
  assert.equal(sum.perluPerpanjanganCount, 2);

  assert.deepEqual(
    filterDoShipments(all, { condition: 'sppb_belum_do' }, ref).map((x) => x.kodeOs),
    ['OS-2611-0302']
  );
  assert.deepEqual(
    filterDoShipments(all, { condition: 'perlu_perpanjangan' }, ref).map((x) => x.kodeOs),
    ['OS-2611-0302', 'OS-2611-0303']
  );
  assert.deepEqual(
    filterDoShipments(all, { condition: 'siap_keluar' }, ref).map((x) => x.kodeOs),
    ['OS-2611-0301', 'OS-2611-0304']
  );
  assert.deepEqual(
    filterDoShipments(all, { search: 'telex release' }, ref).map((x) => x.kodeOs),
    ['OS-2611-0302']
  );
});

test('Eslah/TILA (Kartu Gate) & Trucking normalizers, Phase 2 permissions, summary, and filters work accurately', () => {
  const ref = new Date(2026, 10, 14);

  assert.equal(normalizeStatusGatePass(undefined), 'Belum');
  assert.equal(normalizeStatusGatePass('Proses'), 'Proses');
  assert.equal(normalizeStatusGatePass('Sedia'), 'Sedia');
  assert.equal(normalizeGatePassJenis('Eslah'), 'Eslah');
  assert.equal(normalizeGatePassJenis('invalid'), '');
  assert.equal(normalizeStatusTrucking(undefined), 'Belum');
  assert.equal(normalizeStatusTrucking('Sedia'), 'Sedia');

  assert.match(getStatusGatePassMeta('Belum').bgClass, /amber/);
  assert.match(getStatusGatePassMeta('Proses').bgClass, /sky/);
  assert.match(getStatusGatePassMeta('Sedia').bgClass, /emerald/);
  assert.match(getStatusTruckingMeta('Sedia').bgClass, /emerald/);
  assert.match(getStatusTruckingMeta('Belum').bgClass, /amber/);

  for (const field of [
    'doGatePassStatus',
    'doGatePassJenis',
    'doGatePassNomor',
    'truckingStatus',
    'truckingNamaSupir',
    'truckingNoPlat',
    'truckingNoHpSupir',
  ] as const) {
    assert.ok(PHASE_2_FIELDS.includes(field), `Expected ${field} in PHASE_2_FIELDS`);
  }

  const sFullReady = makeShipment({
    kodeOs: 'OS-2611-0401',
    status: 'SPPB Terbit',
    noSppb: 'SPPB-401',
    doPelayaranStatus: 'Sedia',
    doGatePassStatus: 'Sedia',
    doGatePassJenis: 'TILA (Kartu Gate)',
    doGatePassNomor: 'TILA-NPCT1-001',
    truckingStatus: 'Sedia',
    truckingNamaSupir: 'Agus Setiawan',
    truckingNoPlat: 'B 9482 UYW',
    truckingNoHpSupir: '0812-8890-1122',
  });

  const sProsesEslah = makeShipment({
    kodeOs: 'OS-2611-0402',
    status: 'SPPB Terbit',
    noSppb: 'SPPB-402',
    doPelayaranStatus: 'Sedia',
    doGatePassStatus: 'Proses',
    doGatePassJenis: 'Eslah',
    doGatePassNomor: 'ESLAH-KOJA-002',
    truckingStatus: 'Belum',
    truckingNamaSupir: '',
    truckingNoPlat: '',
    truckingNoHpSupir: '',
  });

  const sBelumSemua = makeShipment({
    kodeOs: 'OS-2611-0403',
    status: 'Proses Pemeriksaan',
    doPelayaranStatus: 'Belum',
    doGatePassStatus: 'Belum',
    truckingStatus: 'Belum',
  });

  const all = [sFullReady, sProsesEslah, sBelumSemua];
  const summary = computeDoReadinessSummary(all, ref);
  assert.equal(summary.gatePassSediaCount, 1);
  assert.equal(summary.gatePassProsesCount, 1);
  assert.equal(summary.gatePassBelumCount, 1);
  assert.equal(summary.truckingSediaCount, 1);
  assert.equal(summary.truckingBelumCount, 2);
  assert.equal(summary.fullReadyGateOutCount, 1);

  assert.deepEqual(
    filterDoShipments(all, { gatePassStatus: 'Proses' }, ref).map((x) => x.kodeOs),
    ['OS-2611-0402']
  );
  assert.deepEqual(
    filterDoShipments(all, { truckingStatus: 'Sedia' }, ref).map((x) => x.kodeOs),
    ['OS-2611-0401']
  );
  assert.deepEqual(
    filterDoShipments(all, { condition: 'full_ready' }, ref).map((x) => x.kodeOs),
    ['OS-2611-0401']
  );
  assert.deepEqual(
    filterDoShipments(all, { condition: 'gatepass_belum' }, ref).map((x) => x.kodeOs),
    ['OS-2611-0402', 'OS-2611-0403']
  );
  assert.deepEqual(
    filterDoShipments(all, { search: 'B 9482 UYW' }, ref).map((x) => x.kodeOs),
    ['OS-2611-0401']
  );
  assert.deepEqual(
    filterDoShipments(all, { search: 'ESLAH-KOJA-002' }, ref).map((x) => x.kodeOs),
    ['OS-2611-0402']
  );
});

test('Pencatat D/O Draft/Ready & Gate-Out binding helpers, Phase 2 fields, summary counts, and filters work accurately', () => {
  const ref = new Date(2026, 10, 14);

  assert.equal(normalizeStatusGateOut(undefined, 'Dokumen Diterima'), 'Belum');
  assert.equal(normalizeStatusGateOut(undefined, 'Selesai'), 'Sudah');
  assert.equal(normalizeStatusGateOut('Sudah', 'SPPB Terbit'), 'Sudah');
  assert.equal(normalizeStatusGateOut('Belum', 'SPPB Terbit'), 'Belum');

  assert.equal(getStatusGateOutMeta('Sudah').label, 'Sudah Gate-Out');
  assert.match(getStatusGateOutMeta('Sudah').bgClass, /emerald/);
  assert.equal(getStatusGateOutMeta('Belum').label, 'Belum Gate-Out');
  assert.match(getStatusGateOutMeta('Belum').bgClass, /slate/);

  for (const field of ['gateOutStatus', 'gateOutTanggal', 'gateOutCatatan'] as const) {
    assert.ok(PHASE_2_FIELDS.includes(field), `Expected ${field} in PHASE_2_FIELDS`);
  }

  const sDraftGateOutBelum = makeShipment({
    kodeOs: 'OS-2611-0501',
    statusDokumen: 'Draft',
    status: 'Dokumen Diterima',
    doPelayaranStatus: 'Belum',
    gateOutStatus: 'Belum',
  });

  const sReadyGateOutBelum = makeShipment({
    kodeOs: 'OS-2611-0502',
    statusDokumen: 'Ready',
    status: 'SPPB Terbit',
    noSppb: 'SPPB-502',
    doPelayaranStatus: 'Sedia',
    gateOutStatus: 'Belum',
  });

  const sReadyGateOutSudah = makeShipment({
    kodeOs: 'OS-2611-0503',
    statusDokumen: 'Ready',
    status: 'Selesai',
    noSppb: 'SPPB-503',
    doPelayaranStatus: 'Sedia',
    gateOutStatus: 'Sudah',
    gateOutTanggal: '2026-11-14',
    gateOutCatatan: 'Keluar pelabuhan JICT & terikat Dokumen Selesai',
  });

  assert.equal(isContainerGateOut(sDraftGateOutBelum), false);
  assert.equal(isContainerGateOut(sReadyGateOutSudah), true);

  const list = [sDraftGateOutBelum, sReadyGateOutBelum, sReadyGateOutSudah];
  const summary = computeDoReadinessSummary(list, ref);
  assert.equal(summary.draftDokCount, 1);
  assert.equal(summary.readyDokCount, 2);
  assert.equal(summary.gateOutSudahCount, 1);
  assert.equal(summary.gateOutBelumCount, 2);
  assert.equal(summary.dokumenSelesaiCount, 1);

  assert.deepEqual(
    filterDoShipments(list, { statusDokumen: 'Draft' }, ref).map((x) => x.kodeOs),
    ['OS-2611-0501']
  );
  assert.deepEqual(
    filterDoShipments(list, { statusDokumen: 'Ready' }, ref).map((x) => x.kodeOs),
    ['OS-2611-0502', 'OS-2611-0503']
  );
  assert.deepEqual(
    filterDoShipments(list, { gateOutStatus: 'Sudah' }, ref).map((x) => x.kodeOs),
    ['OS-2611-0503']
  );
  assert.deepEqual(
    filterDoShipments(list, { condition: 'gateout_sudah' }, ref).map((x) => x.kodeOs),
    ['OS-2611-0503']
  );
  assert.deepEqual(
    filterDoShipments(list, { condition: 'gateout_belum' }, ref).map((x) => x.kodeOs),
    ['OS-2611-0501', 'OS-2611-0502']
  );
  assert.deepEqual(
    filterDoShipments(list, { search: 'terikat Dokumen Selesai' }, ref).map((x) => x.kodeOs),
    ['OS-2611-0503']
  );
});

test('Surat Jalan auto-generates on Gate-Out, tracks 3-stage delivery status, validates Phase 2 fields, and filters accurately', () => {
  const ref = new Date(2026, 10, 15);

  assert.equal(generateSuratJalanNomor('OS-2611-0007', ref), 'SJ-2611-0007');
  assert.equal(generateSuratJalanNomor('CUSTOM-88', ref), 'SJ-2611-OM88');

  assert.equal(normalizeStatusSuratJalan(undefined, 'Belum', 'SPPB Terbit'), 'Belum');
  assert.equal(normalizeStatusSuratJalan(undefined, 'Sudah', 'Selesai'), 'Terbit');
  assert.equal(normalizeStatusSuratJalan('Dalam Pengiriman', 'Sudah', 'Selesai'), 'Dalam Pengiriman');
  assert.equal(normalizeStatusSuratJalan('Tiba di Tujuan', 'Sudah', 'Selesai'), 'Tiba di Tujuan');

  assert.equal(getStatusSuratJalanMeta(undefined, 'Belum', 'SPPB Terbit').label, 'Belum Terbit');
  assert.match(getStatusSuratJalanMeta('Terbit', 'Sudah', 'Selesai').bgClass, /sky/);
  assert.match(getStatusSuratJalanMeta('Dalam Pengiriman', 'Sudah', 'Selesai').bgClass, /amber/);
  assert.match(getStatusSuratJalanMeta('Tiba di Tujuan', 'Sudah', 'Selesai').bgClass, /emerald/);

  for (const field of [
    'suratJalanNomor',
    'suratJalanTanggal',
    'suratJalanStatus',
    'suratJalanTujuan',
    'suratJalanPenerima',
    'suratJalanCatatan',
    'suratJalanUpdatedAt',
  ] as const) {
    assert.ok(PHASE_2_FIELDS.includes(field), `Expected ${field} in PHASE_2_FIELDS`);
  }

  const auto = buildAutoSuratJalanFields(
    {
      kodeOs: 'OS-2611-0007',
      namaCustomer: 'PT Cahaya Abadi',
      gateOutTanggal: '2026-11-15',
    },
    '2026-11-15',
    '2026-11-15T08:00:00.000Z'
  );
  assert.equal(auto.suratJalanNomor, 'SJ-2611-0007');
  assert.equal(auto.suratJalanTanggal, '2026-11-15');
  assert.equal(auto.suratJalanStatus, 'Terbit');
  assert.equal(auto.suratJalanTujuan, 'Gudang PT Cahaya Abadi');

  const sBelum = makeShipment({ kodeOs: 'OS-2611-0601', gateOutStatus: 'Belum', status: 'SPPB Terbit' });
  const sTerbit = makeShipment({
    kodeOs: 'OS-2611-0602',
    gateOutStatus: 'Sudah',
    status: 'Selesai',
    suratJalanNomor: 'SJ-2611-0602',
    suratJalanStatus: 'Terbit',
    suratJalanTujuan: 'Gudang Bekasi',
  });
  const sKirim = makeShipment({
    kodeOs: 'OS-2611-0603',
    gateOutStatus: 'Sudah',
    status: 'Selesai',
    suratJalanNomor: 'SJ-2611-0603',
    suratJalanStatus: 'Dalam Pengiriman',
    suratJalanTujuan: 'Gudang Karawang',
  });
  const sTiba = makeShipment({
    kodeOs: 'OS-2611-0604',
    gateOutStatus: 'Sudah',
    status: 'Selesai',
    suratJalanNomor: 'SJ-2611-0604',
    suratJalanStatus: 'Tiba di Tujuan',
    suratJalanTujuan: 'Gudang Cikarang',
  });

  const sum = computeDoReadinessSummary([sBelum, sTerbit, sKirim, sTiba], ref);
  assert.equal(sum.suratJalanTerbitCount, 1);
  assert.equal(sum.suratJalanDalamPengirimanCount, 1);
  assert.equal(sum.suratJalanTibaCount, 1);

  assert.deepEqual(
    filterDoShipments([sBelum, sTerbit, sKirim, sTiba], { suratJalanStatus: 'Dalam Pengiriman' }, ref).map(
      (x) => x.kodeOs
    ),
    ['OS-2611-0603']
  );
  assert.deepEqual(
    filterDoShipments([sBelum, sTerbit, sKirim, sTiba], { search: 'SJ-2611-0604' }, ref).map(
      (x) => x.kodeOs
    ),
    ['OS-2611-0604']
  );

  const badDate = validateShipmentInput({
    kodeCustomer: 'CUST-001',
    noBl: 'BL-123',
    eta: '2026-11-20',
    suratJalanTanggal: '15-11-2026',
  });
  assert.equal(badDate.valid, false);
  assert.ok(badDate.errors.suratJalanTanggal);
});

test('Owner WA/Email notification & Admin Auto Surat Penagihan helpers work accurately on SPPB Terbit & Gate-Out', () => {
  const ref = new Date(2026, 10, 15);

  const sNotReady = makeShipment({
    kodeOs: 'OS-2611-0701',
    status: 'Dokumen Diterima',
    noSppb: '',
    gateOutStatus: 'Belum',
  });
  const sSppb = makeShipment({
    kodeOs: 'OS-2611-0702',
    namaCustomer: 'PT Cahaya Nusantara',
    kodeCustomer: 'CUST-002',
    status: 'SPPB Terbit',
    noSppb: 'SPPB-702',
    tglSppb: '2026-11-15',
    jalur: 'Merah',
    noCont: 'MSCU1112223 (40HC), MSCU4445556 (40HC)',
  });
  const sGateOut = makeShipment({
    kodeOs: 'OS-2611-0703',
    namaCustomer: 'PT Sinar Logistik',
    kodeCustomer: 'CUST-003',
    status: 'Selesai',
    noSppb: 'SPPB-703',
    tglSppb: '2026-11-14',
    gateOutStatus: 'Sudah',
    gateOutTanggal: '2026-11-15',
    suratJalanNomor: 'SJ-2611-0703',
    billingStatus: 'Info Owner Terkirim',
  });
  const sTerkirim = makeShipment({
    kodeOs: 'OS-2611-0704',
    status: 'Selesai',
    noSppb: 'SPPB-704',
    gateOutStatus: 'Sudah',
    billingStatus: 'Terkirim ke Customer',
    billingNomor: 'INV-2611-0704',
    billingTotal: 5550000,
    billingItems: [
      { id: '1', deskripsi: 'Jasa PPJK', qty: 1, satuan: 'Dok', hargaSatuan: 5000000 },
    ],
    billingPpnPersen: 11,
  });

  // Eligibility & reasons
  assert.equal(isShipmentBillingEligible(sNotReady), false);
  assert.equal(isShipmentBillingEligible(sSppb), true);
  assert.equal(isShipmentBillingEligible(sGateOut), true);
  assert.equal(getBillingEligibilityReason(sNotReady), 'Menunggu SPPB / Gate-Out');
  assert.equal(getBillingEligibilityReason(sSppb), 'Dokumen SPPB Terbit');
  assert.equal(getBillingEligibilityReason(sGateOut), 'SPPB Terbit & Sudah Gate-Out');

  // Invoice numbering & statuses
  assert.equal(generateSuratPenagihanNomor('OS-2611-0702', ref), 'INV-2611-0702');
  assert.equal(generateSuratPenagihanNomor('EXT-99', ref), 'INV-2611-XT99');
  assert.equal(normalizeStatusPenagihan(undefined, sNotReady), 'Belum');
  assert.equal(normalizeStatusPenagihan(undefined, sSppb), 'Siap Info Owner');
  assert.equal(normalizeStatusPenagihan('Info Owner Terkirim', sGateOut), 'Info Owner Terkirim');
  assert.match(getStatusPenagihanMeta('Siap Info Owner', sSppb).bgClass, /amber/);
  assert.match(getStatusPenagihanMeta('Info Owner Terkirim', sGateOut).bgClass, /violet/);
  assert.match(getStatusPenagihanMeta('Penagihan Terbit', sGateOut).bgClass, /sky/);
  assert.match(getStatusPenagihanMeta('Terkirim ke Customer', sTerkirim).bgClass, /indigo/);
  assert.match(getStatusPenagihanMeta('Lunas', sTerkirim).bgClass, /emerald/);

  // Phone normalization & customer contact parsing
  assert.equal(normalizeWhatsAppNumber('0811-8880-900'), '628118880900');
  assert.equal(normalizeWhatsAppNumber('+62 812-3456-7890'), '6281234567890');
  assert.equal(normalizeWhatsAppNumber(''), '');

  const parsedContact = parseCustomerContact('021-5551234 / 0812-9999-1111 (import@cahaya.co.id)');
  assert.equal(parsedContact.email, 'import@cahaya.co.id');
  assert.equal(parsedContact.whatsappDigits, '62215551234');

  // Default items & PPN 11% calculation (Merah 2 containers: 3.5jt + 2*1.25jt + 2*2.75jt + 0.5jt = 12jt; +11% = 13.32jt)
  const items = buildDefaultBillingItems(sSppb);
  assert.equal(items.length, 4);
  const totals = calculateBillingTotals(items, 11);
  assert.equal(totals.subtotal, 12000000);
  assert.equal(totals.ppnNominal, 1320000);
  assert.equal(totals.total, 13320000);
  assert.match(formatRupiah(totals.total), /13\.320\.000/);

  // Auto billing fields
  const auto = buildAutoBillingFields(sSppb, '2026-11-15');
  assert.equal(auto.billingStatus, 'Siap Info Owner');
  assert.equal(auto.billingNomor, 'INV-2611-0702');
  assert.equal(auto.billingTanggal, '2026-11-15');
  assert.equal(auto.billingJatuhTempo, '2026-11-29');
  assert.equal(auto.billingTotal, 13320000);

  // Owner & Customer message builders (WA + Email links)
  const ownerMsg = buildOwnerBillingMessage(sGateOut, DEFAULT_PENGATURAN);
  assert.match(ownerMsg.subject, /OS-2611-0703/);
  assert.match(ownerMsg.message, /SJ-2611-0703/);
  assert.match(ownerMsg.message, /Hendra Wijaya/);
  assert.ok(ownerMsg.whatsappUrl.startsWith('https://wa.me/628118880900?text='));
  assert.ok(ownerMsg.mailtoUrl.startsWith('mailto:owner%40ptg-ppjk.co.id?subject='));

  const custMsg = buildCustomerBillingMessage(
    sSppb,
    {
      kodeCustomer: 'CUST-002',
      namaCustomer: 'PT Cahaya Nusantara',
      kontak: '0813-7777-8888 / ap@cahayanusantara.co.id',
    },
    DEFAULT_PENGATURAN
  );
  assert.equal(custMsg.customerEmail, 'ap@cahayanusantara.co.id');
  assert.ok(custMsg.whatsappUrl.startsWith('https://wa.me/6281377778888?text='));
  assert.ok(custMsg.mailtoUrl.startsWith('mailto:ap%40cahayanusantara.co.id?subject='));
  assert.match(custMsg.message, /INV-2611-0702/);
  assert.match(custMsg.message, /Bank Mandiri/);

  // Summary & Filter
  const all = [sNotReady, sSppb, sGateOut, sTerkirim];
  const summary = computeBillingSummary(all);
  assert.equal(summary.eligibleCount, 3);
  assert.equal(summary.siapInfoOwnerCount, 1);
  assert.equal(summary.ownerNotifiedCount, 1);
  assert.equal(summary.terkirimCustomerCount, 1);

  assert.deepEqual(
    filterBillingShipments(all, { status: 'Siap Info Owner' }).map((x) => x.kodeOs),
    ['OS-2611-0702']
  );
  assert.deepEqual(
    filterBillingShipments(all, { search: 'INV-2611-0704' }).map((x) => x.kodeOs),
    ['OS-2611-0704']
  );

  // Billing date validation
  const badBillingDates = validateShipmentInput({
    kodeCustomer: 'CUST-002',
    noBl: 'BL-702',
    eta: '2026-11-20',
    billingTanggal: '15/11/2026',
    billingJatuhTempo: '29/11/2026',
  });
  assert.equal(badBillingDates.valid, false);
  assert.ok(badBillingDates.errors.billingTanggal);
  assert.ok(badBillingDates.errors.billingJatuhTempo);
});

test('computeImportirSummaries, parseBmPdriAmount, formatCurrencyTotals, and filterShipments by importir work accurately', () => {
  const ref = new Date(2026, 10, 15);
  const fullOs = {
    items: Object.fromEntries(DEFAULT_CHECKLIST_ITEMS.map((i) => [i, true])),
    catatan: 'Lengkap',
  };

  assert.equal(parseBmPdriAmount('Rp 142.500.000'), 142500000);
  assert.equal(parseBmPdriAmount('Rp 45.000.000,50'), 45000000.5);
  assert.equal(parseBmPdriAmount('48300000'), 48300000);
  assert.equal(parseBmPdriAmount('12,500,000'), 12500000);
  assert.equal(parseBmPdriAmount('-'), 0);
  assert.equal(parseBmPdriAmount(''), 0);

  assert.equal(formatCurrencyTotals([]), '-');
  assert.equal(
    formatCurrencyTotals([
      { currency: 'EUR', amount: 12500 },
      { currency: 'USD', amount: 45000.5 },
    ]),
    'EUR 12,500 · USD 45,000.5'
  );

  const s1 = makeShipment({
    kodeOs: 'OS-2611-0801',
    kodeImportir: 'IMP-001',
    namaCustomer: 'PT Maju Jaya',
    statusDokumen: 'Ready',
    status: 'SPPB Terbit',
    jalur: 'Hijau',
    noSppb: 'SPPB-801',
    tglSppb: '2026-11-15',
    currency: 'USD',
    invoice: 30000,
    bmPdri: 'Rp 142.500.000',
    noPackinglist: 'PL-ALPHA-801',
    description: 'Mesin CNC Presisi',
    negaraAsal: 'Jepang',
  });
  const s2 = makeShipment({
    kodeOs: 'OS-2611-0802',
    kodeImportir: 'IMP-001',
    namaCustomer: 'PT Cahaya Nusantara',
    statusDokumen: 'Ready',
    status: 'Selesai',
    jalur: 'MITA',
    noSppb: 'SPPB-802',
    tglSppb: '2026-11-15',
    gateOutStatus: 'Sudah',
    suratJalanNomor: 'SJ-2611-0802',
    dokumenOs: fullOs,
    currency: 'USD',
    invoice: 20000,
    bmPdri: 'Rp 118.400.000',
  });
  const s3 = makeShipment({
    kodeOs: 'OS-2611-0803',
    kodeImportir: 'IMP-002',
    namaCustomer: 'PT Sinar Logistik',
    statusDokumen: 'Draft',
    status: 'Dokumen Diterima',
    jalur: 'Merah',
    currency: 'EUR',
    invoice: 15000,
    bmPdri: 'Rp 89.200.000',
  });
  const s4 = makeShipment({
    kodeOs: 'OS-2611-0804',
    kodeImportir: '',
    namaCustomer: 'PT Global Mandiri',
    statusDokumen: 'Draft',
    status: 'Dokumen Diterima',
    jalur: '',
    currency: 'USD',
    invoice: '',
    bmPdri: '',
  });

  const importirs = [
    { kodeImportir: 'IMP-001', namaImportir: 'PT Importir Utama Sejahtera' },
    { kodeImportir: 'IMP-002', namaImportir: 'PT Samudera Niaga Abadi' },
  ];

  const summary = computeImportirSummaries([s1, s2, s3, s4], importirs, DEFAULT_CHECKLIST_ITEMS, ref);

  assert.equal(summary.totalImportirs, 2);
  assert.equal(summary.totalShipments, 4);
  assert.equal(summary.totalDraft, 2);
  assert.equal(summary.totalReady, 2);
  assert.equal(summary.totalOutstanding, 3);
  assert.equal(summary.totalCompleted, 1);
  assert.equal(summary.totalSppb, 2);
  assert.equal(summary.totalGateOut, 1);
  assert.equal(summary.totalBmPdri, 350100000);

  // Sorted by total desc, with 'Belum Diisi' always last
  assert.deepEqual(
    summary.items.map((x) => x.kodeImportir),
    ['IMP-001', 'IMP-002', 'Belum Diisi']
  );

  const imp1 = summary.items[0];
  assert.equal(imp1.namaImportir, 'PT Importir Utama Sejahtera');
  assert.equal(imp1.total, 2);
  assert.equal(imp1.readyCount, 2);
  assert.equal(imp1.draftCount, 0);
  assert.equal(imp1.outstanding, 1);
  assert.equal(imp1.completed, 1);
  assert.equal(imp1.sppbCount, 2);
  assert.equal(imp1.gateOutCount, 1);
  assert.equal(imp1.byJalur.Hijau, 1);
  assert.equal(imp1.byJalur.MITA, 1);
  assert.deepEqual(imp1.customerNames, ['PT Cahaya Nusantara', 'PT Maju Jaya']);
  assert.equal(imp1.bmPdriTotal, 260900000);

  const impEmpty = summary.items[2];
  assert.equal(impEmpty.namaImportir, 'Kode Importir Belum Diisi');
  assert.equal(impEmpty.bmPdriTotal, 0);
  assert.equal(impEmpty.byJalur['Belum Ada'], 1);

  // Filter by importir & extended search fields
  const all = [s1, s2, s3, s4];
  assert.deepEqual(
    filterShipments(all, { mode: 'all', filterImportir: 'IMP-001' }).map((x) => x.kodeOs),
    ['OS-2611-0801', 'OS-2611-0802']
  );
  assert.deepEqual(
    filterShipments(all, { mode: 'all', filterImportir: 'Belum Diisi' }).map((x) => x.kodeOs),
    ['OS-2611-0804']
  );
  assert.deepEqual(
    filterShipments(all, { mode: 'all', search: 'PL-ALPHA-801' }).map((x) => x.kodeOs),
    ['OS-2611-0801']
  );
  assert.deepEqual(
    filterShipments(all, { mode: 'all', search: 'Mesin CNC' }).map((x) => x.kodeOs),
    ['OS-2611-0801']
  );
  assert.deepEqual(
    filterShipments(all, { mode: 'all', search: 'SJ-2611-0802' }).map((x) => x.kodeOs),
    ['OS-2611-0802']
  );
});

test('GAS Deploy PIN validation, hashing, and verification protect GAS code module', async () => {
  // Format validation
  assert.equal(validateGasPinFormat('').valid, false);
  assert.equal(validateGasPinFormat('12345').valid, false);
  assert.equal(validateGasPinFormat('1234567890123').valid, false);
  assert.equal(validateGasPinFormat('12 3456').valid, false);
  assert.equal(validateGasPinFormat('1234!@').valid, false);
  assert.equal(validateGasPinFormat('250888').valid, true);
  assert.equal(validateGasPinFormat('PTG2026').valid, true);

  // Default PIN verification when no custom hash stored
  assert.equal(await verifyGasDeployPin(DEFAULT_GAS_DEPLOY_PIN), true);
  assert.equal(await verifyGasDeployPin('000000'), false);
  assert.equal(await verifyGasDeployPin(''), false);

  // Custom PIN verification once updated
  const customHash = await computeGasPinHash('PTG9988');
  assert.equal(customHash.length, 64);
  assert.equal(await verifyGasDeployPin(DEFAULT_GAS_DEPLOY_PIN, customHash), false);
  assert.equal(await verifyGasDeployPin('PTG9988', customHash), true);
});

test('NOPEN / Nomor Pendaftaran PIB monthly & date-to-date recap filters and summary work accurately', () => {
  const ref = new Date(2026, 10, 15); // 2026-11-15
  assert.equal(getCurrentMonthKey(ref), '2026-11');
  assert.equal(getPreviousMonthKey(ref), '2026-10');
  assert.deepEqual(getMonthDateBounds('2026-11'), {
    dateFrom: '2026-11-01',
    dateTo: '2026-11-30',
  });
  assert.deepEqual(getMonthDateBounds('2024-02'), {
    dateFrom: '2024-02-01',
    dateTo: '2024-02-29',
  });
  assert.deepEqual(getRelativeDateRange(7, ref), {
    dateFrom: '2026-11-09',
    dateTo: '2026-11-15',
  });

  // Inverted range auto-swaps
  assert.deepEqual(
    resolveNopenDateRange({
      periodMode: 'range',
      dateFrom: '2026-11-15',
      dateTo: '2026-11-01',
    }),
    {
      dateFrom: '2026-11-01',
      dateTo: '2026-11-15',
      monthKey: '2026-11',
    }
  );

  assert.match(
    formatNopenPeriodLabel({ periodMode: 'month', month: '2026-11' }),
    /Bulan November 2026/
  );
  assert.match(
    formatNopenPeriodLabel({
      periodMode: 'range',
      dateFrom: '2026-11-05',
      dateTo: '2026-11-14',
    }),
    /05 Nov 2026 s\/d 14 Nov 2026/
  );

  const fullOs = {
    items: Object.fromEntries(DEFAULT_CHECKLIST_ITEMS.map((i) => [i, true])),
    catatan: 'Lengkap',
  };

  const sNovA = makeShipment({
    kodeOs: 'OS-2611-0901',
    nopen: '448120',
    tglNopen: '2026-11-13',
    noAju: '000020-AJU-901',
    tglAju: '2026-11-12',
    status: 'Proses Pemeriksaan',
    jalur: 'Merah',
    kodeImportir: 'IMP-002',
    namaCustomer: 'PT Karya Elektro Indonesia',
    sptnp: 'Proses Verifikasi',
    currency: 'USD',
    invoice: 42150,
    bmPdri: 'Rp 89.200.000',
  });
  const sNovB = makeShipment({
    kodeOs: 'OS-2611-0902',
    nopen: '448905',
    tglNopen: '2026-11-13',
    noAju: '000020-AJU-902',
    tglAju: '2026-11-13',
    status: 'SPPB Terbit',
    jalur: 'MITA',
    noSppb: 'SPPB-902',
    tglSppb: '2026-11-14',
    kodeImportir: 'IMP-001',
    namaCustomer: 'PT Nusantara Baja Mandiri',
    sptnp: 'Tidak',
    currency: 'JPY',
    invoice: 8500000,
    bmPdri: 'Rp 118.400.000',
  });
  const sNovC = makeShipment({
    kodeOs: 'OS-2611-0903',
    nopen: '441203',
    tglNopen: '2026-11-06',
    noAju: '000020-AJU-903',
    tglAju: '2026-11-05',
    status: 'Selesai',
    jalur: 'Hijau',
    noSppb: 'SPPB-903',
    tglSppb: '2026-11-08',
    gateOutStatus: 'Sudah',
    dokumenOs: fullOs,
    kodeImportir: 'IMP-001',
    namaCustomer: 'PT Nusantara Baja Mandiri',
    sptnp: 'Tidak',
    currency: 'USD',
    invoice: 19500,
    bmPdri: 'Rp 28.900.000',
  });
  const sNovNoNopen = makeShipment({
    kodeOs: 'OS-2611-0904',
    nopen: '',
    tglNopen: '',
    noAju: '000020-AJU-904',
    tglAju: '2026-11-14',
    status: 'Proses PIB/AJU',
    jalur: '',
    kodeImportir: 'IMP-002',
    namaCustomer: 'PT Karya Elektro Indonesia',
  });
  const sOctPrevMonth = makeShipment({
    kodeOs: 'OS-2610-0899',
    nopen: '439900',
    tglNopen: '2026-10-28',
    noAju: '000020-AJU-899',
    tglAju: '2026-10-27',
    status: 'Selesai',
    jalur: 'Hijau',
    noSppb: 'SPPB-899',
    gateOutStatus: 'Sudah',
    dokumenOs: fullOs,
    kodeImportir: 'IMP-001',
    currency: 'USD',
    invoice: 10000,
  });

  const all = [sNovA, sNovB, sNovC, sNovNoNopen, sOctPrevMonth];
  const importirs = [
    { kodeImportir: 'IMP-001', namaImportir: 'PT Nusantara Baja Mandiri (API-U)' },
    { kodeImportir: 'IMP-002', namaImportir: 'PT Karya Elektro Indonesia (API-P)' },
  ];

  assert.equal(hasSptnpIssue(sNovA), true);
  assert.equal(hasSptnpIssue(sNovB), false);

  // 1-Month mode (Nov 2026), default excludes rows without NOPEN
  const novOnly = filterNopenRecapShipments(all, {
    periodMode: 'month',
    month: '2026-11',
  });
  assert.deepEqual(
    novOnly.map((x) => x.kodeOs),
    ['OS-2611-0901', 'OS-2611-0902', 'OS-2611-0903']
  );

  // Include rows without NOPEN in Nov 2026
  const novWithUnissued = filterNopenRecapShipments(all, {
    periodMode: 'month',
    month: '2026-11',
    includeWithoutNopen: true,
  });
  assert.deepEqual(
    novWithUnissued.map((x) => x.kodeOs),
    ['OS-2611-0901', 'OS-2611-0902', 'OS-2611-0903', 'OS-2611-0904']
  );

  // Cross-month date-to-date range (2026-10-25 s/d 2026-11-10)
  const crossRange = filterNopenRecapShipments(all, {
    periodMode: 'range',
    dateFrom: '2026-10-25',
    dateTo: '2026-11-10',
  });
  assert.deepEqual(
    crossRange.map((x) => x.kodeOs),
    ['OS-2611-0903', 'OS-2610-0899']
  );

  // Search by No. NOPEN & Filter Jalur/Importir
  assert.deepEqual(
    filterNopenRecapShipments(all, {
      periodMode: 'month',
      month: '2026-11',
      search: '448905',
    }).map((x) => x.kodeOs),
    ['OS-2611-0902']
  );
  assert.deepEqual(
    filterNopenRecapShipments(all, {
      periodMode: 'month',
      month: '2026-11',
      filterImportir: 'IMP-001',
    }).map((x) => x.kodeOs),
    ['OS-2611-0902', 'OS-2611-0903']
  );
  assert.deepEqual(
    filterNopenRecapShipments(all, {
      periodMode: 'month',
      month: '2026-11',
      filterJalur: 'Merah',
    }).map((x) => x.kodeOs),
    ['OS-2611-0901']
  );

  // Summary calculation for Nov 2026 NOPEN docs
  const novSummary = computeNopenRecapSummary(novOnly, importirs, DEFAULT_CHECKLIST_ITEMS, {
    periodMode: 'month',
    month: '2026-11',
  });
  assert.equal(novSummary.totalMatched, 3);
  assert.equal(novSummary.totalWithNopen, 3);
  assert.equal(novSummary.totalWithoutNopen, 0);
  assert.equal(novSummary.totalSppb, 2);
  assert.equal(novSummary.totalGateOut, 1);
  assert.equal(novSummary.totalSelesai, 1);
  assert.equal(novSummary.totalOutstanding, 2);
  assert.equal(novSummary.totalSptnp, 1);
  assert.equal(novSummary.byJalur.Merah, 1);
  assert.equal(novSummary.byJalur.MITA, 1);
  assert.equal(novSummary.byJalur.Hijau, 1);
  assert.equal(novSummary.totalBmPdri, 236500000);
  assert.equal(novSummary.byDay.length, 2);
  assert.equal(novSummary.byDay[0].date, '2026-11-13');
  assert.equal(novSummary.byDay[0].count, 2);
  assert.equal(novSummary.byDay[0].sppbCount, 1);
  assert.equal(novSummary.byDay[0].sptnpCount, 1);
  assert.equal(novSummary.byDay[1].date, '2026-11-06');
  assert.equal(novSummary.byDay[1].gateOutCount, 1);
  assert.equal(novSummary.byImportir.length, 2);
  assert.equal(novSummary.byImportir[0].kodeImportir, 'IMP-001');
  assert.equal(novSummary.byImportir[0].count, 2);
  assert.equal(novSummary.byImportir[0].bmPdriTotal, 147300000);
  assert.equal(novSummary.byImportir[1].kodeImportir, 'IMP-002');
  assert.equal(novSummary.byImportir[1].bmPdriTotal, 89200000);
});

test('reconcileAllShipmentsDerivedState refreshes countdown ETA, containers, Surat Jalan, Billing, and seqByMonth', () => {
  const refDate = new Date(2026, 10, 16); // 2026-11-16
  const staleShipment = makeShipment({
    kodeOs: 'OS-2611-0012',
    eta: '2026-11-20',
    countDownEta: 99, // stale! should become 4
    noCont: '-',
    gateOutStatus: 'Sudah',
    gateOutTanggal: '2026-11-16',
    noSppb: 'SPPB-0012',
    suratJalanNomor: '',
    billingNomor: '',
  });
  const freshShipment = makeShipment({
    kodeOs: 'OS-2611-0005',
    eta: '2026-11-18',
    countDownEta: 2,
    noCont: '-',
    statusDokumen: 'Draft',
    doPelayaranStatus: 'Belum',
    doGatePassStatus: 'Belum',
    doGatePassJenis: '',
    truckingStatus: 'Belum',
    gateOutStatus: 'Belum',
    suratJalanStatus: 'Belum',
    billingStatus: 'Belum',
  });
  const kontainers: KontainerItem[] = [
    { id: 'c-1', kodeOs: 'OS-2611-0012', noCont: 'MSCU1234567', ukuranTipe: '40HC' },
  ];

  const singleRes = reconcileShipmentDerivedFields(staleShipment, kontainers, refDate);
  assert.equal(singleRes.changed, true);
  assert.equal(singleRes.shipment.countDownEta, 4);
  assert.equal(singleRes.shipment.noCont, 'MSCU1234567 (40HC)');
  assert.match(singleRes.shipment.suratJalanNomor || '', /^SJ-2611-/);
  assert.match(singleRes.shipment.billingNomor || '', /^INV-2611-/);

  const seqCheck = reconcileSeqByMonth([staleShipment, freshShipment], { '2611': 5 });
  assert.equal(seqCheck.changed, true);
  assert.equal(seqCheck.seqByMonth['2611'], 12);

  const allRes = reconcileAllShipmentsDerivedState(
    [staleShipment, freshShipment],
    kontainers,
    { '2611': 5 },
    refDate
  );
  assert.equal(allRes.hasChanges, true);
  assert.equal(allRes.updatedShipmentsCount, 1);
  assert.equal(allRes.seqChanged, true);
  assert.equal(allRes.seqByMonth['2611'], 12);
  assert.equal(allRes.shipments[0].countDownEta, 4);
  assert.equal(allRes.shipments[1].countDownEta, 2);

  // Second run on already reconciled state should report no changes
  const secondRun = reconcileAllShipmentsDerivedState(
    allRes.shipments,
    kontainers,
    allRes.seqByMonth,
    refDate
  );
  assert.equal(secondRun.hasChanges, false);
  assert.equal(secondRun.updatedShipmentsCount, 0);
  assert.equal(secondRun.seqChanged, false);
});

test('Owner Super Admin role holds exclusive module-toggle authority and full permissions', () => {
  assert.equal(isOwnerSuperAdmin('Owner'), true);
  assert.equal(isOwnerSuperAdmin('Admin'), false);
  assert.equal(isOwnerSuperAdmin('Checker'), false);

  // Owner passes every action including exclusive manage_module_toggles & manage_setup
  assert.equal(canPerformAction('Owner', 'manage_module_toggles'), true);
  assert.equal(canPerformAction('Owner', 'manage_setup'), true);
  assert.equal(canPerformAction('Owner', 'manage_settings'), true);
  assert.equal(canPerformAction('Owner', 'delete_shipment'), true);

  // Non-Owner Admin does NOT get exclusive module toggle authority (Checker cannot manage setup either)
  assert.equal(canPerformAction('Admin', 'manage_module_toggles'), false);
  assert.equal(canPerformAction('Admin', 'manage_setup'), true);
  assert.equal(canPerformAction('Checker', 'manage_setup'), false);
  assert.equal(canPerformAction('Checker', 'manage_module_toggles'), false);
  assert.equal(canPerformAction('Admin', 'manage_settings'), true);

  // Owner has full phase permissions regardless of role restrictions
  assert.deepEqual(getDefaultPhasePermissions('Owner'), {
    phase1: true,
    phase2: true,
    phase3: true,
    phase4: true,
  });
});

test('getPpjkIdentity provides defaults and propagates custom company identity into billing messages', () => {
  const defaultId = getPpjkIdentity();
  assert.equal(defaultId.brandName, 'PTG PPJK');
  assert.equal(defaultId.companyName, 'PT PTG Logistik Kepabeanan');

  const customSettings: Pengaturan = {
    ...DEFAULT_PENGATURAN,
    ppjkBrandName: 'SAMUDERA PPJK',
    ppjkCompanyName: 'PT Samudera Kepabeanan Nusantara',
    ppjkTagline: 'Customs & Port Clearance Hub',
    ppjkNpwp: '02.999.888.7-041.000',
    ppjkAddress: 'Jl. Pelabuhan Raya No. 10, Jakarta',
    ppjkPhone: '021-5555-8888',
    ppjkEmail: 'cs@samudera-ppjk.id',
    ppjkWebsite: 'https://samudera-ppjk.id',
    ppjkFooterNote: 'Catatan Footer Samudera',
  };
  const customId = getPpjkIdentity(customSettings);
  assert.equal(customId.brandName, 'SAMUDERA PPJK');
  assert.equal(customId.companyName, 'PT Samudera Kepabeanan Nusantara');
  assert.equal(customId.footerNote, 'Catatan Footer Samudera');

  const eligibleShipment = makeShipment({
    kodeOs: 'OS-2611-0950',
    noSppb: 'SPPB-950',
    tglSppb: '2026-11-16',
    status: 'SPPB Terbit',
  });
  const ownerMsg = buildOwnerBillingMessage(eligibleShipment, customSettings);
  assert.match(ownerMsg.subject, /\[INFO PENAGIHAN SAMUDERA PPJK\]/);
  assert.match(ownerMsg.message, /Sistem SAMUDERA PPJK/);

  const custMsg = buildCustomerBillingMessage(
    eligibleShipment,
    { kodeCustomer: 'CUST-001', namaCustomer: 'PT Maju Jaya', kontak: '08123456789' },
    customSettings
  );
  assert.match(custMsg.message, /PT Samudera Kepabeanan Nusantara/);
  assert.match(custMsg.message, /SAMUDERA PPJK/);
});

test('resolveUserModuleAccess enforces role matrix, per-user overrides, Owner immunity, and all-locked handling', () => {
  assert.equal(APP_MODULE_META.length, 10);

  const pengaturanWithPolicy: Pick<Pengaturan, 'roleModuleAccess'> = {
    roleModuleAccess: {
      Checker: { do: false, penagihan: false },
      Operasional: { 'report-nopen': false },
    },
  };

  // Owner stays 100% immune even if user.modulePermissions tries to lock them out
  const ownerAccount = {
    role: 'Owner' as const,
    modulePermissions: { dashboard: false, do: false, setup: false },
  };
  const ownerAccess = resolveUserModuleAccess(ownerAccount, pengaturanWithPolicy);
  assert.equal(ownerAccess.setup, true);
  assert.equal(ownerAccess.do, true);
  assert.equal(canUserAccessModule(ownerAccount, 'setup', pengaturanWithPolicy), true);
  assert.equal(canUserAccessModule(ownerAccount, 'do', pengaturanWithPolicy), true);

  // Checker inherits role policy (do=false, penagihan=false), except explicit per-user override (penagihan=true)
  const checkerAccess = resolveUserModuleAccess(
    {
      role: 'Checker',
      modulePermissions: { penagihan: true },
    },
    pengaturanWithPolicy
  );
  assert.equal(checkerAccess.dashboard, true);
  assert.equal(checkerAccess.do, false);
  assert.equal(checkerAccess.penagihan, true);
  assert.equal(checkerAccess.setup, false);

  // Dokumen/Checker shares Checker role policy
  assert.equal(
    canUserAccessModule({ role: 'Dokumen/Checker' }, 'do', pengaturanWithPolicy),
    false
  );

  // Default role module access disables master & setup for Manajer
  const managerDefaults = getDefaultModuleAccessForRole('Manajer');
  assert.equal(managerDefaults.master, false);
  assert.equal(managerDefaults.setup, false);
  assert.equal(managerDefaults.dashboard, true);

  // When all modules are disabled for a non-Owner user, getFirstAccessibleModule returns null
  const allLockedOverrides = Object.fromEntries(APP_MODULE_META.map((m) => [m.id, false]));
  assert.equal(
    getFirstAccessibleModule({ role: 'Manajer', modulePermissions: allLockedOverrides }),
    null
  );

  // Fallback picks first enabled module when dashboard is disabled
  assert.equal(
    getFirstAccessibleModule({
      role: 'Manajer',
      modulePermissions: { dashboard: false, outstanding: false, checker: true },
    }),
    'checker'
  );
});

test('buildUserMonitoringRows aggregates log activity counts, resolved modules, and phase counts per user', () => {
  const users: UserAccount[] = [
    {
      username: 'owner',
      passwordHash: 'h',
      salt: 's',
      nama: 'Bpk. Gunawan (Owner)',
      role: 'Owner',
      aktif: true,
      phasePermissions: { phase1: true, phase2: true, phase3: true, phase4: true },
    },
    {
      username: 'checker1',
      passwordHash: 'h',
      salt: 's',
      nama: 'Budi Santoso',
      role: 'Checker',
      aktif: true,
      phasePermissions: { phase1: true, phase2: false, phase3: false, phase4: false },
      modulePermissions: { do: false, 'surat-jalan': false },
    },
  ];
  const logs: LogPerubahan[] = [
    {
      id: 'l1',
      waktu: '2026-11-15T09:00:00Z',
      user: 'checker1',
      kodeOs: 'OS-2611-0001',
      kolom: 'status',
      nilaiLama: 'Dokumen Diterima',
      nilaiBaru: 'Proses PIB/AJU',
    },
    {
      id: 'l2',
      waktu: '2026-11-16T11:30:00Z',
      user: 'CHECKER1',
      kodeOs: 'OS-2611-0002',
      kolom: 'nopen',
      nilaiLama: '-',
      nilaiBaru: '448120',
    },
  ];

  const rows = buildUserMonitoringRows(users, logs, { roleModuleAccess: {} });
  assert.equal(rows.length, 2);

  const ownerRow = rows[0];
  assert.equal(ownerRow.totalModulesCount, 10);
  assert.equal(ownerRow.enabledModulesCount, 10);
  assert.equal(ownerRow.activePhasesCount, 4);
  assert.equal(ownerRow.activityCount, 0);

  const checkerRow = rows[1];
  assert.equal(checkerRow.totalModulesCount, 9); // excludes owner-exclusive setup module
  assert.equal(checkerRow.enabledModulesCount, 7); // 9 - 2 disabled
  assert.equal(checkerRow.hasCustomModuleOverrides, true);
  assert.equal(checkerRow.activePhasesCount, 1);
  assert.equal(checkerRow.activityCount, 2);
  assert.equal(checkerRow.lastActivityAt, '2026-11-16T11:30:00Z');
  assert.equal(checkerRow.lastKodeOs, 'OS-2611-0002');
});











