# Google Play Data Safety Declarations — PetMatch

Dokumen ini memetakan deklarasi Data Safety untuk pengajuan PetMatch ke Google Play Console.

## 1. Data Collection & Sharing Summary

| Kategori Data | Jenis Data | Dikumpulkan? | Dibagikan ke Pihak Ketiga? | Tujuan Penggunaan | Terenkripsi saat Transit? | User dapat meminta penghapusan? |
|---|---|---|---|---|---|---|
| **Location** | Approximate Location | Ya | Tidak | App functionality, nearby discovery | Ya (TLS 1.3) | Ya (via Account Deletion) |
| **Location** | Precise Location | Ya | Tidak | Live walk route tracking, GPS check-in | Ya (TLS 1.3) | Ya |
| **Personal Info** | Name | Ya | Tidak | Account management, profile display | Ya (TLS 1.3) | Ya |
| **Personal Info** | Phone Number | Ya | Verihubs (SMS OTP verification) | Authentication, account security | Ya (TLS 1.3 + AES-256 field encryption) | Ya |
| **Personal Info** | Government ID (KTP) | Ya (Worker only) | Verihubs (KYC Biometric verification) | Identity verification & trust safety | Ya (SSE-KMS + AES-256 encryption) | Ya |
| **Financial Info** | Payment info & transaction history | Ya | Midtrans / Xendit (Payment Gateway) | Escrow payment hold, payout capture | Ya (TLS 1.3) | Ya |
| **Photos & Videos** | Photos | Ya | AWS S3 (SSE-KMS) | Profile picture, KYC KTP, walk check-in proof | Ya (TLS 1.3) | Ya |
| **App Activity** | In-app messages | Ya | Tidak | Communication between owner & worker | Ya (AES-256-GCM encrypted) | Ya |

## 2. Security Practices

- **Encryption in Transit**: Seluruh data ditransmisikan menggunakan TLS 1.3 dengan HTTPS / WSS.
- **Field-Level Encryption at Rest**: Data sensitif (Nomor HP, NIK KTP, pesan chat) dienkripsi menggunakan AES-256-GCM dan master key di AWS KMS.
- **Account Deletion Mechanism**: Pengguna dapat menghapus akun kapan saja melalui `POST /users/account` sesuai Google Play Policy dan Apple Guideline 5.1.1(v).
- **ProGuard & Hermes**: Bytecode Hermes dan aturan ProGuard aktif untuk mencegah modifikasi APK dan reverse engineering.
- **Mock Location Suppression**: Deteksi mock GPS aktif pada worker app untuk menjamin integritas pelacakan jalan.
