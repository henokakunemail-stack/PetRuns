import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../models/models.dart';

/// WorkerProfile dari API — diambil otomatis via /worker-profile/me.
final myWorkerProfileProvider = FutureProvider<WorkerProfileModel?>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.dio.get<Map<String, dynamic>>('/worker-profiles/me');
    final data = res.data;
    if (data == null) return null;
    return WorkerProfileModel.fromJson(data);
  } on DioException catch (e) {
    if (e.response?.statusCode == 404) return null;
    rethrow;
  }
});

/// Species expertise list untuk worker yang sedang login.
final myWorkerExpertiseProvider = FutureProvider<List<WorkerSpeciesExpertiseModel>>((ref) async {
  final client = ref.watch(apiClientProvider);
  final res = await client.dio.get<List<dynamic>>('/expertise');
  return (res.data ?? const [])
      .map((e) => WorkerSpeciesExpertiseModel.fromJson(e as Map<String, dynamic>))
      .toList();
});

/// Pricing tiers worker.
final myWorkerPricingProvider = FutureProvider<List<WorkerPricingModel>>((ref) async {
  final client = ref.watch(apiClientProvider);
  final res = await client.dio.get<List<dynamic>>('/pricing');
  return (res.data ?? const [])
      .map((e) => WorkerPricingModel.fromJson(e as Map<String, dynamic>))
      .toList();
});

/// Availability worker.
final myWorkerAvailabilityProvider = FutureProvider<List<WorkerAvailabilityModel>>((ref) async {
  final client = ref.watch(apiClientProvider);
  final res = await client.dio.get<List<dynamic>>('/availability');
  return (res.data ?? const [])
      .map((e) => WorkerAvailabilityModel.fromJson(e as Map<String, dynamic>))
      .toList();
});

/// Notifier untuk update worker profile fields (bio, service radius, dll).
final class WorkerProfileEditor extends Notifier<AsyncValue<WorkerProfileModel?>> {
  late final ApiClient _api;

  @override
  AsyncValue<WorkerProfileModel?> build() {
    _api = ref.watch(apiClientProvider);
    return const AsyncValue.loading();
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final res = await _api.dio.get<Map<String, dynamic>>('/worker-profiles/me');
      state = AsyncValue.data(WorkerProfileModel.fromJson(res.data!));
    } on DioException catch (e, st) {
      if (e.response?.statusCode == 404) {
        state = const AsyncValue.data(null);
      } else {
        state = AsyncValue.error(e, st);
      }
    }
  }

  Future<WorkerProfileModel> updateProfile({
    String? bio,
    String? bankName,
    String? bankAccountNumber,
    double? serviceRadiusKm,
    double? baseLatitude,
    double? baseLongitude,
  }) async {
    final res = await _api.dio.patch<Map<String, dynamic>>(
      '/worker-profiles/me',
      data: {
        if (bio != null) 'bio': bio,
        if (bankName != null) 'bankName': bankName,
        if (bankAccountNumber != null) 'bankAccountNumber': bankAccountNumber,
        if (serviceRadiusKm != null) 'serviceRadiusKm': serviceRadiusKm,
        if (baseLatitude != null) 'baseLatitude': baseLatitude,
        if (baseLongitude != null) 'baseLongitude': baseLongitude,
      },
    );
    final updated = WorkerProfileModel.fromJson(res.data!);
    state = AsyncValue.data(updated);
    ref.invalidate(myWorkerProfileProvider);
    return updated;
  }

  Future<void> setSpeciesExpertise(List<String> speciesIds) async {
    await _api.dio.put<List<dynamic>>(
      '/expertise',
      data: {'speciesIds': speciesIds},
    );
    ref.invalidate(myWorkerExpertiseProvider);
  }

  Future<void> setPricing(List<Map<String, dynamic>> entries) async {
    await _api.dio.put<List<dynamic>>(
      '/pricing',
      data: {'items': entries},
    );
    ref.invalidate(myWorkerPricingProvider);
  }

  Future<void> setAvailability(List<Map<String, dynamic>> entries) async {
    await _api.dio.put<List<dynamic>>(
      '/availability',
      data: {'items': entries},
    );
    ref.invalidate(myWorkerAvailabilityProvider);
  }
}

final workerProfileEditorProvider =
    NotifierProvider<WorkerProfileEditor, AsyncValue<WorkerProfileModel?>>(
  WorkerProfileEditor.new,
);