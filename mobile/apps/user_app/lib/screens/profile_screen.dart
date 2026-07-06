import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:petwalk_core/petwalk_core.dart';

/// Halaman profil user — edit nama, alamat, lokasi.
final class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(title: const Text('Profil Saya')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (user != null) ...[
            Center(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 40,
                    child: const Icon(Icons.person, size: 40),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    user.name,
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                  if (user.email != null) Text(user.email!),
                ],
              ),
            ),
            const Divider(height: 32),
            // TODO: add editable fields and save button
            const ListTile(
              leading: Icon(Icons.edit_note),
              title: Text('Edit Profil'),
              subtitle: Text('Nama, alamat, lokasi'),
              trailing: Icon(Icons.chevron_right),
            ),
            const Divider(height: 32),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: const Text(
                'Keluar',
                style: TextStyle(color: Colors.red),
              ),
              onTap: () {
                ref.read(authProvider.notifier).logout();
              },
            ),
          ],
        ],
      ),
    );
  }
}