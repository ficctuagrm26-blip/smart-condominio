from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile
from django.core.exceptions import ObjectDoesNotExist

class MeSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role"]

    def get_role(self, obj):
        return getattr(obj.profile, "role", "RESIDENT")

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=Profile.ROLE_CHOICES, required=False)

    class Meta:
        model = User
        fields = ["username", "email", "password", "role"]

    def create(self, validated_data):
        role = validated_data.pop("role", "RESIDENT")
        user = User.objects.create_user(**validated_data)
        # asegura rol
        user.profile.role = role
        user.profile.save()
        return user
    
class AdminUserSerializer(serializers.ModelSerializer):
    # Lectura: mostramos el rol real del Profile
    role = serializers.SerializerMethodField(read_only=True)
    # Escritura: el admin manda el rol aquí
    role_input = serializers.ChoiceField(
        choices=Profile.ROLE_CHOICES,
        write_only=True,
        required=False
    )
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, min_length=6
    )

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "is_active", "role", "role_input", "password"
        ]

    def get_role(self, instance):
        try:
            return instance.profile.role
        except ObjectDoesNotExist:
            return "RESIDENT"

    def create(self, validated_data):
        role = validated_data.pop("role_input", "RESIDENT")
        password = validated_data.pop("password", None)

        user = User(**validated_data)
        user.set_password(password or User.objects.make_random_password())
        user.save()

        Profile.objects.update_or_create(user=user, defaults={"role": role})
        return user

    def update(self, instance, validated_data):
        role = validated_data.pop("role_input", None)
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password and password.strip():
            instance.set_password(password)

        instance.save()

        if role is not None:
            Profile.objects.update_or_create(user=instance, defaults={"role": role})

        return instance