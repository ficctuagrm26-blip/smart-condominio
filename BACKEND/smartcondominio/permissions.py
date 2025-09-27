# smartcondominio/permissions.py
from rest_framework.permissions import BasePermission, SAFE_METHODS

# ========= Helpers de rol =========
def user_role_code(user):
    """Devuelve 'ADMIN' | 'STAFF' | 'RESIDENT' o None."""
    return getattr(getattr(getattr(user, "profile", None), "role", None), "code", None)

def user_role_base(user):
    """Devuelve la base del rol: 'ADMIN' | 'STAFF' | 'RESIDENT' o None."""
    return getattr(getattr(getattr(user, "profile", None), "role", None), "base", None)

# ========= Permisos básicos por rol =========
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
    - cualquier usuario cuyo rol.base == 'STAFF' (guardias, mantenimiento, etc.)
    """
    def has_permission(self, request, view):
        u = request.user
        if not getattr(u, "is_authenticated", False):
            return False
        if getattr(u, "is_superuser", False):
            return True
        if user_role_code(u) == "ADMIN":
            return True
        return user_role_base(u) == "STAFF"

# Alias opcional para compatibilidad
IsAdminRole = IsAdmin

# ========= Utilidad: permisos vinculados al rol (Django auth Permission) =========
def has_role_permission(user, codename: str) -> bool:
    """
    Verifica si el rol asignado al usuario tiene un Permission con ese codename.
    """
    role = getattr(getattr(user, "profile", None), "role", None)
    if not role:
        return False
    return role.permissions.filter(codename=codename).exists()

# ========= Permisos específicos de dominio =========
class IsAdminOrStaff(BasePermission):
    """ADMIN/STAFF (o superuser) tienen acceso."""
    def has_permission(self, request, view):
        u = request.user
        if not getattr(u, "is_authenticated", False):
            return False
        if getattr(u, "is_superuser", False):
            return True
        base = user_role_base(u)
        return base in {"ADMIN", "STAFF"}

class IsOwnerOrAdmin(BasePermission):
    """
    Para objetos con atributo propietario/propietario_id (p.ej. Vehiculo).
    - El propietario puede leer y editar (limitado por la vista si aplica).
    - ADMIN/STAFF tienen acceso total.
    """
    def has_object_permission(self, request, view, obj):
        if IsAdminOrStaff().has_permission(request, view):
            return True
        owner_id = getattr(obj, "propietario_id", None)
        return owner_id == getattr(request.user, "id", None)

class VisitAccess(BasePermission):
    """
    Visitas:
    - ADMIN/STAFF: acceso total.
    - RESIDENT: solo lectura (SAFE_METHODS) si es anfitrión o si pertenece a su unidad.
    """
    def has_object_permission(self, request, view, obj):
        u = request.user
        code = user_role_code(u)
        base = user_role_base(u)

        # Admin / Staff
        if getattr(u, "is_superuser", False) or code == "ADMIN" or base == "STAFF":
            return True

        # Residentes: solo lectura y relacionadas
        if request.method in SAFE_METHODS:
            es_anfitrion = getattr(obj, "host_resident_id", None) == getattr(u, "id", None)
            es_su_unidad = getattr(getattr(obj, "unit", None), "residente_id", None) == getattr(u, "id", None)
            return es_anfitrion or es_su_unidad

        return False
