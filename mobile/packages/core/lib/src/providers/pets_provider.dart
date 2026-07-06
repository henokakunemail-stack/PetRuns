import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../models/models.dart';

/// List species (Anjing, Kucing, Kelinci, dll) untuk dropdown saat tambah pet.
final speciesListProvider = FutureProvider<List<SpeciesModel>>((ref) async {
  final client = ref.watch(apiClientProvider);
  final response = await client.dio.get<List<dynamic>>('/species');
  final data = response.data ?? const [];
  return data.map((e) => SpeciesModel.fromJson(e as Map<String, dynamic>)).toList();
});

/// Breeds per species (untuk dropdown ras setelah pilih jenis hewan).
final breedsBySpeciesProvider =
    FutureProvider.family<List<BreedModel>, String>((ref, speciesId) async {
  final client = ref.watch(apiClientProvider);
  final response = await client.dio.get<List<dynamic>>(
    '/breeds',
    queryParameters: {'speciesId': speciesId},
  );
  final data = response.data ?? const [];
  return data.map((e) => BreedModel.fromJson(e as Map<String, dynamic>)).toList();
});

/// Daftar pet milik user yang sedang login (User App only).
final myPetsProvider = FutureProvider<List<PetModel>>((ref) async {
  final client = ref.watch(apiClientProvider);
  final tokens = ref.watch(tokenStorageProvider);
  final ownerId = tokens.userId;
  if (ownerId == null) return const [];

  final response = await client.dio.get<List<dynamic>>('/pets/owner/$ownerId');
  final data = response.data ?? const [];
  return data.map((e) => PetModel.fromJson(e as Map<String, dynamic>)).toList();
});

/// Aksi CRUD pet. ownerId TIDAK dikirim — backend mengambilnya dari JWT.
final class PetActions {
  PetActions(this._ref);
  final Ref _ref;

  ApiClient get _api => _ref.read(apiClientProvider);

  Future<PetModel> create({
    required String name,
    required String speciesId,
    String? breedId,
    int? ageMonths,
    double? weightKg,
    String? temperamentNotes,
    String? medicalNotes,
  }) async {
    final response = await _api.dio.post<Map<String, dynamic>>(
      '/pets',
      data: {
        'name': name,
        'speciesId': speciesId,
        if (breedId != null) 'breedId': breedId,
        if (ageMonths != null) 'ageMonths': ageMonths,
        if (weightKg != null) 'weightKg': weightKg,
        if (temperamentNotes != null) 'temperamentNotes': temperamentNotes,
        if (medicalNotes != null) 'medicalNotes': medicalNotes,
      },
    );
    _ref.invalidate(myPetsProvider);
    return PetModel.fromJson(response.data!);
  }

  Future<PetModel> update(
    String petId, {
    String? name,
    String? speciesId,
    String? breedId,
    int? ageMonths,
    double? weightKg,
    String? temperamentNotes,
    String? medicalNotes,
  }) async {
    final response = await _api.dio.patch<Map<String, dynamic>>(
      '/pets/$petId',
      data: {
        if (name != null) 'name': name,
        if (speciesId != null) 'speciesId': speciesId,
        if (breedId != null) 'breedId': breedId,
        if (ageMonths != null) 'ageMonths': ageMonths,
        if (weightKg != null) 'weightKg': weightKg,
        if (temperamentNotes != null) 'temperamentNotes': temperamentNotes,
        if (medicalNotes != null) 'medicalNotes': medicalNotes,
      },
    );
    _ref.invalidate(myPetsProvider);
    return PetModel.fromJson(response.data!);
  }

  Future<void> delete(String petId) async {
    await _api.dio.delete<Map<String, dynamic>>('/pets/$petId');
    _ref.invalidate(myPetsProvider);
  }
}

final petActionsProvider = Provider<PetActions>((ref) => PetActions(ref));
