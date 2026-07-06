import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../constants/app_constants.dart';
import 'token_storage.dart';

/// Dio client with bearer-token interceptor and a basic 401 refresh path.
/// Used by both user and worker apps.
final class ApiClient {
  ApiClient({required TokenStorage tokens, Dio? dio})
      : _tokens = tokens,
        _dio = dio ?? _buildDio() {
    _dio.interceptors.add(_authInterceptor());
  }

  final TokenStorage _tokens;
  final Dio _dio;

  Dio get dio => _dio;

  static Dio _buildDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: AppConstants.apiBaseUrl,
        connectTimeout: AppConstants.httpTimeout,
        receiveTimeout: AppConstants.httpTimeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );
    dio.interceptors.add(
      LogInterceptor(requestBody: true, responseBody: false),
    );
    return dio;
  }

  InterceptorsWrapper _authInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = _tokens.accessToken;
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (err, handler) async {
        if (err.response?.statusCode == 401 && _tokens.refreshToken != null) {
          try {
            final refresh = await _dio.post<Map<String, dynamic>>(
              '/auth/refresh',
              data: {'refreshToken': _tokens.refreshToken},
              options: Options(headers: {'Authorization': null}),
            );
            final newAccess = refresh.data?['accessToken'] as String?;
            if (newAccess != null) {
              await _tokens.updateAccess(newAccess);
              final retry = err.requestOptions;
              retry.headers['Authorization'] = 'Bearer $newAccess';
              final cloned = await _dio.fetch<dynamic>(retry);
              return handler.resolve(cloned);
            }
          } catch (_) {
            // Refresh failed — fall through to original 401
          }
        }
        handler.next(err);
      },
    );
  }
}

/// Token storage is async-init so we expose an override-friendly provider.
final tokenStorageProvider = Provider<TokenStorage>((ref) {
  throw UnimplementedError(
    'Override tokenStorageProvider at app start with TokenStorage.create()',
  );
});

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(tokens: ref.watch(tokenStorageProvider));
});