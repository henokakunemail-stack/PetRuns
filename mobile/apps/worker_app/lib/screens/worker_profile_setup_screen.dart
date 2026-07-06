import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import 'package:petwalk_core/petwalk_core.dart';

const _brandColor = Color(0xFFFF8F00);
const _dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const _bankOptions = ['BCA', 'BNI', 'BRI', 'Mandiri', 'Lainnya'];

/// Wizard onboarding worker — 4 langkah:
///   1. Bio & Lokasi     (text + GPS, + bank info)
///   2. Spesialisasi     (multi-select species)
///   3. Harga/Durasi     (tambah/edit baris)
///   4. Ketersediaan     (hari + jam kerja)
final class WorkerProfileSetupScreen extends ConsumerStatefulWidget {
  const WorkerProfileSetupScreen({super.key});

  @override
  ConsumerState<WorkerProfileSetupScreen> createState() => _WorkerProfileSetupScreenState();
}

final class _WorkerProfileSetupScreenState extends ConsumerState<WorkerProfileSetupScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  int _currentStep = 0;
  bool _loadedOnce = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _goToNextStep() {
    if (_currentStep < 3) {
      setState(() => _currentStep++);
      _tabController.animateTo(_currentStep);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_loadedOnce) {
      _loadedOnce = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(workerProfileEditorProvider.notifier).load();
      });
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Setup Profil'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Bio & Lokasi', icon: Icon(Icons.badge_outlined)),
            Tab(text: 'Spesialisasi', icon: Icon(Icons.pets_outlined)),
            Tab(text: 'Harga', icon: Icon(Icons.attach_money_outlined)),
            Tab(text: 'Jadwal', icon: Icon(Icons.schedule)),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _BioLocationStep(onSave: _goToNextStep),
          _ExpertiseStep(onSave: _goToNextStep),
          _PricingStep(onSave: _goToNextStep),
          const _AvailabilityStep(),
        ],
      ),
    );
  }
}

// ─── Step 1: Bio & Lokasi ────────────────────────────────────────────
class _BioLocationStep extends ConsumerStatefulWidget {
  const _BioLocationStep({required this.onSave});
  final VoidCallback onSave;

  @override
  ConsumerState<_BioLocationStep> createState() => __BioLocationStepState();
}

class __BioLocationStepState extends ConsumerState<_BioLocationStep> {
  final _bioController = TextEditingController();
  final _bankAccountController = TextEditingController();
  String? _bankName;
  double? _lat;
  double? _lng;
  bool _detecting = false;
  bool _saving = false;
  bool _initialized = false;

  @override
  void dispose() {
    _bioController.dispose();
    _bankAccountController.dispose();
    super.dispose();
  }

  void _hydrateFrom(WorkerProfileModel profile) {
    if (_initialized) return;
    _initialized = true;
    _bioController.text = profile.bio ?? '';
    _bankAccountController.text = profile.bankAccountNumber ?? '';
    _bankName = profile.bankName;
    _lat = profile.baseLatitude;
    _lng = profile.baseLongitude;
  }

  Future<void> _detectLocation() async {
    setState(() => _detecting = true);
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) throw StateError('Aktifkan GPS terlebih dahulu');

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        throw StateError('Izin lokasi ditolak');
      }

      final position = await Geolocator.getCurrentPosition();
      setState(() {
        _lat = position.latitude;
        _lng = position.longitude;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal mendeteksi lokasi: $e')));
      }
    } finally {
      if (mounted) setState(() => _detecting = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(workerProfileEditorProvider.notifier).updateProfile(
            bio: _bioController.text,
            bankName: _bankName,
            bankAccountNumber:
                _bankAccountController.text.trim().isEmpty ? null : _bankAccountController.text.trim(),
            baseLatitude: _lat,
            baseLongitude: _lng,
            serviceRadiusKm: 5.0,
          );
      widget.onSave();
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
    final profileAsync = ref.watch(workerProfileEditorProvider);

    return profileAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(child: Text('Error: $error')),
      data: (profile) {
        if (profile != null) _hydrateFrom(profile);
        return Padding(
          padding: const EdgeInsets.all(16),
          child: ListView(
            children: [
              TextField(
                controller: _bioController,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Bio / Tentang Diri',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _bankName,
                decoration: const InputDecoration(labelText: 'Bank', border: OutlineInputBorder()),
                items: _bankOptions.map((b) => DropdownMenuItem(value: b, child: Text(b))).toList(),
                onChanged: (v) => setState(() => _bankName = v),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _bankAccountController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'No. Rekening', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 24),
              ListTile(
                title: Text(
                  _lat != null && _lng != null
                      ? 'Koordinat: ${_lat!.toStringAsFixed(4)}, ${_lng!.toStringAsFixed(4)}'
                      : 'Lokasi belum diatur',
                ),
                trailing: _detecting
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : IconButton(icon: const Icon(Icons.my_location), onPressed: _detectLocation),
              ),
              if (_lat != null)
                const Chip(avatar: Icon(Icons.location_on, size: 18), label: Text('Lokasi terdeteksi')),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _saving ? null : _save,
                icon: const Icon(Icons.check),
                label: Text(_saving ? 'Menyimpan...' : 'Simpan & Lanjut'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _brandColor,
                  minimumSize: const Size.fromHeight(48),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── Step 2: Spesialisasi Species ───────────────────────────────────
class _ExpertiseStep extends ConsumerStatefulWidget {
  const _ExpertiseStep({required this.onSave});
  final VoidCallback onSave;

  @override
  ConsumerState<_ExpertiseStep> createState() => __ExpertiseStepState();
}

class __ExpertiseStepState extends ConsumerState<_ExpertiseStep> {
  final Set<String> _selected = {};
  bool _initialized = false;
  bool _saving = false;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(workerProfileEditorProvider.notifier).setSpeciesExpertise(_selected.toList());
      widget.onSave();
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
    final expertiseAsync = ref.watch(myWorkerExpertiseProvider);
    final speciesAsync = ref.watch(speciesListProvider);
    final theme = Theme.of(context);

    return speciesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(child: Text('Error: $error')),
      data: (speciesList) {
        expertiseAsync.whenData((items) {
          if (!_initialized) {
            _initialized = true;
            _selected.addAll(items.map((e) => e.speciesId));
          }
        });

        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (speciesList.isEmpty) const Text('Tidak ada jenis hewan ditemukan. Hubungi admin.'),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: speciesList.map((species) {
                  final isSelected = _selected.contains(species.id);
                  return FilterChip(
                    label: Text(species.name),
                    selected: isSelected,
                    onSelected: (_) {
                      setState(() {
                        isSelected ? _selected.remove(species.id) : _selected.add(species.id);
                      });
                    },
                    selectedColor: theme.colorScheme.primaryContainer,
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _selected.isEmpty || _saving ? null : _save,
                icon: const Icon(Icons.check),
                label: Text(_saving ? 'Menyimpan...' : 'Simpan Spesialisasi'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _brandColor,
                  minimumSize: const Size.fromHeight(48),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── Step 3: Harga ──────────────────────────────────────────────────
final class _PricingEntry {
  _PricingEntry({this.durationMinutes = 60, this.price = 100000});
  int durationMinutes;
  double price;
}

class _PricingStep extends ConsumerStatefulWidget {
  const _PricingStep({required this.onSave});
  final VoidCallback onSave;

  @override
  ConsumerState<_PricingStep> createState() => __PricingStepState();
}

class __PricingStepState extends ConsumerState<_PricingStep> {
  final List<_PricingEntry> _entries = [];
  bool _initialized = false;
  bool _saving = false;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final entries = _entries
          .map((e) => {'durationMinutes': e.durationMinutes, 'price': e.price})
          .toList();
      await ref.read(workerProfileEditorProvider.notifier).setPricing(entries);
      widget.onSave();
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
    final pricingAsync = ref.watch(myWorkerPricingProvider);

    return pricingAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(child: Text('Error: $error')),
      data: (items) {
        if (!_initialized) {
          _initialized = true;
          if (items.isNotEmpty) {
            _entries.addAll(
              items.map((e) => _PricingEntry(durationMinutes: e.durationMinutes, price: e.price)),
            );
          } else {
            _entries.addAll([
              _PricingEntry(durationMinutes: 30, price: 50000),
              _PricingEntry(durationMinutes: 60, price: 90000),
              _PricingEntry(durationMinutes: 90, price: 125000),
            ]);
          }
        }

        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Atur harga untuk tiap pilihan durasi sesi.'),
              const SizedBox(height: 12),
              ..._entries.asMap().entries.map((entry) {
                final index = entry.key;
                final row = entry.value;
                return _PricingRow(
                  duration: row.durationMinutes,
                  price: row.price,
                  onDurationChanged: (v) => setState(() => row.durationMinutes = v),
                  onPriceChanged: (v) => setState(() => row.price = v),
                  onRemove: () => setState(() => _entries.removeAt(index)),
                );
              }),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => setState(() => _entries.add(_PricingEntry())),
                icon: const Icon(Icons.add),
                label: const Text('Tambah Baris'),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _entries.isEmpty || _saving ? null : _save,
                icon: const Icon(Icons.check),
                label: Text(_saving ? 'Menyimpan...' : 'Simpan & Lanjut'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _brandColor,
                  minimumSize: const Size.fromHeight(48),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _PricingRow extends StatelessWidget {
  const _PricingRow({
    required this.duration,
    required this.price,
    required this.onDurationChanged,
    required this.onPriceChanged,
    required this.onRemove,
  });

  final int duration;
  final double price;
  final ValueChanged<int> onDurationChanged;
  final ValueChanged<double> onPriceChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Flexible(
            flex: 2,
            child: TextFormField(
              initialValue: duration.toString(),
              decoration: const InputDecoration(
                labelText: 'Durasi (menit)',
                prefixIcon: Icon(Icons.timer),
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.symmetric(horizontal: 12),
              ),
              keyboardType: TextInputType.number,
              onChanged: (v) => onDurationChanged(int.tryParse(v) ?? duration),
            ),
          ),
          const SizedBox(width: 12),
          Flexible(
            flex: 3,
            child: TextFormField(
              initialValue: price.toStringAsFixed(0),
              decoration: const InputDecoration(
                labelText: 'Harga (IDR)',
                prefixIcon: Icon(Icons.attach_money),
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.symmetric(horizontal: 12),
              ),
              keyboardType: TextInputType.number,
              onChanged: (v) => onPriceChanged(double.tryParse(v) ?? price),
            ),
          ),
          const SizedBox(width: 8),
          IconButton(icon: const Icon(Icons.delete_outline, color: Colors.red), onPressed: onRemove),
        ],
      ),
    );
  }
}

// ─── Step 4: Ketersediaan ───────────────────────────────────────────
final class _DaySchedule {
  _DaySchedule({this.enabled = false, this.start = const TimeOfDay(hour: 9, minute: 0), this.end = const TimeOfDay(hour: 17, minute: 0)});
  bool enabled;
  TimeOfDay start;
  TimeOfDay end;
}

class _AvailabilityStep extends ConsumerStatefulWidget {
  const _AvailabilityStep();

  @override
  ConsumerState<_AvailabilityStep> createState() => __AvailabilityStepState();
}

class __AvailabilityStepState extends ConsumerState<_AvailabilityStep> {
  final Map<int, _DaySchedule> _schedule = {
    for (var i = 0; i < 7; i++) i: _DaySchedule(enabled: i != 0),
  };
  bool _initialized = false;
  bool _saving = false;

  Future<void> _pickTime(int dayIndex, {required bool isStart}) async {
    final current = isStart ? _schedule[dayIndex]!.start : _schedule[dayIndex]!.end;
    final picked = await showTimePicker(context: context, initialTime: current);
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _schedule[dayIndex]!.start = picked;
      } else {
        _schedule[dayIndex]!.end = picked;
      }
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final entries = _schedule.entries
          .where((e) => e.value.enabled)
          .map((e) => {
                'dayOfWeek': e.key,
                'startTime': _formatTime(e.value.start),
                'endTime': _formatTime(e.value.end),
              })
          .toList();

      if (entries.isEmpty) {
        throw StateError('Aktifkan minimal 1 hari kerja');
      }

      await ref.read(workerProfileEditorProvider.notifier).setAvailability(entries);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Jadwal ketersediaan tersimpan!')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal menyimpan: $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  static String _formatTime(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final availabilityAsync = ref.watch(myWorkerAvailabilityProvider);

    return availabilityAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(child: Text('Error: $error')),
      data: (items) {
        if (!_initialized) {
          _initialized = true;
          if (items.isNotEmpty) {
            for (final day in _schedule.keys) {
              _schedule[day]!.enabled = false;
            }
            for (final item in items) {
              final parts = item.startTime.split(':');
              final endParts = item.endTime.split(':');
              _schedule[item.dayOfWeek] = _DaySchedule(
                enabled: true,
                start: TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1])),
                end: TimeOfDay(hour: int.parse(endParts[0]), minute: int.parse(endParts[1])),
              );
            }
          }
        }

        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Atur hari & jam kerja Anda.'),
              const SizedBox(height: 8),
              Expanded(
                child: ListView(
                  children: List.generate(7, (dayIndex) {
                    final day = _schedule[dayIndex]!;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: Column(
                        children: [
                          SwitchListTile(
                            title: Text(_dayNames[dayIndex]),
                            value: day.enabled,
                            onChanged: (v) => setState(() => day.enabled = v),
                            dense: true,
                          ),
                          if (day.enabled)
                            Padding(
                              padding: const EdgeInsets.only(left: 16, right: 16, bottom: 12),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: OutlinedButton(
                                      onPressed: () => _pickTime(dayIndex, isStart: true),
                                      child: Text('Mulai ${_formatTime(day.start)}'),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: OutlinedButton(
                                      onPressed: () => _pickTime(dayIndex, isStart: false),
                                      child: Text('Selesai ${_formatTime(day.end)}'),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    );
                  }),
                ),
              ),
              const SizedBox(height: 8),
              ElevatedButton.icon(
                onPressed: _saving ? null : _save,
                icon: const Icon(Icons.check),
                label: Text(_saving ? 'Menyimpan...' : 'Simpan Jadwal'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _brandColor,
                  minimumSize: const Size.fromHeight(48),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
