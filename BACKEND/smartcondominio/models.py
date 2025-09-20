from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

#CREAMOS UNA TABLA DE TIPO ROL 
class Rol(models.Model):
    code = models.CharField(max_length=30, unique=True)   # Ej: ADMIN
    name = models.CharField(max_length=50)                # Ej: Administrador
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.code} - {self.name}"

#TABLA DE TIPO PERFIL
# Profile: cambia role de CharField -> ForeignKey
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.ForeignKey(Rol, null=True, blank=True, on_delete=models.SET_NULL)
    def __str__(self):
        return f"{self.user.username} ({self.role.code if self.role else 'Sin rol'})"

@receiver(post_save, sender=User)
def ensure_profile(sender, instance, created, **kwargs):
    Profile.objects.get_or_create(user=instance)