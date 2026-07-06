/// Matches backend Booking.status string values exactly (lihat
/// backend/src/modules/bookings/lib/booking-status.util.ts) — bukan enum
/// Prisma, jadi harus tetap disinkronkan manual kalau backend berubah.
enum BookingStatus {
  pending,
  accepted,
  rejected,
  inProgress,
  completed,
  cancelled;

  String get apiValue {
    switch (this) {
      case BookingStatus.pending:
        return 'pending';
      case BookingStatus.accepted:
        return 'accepted';
      case BookingStatus.rejected:
        return 'rejected';
      case BookingStatus.inProgress:
        return 'in_progress';
      case BookingStatus.completed:
        return 'completed';
      case BookingStatus.cancelled:
        return 'cancelled';
    }
  }

  static BookingStatus fromString(String value) {
    switch (value) {
      case 'pending':
        return BookingStatus.pending;
      case 'accepted':
        return BookingStatus.accepted;
      case 'rejected':
        return BookingStatus.rejected;
      case 'in_progress':
        return BookingStatus.inProgress;
      case 'completed':
        return BookingStatus.completed;
      case 'cancelled':
        return BookingStatus.cancelled;
      default:
        return BookingStatus.pending;
    }
  }
}

final class BookingModel {
  final String id;
  final String ownerId;
  final String workerProfileId;
  final String petId;
  final DateTime scheduledStart;
  final int durationMinutes;
  final double priceTotal;
  final double platformCommission;
  final double workerPayout;
  final BookingStatus status;
  final String? ownerNotes;
  final DateTime? actualStart;
  final DateTime? actualEnd;
  final String? petName;
  final String? workerName;
  final String? paymentStatus;
  final bool hasReview;

  const BookingModel({
    required this.id,
    required this.ownerId,
    required this.workerProfileId,
    required this.petId,
    required this.scheduledStart,
    required this.durationMinutes,
    required this.priceTotal,
    required this.platformCommission,
    required this.workerPayout,
    required this.status,
    this.ownerNotes,
    this.actualStart,
    this.actualEnd,
    this.petName,
    this.workerName,
    this.paymentStatus,
    this.hasReview = false,
  });

  factory BookingModel.fromJson(Map<String, dynamic> json) {
    final statusStr = json['status'] as String? ?? 'pending';
    final pet = json['pet'] as Map<String, dynamic>?;
    final workerProfile = json['workerProfile'] as Map<String, dynamic>?;
    final workerUser = workerProfile?['user'] as Map<String, dynamic>?;
    final payment = json['payment'] as Map<String, dynamic>?;

    return BookingModel(
      id: json['id'] as String,
      ownerId: json['ownerId'] as String,
      workerProfileId: json['workerProfileId'] as String,
      petId: json['petId'] as String,
      scheduledStart: json['scheduledStart'] != null
          ? DateTime.parse(json['scheduledStart'] as String)
          : DateTime.now(),
      durationMinutes: json['durationMinutes'] as int? ?? 60,
      priceTotal: (json['priceTotal'] as num?)?.toDouble() ?? 0,
      platformCommission: (json['platformCommission'] as num?)?.toDouble() ?? 0,
      workerPayout: (json['workerPayout'] as num?)?.toDouble() ?? 0,
      status: BookingStatus.fromString(statusStr),
      ownerNotes: json['ownerNotes'] as String?,
      actualStart: json['actualStart'] != null
          ? DateTime.parse(json['actualStart'] as String)
          : null,
      actualEnd: json['actualEnd'] != null
          ? DateTime.parse(json['actualEnd'] as String)
          : null,
      petName: pet?['name'] as String?,
      workerName: workerUser?['name'] as String?,
      paymentStatus: payment?['status'] as String?,
      hasReview: json['review'] != null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'ownerId': ownerId,
        'workerProfileId': workerProfileId,
        'petId': petId,
        'scheduledStart': scheduledStart.toIso8601String(),
        'durationMinutes': durationMinutes,
        'priceTotal': priceTotal,
        'platformCommission': platformCommission,
        'workerPayout': workerPayout,
        'status': status.apiValue,
        'ownerNotes': ownerNotes,
        'actualStart': actualStart?.toIso8601String(),
        'actualEnd': actualEnd?.toIso8601String(),
      };
}
