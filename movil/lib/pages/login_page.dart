import 'dart:ui';
import 'dart:math' as math; // 👈 necesario para math.sin
import 'package:flutter/material.dart';
import '../services/auth.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _user = TextEditingController();
  final _pass = TextEditingController();
  bool _loading = false;
  String? _error;

  late final AnimationController _anim;
  late final Animation<double> _wave;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();
    _wave = Tween(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _anim, curve: Curves.linear));
  }

  @override
  void dispose() {
    _anim.dispose();
    _user.dispose();
    _pass.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final me = await Auth.login(_user.text.trim(), _pass.text);
      if (!mounted) return;
      switch (me.role) {
        case 'ADMIN':
          Navigator.pushReplacementNamed(context, '/admin');
          break;
        case 'STAFF':
          Navigator.pushReplacementNamed(context, '/staff');
          break;
        default:
          Navigator.pushReplacementNamed(context, '/resident');
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AnimatedBuilder(
        animation: _wave,
        builder: (context, _) {
          return Stack(
            fit: StackFit.expand,
            children: [
              const _ModernGradientBackground(),
              CustomPaint(painter: _WavesPainter(_wave.value)),
              const _SkylineLayer(),
              Container(color: Colors.black.withOpacity(0.10)),
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(22),
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.10),
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(
                              color: Colors.white.withOpacity(0.28),
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.35),
                                blurRadius: 22,
                                offset: const Offset(0, 12),
                              ),
                            ],
                          ),
                          padding: const EdgeInsets.fromLTRB(22, 18, 22, 22),
                          child: Form(
                            key: _formKey,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 18,
                                    vertical: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.22),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: Colors.white.withOpacity(0.35),
                                    ),
                                  ),
                                  child: Text(
                                    'Iniciar Sesion',
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleLarge
                                        ?.copyWith(
                                          fontWeight: FontWeight.w800,
                                          color: Colors.white,
                                          letterSpacing: .2,
                                        ),
                                  ),
                                ),
                                const SizedBox(height: 18),
                                if (_error != null)
                                  Padding(
                                    padding: const EdgeInsets.only(bottom: 8),
                                    child: Text(
                                      _error!,
                                      style: const TextStyle(
                                        color: Colors.redAccent,
                                      ),
                                      textAlign: TextAlign.center,
                                    ),
                                  ),
                                _NoFloatField(
                                  controller: _user,
                                  hint: 'Usuario',
                                  icon: Icons.person_outline,
                                  validator: (v) => (v == null || v.isEmpty)
                                      ? 'Requerido'
                                      : null,
                                ),
                                const SizedBox(height: 12),
                                _NoFloatField(
                                  controller: _pass,
                                  hint: 'Contraseña',
                                  icon: Icons.lock_outline,
                                  obscure: true,
                                  validator: (v) => (v == null || v.isEmpty)
                                      ? 'Requerido'
                                      : null,
                                ),
                                const SizedBox(height: 16),
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.white,
                                      foregroundColor: const Color(0xFF0f2027),
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 14,
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(30),
                                      ),
                                    ),
                                    onPressed: _loading ? null : _submit,
                                    child: Text(
                                      _loading ? 'Ingresando...' : 'Ingresar',
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// ======= Fondo moderno =======

class _ModernGradientBackground extends StatelessWidget {
  const _ModernGradientBackground();
  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0f2027), Color(0xFF203a43), Color(0xFF2c5364)],
        ),
      ),
    );
  }
}

class _WavesPainter extends CustomPainter {
  final double t;
  _WavesPainter(this.t);

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final p1 = Paint()..color = const Color(0xFFFFFFFF).withOpacity(0.04);
    final p2 = Paint()..color = const Color(0xFF2BD1FF).withOpacity(0.06);

    Path wave(double phase, double heightFactor) {
      final path = Path()..moveTo(0, h);
      for (double x = 0; x <= w; x += 1) {
        final y =
            h * heightFactor +
            18 *
                (1.2) *
                (0.5 *
                    (1 +
                        math.sin(
                          t * 6.283 + x * 0.010 + phase,
                        ))); // 👈 corregido
        path.lineTo(x, y);
      }
      path.lineTo(w, h);
      path.close();
      return path;
    }

    canvas.drawPath(wave(0, .70), p1);
    canvas.drawPath(wave(2.0, .75), p2);
  }

  @override
  bool shouldRepaint(covariant _WavesPainter oldDelegate) => true;
}

class _SkylineLayer extends StatelessWidget {
  const _SkylineLayer();
  @override
  Widget build(BuildContext context) => CustomPaint(painter: _SkylinePainter());
}

class _SkylinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final baseY = size.height * .60;
    final back = Paint()..color = Colors.black.withOpacity(.18);
    final mid = Paint()..color = Colors.black.withOpacity(.26);
    final front = Paint()..color = Colors.black.withOpacity(.36);
    _buildings(canvas, size, baseY + 26, back, [
      80,
      100,
      90,
      110,
      100,
      95,
    ], gap: 22);
    _buildings(canvas, size, baseY + 10, mid, [
      120,
      140,
      115,
      150,
      125,
      135,
    ], gap: 20);
    _buildings(
      canvas,
      size,
      baseY,
      front,
      [160, 190, 170, 200, 175, 165],
      gap: 18,
      thick: true,
    );

    final accent = Paint()..color = const Color(0xFF44D4A8).withOpacity(.7);
    final stroke = Paint()
      ..color = const Color(0xFF44D4A8).withOpacity(.5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6;
    final centers = [
      Offset(size.width * .18, baseY - 150),
      Offset(size.width * .62, baseY - 135),
      Offset(size.width * .85, baseY - 120),
    ];
    for (final c in centers) {
      canvas.drawCircle(c, 2.5, accent);
      canvas.drawCircle(c, 9, stroke);
      canvas.drawCircle(c, 16, stroke..color = stroke.color.withOpacity(.35));
    }
  }

  void _buildings(
    Canvas c,
    Size s,
    double baseY,
    Paint p,
    List<double> hs, {
    double gap = 20,
    bool thick = false,
  }) {
    final w = (s.width - gap * (hs.length - 1)) / hs.length;
    var x = 0.0;
    for (final h in hs) {
      final r = RRect.fromRectAndRadius(
        Rect.fromLTWH(x, baseY - h, w, h),
        const Radius.circular(8),
      );
      c.drawRRect(r, p);
      final win = Paint()..color = Colors.white.withOpacity(0.05);
      final cols = thick ? 4 : 3;
      final rows = (h / 22).floor().clamp(2, 8);
      final cellW = (w - 16) / cols;
      const cellH = 8.0;
      for (int ci = 0; ci < cols; ci++) {
        for (int ri = 0; ri < rows; ri++) {
          final rx = x + 8 + ci * cellW + 2;
          final ry = baseY - h + 9 + ri * 16;
          c.drawRRect(
            RRect.fromRectAndRadius(
              Rect.fromLTWH(rx, ry, cellW - 4, cellH),
              const Radius.circular(3),
            ),
            win,
          );
        }
      }
      x += w + gap;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// ===== Campos sin etiqueta flotante (sin “chip” flotante) =====
class _NoFloatField extends StatefulWidget {
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final bool obscure;
  final String? Function(String?)? validator;

  const _NoFloatField({
    required this.controller,
    required this.hint,
    required this.icon,
    this.obscure = false,
    this.validator,
  });

  @override
  State<_NoFloatField> createState() => _NoFloatFieldState();
}

class _NoFloatFieldState extends State<_NoFloatField> {
  bool _show = false;

  @override
  Widget build(BuildContext context) {
    final isPass = widget.obscure;
    return TextFormField(
      controller: widget.controller,
      validator: widget.validator,
      obscureText: isPass && !_show,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        hintText: widget.hint,
        hintStyle: const TextStyle(color: Colors.white70),
        prefixIcon: Icon(widget.icon, color: Colors.white70),
        suffixIcon: isPass
            ? IconButton(
                onPressed: () => setState(() => _show = !_show),
                icon: Icon(
                  _show ? Icons.visibility_off : Icons.visibility,
                  color: Colors.white70,
                ),
              )
            : null,
        filled: true,
        fillColor: Colors.white.withOpacity(0.10),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Colors.white.withOpacity(0.35)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Colors.white),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Colors.redAccent),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Colors.redAccent),
        ),
        contentPadding: const EdgeInsets.symmetric(
          vertical: 16,
          horizontal: 14,
        ),
        floatingLabelBehavior: FloatingLabelBehavior.never,
      ),
      cursorColor: Colors.white,
    );
  }
}
