# Freepik Video Studio

UI/UX dan frontend dibuat dengan Next.js, sedangkan backend memakai Express.js sebagai proxy aman untuk Freepik API. Project ini sekarang juga menyimpan asset video yang sudah selesai ke folder lokal project.

## Menjalankan project

1. Salin `backend/.env.example` menjadi `backend/.env`, lalu isi `FREEPIK_API_KEY`.
2. Jika ingin mengubah alamat backend di frontend, salin `frontend/.env.local.example` menjadi `frontend/.env.local`.
3. Jalankan `npm install` di root project.
4. Jalankan `npm run dev`.

Frontend akan berjalan di `http://localhost:3000` dan backend di `http://localhost:4000`.

## Penyimpanan asset

- Metadata asset tersimpan di `backend/storage/data/assets.json`
- File video tersimpan di `backend/storage/videos`
- Preview lokal memakai endpoint stream
- Download lokal memakai endpoint download

## Endpoint backend

- `GET /api/health`
- `POST /api/video/generate`
- `GET /api/video/tasks/:taskId?model=kling-v3-std`
- `GET /api/assets`
- `POST /api/assets/save`
- `GET /api/assets/:assetId/stream`
- `GET /api/assets/:assetId/download`
- `DELETE /api/assets/:assetId`

## Catatan Freepik

- API key Freepik harus tetap di backend menggunakan header `x-freepik-api-key`.
- Implementasi ini memakai alur async resmi Freepik: submit task lalu polling status.
- Model yang disiapkan: `kling-v3-std`, `kling-v3-pro`, `kling-v3-omni-std`, dan `runway-4-5-i2v`.
- Upload lokal gambar diarahkan ke `runway-4-5-i2v` karena mode ini menerima gambar Base64.
