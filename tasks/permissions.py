from rest_framework.permissions import BasePermission

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return hasattr(request.user, "profile") and request.user.profile.role == "ADMIN"

class IsStaff(BasePermission):
    def has_permission(self, request, view):
        return hasattr(request.user, "profile") and request.user.profile.role in ["STAFF", "ADMIN"]

class IsResident(BasePermission):
    def has_permission(self, request, view):
        return hasattr(request.user, "profile") and request.user.profile.role == "RESIDENT"
