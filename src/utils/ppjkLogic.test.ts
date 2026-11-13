import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCountdownEta,
  canEditPhase,
  canPerformAction,
  canUserEditAnyPhase,
  canUserEditPhase,
  computeCheckerSummaries,
  computeDashboardStats,
  computeSha256Hex,
  createEmptyChecklist,
  DEFAULT_CHECKLIST_ITEMS,
  DEFAULT_STATUS_LIST,
  formatContainerSummary,
  generateNextKodeOS,
  getAllowedFieldsForPermissions,
  getCountdownBadgeMeta,
  getDefaultPhasePermissions,
  isShipmentOutstanding,
  isUrgentMissingAju,
  resolveUserPhasePermissions,
  validateShipmentInput,
} from './ppjkLogic';
import type { Shipment } from '../types/ppjk';

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
  });
  const s2 = makeShipment({
    kodeOs: 'OS-2611-0002',
    eta: '2026-11-25',
    jalur: 'Hijau',
    noAju: '00001',
  });
  const stats = computeDashboardStats([s1, s2], DEFAULT_CHECKLIST_ITEMS, ref);
  assert.equal(stats.total, 2);
  assert.equal(stats.outstanding, 2);
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
