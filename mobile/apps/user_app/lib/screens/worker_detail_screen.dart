import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:petwalk_core/petwalk_core.dart';

import 'create_booking_screen.dart';

/// Detail profil worker — bio, pricing, & tombol booking.
final class WorkerDetailScreen extends ConsumerWidget {
  const WorkerDetailScreen({
    super.key,
    required this.workerProfileId,
    required this.durationMinutes,
  });

  final String workerProfileId;
  final int durationMinutes;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(workerDetailProvider(workerProfileId));

    return Scaffold(
      appBar: AppBar(title: const Text('Detail Worker')),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Gagal memuat profil: $error')),
        data: (profile) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const CircleAvatar(radius: 32, child: Icon(Icons.person, size: 32)),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${profile.averageRating.toStringAsFixed(1)} ⭐ · '
                            '${profile.totalCompletedSessions} sesi selesai',
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(profile.bio?.isNotEmpty == true ? profile.bio! : 'Belum ada bio.'),
                const SizedBox(height: 24),
                const Text('Harga per durasi', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                ...profile.pricing.map(
                  (p) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('${p.durationMinutes} menit'),
                    trailing: Text('Rp${p.price.toStringAsFixed(0)}'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: profileAsync.maybeWhen(
        data: (profile) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: FilledButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => CreateBookingScreen(
                      workerProfileId: workerProfileId,
                      durationMinutes: durationMinutes,
                    ),
                  ),
                );
              },
              child: const Text('Booking Sekarang'),
            ),
          ),
        ),
        orElse: () => null,
      ),
    );
  }
}
