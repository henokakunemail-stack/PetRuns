import 'package:shared_preferences/shared_preferences.dart';

/// Token storage backed by SharedPreferences. For Tahap 2 this is enough —
/// we'll move to flutter_secure_storage once we add Android Keystore support.
final class TokenStorage {
  static const _kAccess = 'pw.accessToken';
  static const _kRefresh = 'pw.refreshToken';
  static const _kUserId = 'pw.userId';

  final SharedPreferences _prefs;
  TokenStorage(this._prefs);

  static Future<TokenStorage> create() async {
    final prefs = await SharedPreferences.getInstance();
    return TokenStorage(prefs);
  }

  Future<void> save({
    required String accessToken,
    required String refreshToken,
    required String userId,
  }) async {
    await _prefs.setString(_kAccess, accessToken);
    await _prefs.setString(_kRefresh, refreshToken);
    await _prefs.setString(_kUserId, userId);
  }

  Future<void> updateAccess(String accessToken) async {
    await _prefs.setString(_kAccess, accessToken);
  }

  Future<void> clear() async {
    await _prefs.remove(_kAccess);
    await _prefs.remove(_kRefresh);
    await _prefs.remove(_kUserId);
  }

  String? get accessToken => _prefs.getString(_kAccess);
  String? get refreshToken => _prefs.getString(_kRefresh);
  String? get userId => _prefs.getString(_kUserId);
  bool get hasSession => accessToken != null && refreshToken != null;
}