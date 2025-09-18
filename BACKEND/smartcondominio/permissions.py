from rest_framework.permissions import BasePermission
from django.core.exceptions import ObjectDoesNotExist

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        if not u.is_authenticated:
            return False
        try:
            return u.profile.role == "ADMIN"
        except ObjectDoesNotExist:
            return False

class IsStaff(BasePermission):
    def has_permission(self, request, view):
        return hasattr(request.user, "profile") and request.user.profile.role in ["STAFF", "ADMIN"]

class IsResident(BasePermission):
    def has_permission(self, request, view):
        return hasattr(request.user, "profile") and request.user.profile.role == "RESIDENT"
