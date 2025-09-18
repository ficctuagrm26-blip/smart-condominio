from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile

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