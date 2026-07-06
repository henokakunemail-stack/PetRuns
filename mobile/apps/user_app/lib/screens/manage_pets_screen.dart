import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:petwalk_core/petwalk_core.dart';

import 'pet_form_screen.dart';

/// Halaman manage pets — lihat, tambah, edit, hapus hewan peliharaan.
final class ManagePetsScreen extends ConsumerWidget {
  const ManagePetsScreen({super.key});

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref, PetModel pet) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Hapus Hewan'),
        content: Text('Yakin ingin menghapus ${pet.name}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Batal'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Hapus'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(petActionsProvider).delete(pet.id);
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('${pet.name} dihapus')));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Gagal menghapus: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final petsAsync = ref.watch(myPetsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Hewan Peliharaan'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'Tambah hewan',
            onPressed: () {
              Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const PetFormScreen()));
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
                  SizedBox(height: 8),
                  Text('Tekan + untuk menambahkan.', style: TextStyle(color: Colors.grey)),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(myPetsProvider),
            child: ListView.builder(
              itemCount: pets.length,
              itemBuilder: (_, index) {
                final pet = pets[index];
                return ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.pets)),
                  title: Text(pet.name),
                  subtitle: Text('${pet.species?.name ?? 'Unknown'} · ${pet.ageMonths} bulan'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.edit, size: 18),
                        tooltip: 'Edit',
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => PetFormScreen(pet: pet)),
                          );
                        },
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline, size: 18),
                        tooltip: 'Hapus',
                        onPressed: () => _confirmDelete(context, ref, pet),
                      ),
                    ],
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
