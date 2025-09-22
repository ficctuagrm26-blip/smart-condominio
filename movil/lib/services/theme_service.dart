import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeService extends ChangeNotifier {
  static final ThemeService instance = ThemeService._internal();
  ThemeService._internal();

  static const _kKey = 'theme_mode'; // system|light|dark
  ThemeMode _mode = ThemeMode.system;

  ThemeMode get mode => _mode;

  Future<void> init() async {
    final sp = await SharedPreferences.getInstance();
    final raw = sp.getString(_kKey);
    switch (raw) {
      case 'light':
        _mode = ThemeMode.light;
        break;
      case 'dark':
        _mode = ThemeMode.dark;
        break;
      default:
        _mode = ThemeMode.system;
    }
    notifyListeners();
  }

  Future<void> set(ThemeMode m) async {
    _mode = m;
    notifyListeners();
    final sp = await SharedPreferences.getInstance();
    await sp.setString(
      _kKey,
      m == ThemeMode.light
          ? 'light'
          : m == ThemeMode.dark
          ? 'dark'
          : 'system',
    );
  }

  Future<void> toggle() async {
    // light -> dark -> light (simple y práctico)
    await set(_mode == ThemeMode.light ? ThemeMode.dark : ThemeMode.light);
  }
}
