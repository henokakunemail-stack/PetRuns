import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/token_storage.dart';
import '../models/models.dart';

/// Auth state held at app level. Once a token exists in storage we mark
/// `bootstrapped = true` so the splash screen can decide which route to use.
final class AuthState {
  final bool isAuthenticated;
  final bool bootstrapped;
  final UserModel? user;
  final String? errorMessage;

  const AuthState({
    this.isAuthenticated = false,
    this.bootstrapped = false,
    this.user,
    this.errorMessage,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    bool? bootstrapped,
    UserModel? user,
    String? errorMessage,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      bootstrapped: bootstrapped ?? this.bootstrapped,
      user: user ?? this.user,
      errorMessage: errorMessage,
    );
  }
}

final class AuthNotifier extends Notifier<AuthState> {
  late final ApiClient _api;
  late final TokenStorage _tokens;

  @override
  AuthState build() {
    _api = ref.watch(apiClientProvider);
    _tokens = ref.watch(tokenStorageProvider);
    return const AuthState();
  }

  /// Called once at app start to check whether we have a stored session.
  Future<void> bootstrap() async {
    if (state.bootstrapped) return;
    if (_tokens.hasSession) {
      state = state.copyWith(isAuthenticated: true, bootstrapped: true);
    } else {
      state = state.copyWith(bootstrapped: true);
    }
  }

  Future<void> login(String identifier, String password) async {
    state = state.copyWith(errorMessage: null);
    try {
      final res = await _api.dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'identifier': identifier, 'password': password},
      );
      final body = res.data!;
      await _persistTokens(body);
      state = state.copyWith(
        isAuthenticated: true,
        user: _userFromBody(body),
        errorMessage: null,
      );
    } on DioException catch (e) {
      state = state.copyWith(
        errorMessage: _extractError(e) ?? 'Login gagal',
      );
      rethrow;
    }
  }

  Future<void> register({
    required String name,
    required String password,
    String? email,
    String? phone,
    List<String> roles = const ['OWNER'],
  }) async {
    state = state.copyWith(errorMessage: null);
    try {
      final res = await _api.dio.post<Map<String, dynamic>>(
        '/auth/register',
        data: {
          'name': name,
          'email': email,
          'phone': phone,
          'password': password,
          'roles': roles,
        },
      );
      final body = res.data!;
      await _persistTokens(body);
      state = state.copyWith(
        isAuthenticated: true,
        user: _userFromBody(body),
        errorMessage: null,
      );
    } on DioException catch (e) {
      state = state.copyWith(errorMessage: _extractError(e) ?? 'Registrasi gagal');
      rethrow;
    }
  }

  Future<void> logout() async {
    try {
      final rt = _tokens.refreshToken;
      if (rt != null) {
        await _api.dio.post('/auth/logout', data: {'refreshToken': rt});
      }
    } catch (_) {
      // ignore — local logout still proceeds
    }
    await _tokens.clear();
    state = const AuthState();
  }

  Future<void> _persistTokens(Map<String, dynamic> body) async {
    final access = body['accessToken'] as String;
    final refresh = body['refreshToken'] as String;
    final userJson = body['user'] as Map<String, dynamic>;
    await _tokens.save(
      accessToken: access,
      refreshToken: refresh,
      userId: userJson['id'] as String,
    );
  }

  UserModel _userFromBody(Map<String, dynamic> body) {
    return UserModel.fromJson(body['user'] as Map<String, dynamic>);
  }

  String? _extractError(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['message'] != null) {
      final m = data['message'];
      if (m is List && m.isNotEmpty) return m.first.toString();
      return m.toString();
    }
    return e.message;
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);