import 'api.dart';

class Me {
  final int id;
  final String username, email, firstName, lastName, role;

  Me({
    required this.id,
    required this.username,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
  });

  factory Me.fromJson(Map<String, dynamic> j) => Me(
    id: j['id'] as int,
    username: (j['username'] ?? '') as String,
    email: (j['email'] ?? '') as String,
    firstName: (j['first_name'] ?? '') as String,
    lastName: (j['last_name'] ?? '') as String,
    role: (j['role'] ?? 'RESIDENT') as String,
  );
}

class Auth {
  static Future<Me> login(String username, String password) async {
    final r = await postJson('/auth/login/', {
      'username': username,
      'password': password,
    });
    await setToken(r['token'] as String);
    return getMe();
  }

  static Future<Me> getMe() async {
    final token = await getToken();
    if (token == null) throw ApiError(401, 'No autenticado');
    final data = await getJson('/auth/me/', token: token);
    return Me.fromJson(data);
  }

  static Future<void> logout() => clearToken();

  /// PATCH /auth/me/update/ (envía solo campos modificados)
  static Future<Me> updateMe({
    String? firstName,
    String? lastName,
    String? email,
    String? username, // (el backend lo permite solo a ADMIN)
  }) async {
    final token = await getToken();
    if (token == null) throw ApiError(401, 'No autenticado');

    final body = <String, dynamic>{};
    if (firstName != null) body['first_name'] = firstName;
    if (lastName != null) body['last_name'] = lastName;
    if (email != null) body['email'] = email;
    if (username != null) body['username'] = username;

    final data = await patchJson('/auth/me/update/', body, token: token);
    return Me.fromJson(data);
  }

  /// POST /auth/change-password/
  static Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final token = await getToken();
    if (token == null) throw ApiError(401, 'No autenticado');
    await postJson('/auth/change-password/', {
      'current_password': currentPassword,
      'new_password': newPassword,
    }, token: token);
  }
}
