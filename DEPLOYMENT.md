# Deployment Guide — Private Video Learning Platform

สถาปัตยกรรม: **FastAPI backend** (deploy บน Render) + **Next.js frontend** (deploy บน Vercel) + **PostgreSQL** (Neon) + **Google OAuth / Google Drive**.

```
Browser ──► Vercel (Next.js)  ──► Render (FastAPI /api)  ──► Neon Postgres
                                        │
                                        └──► Google Drive API (วิดีโอ/เอกสาร)
```

---

## 0. สิ่งที่ต้องเตรียม (ครั้งเดียว)

| ระบบ | ใช้ทำอะไร | ลิงก์ |
|------|-----------|-------|
| GitHub | เก็บโค้ด + รัน CI/CD | ต้อง push repo นี้ขึ้น GitHub ก่อน |
| Neon | ฐานข้อมูล PostgreSQL (ฟรี) | https://neon.tech |
| Render | รัน backend | https://render.com |
| Vercel | รัน frontend | https://vercel.com |
| Google Cloud | OAuth + Drive API | https://console.cloud.google.com |

---

## 1. สร้างฐานข้อมูล PostgreSQL (Neon)

1. สร้าง project ใหม่ใน Neon → เลือก region ใกล้ผู้ใช้
2. คัดลอก **connection string** — จะได้รูปแบบ:
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
3. เก็บไว้ใช้เป็นค่า `DATABASE_URL` ใน Render (ขั้นที่ 3)

> โค้ดจัดการ `postgres://` เก่าให้อัตโนมัติ (`database.py`) และเปิด `pool_pre_ping`
> เพื่อรีไซเคิล connection ที่ Neon ตัดทิ้งตอน idle — ไม่ต้องแก้อะไรเพิ่ม

---

## 2. ตั้งค่า Google OAuth + Drive

1. Google Cloud Console → **APIs & Services → Credentials → Create OAuth client ID** (Web application)
2. เปิดใช้งาน **Google Drive API** (APIs & Services → Library)
3. **Authorized redirect URIs** — ตอนแรกยังไม่รู้ URL จริง ใส่ placeholder ไปก่อน
   แล้วกลับมาแก้หลัง deploy backend เสร็จ (ขั้นที่ 3.4) ให้เป็น:
   ```
   https://<your-service>.onrender.com/api/auth/google/callback
   ```
4. เก็บ `GOOGLE_CLIENT_ID` และ `GOOGLE_CLIENT_SECRET`
5. หา **folder ID** ของโฟลเดอร์ Drive (วิดีโอ / เอกสาร) จาก URL:
   `https://drive.google.com/drive/folders/<FOLDER_ID>`

---

## 3. Deploy Backend (Render)

โปรเจกต์นี้มี **`render.yaml`** (Blueprint) อยู่แล้ว — Render จะอ่านและสร้าง service ให้อัตโนมัติ

1. Render Dashboard → **New + → Blueprint** → เลือก repo นี้
2. Render อ่าน `render.yaml`: runtime Python, `rootDir: backend`,
   build = `pip install -r requirements.txt`, start = `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. กรอก environment variables ที่ทำเครื่องหมาย `sync: false`:

   | Key | ค่า |
   |-----|-----|
   | `DATABASE_URL` | connection string จาก Neon (ขั้นที่ 1) |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | จาก Google (ขั้นที่ 2) |
   | `GOOGLE_REDIRECT_URI` | `https://<service>.onrender.com/api/auth/google/callback` |
   | `GOOGLE_DRIVE_FOLDER_VIDEO` / `_DOCUMENT` / `GOOGLE_DRIVE_ROOT_FOLDER` | folder IDs |
   | `FRONTEND_ORIGIN` | URL frontend บน Vercel (เช่น `https://your-app.vercel.app`) |
   | `ADMIN_USERNAME` / `ADMIN_PASSWORD` | บัญชี admin เริ่มต้น |

   > `JWT_SECRET` Render สุ่มให้อัตโนมัติ (`generateValue: true`) — ไม่ต้องกรอก
4. หลัง deploy สำเร็จ นำ URL จริง (`https://<service>.onrender.com`) ไป:
   - อัปเดต `GOOGLE_REDIRECT_URI` ใน Render **และ** ใน Google Cloud Console ให้ตรงกัน
5. ตรวจสอบ: เปิด `https://<service>.onrender.com/` ต้องได้ `{"status":"ok",...}`
   และ `/api/health` ต้องได้ `{"status":"healthy"}`

> **หมายเหตุ Render free plan:** service จะ "sleep" เมื่อไม่มีทราฟฟิก ~15 นาที
> คำขอแรกหลังหลับจะช้า ~30–60 วินาที (cold start)

---

## 4. Deploy Frontend (Vercel)

1. Vercel → **Add New → Project** → import repo นี้
2. ตั้ง **Root Directory** = `frontend`
3. Framework preset = **Next.js** (auto), build = `next build`
4. เพิ่ม environment variable ให้ frontend ชี้มาที่ backend:
   ```
   NEXT_PUBLIC_API_URL = https://<service>.onrender.com
   ```
   (frontend อ่านค่านี้ใน `src/lib/api.ts`)
5. Deploy → ได้ URL เช่น `https://your-app.vercel.app`
6. นำ URL นี้กลับไปใส่เป็น `FRONTEND_ORIGIN` ใน Render (สำคัญ ไม่งั้น CORS block)

---

## 5. ตั้งค่า CI/CD (GitHub Actions)

ไฟล์ `.github/workflows/ci-cd.yml` ทำงานดังนี้:

- **ทุก push / PR เข้า `main`** → `backend-test` (import app + ยิง `/` และ `/api/health`)
  และ `frontend-build` (`npm ci` + `next build`)
- **เฉพาะ push เข้า `main` และผ่านทั้งสอง job** → job `deploy` ยิง **deploy hook**
  ของ Render และ Vercel

### เพิ่ม GitHub Secrets (Settings → Secrets and variables → Actions)

| Secret | หาได้จาก |
|--------|----------|
| `RENDER_DEPLOY_HOOK_URL` | Render → service → Settings → **Deploy Hook** (คัดลอก URL) |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel → project → Settings → Git → **Deploy Hooks** → สร้างใหม่ |

> ถ้าไม่ตั้ง secret ทั้งสองตัว job `deploy` จะข้าม (แสดง warning) ไม่ทำให้ workflow ล้ม
>
> **ทางเลือก:** ทั้ง Render และ Vercel รองรับ auto-deploy เมื่อ push เข้า main อยู่แล้ว
> ถ้าเปิดใช้ auto-deploy ของ provider โดยตรง ก็ไม่จำเป็นต้องใช้ job `deploy` /
> deploy hook (ใช้ workflow แค่เป็น test gate ได้)

---

## 6. ลำดับ deploy ครั้งแรก (สรุป)

1. Neon → ได้ `DATABASE_URL`
2. Google Cloud → ได้ client id/secret + folder ids (redirect URI ใส่ทีหลัง)
3. Render Blueprint → deploy backend → ได้ URL backend
4. อัปเดต `GOOGLE_REDIRECT_URI` (Render + Google) ให้ตรงกัน
5. Vercel → deploy frontend → ได้ URL frontend
6. ใส่ `FRONTEND_ORIGIN` (= URL Vercel) ใน Render → backend redeploy
7. เพิ่ม GitHub Secrets → ต่อไป push main = auto test + deploy

---

## 7. Troubleshooting

| อาการ | สาเหตุ / วิธีแก้ |
|-------|------------------|
| Frontend เรียก API แล้วโดน CORS block | `FRONTEND_ORIGIN` ใน Render ไม่ตรงกับ URL Vercel เป๊ะ (ต้องรวม `https://` ไม่มี `/` ท้าย) |
| Login Google เด้ง error redirect_uri_mismatch | `GOOGLE_REDIRECT_URI` (Render) ไม่ตรงกับที่ลงทะเบียนใน Google Cloud |
| DB error `postgres://` scheme | จัดการให้แล้วใน `database.py` — ตรวจว่าใช้โค้ดล่าสุด |
| คำขอแรกช้ามาก | Render free cold start — ปกติ หรืออัปเกรด plan |
| ล็อกอิน admin ไม่ได้ | ตรวจ `ADMIN_USERNAME` / `ADMIN_PASSWORD`; admin ถูกสร้างเฉพาะครั้งแรกที่ตาราง users ว่าง |
