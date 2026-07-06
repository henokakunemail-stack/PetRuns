// Smoke test — tanpa sesi tersimpan, app harus menampilkan LoginScreen.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:petwalk_core/petwalk_core.dart';
import 'package:petwalk_worker_app/main.dart';

void main() {
  testWidgets('Worker app menampilkan LoginScreen saat belum ada sesi', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    final tokens = await TokenStorage.create();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [tokenStorageProvider.overrideWithValue(tokens)],
        child: const PetWalkWorkerApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('PetWalk Worker'), findsOneWidget);
  });
}
