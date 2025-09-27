# smartcondominio/permissions.py
from rest_framework.permissions import BasePermission, SAFE_METHODS

def user_role_code(user):
    # Devuelve 'ADMIN' | 'STAFF' | 'RESIDENT' o None
    return getattr(getattr(getattr(user, "profile", None), "role", None), "code", None)
def user_role_base(user):
    return getattr(getattr(getattr(user, "profile", None), "role", None), "base", None)

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
class IsStaffGuardOrAdmin(BasePermission):
    """
    Permite acceso a:
    - superusuario
    - rol con code == 'ADMIN'
    - cualquier usuario cuyo rol.base == 'STAFF' (Guardias, mantenimiento, etc.)
    """
    def has_permission(self, request, view):
        u = request.user
        if not getattr(u, "is_authenticated", False):
            return False
        if getattr(u, "is_superuser", False):
            return True
        from .permissions import user_role_code  # ya lo tienes en este mismo módulo
        if user_role_code(u) == "ADMIN":
            return True
        return user_role_base(u) == "STAFF"
# Alias opcional para compatibilidad con ejemplos anteriores
IsAdminRole = IsAdmin

# Verifica si el rol asignado al usuario tiene un codename de permiso
def has_role_permission(user, codename: str) -> bool:
    role = getattr(getattr(user, "profile", None), "role", None)
    if not role:
        return False
    # Tus roles ya tienen M2M a django.contrib.auth.models.Permission
    return role.permissions.filter(codename=codename).exists()
class VisitAccess(BasePermission):
    """
    ADMIN/STAFF: full access.
    RESIDENT: solo lectura de visitas donde es anfitrión o de su unidad.
    """
    def has_object_permission(self, request, view, obj):
        u = request.user
        code = user_role_code(u)
        base = user_role_base(u)

        if code == "ADMIN" or base == "STAFF":
            return True

        # RESIDENT: solo SAFE y relacionadas
        if request.method in SAFE_METHODS:
            return (obj.host_resident_id == u.id) or (getattr(obj.unit, "residente_id", None) == u.id)

        return False