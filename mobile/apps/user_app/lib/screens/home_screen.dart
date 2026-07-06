import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:petwalk_core/petwalk_core.dart';

import 'worker_detail_screen.dart';

/// Halaman utama — pencarian worker berdasarkan jenis hewan & lokasi GPS.
final class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(workerFilterProvider);
    final speciesAsync = ref.watch(speciesListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Cari Worker')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: speciesAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (error, _) => Text('Gagal memuat jenis hewan: $error'),
              data: (speciesList) {
                return DropdownButtonFormField<String>(
                  initialValue: filter.speciesId,
                  decoration: const InputDecoration(
                    labelText: 'Jenis hewan',
                    border: OutlineInputBorder(),
                  ),
                  items: speciesList
                      .map((s) => DropdownMenuItem(value: s.id, child: Text(s.name)))
                      .toList(),
                  onChanged: (value) {
                    ref.read(workerFilterProvider.notifier).update((f) => f.copyWith(speciesId: value));
                  },
                );
              },
            ),
          ),
          Expanded(
            child: !filter.isReadyToSearch
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        'Pilih jenis hewan untuk mulai mencari worker di sekitar Anda.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey),
                      ),
                    ),
                  )
                : _SearchResults(filter: filter),
          ),
        ],
      ),
    );
  }
}

final class _SearchResults extends ConsumerWidget {
  const _SearchResults({required this.filter});
  final WorkerFilter filter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resultsAsync = ref.watch(searchWorkersProvider);

    return resultsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text('Gagal mencari worker: $error', textAlign: TextAlign.center),
        ),
      ),
      data: (results) {
        if (results.isEmpty) {
          return const Center(child: Text('Belum ada worker yang cocok di sekitar Anda.'));
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(searchWorkersProvider),
          child: ListView.builder(
            itemCount: results.length,
            itemBuilder: (_, index) {
              final worker = results[index];
              return ListTile(
                leading: const CircleAvatar(child: Icon(Icons.person)),
                title: Text(worker.workerName),
                subtitle: Text(
                  '${worker.distanceKm.toStringAsFixed(1)} km · '
                  '${worker.averageRating?.toStringAsFixed(1) ?? '-'} ⭐',
                ),
                trailing: Text(
                  worker.price != null ? 'Rp${worker.price!.toStringAsFixed(0)}' : '-',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => WorkerDetailScreen(
                        workerProfileId: worker.workerProfileId,
                        durationMinutes: filter.durationMinutes,
                      ),
                    ),
                  );
                },
              );
            },
          ),
        );
      },
    );
  }
}
