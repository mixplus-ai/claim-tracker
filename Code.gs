/**
 * ระบบติดตามงานเคลม SSC — Google Apps Script web app
 * อ่าน/เขียนข้อมูลจาก Google Sheet งานเคลมโดยตรง (ข้อมูลสดเสมอ)
 * วางไฟล์นี้ใน ส่วนขยาย › Apps Script ของชีตงานเคลม
 */
const CONFIG = {
  SHEET_NAME: '',          // เว้นว่าง = ใช้ชีตแรก หรือใส่ชื่อแท็บ เช่น 'Sheet1'
  DATA_START_ROW: 6,       // แถวแรกของข้อมูล (แถว 1–5 เป็นหัวตาราง)
  LOG_SHEET: 'ประวัติแก้ไข' // ชีตเก็บประวัติการแก้ไขจาก Web app
};
const NCOL = 26; // คอลัมน์ A–Z
const COLS = ['pcode','vno','vdate','caseId','refId','claimNo','company','pickup','wh','qty',
  'issDoc','issDate','issSn','retPcode','retDoc','retDate','retSn','retNote',
  'rcvPcode','rcvDoc','rcvDate','rcvSn','okPcode','okDoc','okDate','okSn'];
const DATE_KEYS = ['vdate','issDate','retDate','rcvDate','okDate'];
const LABELS = ['รหัสสินค้า','เลขใบสำคัญ','วันที่ใบสำคัญ','Case ID','เลขอ้างอิง (E)','เลขเคลม','ชื่อบริษัท','วันนัดรับ','รหัส (I)','จำนวน',
  'เลขที่เบิก MAC5','วันที่เบิก','SN เบิก','รหัสสินค้า (คืน)','เลขที่เบิก (คืน)','วันที่ (คืน)','SN คืน','หมายเหตุ',
  'รหัสสินค้า (รับ)','เลขที่เบิก (รับ)','วันที่ (รับ)','SN รับ','รหัสสินค้า (จ่าย)','เลขที่เบิก (จ่าย)','วันที่ (จ่าย)','SN จ่าย'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ระบบติดตามงานเคลม SSC')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  const sh = CONFIG.SHEET_NAME ? ss.getSheetByName(CONFIG.SHEET_NAME) : ss.getSheets()[0];
  if (!sh) throw new Error('ไม่พบแท็บชื่อ "' + CONFIG.SHEET_NAME + '"');
  return sh;
}

/** ข้อมูลทั้งหมด: values[i] คือแถว start+i (แถวว่างส่งเป็น []) */
function getData() {
  const sh = sheet_();
  const last = sh.getLastRow();
  const n = Math.max(0, last - CONFIG.DATA_START_ROW + 1);
  const vals = n ? sh.getRange(CONFIG.DATA_START_ROW, 1, n, NCOL).getDisplayValues() : [];
  return {
    start: CONFIG.DATA_START_ROW,
    values: vals.map(function (r) { return r.some(function (c) { return String(c).trim(); }) ? r : []; }),
    rev: getRev(),
    user: Session.getActiveUser().getEmail() || ''
  };
}

/** เลขเวอร์ชันข้อมูล: เปลี่ยนทุกครั้งที่มีการแก้ไข (จาก Web app หรือแก้ในชีตเอง) */
function getRev() {
  const p = PropertiesService.getScriptProperties().getProperty('rev') || '0';
  return p + ':' + sheet_().getLastRow();
}
function bump_() { PropertiesService.getScriptProperties().setProperty('rev', String(Date.now())); }
/** simple trigger: แก้ในชีตโดยตรงก็ทำให้ Web app รีเฟรช */
function onEdit(e) { bump_(); }

function toCell_(key, v) {
  v = v == null ? '' : String(v).trim();
  if (v === '') return '';
  if (DATE_KEYS.indexOf(key) >= 0) {
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  }
  if (key === 'qty' && /^\d+$/.test(v)) return Number(v);
  return "'" + v; // เก็บเป็นข้อความ กันชีตแปลง 23-0007 เป็นวันที่
}

function log_(rows) {
  if (!rows.length) return;
  const ss = SpreadsheetApp.getActive();
  let lg = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (!lg) {
    lg = ss.insertSheet(CONFIG.LOG_SHEET);
    lg.appendRow(['เวลา', 'ผู้แก้ไข', 'แถวในชีต', 'เลขเคลม', 'ช่อง', 'ค่าเดิม', 'ค่าใหม่']);
    lg.setFrozenRows(1);
  }
  lg.getRange(lg.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
}

/**
 * แก้ไขแถวเดิม: items = [{row, expect:{claimNo}, patch:{key:value}}]
 * ตรวจว่าแถวในชีตยังเป็นเลขเคลมเดิมก่อนเขียน (กันเขียนผิดแถวเมื่อมีคนแทรก/ลบแถว)
 */
function updateRows(items) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_(), who = Session.getActiveUser().getEmail() || '', now = new Date();
    const cur = items.map(function (it) {
      if (!(it.row >= CONFIG.DATA_START_ROW)) throw new Error('เลขแถวไม่ถูกต้อง');
      const r = sh.getRange(it.row, 1, 1, NCOL).getDisplayValues()[0];
      if (String(r[5]).trim() !== String(it.expect && it.expect.claimNo || '').trim())
        throw new Error('แถว ' + it.row + ' ในชีตถูกเปลี่ยนไปแล้ว กรุณากดรีเฟรชแล้วบันทึกใหม่');
      return r;
    });
    const logs = [];
    items.forEach(function (it, i) {
      Object.keys(it.patch || {}).forEach(function (k) {
        const j = COLS.indexOf(k);
        if (j < 0) return;
        const nv = String(it.patch[k] == null ? '' : it.patch[k]).trim();
        if (nv === String(cur[i][j]).trim()) return;
        sh.getRange(it.row, j + 1).setValue(toCell_(k, nv));
        logs.push([now, who, it.row, String(cur[i][5]).trim(), LABELS[j], cur[i][j], nv]);
      });
    });
    log_(logs);
    if (logs.length) bump_();
    return { changed: logs.length };
  } finally { lock.releaseLock(); }
}

/** เพิ่มแถวใหม่ต่อท้ายชีต: list = [{key:value}] */
function addRows(list) {
  if (!list || !list.length) return { added: 0 };
  if (list.length > 200) throw new Error('เพิ่มได้ครั้งละไม่เกิน 200 แถว');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_(), who = Session.getActiveUser().getEmail() || '', now = new Date();
    const at = Math.max(sh.getLastRow() + 1, CONFIG.DATA_START_ROW);
    const vals = list.map(function (o) { return COLS.map(function (k) { return toCell_(k, o[k]); }); });
    sh.getRange(at, 1, vals.length, NCOL).setValues(vals);
    log_(list.map(function (o, i) { return [now, who, at + i, String(o.claimNo || ''), 'เพิ่มแถวใหม่', '', String(o.pcode || '')]; }));
    bump_();
    return { added: vals.length, firstRow: at };
  } finally { lock.releaseLock(); }
}
