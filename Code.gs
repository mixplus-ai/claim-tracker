/**
 * ระบบติดตามงานเคลม SSC — Google Apps Script web app
 * อ่าน/เขียนข้อมูลจาก Google Sheet งานเคลมโดยตรง (ข้อมูลสดเสมอ)
 * วางไฟล์นี้ใน ส่วนขยาย › Apps Script ของชีตงานเคลม
 */
const CONFIG = {
  SPREADSHEET_ID: '1P_bzAam7-MREtOz1Lw6gEPzryMVzSJOy8_Ly0zehui8', // ID ของไฟล์ชีตงานเคลม (อยู่ในลิงก์ระหว่าง /d/ กับ /edit)
  SHEET_GID: 200224574,    // gid ของแท็บฐานข้อมูล (ตัวเลขหลัง #gid= ในลิงก์ชีต)
  SHEET_NAME: '',          // ใช้เมื่อไม่ได้ใส่ SHEET_GID: ชื่อแท็บ เช่น 'Sheet1' (ว่าง = แท็บแรก)
  DATA_START_ROW: 6,       // แถวแรกของข้อมูล (แถว 1–5 เป็นหัวตาราง)
  LOG_SHEET: 'ประวัติแก้ไข' // ชีตเก็บประวัติการแก้ไขจาก Web app
};
const NCOL = 26; // คอลัมน์ A–Z
const COLS = ['pcode','vno','vdate','caseId','refId','claimNo','company','pickup','wh','qty',
  'issDoc','issDate','issSn','retPcode','retDoc','retDate','retSn','retNote',
  'rcvPcode','rcvDoc','rcvDate','rcvSn','okPcode','okDoc','okDate','okSn'];
const DATE_KEYS = ['vdate','issDate','retDate','rcvDate','okDate'];
const LABELS = ['รหัสสินค้า','เลขใบสำคัญ','วันที่ใบสำคัญ','Case ID','เลข SiteID (E)','เลขเคลม','ชื่อบริษัท','วันนัดรับ','รหัสเซลล์ (I)','จำนวน',
  'เลขที่เบิก MAC5','วันที่เบิก','SN เบิก','รหัสสินค้า (คืน)','เลขที่เบิก (คืน)','วันที่ (คืน)','SN คืน','หมายเหตุ',
  'รหัสสินค้า (รับ)','เลขที่เบิก (รับ)','วันที่ (รับ)','SN รับ','รหัสสินค้า (จ่าย)','เลขที่เบิก (จ่าย)','วันที่ (จ่าย)','SN จ่าย'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ระบบติดตามงานเคลม SSC')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** เปิดไฟล์ชีตจาก ID เสมอ ใช้ได้ทั้งสคริปต์ที่สร้างจากในชีตและสร้างแยกที่ script.google.com */
function ss_() {
  if (CONFIG.SPREADSHEET_ID) return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const ss = SpreadsheetApp.getActive();
  if (!ss) throw new Error('ไม่พบไฟล์ชีต ใส่ SPREADSHEET_ID ใน CONFIG');
  return ss;
}

function sheet_() {
  const ss = ss_();
  let sh = null;
  if (CONFIG.SHEET_GID !== '' && CONFIG.SHEET_GID != null) {
    sh = ss.getSheets().filter(function (x) { return x.getSheetId() === Number(CONFIG.SHEET_GID); })[0];
    if (!sh) throw new Error('ไม่พบแท็บ gid=' + CONFIG.SHEET_GID + ' ในไฟล์นี้ ตรวจว่า Apps Script ผูกกับชีตงานเคลมถูกไฟล์');
  } else {
    sh = CONFIG.SHEET_NAME ? ss.getSheetByName(CONFIG.SHEET_NAME) : ss.getSheets()[0];
    if (!sh) throw new Error('ไม่พบแท็บชื่อ "' + CONFIG.SHEET_NAME + '"');
  }
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
  let edited = '';
  try { edited = DriveApp.getFileById(ss_().getId()).getLastUpdated().getTime(); } catch (e) {}
  return p + ':' + edited + ':' + sheet_().getLastRow();
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
  const ss = ss_();
  let lg = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (!lg) {
    lg = ss.insertSheet(CONFIG.LOG_SHEET);
    lg.appendRow(['เวลา', 'ผู้แก้ไข', 'แถวในชีต', 'เลขเคลม', 'ช่อง', 'ค่าเดิม', 'ค่าใหม่']);
    lg.setFrozenRows(1);
  }
  lg.getRange(lg.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
}

function colA1_(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

/** ตรวจว่าแถวในชีตยังเป็นข้อมูลเดิม (กันเขียน/ลบผิดแถวเมื่อมีคนแทรกหรือลบแถวระหว่างนั้น) */
function check_(sh, row, expect, cache) {
  if (!(row >= CONFIG.DATA_START_ROW) || row > sh.getLastRow()) throw new Error('แถว ' + row + ' ไม่มีในชีตแล้ว กรุณากดรีเฟรช');
  const r = cache ? cache[row - CONFIG.DATA_START_ROW] : sh.getRange(row, 1, 1, NCOL).getDisplayValues()[0];
  Object.keys(expect || {}).forEach(function (k) {
    const j = COLS.indexOf(k);
    if (j >= 0 && String(r[j]).trim() !== String(expect[k] == null ? '' : expect[k]).trim())
      throw new Error('แถว ' + row + ' ในชีตถูกเปลี่ยนไปแล้ว กรุณากดรีเฟรชแล้วบันทึกใหม่');
  });
  if (!expect || !('claimNo' in expect)) throw new Error('ต้องระบุเลขเคลมของแถว ' + row);
  return r;
}

/**
 * บันทึกหลายอย่างในครั้งเดียว (ทำทั้งหมดหรือไม่ทำเลย ถ้าตรวจไม่ผ่าน)
 * b = {
 *   updates: [{row, expect:{claimNo,...}, patch:{key:value}}],   แก้ไขช่องในแถวเดิม
 *   inserts: {afterRow, afterExpect:{claimNo}, rows:[{key:value}]}, เพิ่มแถวต่อจากแถว afterRow (ไม่ระบุ = ต่อท้ายชีต)
 *   deletes: [{row, expect:{claimNo, issSn,...}}]                ลบทั้งแถว (เก็บค่าเดิมไว้ในประวัติ)
 * }
 */
function saveBatch(b) {
  b = b || {};
  const updates = b.updates || [], deletes = b.deletes || [], ins = b.inserts || null;
  const insRows = ins && ins.rows ? ins.rows : [];
  if (insRows.length > 300) throw new Error('เพิ่มได้ครั้งละไม่เกิน 300 แถว');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = sheet_(), who = Session.getActiveUser().getEmail() || '', now = new Date(), logs = [];
    // 1) ตรวจทุกแถวก่อน ยังไม่เขียนอะไร
    // อ่านทั้งชีตครั้งเดียวเมื่อแก้หลายแถว (เร็วกว่าอ่านทีละแถว)
    const many = updates.length + deletes.length > 15;
    const cache = many ? sh.getRange(CONFIG.DATA_START_ROW, 1, Math.max(1, sh.getLastRow() - CONFIG.DATA_START_ROW + 1), NCOL).getDisplayValues() : null;
    const cur = updates.map(function (u) { return check_(sh, u.row, u.expect, cache); });
    const del = deletes.map(function (d) { return { row: d.row, vals: check_(sh, d.row, d.expect, cache) }; });
    let after = null;
    if (insRows.length && ins.afterRow) { check_(sh, ins.afterRow, ins.afterExpect); after = ins.afterRow; }
    if (after !== null && del.some(function (d) { return d.row > after; })) throw new Error('ตำแหน่งเพิ่มแถวไม่ถูกต้อง กรุณากดรีเฟรช');
    // 2) แก้ไขช่อง (ไม่ทำให้เลขแถวเลื่อน)
    //    รวมช่องที่ได้ค่าเดียวกันแล้วเขียนครั้งเดียว (เช่นเลขที่ใบเบิกเดียวกันหลายแถว)
    const groups = {};
    updates.forEach(function (u, i) {
      Object.keys(u.patch || {}).forEach(function (k) {
        const j = COLS.indexOf(k);
        if (j < 0) return;
        const nv = String(u.patch[k] == null ? '' : u.patch[k]).trim();
        if (nv === String(cur[i][j]).trim()) return;
        const g = k + '\u0000' + nv;
        (groups[g] = groups[g] || { k: k, nv: nv, a1: [] }).a1.push(colA1_(j + 1) + u.row);
        logs.push([now, who, u.row, String(cur[i][5]).trim(), LABELS[j], cur[i][j], nv]);
      });
    });
    Object.keys(groups).forEach(function (g) {
      const x = groups[g], v = toCell_(x.k, x.nv);
      for (let i = 0; i < x.a1.length; i += 500) sh.getRangeList(x.a1.slice(i, i + 500)).setValue(v);
    });
    // 3) เพิ่มแถว ต่อจากแถวสุดท้ายของเคลม (อยู่ใต้แถวที่จะลบทั้งหมด จึงไม่กระทบเลขแถวที่ลบ)
    let firstRow = null;
    if (insRows.length) {
      const vals = insRows.map(function (o) { return COLS.map(function (k) { return toCell_(k, o[k]); }); });
      if (after !== null) { sh.insertRowsAfter(after, vals.length); firstRow = after + 1; }
      else firstRow = Math.max(sh.getLastRow() + 1, CONFIG.DATA_START_ROW);
      sh.getRange(firstRow, 1, vals.length, NCOL).setValues(vals);
      insRows.forEach(function (o, i) { logs.push([now, who, firstRow + i, String(o.claimNo || ''), 'เพิ่มแถวใหม่', '', String(o.pcode || '')]); });
    }
    // 4) ลบแถว จากล่างขึ้นบน
    del.sort(function (a, c) { return c.row - a.row; }).forEach(function (d) {
      sh.deleteRow(d.row);
      logs.push([now, who, d.row, String(d.vals[5]).trim(), 'ลบแถว', JSON.stringify(d.vals), '']);
    });
    log_(logs);
    if (logs.length) bump_();
    return { changed: logs.length, firstRow: firstRow };
  } finally { lock.releaseLock(); }
}

/** แก้ไขแถวเดิม: items = [{row, expect:{claimNo}, patch:{key:value}}] */
function updateRows(items) { return saveBatch({ updates: items }); }

/** เพิ่มแถวใหม่ต่อท้ายชีต: list = [{key:value}] */
function addRows(list) { return saveBatch({ inserts: { rows: list } }); }

/** ลบแถว: items = [{row, expect:{claimNo, issSn}}] */
function deleteRows(items) { return saveBatch({ deletes: items }); }
