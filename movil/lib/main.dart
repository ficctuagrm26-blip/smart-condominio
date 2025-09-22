import 'package:flutter/material.dart';
import 'services/theme_service.dart';
import 'pages/login_page.dart';
import 'pages/role_pages.dart';
import 'pages/profile_page.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ThemeService.instance.init();
  runApp(const SmartCondoApp());
}

class SmartCondoApp extends StatefulWidget {
  const SmartCondoApp({super.key});

  @override
  State<SmartCondoApp> createState() => _SmartCondoAppState();
}

class _SmartCondoAppState extends State<SmartCondoApp> {
  @override
  void initState() {
    super.initState();
    ThemeService.instance.addListener(_onTheme);
  }

  @override
  void dispose() {
    ThemeService.instance.removeListener(_onTheme);
    super.dispose();
  }

  void _onTheme() => setState(() {});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Smart Condominium',
      debugShowCheckedModeBanner: false, // ← quita el banner de Flutter
      themeMode: ThemeService.instance.mode,
      theme: _lightTheme,
      darkTheme: _darkTheme,
      initialRoute: '/login',
      routes: {
        '/login': (_) => const LoginPage(),
        '/admin': (_) => const StaffHomePage(),
        '/resident': (_) => const ResidentHomePage(),
        '/staff': (_) => const StaffHomePage(),
        '/profile': (_) => const ProfilePage(),
      },
    );
  }
}

/// ------------------ THEMES ------------------

final _lightTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: const Color(0xFF0F6DFB),
    brightness: Brightness.light,
  ),
  scaffoldBackgroundColor: const Color(0xFFF5F7FB),
  appBarTheme: const AppBarTheme(
    foregroundColor: Colors.black87,
    backgroundColor: Colors.transparent,
    elevation: 0,
  ),
  cardTheme: CardThemeData(
    // ← CardThemeData en Flutter 3.35
    color: Colors.white,
    elevation: 0,
    surfaceTintColor: Colors.transparent,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.all(Radius.circular(18)),
    ),
  ),
);

final _darkTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: const Color(0xFF2BD1FF),
    brightness: Brightness.dark,
  ),
  scaffoldBackgroundColor: const Color(0xFF0C1116),
  appBarTheme: const AppBarTheme(
    foregroundColor: Colors.white,
    backgroundColor: Colors.transparent,
    elevation: 0,
  ),
  cardTheme: CardThemeData(
    // ← CardThemeData en Flutter 3.35
    color: Colors.white10,
    elevation: 0,
    surfaceTintColor: Colors.transparent,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.all(Radius.circular(18)),
    ),
  ),
);
