/**
 * ============================================================================
 * PTG PPJK OUTSTANDING TRACKER - GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * ============================================================================
 * Pencatatan & pemantauan dokumen shipment impor dari awal hingga akhir.
 * Struktur: 10 Sheet (Shipment 39 kolom, Kontainer, Customer, Importir,
 * Shipper, User, LogPerubahan, Catatan, Dokumen, Pengaturan).
 */

var CACHE_TTL_SECONDS = 300; // 5 menit untuk data list
var SESSION_TTL_SECONDS = 21600; // 6 jam masa berlaku token sesi
var APP_CACHE_DATA_KEY = 'PTG_PPJK_ALL_DATA_V1';

var SHIPMENT_HEADERS = [
  'Kode OS', 'Ship', 'Kode Customer', 'Nama Customer', 'Tgl. Terima Dok',
  'Terima Dok', 'No. Packinglist', 'No. BL', 'ETD', 'ETA',
  'Count Down ETA', 'No. Cont', 'No. AJU', 'Tgl. AJU', 'Status',
  'NOPEN', 'Tgl. NOPEN', 'Jalur', 'Kode Importir', 'Shipper',
  'Description', 'Negara Asal', 'Currency', 'Kurs', 'Invoice',
  'BM/PDRI', 'SPTNP', 'No. SPPB', 'Tgl SPPB', 'Dokumen Checker',
  'No. SPTNP', 'Tgl. SPTNP', 'PFPB', 'Tgl. PFPB', 'PFPD',
  'Tgl. PFPD', 'ESLAH', 'Tgl. ESLAH', 'Dokumen OS',
  'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'StatusDokumen',
  'Bc11Terbit', 'NoBc11', 'TglBc11'
];

var DEFAULT_STATUS_LIST = [
  'Dokumen Diterima',
  'Proses PIB/AJU',
  'Menunggu Jalur',
  'Proses Pemeriksaan',
  'SPPB Terbit',
  'Pasca-SPPB',
  'Selesai'
];

var DEFAULT_JALUR_LIST = ['Hijau', 'Kuning', 'Merah', 'MITA'];

var DEFAULT_CHECKLIST_ITEMS = [
  'Bill of Lading (BL)',
  'Commercial Invoice',
  'Packing List',
  'Certificate of Origin (COO/SKA)',
  'Asuransi / Polis',
  'Surat Kuasa & PIB Draft'
];

var VALID_ROLES_ = ['Admin', 'Checker', 'Drafter', 'Dokumen/Checker', 'Operasional', 'Manajer'];

var PHASE_1_KEYS_ = {
  kodeCustomer: true,
  namaCustomer: true,
  tglTerimaDok: true,
  terimaDok: true,
  noPackinglist: true,
  noBl: true,
  statusDokumen: true,
  dokumenChecker: true
};

var PHASE_2_KEYS_ = {
  ship: true,
  etd: true,
  eta: true,
  noCont: true,
  bc11Terbit: true,
  noBc11: true,
  tglBc11: true
};

var PHASE_3_KEYS_ = {
  noAju: true,
  tglAju: true,
  status: true,
  nopen: true,
  tglNopen: true,
  jalur: true,
  kodeImportir: true,
  shipper: true,
  description: true,
  negaraAsal: true,
  currency: true,
  kurs: true,
  invoice: true,
  bmPdri: true,
  sptnp: true,
  noSppb: true,
  tglSppb: true
};

var PHASE_4_KEYS_ = {
  status: true,
  noSptnp: true,
  tglSptnp: true,
  pfpb: true,
  tglPfpb: true,
  pfpd: true,
  tglPfpd: true,
  eslah: true,
  tglEslah: true,
  dokumenOs: true
};

function isCheckerRole_(role) {
  return role === 'Checker' || role === 'Dokumen/Checker';
}

function isDrafterOrOpsRole_(role) {
  return role === 'Drafter' || role === 'Operasional';
}

function getDefaultPhasePermissions_(role) {
  if (role === 'Admin') return { phase1: true, phase2: true, phase3: true, phase4: true };
  if (isCheckerRole_(role)) return { phase1: true, phase2: false, phase3: false, phase4: true };
  if (isDrafterOrOpsRole_(role)) return { phase1: false, phase2: true, phase3: true, phase4: false };
  return { phase1: false, phase2: false, phase3: false, phase4: false };
}

function resolveUserPhasePermissions_(role, custom) {
  var def = getDefaultPhasePermissions_(role);
  var obj = custom;
  if (typeof custom === 'string' && custom.trim() !== '') {
    try { obj = JSON.parse(custom); } catch (e) { obj = null; }
  }
  if (!obj || typeof obj !== 'object') return def;
  return {
    phase1: typeof obj.phase1 === 'boolean' ? obj.phase1 : def.phase1,
    phase2: typeof obj.phase2 === 'boolean' ? obj.phase2 : def.phase2,
    phase3: typeof obj.phase3 === 'boolean' ? obj.phase3 : def.phase3,
    phase4: typeof obj.phase4 === 'boolean' ? obj.phase4 : def.phase4
  };
}

function getAllowedKeysForPermissions_(perms) {
  var map = {};
  if (perms.phase1) Object.keys(PHASE_1_KEYS_).forEach(function (k) { map[k] = true; });
  if (perms.phase2) Object.keys(PHASE_2_KEYS_).forEach(function (k) { map[k] = true; });
  if (perms.phase3) Object.keys(PHASE_3_KEYS_).forEach(function (k) { map[k] = true; });
  if (perms.phase4) Object.keys(PHASE_4_KEYS_).forEach(function (k) { map[k] = true; });
  return map;
}

function canUserEditAnyPhase_(perms) {
  return Boolean(perms && (perms.phase1 || perms.phase2 || perms.phase3 || perms.phase4));
}

/**
 * Entry point Web App
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('PTG PPJK Outstanding — Monitoring Dokumen Impor')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Setup awal: membuat seluruh 10 sheet, header, pemformatan, pengaturan default,
 * folder induk Drive, dan 1 akun Admin default (wajib ganti password saat login pertama).
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Jalankan setup() dari Google Spreadsheet yang terikat dengan script ini.');
  }

  var schemas = [
    { name: 'Shipment', headers: SHIPMENT_HEADERS },
    { name: 'Kontainer', headers: ['Kode OS', 'No. Cont', 'Ukuran/Tipe'] },
    { name: 'Customer', headers: ['Kode Customer', 'Nama Customer', 'Kontak'] },
    { name: 'Importir', headers: ['Kode Importir', 'Nama Importir'] },
    { name: 'Shipper', headers: ['Nama Shipper', 'Negara'] },
    { name: 'User', headers: ['Username', 'PasswordHash', 'Salt', 'Nama', 'Role', 'Aktif', 'WajibGantiPassword', 'PhasePermissions'] },
    { name: 'LogPerubahan', headers: ['Waktu', 'User', 'Kode OS', 'Kolom', 'Nilai Lama', 'Nilai Baru'] },
    { name: 'Catatan', headers: ['Kode OS', 'Waktu', 'User', 'Isi'] },
    { name: 'Dokumen', headers: ['Kode OS', 'Jenis Dokumen', 'Link Drive', 'Waktu Upload', 'User'] },
    { name: 'Pengaturan', headers: ['Kunci', 'Nilai', 'Keterangan'] }
  ];

  for (var i = 0; i < schemas.length; i++) {
    ensureSheet_(ss, schemas[i].name, schemas[i].headers);
  }

  // Pastikan pengaturan default tersedia
  var setSheet = ss.getSheetByName('Pengaturan');
  var existingSettings = getSettingsMap_(ss);

  var parentFolderId = existingSettings.DRIVE_PARENT_FOLDER_ID || '';
  if (!parentFolderId) {
    var rootFolders = DriveApp.getFoldersByName('PTG_PPJK_Dokumen');
    var rootFolder = rootFolders.hasNext()
      ? rootFolders.next()
      : DriveApp.createFolder('PTG_PPJK_Dokumen');
    parentFolderId = rootFolder.getId();
  }

  var defaults = [
    ['DRIVE_PARENT_FOLDER_ID', parentFolderId, 'ID Folder Induk Google Drive untuk scan dokumen'],
    ['STATUS_LIST', JSON.stringify(DEFAULT_STATUS_LIST), 'Daftar opsi Status shipment'],
    ['JALUR_LIST', JSON.stringify(DEFAULT_JALUR_LIST), 'Daftar opsi Jalur kepabeanan'],
    ['CHECKLIST_ITEMS', JSON.stringify(DEFAULT_CHECKLIST_ITEMS), 'Daftar item checklist Terima Dok & Dokumen OS'],
    ['NOTIFICATION_EMAILS', JSON.stringify([Session.getEffectiveUser().getEmail() || 'admin@ptg-ppjk.co.id']), 'Daftar email penerima notifikasi otomatis'],
    ['SEQ_MAP', JSON.stringify({}), 'Nomor urut Kode OS per bulan (YYMM)']
  ];

  var setRows = setSheet.getDataRange().getValues();
  var keyIndex = {};
  for (var r = 1; r < setRows.length; r++) {
    if (setRows[r][0]) keyIndex[String(setRows[r][0])] = r + 1;
  }
  for (var d = 0; d < defaults.length; d++) {
    if (!keyIndex[defaults[d][0]]) {
      setSheet.appendRow(defaults[d]);
    }
  }

  // Buat akun Admin default jika sheet User masih kosong (hanya header)
  var userSheet = ss.getSheetByName('User');
  if (userSheet.getLastRow() <= 1) {
    var salt = Utilities.getUuid().replace(/-/g, '').substring(0, 16);
    var defaultPass = 'Admin123!';
    var hash = computeSha256_(salt + ':' + defaultPass);
    userSheet.appendRow(['admin', hash, salt, 'Administrator PTG', 'Admin', true, true, JSON.stringify(getDefaultPhasePermissions_('Admin'))]);
  }

  invalidateCache_();
  return {
    success: true,
    message: 'Setup selesai. 10 sheet siap digunakan. Akun default: admin / Admin123! (wajib ganti saat login pertama).'
  };
}

/**
 * Memasang trigger harian (time-driven) jam 07:30 pagi untuk notifikasi email otomatis
 */
function installNotificationTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendDailyNotifications') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('sendDailyNotifications')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .nearMinute(30)
    .create();
  return { success: true, message: 'Trigger harian notifikasi email aktif pada pukul 07:30.' };
}

/**
 * Helper: memastikan sheet ada dan header terformat rapi
 */
function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#0B2545');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    headerRange.setFontFamily('Poppins');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Helper SHA-256 hex digest
 */
function computeSha256_(text) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < raw.length; i++) {
    var b = (raw[i] + 256) % 256;
    var h = b.toString(16);
    if (h.length === 1) hex += '0';
    hex += h;
  }
  return hex;
}

/**
 * Autentikasi Login: verifikasi SHA-256 + salt, buat token sesi di CacheService & PropertiesService
 */
function login(username, password) {
  username = String(username || '').trim();
  password = String(password || '');
  if (!username || !password) {
    throw new Error('Username dan password wajib diisi.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var userSheet = ss.getSheetByName('User');
  if (!userSheet) throw new Error('Sheet User belum diinisialisasi. Jalankan setup() terlebih dahulu.');

  var rows = userSheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var rowUser = String(rows[i][0] || '').trim();
    if (rowUser.toLowerCase() === username.toLowerCase()) {
      var storedHash = String(rows[i][1] || '');
      var salt = String(rows[i][2] || '');
      var nama = String(rows[i][3] || rowUser);
      var role = String(rows[i][4] || 'Manajer');
      var aktif = rows[i][5] === true || String(rows[i][5]).toUpperCase() === 'TRUE';
      var mustChange = rows[i][6] === true || String(rows[i][6]).toUpperCase() === 'TRUE';
      var phasePermissions = resolveUserPhasePermissions_(role, rows[i][7]);

      if (!aktif) {
        throw new Error('Akun Anda tidak aktif. Hubungi Admin.');
      }

      var candidateHash = computeSha256_(salt + ':' + password);
      if (candidateHash !== storedHash) {
        throw new Error('Username atau password salah.');
      }

      var token = Utilities.getUuid();
      var sessionObj = {
        token: token,
        username: rowUser,
        nama: nama,
        role: role,
        mustChangePassword: mustChange,
        phasePermissions: phasePermissions,
        expiresAt: new Date().getTime() + SESSION_TTL_SECONDS * 1000
      };

      var serialized = JSON.stringify(sessionObj);
      CacheService.getScriptCache().put('SESSION_' + token, serialized, SESSION_TTL_SECONDS);
      PropertiesService.getScriptProperties().setProperty('SESSION_' + token, serialized);

      return sessionObj;
    }
  }
  throw new Error('Username atau password salah.');
}

function logout(token) {
  if (token) {
    CacheService.getScriptCache().remove('SESSION_' + token);
    PropertiesService.getScriptProperties().deleteProperty('SESSION_' + token);
  }
  return { success: true };
}

function validateSession_(token) {
  if (!token) throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
  var cache = CacheService.getScriptCache();
  var raw = cache.get('SESSION_' + token);
  if (!raw) {
    raw = PropertiesService.getScriptProperties().getProperty('SESSION_' + token);
    if (raw) {
      cache.put('SESSION_' + token, raw, SESSION_TTL_SECONDS);
    }
  }
  if (!raw) throw new Error('Sesi berakhir atau tidak valid. Silakan login kembali.');
  var session = JSON.parse(raw);
  if (new Date().getTime() > session.expiresAt) {
    logout(token);
    throw new Error('Sesi telah kedaluwarsa. Silakan login ulang.');
  }
  // Verifikasi akun masih aktif di sheet User
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var userSheet = ss.getSheetByName('User');
  if (userSheet && userSheet.getLastRow() > 1) {
    var rows = userSheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim().toLowerCase() === String(session.username || '').toLowerCase()) {
        var aktif = rows[i][5] === true || String(rows[i][5]).toUpperCase() === 'TRUE';
        if (!aktif) {
          logout(token);
          throw new Error('Akun Anda telah dinonaktifkan oleh Admin.');
        }
        session.role = String(rows[i][4] || session.role);
        session.phasePermissions = resolveUserPhasePermissions_(session.role, rows[i][7]);
        break;
      }
    }
  }
  return session;
}

function requireRole_(token, allowedRoles) {
  var session = validateSession_(token);
  if (allowedRoles.indexOf(session.role) === -1) {
    throw new Error('Akses ditolak: Peran "' + session.role + '" tidak memiliki izin untuk aksi ini.');
  }
  return session;
}

function changePassword(token, oldPassword, newPassword) {
  var session = validateSession_(token);
  if (!newPassword || String(newPassword).length < 6) {
    throw new Error('Password baru minimal 6 karakter.');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('User');
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === session.username) {
        var oldHash = computeSha256_(String(rows[i][2]) + ':' + String(oldPassword));
        if (oldHash !== String(rows[i][1])) {
          throw new Error('Password lama tidak sesuai.');
        }
        var newSalt = Utilities.getUuid().replace(/-/g, '').substring(0, 16);
        var newHash = computeSha256_(newSalt + ':' + String(newPassword));
        sheet.getRange(i + 1, 2, 1, 2).setValues([[newHash, newSalt]]);
        sheet.getRange(i + 1, 7).setValue(false);

        session.mustChangePassword = false;
        var serialized = JSON.stringify(session);
        CacheService.getScriptCache().put('SESSION_' + token, serialized, SESSION_TTL_SECONDS);
        PropertiesService.getScriptProperties().setProperty('SESSION_' + token, serialized);
        return session;
      }
    }
    throw new Error('User tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Generator Kode OS otomatis (OS-YYMM-NNNN), reset tiap bulan, aman dengan LockService
 */
function generateKodeOS_(ss) {
  var setSheet = ss.getSheetByName('Pengaturan');
  var rows = setSheet.getDataRange().getValues();
  var seqRowIndex = -1;
  var seqMap = {};

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === 'SEQ_MAP') {
      seqRowIndex = i + 1;
      try {
        seqMap = JSON.parse(String(rows[i][1] || '{}'));
      } catch (e) {
        seqMap = {};
      }
      break;
    }
  }

  var now = new Date();
  var yy = String(now.getFullYear()).slice(-2);
  var mm = ('0' + (now.getMonth() + 1)).slice(-2);
  var monthKey = yy + mm;
  var nextSeq = (seqMap[monthKey] || 0) + 1;
  seqMap[monthKey] = nextSeq;

  var seqStr = ('0000' + nextSeq).slice(-4);
  var kodeOs = 'OS-' + monthKey + '-' + seqStr;

  if (seqRowIndex > 0) {
    setSheet.getRange(seqRowIndex, 2).setValue(JSON.stringify(seqMap));
  } else {
    setSheet.appendRow(['SEQ_MAP', JSON.stringify(seqMap), 'Nomor urut Kode OS per bulan']);
  }

  return kodeOs;
}

/**
 * Mengambil seluruh data aplikasi (dengan CacheService)
 */
function getInitialData(token, forceRefresh) {
  var session = validateSession_(token);
  var cache = CacheService.getScriptCache();

  if (!forceRefresh) {
    var cached = cache.get(APP_CACHE_DATA_KEY);
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        parsed.currentUser = session;
        if (session.role !== 'Admin') {
          parsed.users = [];
        }
        return parsed;
      } catch (e) {}
    }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shipments = readShipments_(ss);
  var kontainers = readKontainers_(ss);
  var customers = readSimpleTable_(ss, 'Customer', ['kodeCustomer', 'namaCustomer', 'kontak']);
  var importirs = readSimpleTable_(ss, 'Importir', ['kodeImportir', 'namaImportir']);
  var shippers = readSimpleTable_(ss, 'Shipper', ['namaShipper', 'negara']);
  var logs = readSimpleTable_(ss, 'LogPerubahan', ['waktu', 'user', 'kodeOs', 'kolom', 'nilaiLama', 'nilaiBaru']);
  var catatan = readSimpleTable_(ss, 'Catatan', ['kodeOs', 'waktu', 'user', 'isi']);
  var dokumen = readSimpleTable_(ss, 'Dokumen', ['kodeOs', 'jenisDokumen', 'linkDrive', 'waktuUpload', 'user']);
  var settings = getSettingsMap_(ss);
  var users = readUsersSanitized_(ss);

  // Gabungkan ringkasan kontainer & hitung ulang Count Down ETA secara dinamis
  var kontainerByOs = {};
  for (var k = 0; k < kontainers.length; k++) {
    var ko = kontainers[k];
    if (!kontainerByOs[ko.kodeOs]) kontainerByOs[ko.kodeOs] = [];
    kontainerByOs[ko.kodeOs].push(ko);
  }

  for (var s = 0; s < shipments.length; s++) {
    var sh = shipments[s];
    sh.countDownEta = calculateCountdownEta_(sh.eta);
    var listK = kontainerByOs[sh.kodeOs] || [];
    if (listK.length > 0) {
      sh.noCont = listK.map(function (c) {
        return c.ukuranTipe ? c.noCont + ' (' + c.ukuranTipe + ')' : c.noCont;
      }).join(', ');
    }
  }

  var payload = {
    shipments: shipments,
    kontainers: kontainers,
    customers: customers,
    importirs: importirs,
    shippers: shippers,
    logs: logs.reverse().slice(0, 300),
    catatan: catatan,
    dokumen: dokumen,
    pengaturan: {
      driveParentFolderId: settings.DRIVE_PARENT_FOLDER_ID || '',
      statusList: safeJsonParse_(settings.STATUS_LIST, DEFAULT_STATUS_LIST),
      jalurList: safeJsonParse_(settings.JALUR_LIST, DEFAULT_JALUR_LIST),
      checklistItems: safeJsonParse_(settings.CHECKLIST_ITEMS, DEFAULT_CHECKLIST_ITEMS),
      notificationEmails: safeJsonParse_(settings.NOTIFICATION_EMAILS, []),
      seqByMonth: safeJsonParse_(settings.SEQ_MAP, {})
    },
    users: users,
    currentUser: session
  };

  try {
    var jsonStr = JSON.stringify(payload);
    if (jsonStr.length < 95000) {
      cache.put(APP_CACHE_DATA_KEY, jsonStr, CACHE_TTL_SECONDS);
    }
  } catch (e) {}

  if (session.role !== 'Admin') {
    payload.users = [];
  }
  return payload;
}

/**
 * Validasi & Simpan (Create / Update) Shipment + Kontainer + LogPerubahan
 */
function saveShipment(token, data, kontainerList, isNew) {
  var session = isNew
    ? requireRole_(token, ['Admin', 'Checker', 'Dokumen/Checker'])
    : validateSession_(token);
  var activePerms = resolveUserPhasePermissions_(session.role, session.phasePermissions);
  if (!isNew && !canUserEditAnyPhase_(activePerms)) {
    throw new Error('Akses ditolak: Tidak ada fase edit yang diaktifkan Admin untuk akun Anda.');
  }

  // Validasi input wajib & format
  if (!data.kodeCustomer || !String(data.kodeCustomer).trim()) {
    throw new Error('Kode Customer wajib diisi.');
  }
  if (!data.noBl || !String(data.noBl).trim()) {
    throw new Error('No. BL wajib diisi.');
  }
  if (!data.eta || !/^\d{4}-\d{2}-\d{2}$/.test(String(data.eta).trim())) {
    throw new Error('ETA wajib diisi dengan format YYYY-MM-DD.');
  }
  if (data.etd && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.etd).trim())) {
    throw new Error('Format ETD harus YYYY-MM-DD.');
  }
  if (data.etd && data.eta && String(data.eta) < String(data.etd)) {
    throw new Error('ETA tidak boleh lebih awal dari ETD.');
  }
  if (data.kurs !== '' && data.kurs !== null && data.kurs !== undefined && isNaN(Number(data.kurs))) {
    throw new Error('Kurs harus berupa angka.');
  }
  if (data.invoice !== '' && data.invoice !== null && data.invoice !== undefined && isNaN(Number(data.invoice))) {
    throw new Error('Invoice harus berupa angka.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Shipment');
    var allRows = sheet.getDataRange().getValues();
    var nowIso = new Date().toISOString();

    var kodeOs = String(data.kodeOs || '').trim();
    var existingRowIndex = -1;
    var oldObj = null;
    var skipContainerSync = false;

    if (!isNew) {
      for (var i = 1; i < allRows.length; i++) {
        if (String(allRows[i][0]) === kodeOs) {
          existingRowIndex = i + 1;
          oldObj = rowToShipment_(allRows[i]);
          break;
        }
      }
      if (existingRowIndex === -1) {
        throw new Error('Data shipment dengan Kode OS ' + kodeOs + ' tidak ditemukan.');
      }
      // Enforce RBAC di sisi server berdasarkan pengaturan toggle fase manual dari Admin
      var allowedMap = getAllowedKeysForPermissions_(activePerms);
      var keys = Object.keys(oldObj);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        if (key === 'kodeOs' || key === 'countDownEta' || key === 'createdAt' || key === 'createdBy' || key === 'updatedAt' || key === 'updatedBy') continue;
        if (!allowedMap[key]) {
          data[key] = oldObj[key];
        }
      }
      if (!activePerms.phase2) {
        skipContainerSync = true;
      }
    } else {
      kodeOs = generateKodeOS_(ss);
      data.kodeOs = kodeOs;
    }

    // Ringkasan kontainer
    var validContainers = (kontainerList || []).filter(function (c) {
      return c && String(c.noCont || '').trim() !== '';
    });
    if (!skipContainerSync) {
      var containerSummary = validContainers.length > 0
        ? validContainers.map(function (c) {
            return c.ukuranTipe ? String(c.noCont).trim() + ' (' + String(c.ukuranTipe).trim() + ')' : String(c.noCont).trim();
          }).join(', ')
        : (data.noCont || '-');
      data.noCont = containerSummary;
    } else if (oldObj) {
      data.noCont = oldObj.noCont;
    }

    data.countDownEta = calculateCountdownEta_(data.eta);
    data.createdAt = isNew ? nowIso : (oldObj.createdAt || nowIso);
    data.createdBy = isNew ? session.username : (oldObj.createdBy || session.username);
    data.updatedAt = nowIso;
    data.updatedBy = session.username;

    var rowValues = shipmentToRow_(data);
    if (isNew) {
      sheet.appendRow(rowValues);
      appendLog_(ss, session.username, kodeOs, 'CREATE', '-', 'Shipment dibuat (' + data.noBl + ')');
    } else {
      sheet.getRange(existingRowIndex, 1, 1, SHIPMENT_HEADERS.length).setValues([rowValues]);
      logShipmentDiff_(ss, session.username, kodeOs, oldObj, data);
    }

    // Sinkronisasi sheet Kontainer
    if (!skipContainerSync) {
      syncContainers_(ss, kodeOs, validContainers);
    }

    invalidateCache_();
    return { success: true, kodeOs: kodeOs, shipment: data };
  } finally {
    lock.releaseLock();
  }
}

function deleteShipment(token, kodeOs) {
  var session = requireRole_(token, ['Admin']);
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Shipment');
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(kodeOs)) {
        sheet.deleteRow(i + 1);
        syncContainers_(ss, kodeOs, []);
        appendLog_(ss, session.username, kodeOs, 'DELETE', String(rows[i][7] || ''), 'Shipment dihapus');
        invalidateCache_();
        return { success: true };
      }
    }
    throw new Error('Shipment tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

function addCatatan(token, kodeOs, isi) {
  var session = requireRole_(token, ['Admin', 'Checker', 'Dokumen/Checker', 'Drafter', 'Operasional']);
  isi = String(isi || '').trim();
  if (!isi) throw new Error('Isi catatan tidak boleh kosong.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Catatan');
    var nowIso = new Date().toISOString();
    sheet.appendRow([kodeOs, nowIso, session.nama + ' (' + session.username + ')', isi]);
    invalidateCache_();
    return { kodeOs: kodeOs, waktu: nowIso, user: session.nama + ' (' + session.username + ')', isi: isi };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Upload scan dokumen ke Google Drive:
 * Satu folder induk (dari Pengaturan), subfolder otomatis per Kode OS.
 */
function uploadDokumen(token, kodeOs, jenisDokumen, fileName, mimeType, base64Data) {
  var session = requireRole_(token, ['Admin', 'Checker', 'Dokumen/Checker', 'Drafter', 'Operasional']);
  if (!kodeOs || !fileName || !base64Data) {
    throw new Error('Data file dokumen tidak lengkap.');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var settings = getSettingsMap_(ss);
    var parentId = settings.DRIVE_PARENT_FOLDER_ID;
    var parentFolder;
    try {
      parentFolder = parentId ? DriveApp.getFolderById(parentId) : null;
    } catch (e) {
      parentFolder = null;
    }
    if (!parentFolder) {
      var existing = DriveApp.getFoldersByName('PTG_PPJK_Dokumen');
      parentFolder = existing.hasNext() ? existing.next() : DriveApp.createFolder('PTG_PPJK_Dokumen');
    }

    var subFolders = parentFolder.getFoldersByName(kodeOs);
    var subFolder = subFolders.hasNext() ? subFolders.next() : parentFolder.createFolder(kodeOs);

    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, mimeType || 'application/octet-stream', fileName);
    var file = subFolder.createFile(blob);
    var fileUrl = file.getUrl();

    var docSheet = ss.getSheetByName('Dokumen');
    var nowIso = new Date().toISOString();
    docSheet.appendRow([kodeOs, jenisDokumen || 'Dokumen Lainnya', fileUrl, nowIso, session.username]);

    appendLog_(ss, session.username, kodeOs, 'DOKUMEN_UPLOAD', '-', (jenisDokumen || '') + ': ' + fileName);
    invalidateCache_();
    return {
      kodeOs: kodeOs,
      jenisDokumen: jenisDokumen,
      linkDrive: fileUrl,
      waktuUpload: nowIso,
      user: session.username
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * CRUD Master Data (Customer, Importir, Shipper)
 */
function saveMasterItem(token, sheetName, item) {
  requireRole_(token, ['Admin', 'Checker', 'Dokumen/Checker']);
  var allowed = ['Customer', 'Importir', 'Shipper'];
  if (allowed.indexOf(sheetName) === -1) throw new Error('Master data tidak valid.');

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    var rows = sheet.getDataRange().getValues();
    var keyVal = sheetName === 'Customer'
      ? item.kodeCustomer
      : sheetName === 'Importir'
      ? item.kodeImportir
      : item.namaShipper;

    var rowVals = sheetName === 'Customer'
      ? [item.kodeCustomer, item.namaCustomer, item.kontak || '']
      : sheetName === 'Importir'
      ? [item.kodeImportir, item.namaImportir]
      : [item.namaShipper, item.negara || ''];

    var updated = false;
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(keyVal)) {
        sheet.getRange(i + 1, 1, 1, rowVals.length).setValues([rowVals]);
        updated = true;
        break;
      }
    }
    if (!updated) sheet.appendRow(rowVals);
    invalidateCache_();
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function deleteMasterItem(token, sheetName, keyVal) {
  requireRole_(token, ['Admin', 'Checker', 'Dokumen/Checker']);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(keyVal)) {
        sheet.deleteRow(i + 1);
        invalidateCache_();
        return { success: true };
      }
    }
    return { success: false };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Manajemen User (Khusus Admin)
 */
function saveUser(token, userPayload) {
  var session = requireRole_(token, ['Admin']);
  var username = String(userPayload.username || '').trim();
  if (!username) throw new Error('Username wajib diisi.');
  var role = String(userPayload.role || 'Manajer').trim();
  if (VALID_ROLES_.indexOf(role) === -1) {
    throw new Error('Peran user tidak valid.');
  }
  if (username.toLowerCase() === String(session.username || '').toLowerCase() && userPayload.aktif === false) {
    throw new Error('Admin tidak dapat menonaktifkan akunnya sendiri.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('User');
    var rows = sheet.getDataRange().getValues();
    var foundRow = -1;
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).toLowerCase() === username.toLowerCase()) {
        foundRow = i + 1;
        break;
      }
    }

    if (sheet.getLastColumn() < 8) {
      sheet.getRange(1, 8).setValue('PhasePermissions');
    }

    var resolvedPerms = resolveUserPhasePermissions_(
      role,
      userPayload.phasePermissions || (foundRow > 0 ? rows[foundRow - 1][7] : null)
    );
    var permsJson = JSON.stringify(resolvedPerms);

    if (foundRow > 0) {
      var salt = String(rows[foundRow - 1][2]);
      var hash = String(rows[foundRow - 1][1]);
      var mustChange = rows[foundRow - 1][6];
      if (userPayload.password && String(userPayload.password).trim() !== '') {
        if (String(userPayload.password).trim().length < 6) {
          throw new Error('Password baru minimal 6 karakter.');
        }
        salt = Utilities.getUuid().replace(/-/g, '').substring(0, 16);
        hash = computeSha256_(salt + ':' + String(userPayload.password).trim());
        mustChange = userPayload.mustChangePassword === true;
      }
      sheet.getRange(foundRow, 1, 1, 8).setValues([[
        username, hash, salt, userPayload.nama || username,
        role, userPayload.aktif !== false, mustChange, permsJson
      ]]);
    } else {
      if (!userPayload.password || String(userPayload.password).trim().length < 6) {
        throw new Error('Password user baru minimal 6 karakter.');
      }
      var newSalt = Utilities.getUuid().replace(/-/g, '').substring(0, 16);
      var newHash = computeSha256_(newSalt + ':' + String(userPayload.password).trim());
      sheet.appendRow([
        username, newHash, newSalt, userPayload.nama || username,
        role, userPayload.aktif !== false, userPayload.mustChangePassword === true, permsJson
      ]);
    }
    invalidateCache_();
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Simpan Pengaturan Sistem (Khusus Admin)
 */
function savePengaturan(token, settingsObj) {
  requireRole_(token, ['Admin']);
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Pengaturan');
    var rows = sheet.getDataRange().getValues();
    var updates = {
      DRIVE_PARENT_FOLDER_ID: settingsObj.driveParentFolderId || '',
      STATUS_LIST: JSON.stringify(settingsObj.statusList || DEFAULT_STATUS_LIST),
      CHECKLIST_ITEMS: JSON.stringify(settingsObj.checklistItems || DEFAULT_CHECKLIST_ITEMS),
      NOTIFICATION_EMAILS: JSON.stringify(settingsObj.notificationEmails || [])
    };

    var found = {};
    for (var i = 1; i < rows.length; i++) {
      var k = String(rows[i][0]);
      if (updates.hasOwnProperty(k)) {
        sheet.getRange(i + 1, 2).setValue(updates[k]);
        found[k] = true;
      }
    }
    Object.keys(updates).forEach(function (k) {
      if (!found[k]) sheet.appendRow([k, updates[k], '']);
    });

    invalidateCache_();
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Notifikasi Email Harian (Time-Driven Trigger)
 * - Shipment dengan ETA 3 hari lagi (belum ada No. SPPB)
 * - Shipment berstatus Jalur Merah atau MITA yang belum Selesai
 */
function sendDailyNotifications() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shipments = readShipments_(ss);
  var settings = getSettingsMap_(ss);
  var recipients = safeJsonParse_(settings.NOTIFICATION_EMAILS, []);
  if (!recipients || recipients.length === 0) return;

  var eta3DaysList = [];
  var jalurAlertList = [];

  for (var i = 0; i < shipments.length; i++) {
    var s = shipments[i];
    if (s.status === 'Selesai') continue;

    var cd = calculateCountdownEta_(s.eta);
    if (cd !== null && cd <= 3 && !s.noSppb) {
      eta3DaysList.push(s.kodeOs + ' | ' + s.namaCustomer + ' | BL: ' + s.noBl + ' | ETA: ' + s.eta + ' (' + cd + ' hari)');
    }
    if ((s.jalur === 'Merah' || s.jalur === 'MITA') && !s.noSppb) {
      jalurAlertList.push(s.kodeOs + ' | ' + s.namaCustomer + ' | Jalur: ' + s.jalur + ' | AJU: ' + (s.noAju || '-'));
    }
  }

  if (eta3DaysList.length === 0 && jalurAlertList.length === 0) return;

  var body = 'Laporan Notifikasi Harian PTG PPJK Outstanding\n' +
    'Tanggal: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd MMM yyyy HH:mm') + '\n\n';

  if (eta3DaysList.length > 0) {
    body += '=== SHIPMENT ETA <= 3 HARI / LEWAT (BELUM SPPB) ===\n' + eta3DaysList.join('\n') + '\n\n';
  }
  if (jalurAlertList.length > 0) {
    body += '=== SHIPMENT JALUR MERAH / MITA AKTIF ===\n' + jalurAlertList.join('\n') + '\n\n';
  }
  body += 'Silakan cek detail di Web App PTG PPJK Outstanding.';

  MailApp.sendEmail({
    to: recipients.join(','),
    subject: '[PTG PPJK] Peringatan Shipment Outstanding (' + (eta3DaysList.length + jalurAlertList.length) + ' item)',
    body: body
  });
}

// ============================================================================
// INTERNAL HELPERS (Batch Sheets I/O & Serialization)
// ============================================================================

function invalidateCache_() {
  CacheService.getScriptCache().remove(APP_CACHE_DATA_KEY);
}

function calculateCountdownEta_(etaStr) {
  if (!etaStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(etaStr).trim())) return null;
  var p = String(etaStr).trim().split('-');
  var etaDate = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((etaDate.getTime() - today.getTime()) / 86400000);
}

function formatDateCell_(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]') {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val).trim();
}

function safeJsonParse_(str, fallback) {
  if (!str) return fallback;
  if (typeof str === 'object') return str;
  try { return JSON.parse(String(str)); } catch (e) { return fallback; }
}

function getSettingsMap_(ss) {
  var sheet = ss.getSheetByName('Pengaturan');
  if (!sheet || sheet.getLastRow() <= 1) return {};
  var rows = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0]) map[String(rows[i][0])] = rows[i][1];
  }
  return map;
}

function readSimpleTable_(ss, sheetName, keys) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var rows = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < rows.length; i++) {
    var obj = {};
    var empty = true;
    for (var j = 0; j < keys.length; j++) {
      var val = rows[i][j];
      if (val !== '' && val !== null && val !== undefined) empty = false;
      obj[keys[j]] = Object.prototype.toString.call(val) === '[object Date]'
        ? val.toISOString()
        : (val === undefined || val === null ? '' : val);
    }
    if (!empty) result.push(obj);
  }
  return result;
}

function readKontainers_(ss) {
  var rows = readSimpleTable_(ss, 'Kontainer', ['kodeOs', 'noCont', 'ukuranTipe']);
  return rows.map(function (r, idx) {
    r.id = r.kodeOs + '_' + idx;
    return r;
  });
}

function syncContainers_(ss, kodeOs, containers) {
  var sheet = ss.getSheetByName('Kontainer');
  var rows = sheet.getDataRange().getValues();
  var kept = [rows[0]];
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== String(kodeOs)) {
      kept.push(rows[i]);
    }
  }
  for (var j = 0; j < containers.length; j++) {
    kept.push([kodeOs, String(containers[j].noCont || '').trim(), String(containers[j].ukuranTipe || '').trim()]);
  }
  sheet.clearContents();
  sheet.getRange(1, 1, kept.length, 3).setValues(kept);
}

function readUsersSanitized_(ss) {
  var sheet = ss.getSheetByName('User');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var rows = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    var role = String(rows[i][4]);
    list.push({
      username: String(rows[i][0]),
      nama: String(rows[i][3]),
      role: role,
      aktif: rows[i][5] === true || String(rows[i][5]).toUpperCase() === 'TRUE',
      mustChangePassword: rows[i][6] === true || String(rows[i][6]).toUpperCase() === 'TRUE',
      phasePermissions: resolveUserPhasePermissions_(role, rows[i][7])
    });
  }
  return list;
}

function readShipments_(ss) {
  var sheet = ss.getSheetByName('Shipment');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var rows = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push(rowToShipment_(rows[i]));
  }
  return out;
}

function rowToShipment_(r) {
  return {
    kodeOs: String(r[0] || ''),
    ship: String(r[1] || ''),
    kodeCustomer: String(r[2] || ''),
    namaCustomer: String(r[3] || ''),
    tglTerimaDok: formatDateCell_(r[4]),
    terimaDok: safeJsonParse_(r[5], { items: {}, catatan: '' }),
    noPackinglist: String(r[6] || ''),
    noBl: String(r[7] || ''),
    etd: formatDateCell_(r[8]),
    eta: formatDateCell_(r[9]),
    countDownEta: r[10] === '' ? null : Number(r[10]),
    noCont: String(r[11] || ''),
    noAju: String(r[12] || ''),
    tglAju: formatDateCell_(r[13]),
    status: String(r[14] || 'Dokumen Diterima'),
    nopen: String(r[15] || ''),
    tglNopen: formatDateCell_(r[16]),
    jalur: String(r[17] || ''),
    kodeImportir: String(r[18] || ''),
    shipper: String(r[19] || ''),
    description: String(r[20] || ''),
    negaraAsal: String(r[21] || ''),
    currency: String(r[22] || 'USD'),
    kurs: r[23] === '' ? '' : Number(r[23]),
    invoice: r[24] === '' ? '' : Number(r[24]),
    bmPdri: String(r[25] || ''),
    sptnp: String(r[26] || ''),
    noSppb: String(r[27] || ''),
    tglSppb: formatDateCell_(r[28]),
    dokumenChecker: String(r[29] || ''),
    noSptnp: String(r[30] || ''),
    tglSptnp: formatDateCell_(r[31]),
    pfpb: String(r[32] || ''),
    tglPfpb: formatDateCell_(r[33]),
    pfpd: String(r[34] || ''),
    tglPfpd: formatDateCell_(r[35]),
    eslah: String(r[36] || ''),
    tglEslah: formatDateCell_(r[37]),
    dokumenOs: safeJsonParse_(r[38], { items: {}, catatan: '' }),
    createdAt: String(r[39] || ''),
    createdBy: String(r[40] || ''),
    updatedAt: String(r[41] || ''),
    updatedBy: String(r[42] || ''),
    statusDokumen: String(r[43] || '') === 'Ready' ? 'Ready' : 'Draft',
    bc11Terbit: String(r[44] || '').toLowerCase() === 'true' || r[44] === true,
    noBc11: String(r[45] || ''),
    tglBc11: formatDateCell_(r[46])
  };
}

function shipmentToRow_(s) {
  return [
    s.kodeOs || '',
    s.ship || '',
    s.kodeCustomer || '',
    s.namaCustomer || '',
    s.tglTerimaDok || '',
    JSON.stringify(s.terimaDok || { items: {}, catatan: '' }),
    s.noPackinglist || '',
    s.noBl || '',
    s.etd || '',
    s.eta || '',
    s.countDownEta === null || s.countDownEta === undefined ? '' : s.countDownEta,
    s.noCont || '',
    s.noAju || '',
    s.tglAju || '',
    s.status || 'Dokumen Diterima',
    s.nopen || '',
    s.tglNopen || '',
    s.jalur || '',
    s.kodeImportir || '',
    s.shipper || '',
    s.description || '',
    s.negaraAsal || '',
    s.currency || 'USD',
    s.kurs === '' || s.kurs === undefined ? '' : Number(s.kurs),
    s.invoice === '' || s.invoice === undefined ? '' : Number(s.invoice),
    s.bmPdri || '',
    s.sptnp || '',
    s.noSppb || '',
    s.tglSppb || '',
    s.dokumenChecker || '',
    s.noSptnp || '',
    s.tglSptnp || '',
    s.pfpb || '',
    s.tglPfpb || '',
    s.pfpd || '',
    s.tglPfpd || '',
    s.eslah || '',
    s.tglEslah || '',
    JSON.stringify(s.dokumenOs || { items: {}, catatan: '' }),
    s.createdAt || '',
    s.createdBy || '',
    s.updatedAt || '',
    s.updatedBy || '',
    s.statusDokumen === 'Ready' ? 'Ready' : 'Draft',
    s.bc11Terbit ? 'true' : 'false',
    s.noBc11 || '',
    s.tglBc11 || ''
  ];
}

function appendLog_(ss, user, kodeOs, kolom, nilaiLama, nilaiBaru) {
  var logSheet = ss.getSheetByName('LogPerubahan');
  logSheet.appendRow([new Date().toISOString(), user, kodeOs, kolom, String(nilaiLama || ''), String(nilaiBaru || '')]);
}

function logShipmentDiff_(ss, user, kodeOs, oldObj, newObj) {
  var logSheet = ss.getSheetByName('LogPerubahan');
  var rowsToAdd = [];
  var nowIso = new Date().toISOString();
  var ignored = { countDownEta: true, createdAt: true, createdBy: true, updatedAt: true, updatedBy: true };

  Object.keys(newObj).forEach(function (key) {
    if (ignored[key]) return;
    var vOld = typeof oldObj[key] === 'object' ? JSON.stringify(oldObj[key]) : String(oldObj[key] === undefined || oldObj[key] === null ? '' : oldObj[key]);
    var vNew = typeof newObj[key] === 'object' ? JSON.stringify(newObj[key]) : String(newObj[key] === undefined || newObj[key] === null ? '' : newObj[key]);
    if (vOld !== vNew) {
      rowsToAdd.push([nowIso, user, kodeOs, key, vOld, vNew]);
    }
  });

  if (rowsToAdd.length > 0) {
    var startRow = logSheet.getLastRow() + 1;
    logSheet.getRange(startRow, 1, rowsToAdd.length, 6).setValues(rowsToAdd);
  }
}
