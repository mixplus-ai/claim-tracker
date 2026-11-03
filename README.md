# ระบบติดตามงานเคลม SSC

Web app สำหรับตรวจสอบและบันทึกงานเคลม 5 ขั้นตอน (ลูกค้า › SSC › SolarEdge) โดยใช้เลขเคลมเป็นหลัก และค้นหาจากรหัสสินค้า SN Case ID หรือเลขที่เบิกได้ ข้อมูลอ่านและเขียนจาก Google Sheet งานเคลมโดยตรง

```
เบราว์เซอร์ ──► Netlify (web/ หน้าเว็บ static)
     │
     └── fetch POST JSON ──► Google Apps Script (apps-script/Code.gs) ──► Google Sheet
```

| ไฟล์ | หน้าที่ |
|---|---|
| `web/index.html` | หน้าเว็บ: ค้นหา รายละเอียดเคลม บันทึกขั้นตอน รายงานตรวจสอบ แดชบอร์ด พิมพ์ใบเคลม A4 (PDF/PNG/XLSX) สิทธิ์ Admin/ผู้ดู |
| `web/config.js` | ที่อยู่ API (Netlify เขียนทับตอน build จากตัวแปร `CLAIM_API_URL`) |
| `apps-script/Code.gs` | API: `doPost` รับ `{fn, args, token, vtoken}` ตอบ `{ok, data}` หรือ `{ok:false, code, error}` |
| `apps-script/appsscript.json` | ค่าตั้งของ Apps Script (เรียกใช้ในฐานะเจ้าของ เข้าถึงได้ทุกคน) สำหรับ `clasp push` |
| `netlify.toml` | ค่า build และ security headers ของ Netlify |
| `scripts/build-config.mjs` | สร้าง `web/config.js` จาก `CLAIM_API_URL` ตอน build |
| `INSTALL.th.md` | วิธีติดตั้งทีละขั้นตอน |

## สิทธิ์การใช้งาน
- **ผู้ดู**: ดูได้อย่างเดียว ถ้าตั้งรหัสผู้ดู (`setupViewer`) ต้องใส่รหัสก่อน ได้ token ลงลายมือชื่อ HMAC อายุ 30 วัน
- **Admin**: ID + รหัสผ่าน (`setupAdmins` เก็บแบบ salted SHA-256) ได้ token ใน CacheService อายุ 6 ชั่วโมง ใช้กับทุกคำสั่งที่เขียนชีต

## พัฒนาในเครื่อง
เปิด `web/` ด้วย static server ใดก็ได้ (เช่น `npx serve web`) แล้วใส่ URL `/exec` ใน `web/config.js` ชั่วคราว (อย่า commit)

## Apps Script ด้วย clasp (ทางเลือก)
```
npm i -g @google/clasp
clasp login
clasp clone <SCRIPT_ID> --rootDir apps-script
clasp push
```
