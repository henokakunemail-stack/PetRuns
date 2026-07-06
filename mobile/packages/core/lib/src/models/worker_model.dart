import 'pet_model.dart' show SpeciesModel;

/// Worker Profile — data tambahan khusus worker.
final class WorkerProfileModel {
  final String id;
  final String userId;
  final String? bio;
  final String verificationStatus; // pending | approved | rejected
  final String? ktpDocumentUrl;
  final String? bankAccountNumber;
  final String? bankName;
  final double? serviceRadiusKm;
  final double? baseLatitude;
  final double? baseLongitude;
  final double averageRating;
  final int totalCompletedSessions;
  final List<WorkerPricingModel> pricing;
  final List<WorkerSpeciesExpertiseModel> speciesExpertise;
  final List<WorkerAvailabilityModel> availability;

  const WorkerProfileModel({
    required this.id,
    required this.userId,
    this.bio,
    this.verificationStatus = 'pending',
    this.ktpDocumentUrl,
    this.bankAccountNumber,
    this.bankName,
    this.serviceRadiusKm,
    this.baseLatitude,
    this.baseLongitude,
    this.averageRating = 0,
    this.totalCompletedSessions = 0,
    this.pricing = const [],
    this.speciesExpertise = const [],
    this.availability = const [],
  });

  factory WorkerProfileModel.fromJson(Map<String, dynamic> json) {
    return WorkerProfileModel(
      id: json['id'] as String,
      userId: json['userId'] as String,
      bio: json['bio'] as String?,
      verificationStatus: json['verificationStatus'] as String? ?? 'pending',
      ktpDocumentUrl: json['ktpDocumentUrl'] as String?,
      bankAccountNumber: json['bankAccountNumber'] as String?,
      bankName: json['bankName'] as String?,
      serviceRadiusKm: (json['serviceRadiusKm'] as num?)?.toDouble(),
      baseLatitude: (json['baseLatitude'] as num?)?.toDouble(),
      baseLongitude: (json['baseLongitude'] as num?)?.toDouble(),
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0,
      totalCompletedSessions: json['totalCompletedSessions'] as int? ?? 0,
      pricing: (json['pricing'] as List<dynamic>? ?? const [])
          .map((e) => WorkerPricingModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      speciesExpertise: (json['speciesExpertise'] as List<dynamic>? ?? const [])
          .map((e) => WorkerSpeciesExpertiseModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      availability: (json['availability'] as List<dynamic>? ?? const [])
          .map((e) => WorkerAvailabilityModel.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'bio': bio,
        'verificationStatus': verificationStatus,
        'ktpDocumentUrl': ktpDocumentUrl,
        'bankAccountNumber': bankAccountNumber,
        'bankName': bankName,
        'serviceRadiusKm': serviceRadiusKm,
        'baseLatitude': baseLatitude,
        'baseLongitude': baseLongitude,
        'averageRating': averageRating,
        'totalCompletedSessions': totalCompletedSessions,
        'pricing': pricing.map((p) => p.toJson()).toList(),
        'speciesExpertise': speciesExpertise.map((s) => s.toJson()).toList(),
        'availability': availability.map((a) => a.toJson()).toList(),
      };
}

/// Species expertise for a worker (many-to-many).
final class WorkerSpeciesExpertiseModel {
  final String id;
  final String workerProfileId;
  final String speciesId;
  final SpeciesModel? species;

  const WorkerSpeciesExpertiseModel({
    required this.id,
    required this.workerProfileId,
    required this.speciesId,
    this.species,
  });

  factory WorkerSpeciesExpertiseModel.fromJson(Map<String, dynamic> json) {
    return WorkerSpeciesExpertiseModel(
      id: json['id'] as String,
      workerProfileId: json['workerProfileId'] as String,
      speciesId: json['speciesId'] as String,
      species: json['species'] is Map<String, dynamic>
          ? SpeciesModel.fromJson(json['species'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'workerProfileId': workerProfileId,
        'speciesId': speciesId,
        'species': species?.toJson(),
      };
}

/// Pricing tier set by worker.
final class WorkerPricingModel {
  final String id;
  final int durationMinutes;
  final double price;

  const WorkerPricingModel({
    required this.id,
    required this.durationMinutes,
    required this.price,
  });

  factory WorkerPricingModel.fromJson(Map<String, dynamic> json) {
    return WorkerPricingModel(
      id: json['id'] as String,
      durationMinutes: json['durationMinutes'] as int,
      price: (json['price'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'durationMinutes': durationMinutes,
        'price': price,
      };
}

/// Availability slot for a worker.
final class WorkerAvailabilityModel {
  final String id;
  final int dayOfWeek; // 0 = Sunday … 6 = Saturday
  final String startTime; // HH:mm
  final String endTime;

  const WorkerAvailabilityModel({
    required this.id,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
  });

  factory WorkerAvailabilityModel.fromJson(Map<String, dynamic> json) {
    return WorkerAvailabilityModel(
      id: json['id'] as String,
      dayOfWeek: json['dayOfWeek'] as int,
      startTime: _toHHmm(json['startTime'] as String),
      endTime: _toHHmm(json['endTime'] as String),
    );
  }

  /// Backend mengirim kolom @db.Time sebagai ISO datetime penuh
  /// (contoh: "2000-01-01T09:00:00.000Z"), bukan "HH:mm" mentah.
  static String _toHHmm(String value) {
    if (RegExp(r'^\d{2}:\d{2}$').hasMatch(value)) return value;
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value;
    final hh = parsed.hour.toString().padLeft(2, '0');
    final mm = parsed.minute.toString().padLeft(2, '0');
    return '$hh:$mm';
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'dayOfWeek': dayOfWeek,
        'startTime': startTime,
        'endTime': endTime,
      };
}