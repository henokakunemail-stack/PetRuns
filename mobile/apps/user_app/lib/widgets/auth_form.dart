import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Simple form state untuk login/register screen.
final class AuthFormState {
  final bool isLoading;

  const AuthFormState({this.isLoading = false});
  AuthFormState copyWith({bool? isLoading}) {
    return AuthFormState(isLoading: isLoading ?? this.isLoading);
  }
}

final authFlowProvider = Provider<AuthFormState>((ref) => const AuthFormState());