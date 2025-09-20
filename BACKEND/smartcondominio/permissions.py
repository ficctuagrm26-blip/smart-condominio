# smartcondominio/permissions.py
from rest_framework.permissions import BasePermission

def user_role_code(user):
    # Devuelve 'ADMIN' | 'STAFF' | 'RESIDENT' o None
    return getattr(getattr(getattr(user, "profile", None), "role", None), "code", None)

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        if not getattr(u, "is_authenticated", False):
            return False
        if getattr(u, "is_superuser", False):
            return True
        return user_role_code(u) == "ADMIN"

class IsStaff(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        if not getattr(u, "is_authenticated", False):
            return False
        if getattr(u, "is_superuser", False):
            return True
        return user_role_code(u) in {"STAFF", "ADMIN"}

class IsResident(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        if not getattr(u, "is_authenticated", False):
            return False
        if getattr(u, "is_superuser", False):
            return True
        return user_role_code(u) == "RESIDENT"

# Alias opcional para compatibilidad con ejemplos anteriores
IsAdminRole = IsAdmin

