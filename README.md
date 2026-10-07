# ระบบติดตามงานเคลม SSC

Web app สำหรับตรวจสอบและบันทึกงานเคลม 5 ขั้นตอน (ลูกค้า › SSC › SolarEdge) โดยใช้เลขเคลมเป็นหลัก และค้นหาจากรหัสสินค้า SN Case ID หรือเลขที่เบิกได้ ระบบทำงานเป็น Google Apps Script บน Google Sheet งานเคลม จึงอ่านและเขียนข้อมูลจากชีตโดยตรง

| ไฟล์ | หน้าที่ |
|---|---|
| `Code.gs` | ฝั่ง server: อ่านชีต เขียนเฉพาะช่องที่แก้ เพิ่มแถว และบันทึกลงแท็บ `ประวัติแก้ไข` |
| `Index.html` | หน้า Web app: ค้นหา ดูรายละเอียดเคลม บันทึกขั้นตอน รายงานตรวจสอบ 14 หัวข้อ แดชบอร์ดสรุปผล พิมพ์ใบเคลม A4 (PDF/PNG/XLSX) และสิทธิ์ Admin (ID + รหัสผ่าน)/ผู้ดู |
| `appsscript.json` | ค่าตั้งของโปรเจกต์ Apps Script (ใช้กับ `clasp push`) |
| `INSTALL.th.md` | วิธีติดตั้งทีละขั้นตอน |

## ติดตั้งด้วย clasp (ทางเลือก)
```
npm i -g @google/clasp
clasp login
clasp clone <SCRIPT_ID>   # Script ID ของ Apps Script ที่ผูกกับชีต
clasp push
```
`access` ใน `appsscript.json` ตั้งไว้เป็น `DOMAIN` (ทุกคนในองค์กร) ถ้าใช้บัญชี Gmail ส่วนตัวให้เปลี่ยนเป็น `ANYONE`
