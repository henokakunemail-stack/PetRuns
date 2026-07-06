/// Species: Anjing, Kucing, Kelinci, etc.
final class SpeciesModel {
  final String id;
  final String name;

  const SpeciesModel({required this.id, required this.name});

  factory SpeciesModel.fromJson(Map<String, dynamic> json) {
    return SpeciesModel(
      id: json['id'] as String,
      name: json['name'] as String,
    );
  }

  Map<String, dynamic> toJson() => {'id': id, 'name': name};
}

/// Breed: Golden Retriever, Husky, Persia, etc.
final class BreedModel {
  final String id;
  final String speciesId;
  final String name;

  const BreedModel({
    required this.id,
    required this.speciesId,
    required this.name,
  });

  factory BreedModel.fromJson(Map<String, dynamic> json) {
    return BreedModel(
      id: json['id'] as String,
      speciesId: json['speciesId'] as String,
      name: json['name'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'speciesId': speciesId,
        'name': name,
      };
}

/// Pet: a user's companion animal.
final class PetModel {
  final String id;
  final String ownerId;
  final String speciesId;
  final SpeciesModel? species;
  final String? breedId;
  final BreedModel? breed;
  final String name;
  final int ageMonths;
  final double? weightKg;
  final String? temperamentNotes;
  final String? medicalNotes;
  final String? photoUrl;

  const PetModel({
    required this.id,
    required this.ownerId,
    required this.speciesId,
    this.species,
    this.breedId,
    this.breed,
    required this.name,
    required this.ageMonths,
    this.weightKg,
    this.temperamentNotes,
    this.medicalNotes,
    this.photoUrl,
  });

  factory PetModel.fromJson(Map<String, dynamic> json) {
    return PetModel(
      id: json['id'] as String,
      ownerId: json['ownerId'] as String,
      speciesId: json['speciesId'] as String,
      species: json['species'] is Map<String, dynamic>
          ? SpeciesModel.fromJson(json['species'] as Map<String, dynamic>)
          : null,
      breedId: json['breedId'] as String?,
      breed: json['breed'] is Map<String, dynamic>
          ? BreedModel.fromJson(json['breed'] as Map<String, dynamic>)
          : null,
      name: json['name'] as String,
      ageMonths: json['ageMonths'] as int,
      weightKg: (json['weightKg'] as num?)?.toDouble(),
      temperamentNotes: json['temperamentNotes'] as String?,
      medicalNotes: json['medicalNotes'] as String?,
      photoUrl: json['photoUrl'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'ownerId': ownerId,
        'speciesId': speciesId,
        'breedId': breedId,
        'name': name,
        'ageMonths': ageMonths,
        'weightKg': weightKg,
        'temperamentNotes': temperamentNotes,
        'medicalNotes': medicalNotes,
        'photoUrl': photoUrl,
      };
}