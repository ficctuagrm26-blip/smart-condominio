from django.db import models
from django.contrib.auth.models import User

# Create your models here.


class Task(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    done = models.BooleanField(default=False)

    def __str__(self):
        return self.title

class Profile(models.Model):
    ROLE_CHOICES = (
        ("ADMIN", "Administrador"),
        ("STAFF", "Personal"),
        ("RESIDENT", "Residente"),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="RESIDENT")

    def __str__(self):
        return f"{self.user.username} ({self.role})"