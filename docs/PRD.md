# Product Requirements Document (PRD) — PetWalk

## 1. Latar Belakang
Pemilik hewan peliharaan yang sibuk kesulitan meluangkan waktu mengajak hewan jalan-jalan secara rutin. PetWalk menghubungkan mereka dengan worker terpercaya di sekitar lokasi mereka.

## 2. Target Pengguna
- **Pet Owner**: pekerja kantoran/profesional sibuk, tinggal di kota besar, punya 1+ hewan peliharaan.
- **Worker**: individu yang ingin penghasilan tambahan/utama dari menjaga & mengajak hewan jalan-jalan, biasanya di sekitar area domisili mereka.

## 3. Aplikasi #1 — User App (Pet Owner)

### 3.1 Autentikasi & Profil
- Daftar/masuk (email, nomor HP, atau Google/Apple Sign-In)
- Profil pengguna: nama, foto, alamat, nomor kontak darurat
- Manajemen data hewan peliharaan (bisa lebih dari 1 hewan per akun):
  - Jenis hewan (species) — dropdown, default kategori: Anjing, Kucing, Kelinci, Lainnya
  - Breed/ras (khusus anjing: Golden Retriever, Husky, Pomeranian, Shih Tzu, Poodle, Local/Kampung, dll — bisa input manual jika tidak ada di list)
  - Umur, berat badan, foto hewan
  - Catatan khusus: alergi, riwayat medis, temperamen (agresif/jinak/takut orang asing), kebutuhan khusus (leash khusus, dll)

### 3.2 Pencarian & Pemilihan Worker
- List worker terdekat berdasarkan lokasi (GPS)
- Filter: jenis hewan yang dikuasai worker, harga, rating, jarak, ketersediaan waktu
- Detail profil worker: foto, bio, rating & review, pengalaman, jenis hewan yang biasa ditangani, harga per durasi, radius layanan
- Pilih durasi sesi (contoh: 30 menit / 60 menit / 90 menit — durasi & harga diatur oleh worker masing-masing)

### 3.3 Booking
- Pilih tanggal & jam sesuai slot ketersediaan worker
- Pilih hewan mana yang akan diajak (jika owner punya lebih dari 1)
- Catatan tambahan untuk worker (instruksi khusus)
- Konfirmasi & pembayaran di muka (in-app payment)
- Notifikasi saat worker menerima/menolak booking

### 3.4 Selama Sesi Berlangsung
- Status real-time: worker dalam perjalanan → sesi dimulai → sesi selesai
- (Fase 2) Live GPS tracking lokasi hewan & worker di peta
- (Fase 2) Chat langsung dengan worker

### 3.5 Setelah Sesi
- Ringkasan sesi (durasi aktual, foto/update dari worker jika ada)
- Rating & review worker (1-5 bintang + komentar)
- Riwayat booking & invoice

### 3.6 Lainnya
- Notifikasi push (booking diterima, worker on the way, sesi selesai, promo)
- Metode pembayaran tersimpan
- Riwayat transaksi & pengeluaran

---

## 4. Aplikasi #2 — Worker App

### 4.1 Pendaftaran & Verifikasi
- Daftar sebagai worker: data diri, KTP, foto profil, nomor rekening untuk payout
- (Opsional, open question) Sertifikasi handling hewan / pengalaman sebelumnya
- Status verifikasi: pending → approved → active (diverifikasi admin sebelum bisa menerima order)

### 4.2 Setup Profil Kerja
- Lokasi/area layanan (titik lokasi + radius, misal 5km dari titik tertentu)
- Jenis hewan yang dikuasai (many-to-many: bisa pilih beberapa: Anjing besar, Anjing kecil, Kucing, dll)
- Harga per durasi (worker menentukan sendiri tarif per 30/60/90 menit, dst — fleksibel bukan fixed slot)
- Bio singkat & pengalaman
- Foto profil & foto/video contoh kerja (opsional)

### 4.3 Manajemen Ketersediaan
- Kalender ketersediaan (set jam kerja per hari)
- Toggle status: available / unavailable / sedang bertugas

### 4.4 Manajemen Booking
- Notifikasi booking masuk → terima/tolak (dengan batas waktu respon)
- Detail booking: info hewan, lokasi jemput, durasi, catatan owner
- Navigasi ke lokasi pet owner (integrasi Google Maps)
- Tombol "Mulai Sesi" → "Selesai Sesi"
- (Fase 2) Update foto/status selama sesi ke owner

### 4.5 Pendapatan
- Riwayat pendapatan per transaksi (breakdown: total dibayar user, komisi platform, pendapatan bersih worker)
- Saldo & penarikan dana (payout)
- Statistik: jumlah sesi selesai, rating rata-rata

---

## 5. Admin Dashboard (Web)
- Manajemen & verifikasi akun worker (approve/reject, lihat dokumen)
- Monitoring semua transaksi/booking real-time
- Manajemen komplain & dispute (hewan hilang, worker tidak datang, dll)
- Laporan keuangan (total transaksi, komisi platform, payout worker)
- Manajemen data master: kategori species & breed hewan
- Manajemen konten promo/notifikasi broadcast

---

## 6. Fitur MVP vs Fase 2

### MVP (Rilis Pertama)
- Registrasi & profil user + worker
- Manajemen data hewan (species & breed)
- List & filter worker berdasarkan lokasi + jenis hewan
- Booking dengan pilihan durasi & jadwal
- Pembayaran in-app
- Terima/tolak booking oleh worker
- Rating & review
- Notifikasi dasar (push notification)
- Admin dashboard: verifikasi worker & monitoring transaksi dasar

### Fase 2 (Setelah MVP Stabil)
- Live GPS tracking selama sesi
- Chat in-app real-time
- Kalender ketersediaan yang lebih kompleks (recurring booking/booking rutin mingguan)
- Foto/update selama sesi
- Sistem dispute & refund otomatis
- Program referral/promo

## 7. Metrik Keberhasilan (untuk dipantau setelah launch)
- Jumlah worker aktif terverifikasi
- Jumlah booking selesai per minggu
- Retention rate user (booking berulang)
- Rating rata-rata worker
- Waktu rata-rata worker merespon booking
