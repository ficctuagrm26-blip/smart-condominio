# smartcondominio/queryutils.py
from django.db.models import Q

def cuotas_for_user(qs, user):
    """
    Limita a cuotas de unidades donde el user es propietario o residente.
    Devuelve qs.none() si no está autenticado.
    """
    if not user or not user.is_authenticated:
        return qs.none()
    if getattr(user, "is_superuser", False):
        return qs
    return qs.filter(
        Q(unidad__propietario=user) | Q(unidad__residente=user)
    ).distinct()
