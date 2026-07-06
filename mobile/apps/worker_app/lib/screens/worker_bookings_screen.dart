import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:petwalk_core/petwalk_core.dart';

/// Bookings masuk untuk worker — terima/tolak/mulai/selesaikan sesi.
final class WorkerBookingsScreen extends ConsumerStatefulWidget {
  const WorkerBookingsScreen({super.key});

  @override
  ConsumerState<WorkerBookingsScreen> createState() => _WorkerBookingsScreenState();
}

final class _WorkerBookingsScreenState extends ConsumerState<WorkerBookingsScreen> {
  BookingStatus? _filter;
  String? _actingOnId;

  Future<void> _updateStatus(BookingModel booking, BookingStatus newStatus) async {
    setState(() => _actingOnId = booking.id);
    try {
      await ref.read(bookingActionsProvider).updateStatus(booking.id, newStatus);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal update status: $e')));
    } finally {
      if (mounted) setState(() => _actingOnId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bookingsAsync = ref.watch(myBookingsAsWorkerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Booking Masuk'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _filterChip('Semua', null),
                  const SizedBox(width: 8),
                  _filterChip('Pending', BookingStatus.pending),
                  const SizedBox(width: 8),
                  _filterChip('Diterima', BookingStatus.accepted),
                  const SizedBox(width: 8),
                  _filterChip('Berlangsung', BookingStatus.inProgress),
                  const SizedBox(width: 8),
                  _filterChip('Selesai', BookingStatus.completed),
                ],
              ),
            ),
          ),
        ),
      ),
      body: bookingsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Gagal memuat booking: $error')),
        data: (bookings) {
          final filtered = _filter == null
              ? bookings
              : bookings.where((b) => b.status == _filter).toList();

          if (filtered.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.inbox_outlined, size: 64, color: theme.colorScheme.outline),
                  const SizedBox(height: 16),
                  const Text('Belum ada booking.'),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(myBookingsAsWorkerProvider),
            child: ListView.builder(
              itemCount: filtered.length,
              itemBuilder: (_, index) => _BookingCard(
                booking: filtered[index],
                busy: _actingOnId == filtered[index].id,
                onUpdateStatus: _updateStatus,
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _filterChip(String label, BookingStatus? value) {
    return FilterChip(
      label: Text(label),
      selected: _filter == value,
      onSelected: (_) => setState(() => _filter = value),
    );
  }
}

final class _BookingCard extends StatelessWidget {
  const _BookingCard({required this.booking, required this.busy, required this.onUpdateStatus});

  final BookingModel booking;
  final bool busy;
  final void Function(BookingModel booking, BookingStatus newStatus) onUpdateStatus;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(booking.scheduledStart.toLocal().label, style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text('${booking.petName ?? 'Hewan'} · ${booking.durationMinutes} menit'),
            Text('Rp${booking.workerPayout.toStringAsFixed(0)} (setelah komisi platform)'),
            if (booking.ownerNotes?.isNotEmpty == true)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('Catatan: ${booking.ownerNotes}', style: const TextStyle(fontStyle: FontStyle.italic)),
              ),
            const SizedBox(height: 8),
            if (busy)
              const Align(alignment: Alignment.centerRight, child: CircularProgressIndicator())
            else
              _actionsFor(booking.status),
          ],
        ),
      ),
    );
  }

  Widget _actionsFor(BookingStatus status) {
    switch (status) {
      case BookingStatus.pending:
        return Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            OutlinedButton(
              onPressed: () => onUpdateStatus(booking, BookingStatus.rejected),
              child: const Text('Tolak'),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: () => onUpdateStatus(booking, BookingStatus.accepted),
              child: const Text('Terima'),
            ),
          ],
        );
      case BookingStatus.accepted:
        return Align(
          alignment: Alignment.centerRight,
          child: FilledButton(
            onPressed: () => onUpdateStatus(booking, BookingStatus.inProgress),
            child: const Text('Mulai Sesi'),
          ),
        );
      case BookingStatus.inProgress:
        return Align(
          alignment: Alignment.centerRight,
          child: FilledButton(
            onPressed: () => onUpdateStatus(booking, BookingStatus.completed),
            child: const Text('Selesaikan'),
          ),
        );
      case BookingStatus.completed:
      case BookingStatus.rejected:
      case BookingStatus.cancelled:
        return const SizedBox.shrink();
    }
  }
}

extension _Fmt on DateTime {
  String get label => DateFormat('EEE, d MMM y, HH:mm').format(this);
}
