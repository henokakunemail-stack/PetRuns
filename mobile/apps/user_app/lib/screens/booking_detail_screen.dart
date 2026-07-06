import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:petwalk_core/petwalk_core.dart';
import 'package:url_launcher/url_launcher.dart';

/// Detail 1 booking — status, pembayaran, dan form rating setelah selesai.
final class BookingDetailScreen extends ConsumerStatefulWidget {
  const BookingDetailScreen({super.key, required this.bookingId});
  final String bookingId;

  @override
  ConsumerState<BookingDetailScreen> createState() => _BookingDetailScreenState();
}

class _BookingDetailScreenState extends ConsumerState<BookingDetailScreen> {
  bool _payingNow = false;
  String? _actionError;

  Future<void> _pay() async {
    setState(() {
      _payingNow = true;
      _actionError = null;
    });
    try {
      final redirectUrl = await ref.read(bookingActionsProvider).createPayment(widget.bookingId);
      final uri = Uri.parse(redirectUrl);
      final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!launched) throw Exception('Tidak bisa membuka halaman pembayaran');
    } catch (e) {
      setState(() => _actionError = 'Gagal memulai pembayaran: $e');
    } finally {
      if (mounted) setState(() => _payingNow = false);
    }
  }

  Future<void> _showReviewDialog() async {
    var rating = 5;
    final commentController = TextEditingController();

    final submitted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: const Text('Beri Rating'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (i) {
                  final starValue = i + 1;
                  return IconButton(
                    icon: Icon(
                      starValue <= rating ? Icons.star : Icons.star_border,
                      color: Colors.amber,
                    ),
                    onPressed: () => setDialogState(() => rating = starValue),
                  );
                }),
              ),
              TextField(
                controller: commentController,
                decoration: const InputDecoration(hintText: 'Komentar (opsional)'),
                maxLines: 2,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Kirim'),
            ),
          ],
        ),
      ),
    );

    if (submitted != true || !mounted) return;

    try {
      await ref.read(bookingActionsProvider).submitReview(
            widget.bookingId,
            rating: rating,
            comment: commentController.text.trim().isEmpty ? null : commentController.text.trim(),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Terima kasih atas ratingnya!')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal mengirim rating: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final bookingAsync = ref.watch(bookingDetailProvider(widget.bookingId));

    return Scaffold(
      appBar: AppBar(title: const Text('Detail Booking')),
      body: bookingAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Gagal memuat booking: $error')),
        data: (booking) {
          final isPaid = booking.paymentStatus == 'paid';
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _row('Hewan', booking.petName ?? '-'),
                _row('Worker', booking.workerName ?? '-'),
                _row('Jadwal', booking.scheduledStart.toLocal().toString()),
                _row('Durasi', '${booking.durationMinutes} menit'),
                _row('Total', 'Rp${booking.priceTotal.toStringAsFixed(0)}'),
                _row('Status Booking', booking.status.apiValue),
                _row('Status Pembayaran', booking.paymentStatus ?? 'belum dibuat'),
                if (booking.ownerNotes?.isNotEmpty == true) _row('Catatan', booking.ownerNotes!),
                const SizedBox(height: 24),
                if (_actionError != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(_actionError!, style: const TextStyle(color: Colors.red)),
                  ),
                if (!isPaid)
                  FilledButton.icon(
                    onPressed: _payingNow ? null : _pay,
                    icon: const Icon(Icons.payment),
                    label: Text(_payingNow ? 'Membuka pembayaran...' : 'Bayar Sekarang'),
                  ),
                if (booking.status == BookingStatus.completed && !booking.hasReview)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: OutlinedButton.icon(
                      onPressed: _showReviewDialog,
                      icon: const Icon(Icons.star_border),
                      label: const Text('Beri Rating'),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(width: 140, child: Text(label, style: const TextStyle(color: Colors.grey))),
            Expanded(child: Text(value)),
          ],
        ),
      );
}
