from django.db import migrations, models
import django.db.models.deletion

def forwards(apps, schema_editor):
    Rol = apps.get_model('smartcondominio', 'Rol')
    Profile = apps.get_model('smartcondominio', 'Profile')

    # 1) crear roles base si no existen
    for code, name in [('ADMIN','Administrador'), ('STAFF','Personal'), ('RESIDENT','Residente')]:
        Rol.objects.get_or_create(code=code, defaults={'name': name})

    # 2) mapear el valor char antiguo a la FK nueva
    code_to_id = {r.code: r.id for r in Rol.objects.all()}

    # OJO: en este punto Profile tiene ambos campos: role (CharField) y role_new (FK)
    for p in Profile.objects.all():
        old = getattr(p, 'role', None)  # era CharField
        if old in code_to_id:
            setattr(p, 'role_new_id', code_to_id[old])
            p.save(update_fields=['role_new'])

def backwards(apps, schema_editor):
    # revertir: escribir el code en el campo char desde la FK
    Rol = apps.get_model('smartcondominio', 'Rol')
    Profile = apps.get_model('smartcondominio', 'Profile')

    id_to_code = {r.id: r.code for r in Rol.objects.all()}
    for p in Profile.objects.all():
        rid = getattr(p, 'role_id', None) or getattr(p, 'role_new_id', None)
        if rid in id_to_code:
            setattr(p, 'role', id_to_code[rid])  # campo char en backwards
            p.save(update_fields=['role'])


class Migration(migrations.Migration):

    dependencies = [
        ('smartcondominio', '0001_initial'),
    ]

    operations = [
        # 0) Crear modelo Rol
        migrations.CreateModel(
            name='Rol',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=30, unique=True)),
                ('name', models.CharField(max_length=60)),
                ('description', models.TextField(blank=True)),
            ],
        ),

        # 1) Agregar campo FK nuevo (nullable) sin romper aún
        migrations.AddField(
            model_name='profile',
            name='role_new',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='smartcondominio.rol'),
        ),

        # 2) Copiar datos del char -> FK
        migrations.RunPython(forwards, backwards),

        # 3) Quitar el campo char viejo
        migrations.RemoveField(
            model_name='profile',
            name='role',
        ),

        # 4) Renombrar role_new -> role (ya es FK)
        migrations.RenameField(
            model_name='profile',
            old_name='role_new',
            new_name='role',
        ),
    ]
