/// API base URL — override lewat `--dart-define=API_BASE_URL=...` saat build/run.
/// Default `10.0.2.2` supaya Android emulator bisa reach backend NestJS yang
/// jalan di `localhost:3000` pada mesin host (127.0.0.1 di emulator = emulator itu sendiri).
final class AppConstants {
  AppConstants._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api',
  );
  static const Duration httpTimeout = Duration(seconds: 30);

  /// Komisi platform default (persen) — nilai sebenarnya dihitung backend
  /// dari PLATFORM_COMMISSION_PERCENT, ini cuma untuk estimasi tampilan di UI.
  static const double commissionRate = 0.20;
}
