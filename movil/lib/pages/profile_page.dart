import 'package:flutter/material.dart';
import '../services/auth.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  Me? _me;
  bool _loading = true;
  String? _error;

  final _f = TextEditingController();
  final _l = TextEditingController();
  final _e = TextEditingController();
  final _u = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final me = await Auth.getMe();
      setState(() {
        _me = me;
        _f.text = me.firstName;
        _l.text = me.lastName;
        _e.text = me.email;
        _u.text = me.username;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _save() async {
    if (_me == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final updated = await Auth.updateMe(
        firstName: _f.text != _me!.firstName ? _f.text : null,
        lastName: _l.text != _me!.lastName ? _l.text : null,
        email: _e.text != _me!.email ? _e.text : null,
        username: _me!.role == 'ADMIN' && _u.text != _me!.username
            ? _u.text
            : null,
      );
      if (!mounted) return;
      setState(() {
        _me = updated;
        _loading = false;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Perfil actualizado')));
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _changePassword() async {
    final current = TextEditingController();
    final newp = TextEditingController();
    final formKey = GlobalKey<FormState>();

    await showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cambiar contraseña'),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: current,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Actual'),
                validator: (v) => (v == null || v.isEmpty) ? 'Requerido' : null,
              ),
              TextFormField(
                controller: newp,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Nueva (mín. 6)'),
                validator: (v) =>
                    (v == null || v.length < 6) ? 'Min 6 caracteres' : null,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () async {
              if (!formKey.currentState!.validate()) return;
              try {
                await Auth.changePassword(
                  currentPassword: current.text,
                  newPassword: newp.text,
                );
                if (context.mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Contraseña actualizada')),
                  );
                }
              } catch (e) {
                ScaffoldMessenger.of(
                  context,
                ).showSnackBar(SnackBar(content: Text(e.toString())));
              }
            },
            child: const Text('Guardar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Perfil')),
        body: Center(child: Text(_error!)),
      );
    }
    final isAdmin = _me?.role == 'ADMIN';
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi perfil'),
        actions: [
          IconButton(
            icon: const Icon(Icons.key),
            onPressed: _changePassword,
            tooltip: 'Cambiar contraseña',
          ),
          IconButton(
            icon: const Icon(Icons.save),
            onPressed: _save,
            tooltip: 'Guardar',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextFormField(
              controller: _f,
              decoration: const InputDecoration(labelText: 'Nombre'),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _l,
              decoration: const InputDecoration(labelText: 'Apellido'),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _e,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _u,
              decoration: InputDecoration(
                labelText: 'Usuario',
                helperText: isAdmin ? 'Editable (ADMIN)' : 'Solo lectura',
              ),
              enabled: isAdmin,
            ),
            const SizedBox(height: 16),
            Row(children: [Chip(label: Text('Rol: ${_me?.role ?? "-"}'))]),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _save,
                child: const Text('Guardar cambios'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
