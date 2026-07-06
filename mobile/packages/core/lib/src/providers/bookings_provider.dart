import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../models/models.dart';

/// Booking milik owner yang sedang login (GET /bookings/me/owner).
final myBookingsAsOwnerProvider = FutureProvider<List<BookingModel>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final response = await api.dio.get<List<dynamic>>('/bookings/me/owner');
  final data = response.data ?? const [];
  return data.map((e) => BookingModel.fromJson(e as Map<String, dynamic>)).toList();
});

/// Booking milik worker yang sedang login (GET /bookings/me/worker).
final myBookingsAsWorkerProvider = FutureProvider<List<BookingModel>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final response = await api.dio.get<List<dynamic>>('/bookings/me/worker');
  final data = response.data ?? const [];
  return data.map((e) => BookingModel.fromJson(e as Map<String, dynamic>)).toList();
});

/// Detail 1 booking (GET /bookings/:id).
final bookingDetailProvider = FutureProvider.family<BookingModel, String>((ref, id) async {
  final api = ref.watch(apiClientProvider);
  final response = await api.dio.get<Map<String, dynamic>>('/bookings/$id');
  return BookingModel.fromJson(response.data!);
});

/// Aksi terkait booking: create, ubah status, bayar, kasih rating.
/// Dipisah dari provider list di atas supaya UI bisa `ref.invalidate` list
/// setelah aksi berhasil tanpa depend langsung ke notifier state.
final class BookingActions {
  BookingActions(this._ref);
  final Ref _ref;

  ApiClient get _api => _ref.read(apiClientProvider);

  Future<BookingModel> create({
    required String workerProfileId,
    required String petId,
    required DateTime scheduledStart,
    required int durationMinutes,
    String? ownerNotes,
  }) async {
    final response = await _api.dio.post<Map<String, dynamic>>(
      '/bookings',
      data: {
        'workerProfileId': workerProfileId,
        'petId': petId,
        'scheduledStart': scheduledStart.toUtc().toIso8601String(),
        'durationMinutes': durationMinutes,
        if (ownerNotes != null) 'ownerNotes': ownerNotes,
      },
    );
    _ref.invalidate(myBookingsAsOwnerProvider);
    return BookingModel.fromJson(response.data!);
  }

  Future<BookingModel> updateStatus(String bookingId, BookingStatus status) async {
    final response = await _api.dio.patch<Map<String, dynamic>>(
      '/bookings/$bookingId/status',
      data: {'status': status.apiValue},
    );
    _ref.invalidate(myBookingsAsOwnerProvider);
    _ref.invalidate(myBookingsAsWorkerProvider);
    _ref.invalidate(bookingDetailProvider(bookingId));
    return BookingModel.fromJson(response.data!);
  }

  /// Mulai pembayaran Midtrans Snap untuk booking ini — return redirect URL
  /// untuk dibuka di WebView/browser.
  Future<String> createPayment(String bookingId) async {
    final response = await _api.dio.post<Map<String, dynamic>>(
      '/bookings/$bookingId/payment',
    );
    return response.data!['redirectUrl'] as String;
  }

  Future<void> submitReview(String bookingId, {required int rating, String? comment}) async {
    await _api.dio.post<Map<String, dynamic>>(
      '/bookings/$bookingId/review',
      data: {'rating': rating, if (comment != null) 'comment': comment},
    );
    _ref.invalidate(myBookingsAsOwnerProvider);
    _ref.invalidate(bookingDetailProvider(bookingId));
  }
}

final bookingActionsProvider = Provider<BookingActions>((ref) => BookingActions(ref));
