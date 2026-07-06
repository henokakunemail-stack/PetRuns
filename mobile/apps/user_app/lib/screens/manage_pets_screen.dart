import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:petwalk_core/petwalk_core.dart';

/// Halaman manage pets — lihat, tambah, edit, hapus hewan peliharaan.
final class ManagePetsScreen extends ConsumerWidget {
  const ManagePetsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final petsAsync = ref.watch(myPetsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Hewan Peliharaan'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () {
              // TODO: navigate to edit pet
            },
          ),
        ],
      ),
      body: petsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Error: $error')),
        data: (pets) {
          if (pets.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.pets_outlined, size: 64, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('Belum ada hewan peliharaan.'),
                ],
              ),
            );
          }
          return ListView.builder(
            itemCount: pets.length,
            itemBuilder: (_, index) {
              final pet = pets[index];
              return ListTile(
                leading: CircleAvatar(
                  child: Icon(Icons.pets),
                ),
                title: Text(pet.name),
                subtitle: Text('${pet.species?.name ?? 'Unknown'} · ${pet.ageMonths} bulan'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit, size: 18),
                      onPressed: () {},
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline, size: 18),
                      onPressed: () {},
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}