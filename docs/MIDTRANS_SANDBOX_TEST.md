# Midtrans Sandbox Test

Gunakan checklist ini setelah `MIDTRANS_SERVER_KEY` sandbox asli diisi di `backend/.env`.

## 1. Setup
1. Pastikan backend berjalan dengan env sandbox:
   - `MIDTRANS_SERVER_KEY=SB-Mid-server-...`
   - `MIDTRANS_IS_PRODUCTION=false`
2. Di dashboard Midtrans sandbox, set Payment Notification URL ke:
   `https://<backend-public-url>/api/payments/webhook`

## 2. Flow Manual
1. Buat booking dari User App atau API.
2. Panggil `POST /api/bookings/:bookingId/payment` sebagai owner.
3. Buka `redirectUrl` dari respons.
4. Selesaikan pembayaran sandbox.
5. Pastikan webhook mengubah `Payment.status` menjadi `paid`.

## 3. Verifikasi Webhook Simulator
Gunakan Midtrans Dashboard Sandbox -> Settings -> Configuration -> Payment Notification URL tester.

Payload webhook harus membawa:
- `order_id`: booking id
- `status_code`
- `gross_amount`
- `transaction_status`
- `signature_key`

Backend akan menolak payload dengan signature salah memakai HTTP 403.
