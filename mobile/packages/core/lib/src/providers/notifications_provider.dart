import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';

final notificationSyncProvider = Provider<NotificationSync>((ref) {
  return NotificationSync(ref);
});

final class NotificationSync {
  NotificationSync(this._ref);
  final Ref _ref;
  var _registered = false;

  ApiClient get _api => _ref.read(apiClientProvider);

  Future<void> registerDevice({required String app}) async {
    if (_registered) return;

    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();

      final token = await messaging.getToken();
      if (token == null) return;

      await _api.dio.post<void>(
        '/notifications/device-tokens',
        data: {
          'token': token,
          'platform': _platform,
          'app': app,
        },
      );
      _registered = true;
    } catch (_) {
      // Firebase belum dikonfigurasi atau permission/token gagal. App tetap jalan.
    }
  }

  Future<void> unregisterDevice({required String token}) async {
    await _api.dio.delete<void>(
      '/notifications/device-tokens',
      data: {'token': token},
    );
  }

  String get _platform {
    if (kIsWeb) return 'web';
    if (Platform.isIOS) return 'ios';
    return 'android';
  }
}
