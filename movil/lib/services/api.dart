import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Cambia la base en tiempo de compilación con:
/// flutter run --dart-define=API_BASE_URL=https://smart-condominium-1.onrender.com/api
const String kBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://smart-condominium-1.onrender.com/api',
);

final _storage = const FlutterSecureStorage();

Future<String?> getToken() => _storage.read(key: 'token');
Future<void> setToken(String t) => _storage.write(key: 'token', value: t);
Future<void> clearToken() => _storage.delete(key: 'token');

Map<String, String> _jsonHeaders([String? token]) => {
  'Content-Type': 'application/json',
  if (token != null) 'Authorization': 'Token $token',
};

Uri _u(String path) => Uri.parse('$kBaseUrl$path');

Future<Map<String, dynamic>> postJson(
  String path,
  Map body, {
  String? token,
}) async {
  final res = await http.post(
    _u(path),
    headers: _jsonHeaders(token),
    body: jsonEncode(body),
  );
  final data = res.body.isEmpty ? {} : jsonDecode(res.body);
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return (data as Map).cast<String, dynamic>();
  }
  throw ApiError(res.statusCode, _errorFromBody(data, res.body));
}

Future<Map<String, dynamic>> getJson(String path, {String? token}) async {
  final res = await http.get(_u(path), headers: _jsonHeaders(token));
  final data = res.body.isEmpty ? {} : jsonDecode(res.body);
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return (data as Map).cast<String, dynamic>();
  }
  throw ApiError(res.statusCode, _errorFromBody(data, res.body));
}

Future<Map<String, dynamic>> patchJson(
  String path,
  Map body, {
  String? token,
}) async {
  final res = await http.patch(
    _u(path),
    headers: _jsonHeaders(token),
    body: jsonEncode(body),
  );
  final data = res.body.isEmpty ? {} : jsonDecode(res.body);
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return (data as Map).cast<String, dynamic>();
  }
  throw ApiError(res.statusCode, _errorFromBody(data, res.body));
}

String _errorFromBody(dynamic data, String raw) {
  if (data is Map && data['detail'] != null) return '${data['detail']}';
  if (data is Map && data['non_field_errors'] != null) {
    return '${data['non_field_errors']}';
  }
  return raw;
}

class ApiError implements Exception {
  final int status;
  final String message;
  ApiError(this.status, this.message);
  @override
  String toString() => '($status) $message';
}
