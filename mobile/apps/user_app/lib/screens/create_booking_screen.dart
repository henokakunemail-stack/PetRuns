import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:petwalk_core/petwalk_core.dart';

/// Form booking: pilih hewan, tanggal & jam mulai, lalu submit.
final class CreateBookingScreen extends ConsumerStatefulWidget {
  const CreateBookingScreen({
    super.key,
    required this.workerProfileId,
    required this.durationMinutes,
  });

  final String workerProfileId;
  final int durationMinutes;

  @override
  ConsumerState<CreateBookingScreen> createState() => _CreateBookingScreenState();
}

class _CreateBookingScreenState extends ConsumerState<CreateBookingScreen> {
  String? _selectedPetId;
  DateTime? _selectedDateTime;
  final _notesController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickDateTime() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(hours: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 90)),
    );
    if (date == null || !mounted) return;

    final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(now));
    if (time == null) return;

    setState(() {
      _selectedDateTime = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    });
  }

  Future<void> _submit() async {
    if (_selectedPetId == null || _selectedDateTime == null) {
      setState(() => _error = 'Pilih hewan dan jadwal terlebih dahulu');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final booking = await ref.read(bookingActionsProvider).create(
            workerProfileId: widget.workerProfileId,
            petId: _selectedPetId!,
            scheduledStart: _selectedDateTime!,
            durationMinutes: widget.durationMinutes,
            ownerNotes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).popUntil((route) => route.isFirst);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Booking dibuat! Menunggu konfirmasi worker. (${booking.id})')),
      );
    } catch (e) {
      setState(() => _error = 'Gagal membuat booking: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final petsAsync = ref.watch(myPetsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Booking')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            const Text('Pilih Hewan', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            petsAsync.when(
              loading: () => const CircularProgressIndicator(),
              error: (error, _) => Text('Gagal memuat hewan: $error'),
              data: (pets) {
                if (pets.isEmpty) {
                  return const Text('Anda belum punya hewan peliharaan terdaftar.');
                }
                return DropdownButtonFormField<String>(
                  initialValue: _selectedPetId,
                  decoration: const InputDecoration(border: OutlineInputBorder()),
                  items: pets
                      .map((p) => DropdownMenuItem(value: p.id, child: Text(p.name)))
                      .toList(),
                  onChanged: (value) => setState(() => _selectedPetId = value),
                );
              },
            ),
            const SizedBox(height: 24),
            const Text('Jadwal', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _pickDateTime,
              icon: const Icon(Icons.calendar_today),
              label: Text(
                _selectedDateTime == null
                    ? 'Pilih tanggal & jam'
                    : _selectedDateTime.toString(),
              ),
            ),
            const SizedBox(height: 24),
            const Text('Catatan (opsional)', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            TextField(
              controller: _notesController,
              maxLines: 3,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'Instruksi khusus untuk worker',
              ),
            ),
            const Spacer(),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      height: 16,
                      width: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Konfirmasi Booking'),
            ),
          ],
        ),
      ),
    );
  }
}
