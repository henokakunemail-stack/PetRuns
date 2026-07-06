import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../api/api_client.dart';
import '../models/models.dart';

/// Filter state untuk list worker. `speciesId` & `durationMinutes` wajib diisi
/// sebelum search bisa jalan — lihat SearchWorkersDto di backend.
final class WorkerFilter {
  final String? speciesId;
  final int durationMinutes;
  final double? maxPrice;
  final double? minRating;
  final String sortBy;

  const WorkerFilter({
    this.speciesId,
    this.durationMinutes = 60,
    this.maxPrice,
    this.minRating,
    this.sortBy = 'distance',
  });

  bool get isReadyToSearch => speciesId != null;

  WorkerFilter copyWith({
    String? speciesId,
    int? durationMinutes,
    double? maxPrice,
    double? minRating,
    String? sortBy,
  }) {
    return WorkerFilter(
      speciesId: speciesId ?? this.speciesId,
      durationMinutes: durationMinutes ?? this.durationMinutes,
      maxPrice: maxPrice ?? this.maxPrice,
      minRating: minRating ?? this.minRating,
      sortBy: sortBy ?? this.sortBy,
    );
  }
}

final class WorkerFilterNotifier extends Notifier<WorkerFilter> {
  @override
  WorkerFilter build() => const WorkerFilter();

  void update(WorkerFilter Function(WorkerFilter current) updater) {
    state = updater(state);
  }

  void reset() {
    state = const WorkerFilter();
  }
}

final workerFilterProvider =
    NotifierProvider<WorkerFilterNotifier, WorkerFilter>(WorkerFilterNotifier.new);

/// Hasil pencarian worker sesuai filter saat ini (GET /bookings/search-workers).
/// speciesId & durationMinutes wajib; lokasi diambil dari GPS device saat ini.
final searchWorkersProvider = FutureProvider<List<WorkerSearchResult>>((ref) async {
  final filter = ref.watch(workerFilterProvider);
  if (!filter.isReadyToSearch) return const [];

  final api = ref.watch(apiClientProvider);
  final position = await _getCurrentPosition();

  final response = await api.dio.get<List<dynamic>>(
    '/bookings/search-workers',
    queryParameters: {
      'speciesId': filter.speciesId,
      'durationMinutes': filter.durationMinutes,
      'latitude': position.latitude,
      'longitude': position.longitude,
      'sortBy': filter.sortBy,
      if (filter.maxPrice != null) 'maxPrice': filter.maxPrice,
      if (filter.minRating != null) 'minRating': filter.minRating,
    },
  );

  final data = response.data ?? const [];
  return data
      .map((e) => WorkerSearchResult.fromJson(e as Map<String, dynamic>))
      .toList();
});

Future<Position> _getCurrentPosition() async {
  final serviceEnabled = await Geolocator.isLocationServiceEnabled();
  if (!serviceEnabled) {
    throw StateError('Layanan lokasi tidak aktif — aktifkan GPS untuk mencari worker terdekat');
  }

  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
  }
  if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
    throw StateError('Izin lokasi ditolak — aktifkan izin lokasi untuk mencari worker terdekat');
  }

  return Geolocator.getCurrentPosition();
}

/// Detail 1 worker profile (untuk halaman detail sebelum booking).
final workerDetailProvider =
    FutureProvider.family<WorkerProfileModel, String>((ref, workerProfileId) async {
  final api = ref.watch(apiClientProvider);
  final response = await api.dio.get<Map<String, dynamic>>(
    '/worker-profiles/$workerProfileId',
  );
  return WorkerProfileModel.fromJson(response.data!);
});

/// Bentuk hasil `GET /bookings/search-workers` — bukan WorkerProfileModel penuh,
/// lihat BookingsService.searchWorkers() di backend untuk shape persisnya.
final class WorkerSearchResult {
  final String workerProfileId;
  final double distanceKm;
  final double? price;
  final double? averageRating;
  final double? serviceRadiusKm;
  final String workerName;
  final String? workerPhotoUrl;

  const WorkerSearchResult({
    required this.workerProfileId,
    required this.distanceKm,
    this.price,
    this.averageRating,
    this.serviceRadiusKm,
    required this.workerName,
    this.workerPhotoUrl,
  });

  factory WorkerSearchResult.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    return WorkerSearchResult(
      workerProfileId: json['workerProfileId'] as String,
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0,
      price: (json['price'] as num?)?.toDouble(),
      averageRating: (json['averageRating'] as num?)?.toDouble(),
      serviceRadiusKm: (json['serviceRadiusKm'] as num?)?.toDouble(),
      workerName: user?['name'] as String? ?? 'Worker',
      workerPhotoUrl: user?['profilePhotoUrl'] as String?,
    );
  }
}
