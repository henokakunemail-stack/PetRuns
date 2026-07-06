import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:petwalk_core/petwalk_core.dart';

/// Form tambah/edit hewan peliharaan. Jika [pet] null berarti mode tambah.
final class PetFormScreen extends ConsumerStatefulWidget {
  const PetFormScreen({super.key, this.pet});
  final PetModel? pet;

  @override
  ConsumerState<PetFormScreen> createState() => _PetFormScreenState();
}

class _PetFormScreenState extends ConsumerState<PetFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _ageController;
  late final TextEditingController _weightController;
  late final TextEditingController _temperamentController;
  late final TextEditingController _medicalController;
  String? _speciesId;
  String? _breedId;
  bool _saving = false;

  bool get _isEdit => widget.pet != null;

  @override
  void initState() {
    super.initState();
    final pet = widget.pet;
    _nameController = TextEditingController(text: pet?.name ?? '');
    _ageController = TextEditingController(text: pet?.ageMonths.toString() ?? '');
    _weightController = TextEditingController(text: pet?.weightKg?.toString() ?? '');
    _temperamentController = TextEditingController(text: pet?.temperamentNotes ?? '');
    _medicalController = TextEditingController(text: pet?.medicalNotes ?? '');
    _speciesId = pet?.speciesId;
    _breedId = pet?.breedId;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _ageController.dispose();
    _weightController.dispose();
    _temperamentController.dispose();
    _medicalController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_speciesId == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Pilih jenis hewan dulu')));
      return;
    }

    setState(() => _saving = true);
    try {
      final actions = ref.read(petActionsProvider);
      final name = _nameController.text.trim();
      final ageMonths = int.tryParse(_ageController.text.trim());
      final weightKg = double.tryParse(_weightController.text.trim());
      final temperament = _temperamentController.text.trim();
      final medical = _medicalController.text.trim();

      if (_isEdit) {
        await actions.update(
          widget.pet!.id,
          name: name,
          speciesId: _speciesId,
          breedId: _breedId,
          ageMonths: ageMonths,
          weightKg: weightKg,
          temperamentNotes: temperament.isEmpty ? null : temperament,
          medicalNotes: medical.isEmpty ? null : medical,
        );
      } else {
        await actions.create(
          name: name,
          speciesId: _speciesId!,
          breedId: _breedId,
          ageMonths: ageMonths,
          weightKg: weightKg,
          temperamentNotes: temperament.isEmpty ? null : temperament,
          medicalNotes: medical.isEmpty ? null : medical,
        );
      }

      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_isEdit ? 'Data hewan diperbarui' : 'Hewan berhasil ditambahkan')),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal menyimpan: $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final speciesAsync = ref.watch(speciesListProvider);

    return Scaffold(
      appBar: AppBar(title: Text(_isEdit ? 'Edit Hewan' : 'Tambah Hewan')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Nama', border: OutlineInputBorder()),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Wajib diisi' : null,
            ),
            const SizedBox(height: 16),
            speciesAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (error, _) => Text('Gagal memuat jenis hewan: $error'),
              data: (speciesList) => DropdownButtonFormField<String>(
                initialValue: _speciesId,
                decoration:
                    const InputDecoration(labelText: 'Jenis Hewan', border: OutlineInputBorder()),
                items: speciesList
                    .map((s) => DropdownMenuItem(value: s.id, child: Text(s.name)))
                    .toList(),
                onChanged: (v) => setState(() {
                  _speciesId = v;
                  _breedId = null; // reset ras saat ganti jenis
                }),
              ),
            ),
            const SizedBox(height: 16),
            if (_speciesId != null) _BreedDropdown(
              speciesId: _speciesId!,
              value: _breedId,
              onChanged: (v) => setState(() => _breedId = v),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _ageController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        labelText: 'Umur (bulan)', border: OutlineInputBorder()),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _weightController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                        labelText: 'Berat (kg)', border: OutlineInputBorder()),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _temperamentController,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Temperamen (opsional)',
                hintText: 'Contoh: jinak, takut orang asing',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _medicalController,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Catatan medis (opsional)',
                hintText: 'Contoh: alergi ayam',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: Text(_saving ? 'Menyimpan...' : 'Simpan'),
            ),
          ],
        ),
      ),
    );
  }
}

final class _BreedDropdown extends ConsumerWidget {
  const _BreedDropdown({required this.speciesId, required this.value, required this.onChanged});
  final String speciesId;
  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final breedsAsync = ref.watch(breedsBySpeciesProvider(speciesId));

    return breedsAsync.when(
      loading: () => const LinearProgressIndicator(),
      error: (error, _) => Text('Gagal memuat ras: $error'),
      data: (breeds) {
        if (breeds.isEmpty) return const SizedBox.shrink();
        return DropdownButtonFormField<String>(
          initialValue: value,
          decoration: const InputDecoration(
              labelText: 'Ras (opsional)', border: OutlineInputBorder()),
          items: [
            const DropdownMenuItem<String>(value: null, child: Text('Tidak tahu / campuran')),
            ...breeds.map((b) => DropdownMenuItem(value: b.id, child: Text(b.name))),
          ],
          onChanged: onChanged,
        );
      },
    );
  }
}
