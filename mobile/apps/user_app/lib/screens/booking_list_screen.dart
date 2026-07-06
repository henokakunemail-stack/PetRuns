import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:petwalk_core/petwalk_core.dart';

import 'booking_detail_screen.dart';

/// Riwayat booking milik owner yang sedang login.
final class BookingListScreen extends ConsumerWidget {
  const BookingListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookingsAsync = ref.watch(myBookingsAsOwnerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Booking Saya')),
      body: bookingsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Gagal memuat booking: $error')),
        data: (bookings) {
          if (bookings.isEmpty) {
            return const Center(child: Text('Belum ada booking.'));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(myBookingsAsOwnerProvider),
            child: ListView.builder(
              itemCount: bookings.length,
              itemBuilder: (_, index) {
                final booking = bookings[index];
                return ListTile(
                  leading: Icon(_statusIcon(booking.status)),
                  title: Text(_formatDate(booking.scheduledStart)),
                  subtitle: Text(_statusLabel(booking.status)),
                  trailing: Text('Rp${booking.priceTotal.toStringAsFixed(0)}'),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => BookingDetailScreen(bookingId: booking.id)),
                    );
                  },
                );
              },
            ),
          );
        },
      ),
    );
  }
}

String _formatDate(DateTime dt) {
  final local = dt.toLocal();
  return '${local.day}/${local.month}/${local.year} ${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
}

String _statusLabel(BookingStatus status) {
  switch (status) {
    case BookingStatus.pending:
      return 'Menunggu konfirmasi worker';
    case BookingStatus.accepted:
      return 'Diterima — menunggu jadwal';
    case BookingStatus.rejected:
      return 'Ditolak worker';
    case BookingStatus.inProgress:
      return 'Sedang berlangsung';
    case BookingStatus.completed:
      return 'Selesai';
    case BookingStatus.cancelled:
      return 'Dibatalkan';
  }
}

IconData _statusIcon(BookingStatus status) {
  switch (status) {
    case BookingStatus.pending:
      return Icons.hourglass_empty;
    case BookingStatus.accepted:
      return Icons.event_available;
    case BookingStatus.rejected:
      return Icons.cancel_outlined;
    case BookingStatus.inProgress:
      return Icons.directions_walk;
    case BookingStatus.completed:
      return Icons.check_circle_outline;
    case BookingStatus.cancelled:
      return Icons.block;
  }
}
