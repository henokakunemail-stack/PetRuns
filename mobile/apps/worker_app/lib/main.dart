import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:petwalk_core/petwalk_core.dart';

import 'screens/login_screen.dart';
import 'screens/worker_profile_setup_screen.dart';
import 'screens/worker_bookings_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final tokens = await TokenStorage.create();
  runApp(
    ProviderScope(
      overrides: [tokenStorageProvider.overrideWithValue(tokens)],
      child: const PetWalkWorkerApp(),
    ),
  );
}

/// Entry point Worker App — Pet Walker / Groomer.
final class PetWalkWorkerApp extends StatelessWidget {
  const PetWalkWorkerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PetWalk Worker',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFFF8F00)),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(centerTitle: true),
      ),
      home: const AuthGateway(),
    );
  }
}

/// Decide what to show based on auth state.
final class AuthGateway extends ConsumerWidget {
  const AuthGateway({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    if (!auth.bootstrapped) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(authProvider.notifier).bootstrap();
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (auth.isAuthenticated) {
      return const WorkerDashboard();
    }

    return const LoginScreen();
  }
}

/// Dashboard utama worker — setelah login.
final class WorkerDashboard extends StatefulWidget {
  const WorkerDashboard({super.key});

  @override
  State<WorkerDashboard> createState() => _WorkerDashboardState();
}

class _WorkerDashboardState extends State<WorkerDashboard> {
  var _currentIndex = 0;

  final List<Widget> _pages = const [
    WorkerProfileSetupScreen(),
    WorkerBookingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profil'),
          NavigationDestination(icon: Icon(Icons.work_outline), selectedIcon: Icon(Icons.work), label: 'Bookings'),
        ],
      ),
    );
  }
}