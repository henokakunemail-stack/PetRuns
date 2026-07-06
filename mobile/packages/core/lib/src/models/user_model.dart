/// Role enum matching backend UserRole.
enum UserRole {
  owner,
  worker,
  admin;

  static UserRole fromString(String value) {
    switch (value.toUpperCase()) {
      case 'OWNER':
        return UserRole.owner;
      case 'WORKER':
        return UserRole.worker;
      case 'ADMIN':
        return UserRole.admin;
      default:
        return UserRole.owner;
    }
  }
}

/// Lightweight user representation used across apps.
/// `roles` adalah List karena 1 akun bisa punya lebih dari 1 role sekaligus
/// (lihat CLAUDE.md — user bisa jadi owner sekaligus worker).
final class UserModel {
  final String id;
  final String name;
  final String? email;
  final String? phone;
  final String? profilePhotoUrl;
  final List<UserRole> roles;

  const UserModel({
    required this.id,
    required this.name,
    this.email,
    this.phone,
    this.profilePhotoUrl,
    this.roles = const [UserRole.owner],
  });

  bool hasRole(UserRole role) => roles.contains(role);

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final rawRoles = json['roles'] ?? json['role'];
    final roles = rawRoles is List
        ? rawRoles.map((r) => UserRole.fromString(r.toString())).toList()
        : [UserRole.fromString(rawRoles?.toString() ?? 'OWNER')];
    return UserModel(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      profilePhotoUrl: json['profilePhotoUrl'] as String?,
      roles: roles.isEmpty ? const [UserRole.owner] : roles,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'phone': phone,
        'profilePhotoUrl': profilePhotoUrl,
        'roles': roles.map((r) => r.name.toUpperCase()).toList(),
      };
}