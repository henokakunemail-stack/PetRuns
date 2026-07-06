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
