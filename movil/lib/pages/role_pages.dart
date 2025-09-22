// lib/pages/role_pages.dart
import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';

import '../services/auth.dart';
import '../services/theme_service.dart';

/// ===============================================================
/// HOME POR ROL
/// ===============================================================

class ResidentHomePage extends StatelessWidget {
  const ResidentHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return _SmartShell(
      title: 'Mi Condominio',
      subtitle: 'Panel de Residente',
      // Para residente sí mostramos "Ver unidad"
      unitCard: const _UnitSummaryCard(
        unitName: 'Torre A • Dpto. 502',
        balance: -125.50,
        nextDue: '10/10/2025',
        area: '85 m²',
        showUnitButton: true,
      ),
      tiles: const [
        _NavTileData(
          icon: Icons.account_balance_wallet_outlined,
          title: 'Estado de cuenta',
          page: AccountStatusPage(),
        ),
        _NavTileData(
          icon: Icons.payments_outlined,
          title: 'Pago en línea',
          page: OnlinePaymentPage(),
        ),
        _NavTileData(
          icon: Icons.receipt_long_outlined,
          title: 'Comprobante',
          page: ReceiptPage(),
        ),
        _NavTileData(
          icon: Icons.campaign_outlined,
          title: 'Avisos',
          page: NoticesPage(),
        ),
        _NavTileData(
          icon: Icons.event_available_outlined,
          title: 'Disponibilidad',
          page: CommonAvailabilityPage(),
        ),
        _NavTileData(
          icon: Icons.event_note_outlined,
          title: 'Reservas',
          page: ManageCommonAreaPage(),
        ),
        _NavTileData(
          icon: Icons.how_to_reg_outlined,
          title: 'Visitas',
          page: VisitsPage(),
        ),
        _NavTileData(
          icon: Icons.home_work_outlined,
          title: 'Mi unidad',
          page: MyUnitPage(),
        ),
      ],
    );
  }
}

class StaffHomePage extends StatelessWidget {
  const StaffHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return _SmartShell(
      title: 'Operaciones',
      subtitle: 'Panel de Personal',
      // Para staff ocultamos "Ver unidad" (fix pedido)
      unitCard: const _UnitSummaryCard(
        unitName: 'Puesto: Portería 1',
        balance: 0,
        nextDue: '-',
        area: 'Turno 08:00–16:00',
        showUnitButton: false,
      ),
      tiles: const [
        _NavTileData(
          icon: Icons.campaign_outlined,
          title: 'Avisos',
          page: NoticesPage(),
        ),
        _NavTileData(
          icon: Icons.event_available_outlined,
          title: 'Disponibilidad',
          page: CommonAvailabilityPage(),
        ),
        _NavTileData(
          icon: Icons.event_available,
          title: 'Confirmar/cobrar',
          page: ConfirmChargeReservationPage(),
        ),
        _NavTileData(
          icon: Icons.how_to_reg_outlined,
          title: 'Visitas',
          page: VisitsPage(),
        ),
      ],
    );
  }
}

/// ===============================================================
/// SHELL + UI
/// ===============================================================

class _SmartShell extends StatelessWidget {
  final String title;
  final String subtitle;
  final _UnitSummaryCard unitCard;
  final List<_NavTileData> tiles;

  const _SmartShell({
    required this.title,
    required this.subtitle,
    required this.unitCard,
    required this.tiles,
  });

  Future<void> _logout(BuildContext context) async {
    await Auth.logout();
    if (context.mounted) {
      Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text(title),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        actions: [
          IconButton(
            tooltip: 'Tema claro/oscuro',
            icon: Icon(isDark ? Icons.light_mode : Icons.dark_mode),
            onPressed: () => ThemeService.instance.toggle(),
          ),
          IconButton(
            tooltip: 'Perfil',
            icon: const Icon(Icons.person),
            onPressed: () => Navigator.pushNamed(context, '/profile'),
          ),
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout),
            onPressed: () => _logout(context),
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          _AdaptiveBackground(colorScheme: cs),
          SafeArea(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: [
                _GlassHeader(text: subtitle),
                const SizedBox(height: 14),
                unitCard,
                const SizedBox(height: 14),
                GridView.builder(
                  physics: const NeverScrollableScrollPhysics(),
                  shrinkWrap: true,
                  itemCount: tiles.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 14,
                    mainAxisSpacing: 14,
                    childAspectRatio: 1.08,
                  ),
                  itemBuilder: (context, i) {
                    final t = tiles[i];
                    return _GlassTile(
                      icon: t.icon,
                      title: t.title,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => t.page),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GlassHeader extends StatelessWidget {
  final String text;
  const _GlassHeader({required this.text});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: cs.surface.withOpacity(.28),
            border: Border.all(color: cs.outlineVariant.withOpacity(.6)),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              Icon(Icons.apartment, color: cs.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  text,
                  style: TextStyle(
                    color: cs.onSurface,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// ===============================================================
/// TARJETA RESUMEN (con fix de overflow y botón opcional)
/// ===============================================================

class _UnitSummaryCard extends StatelessWidget {
  final String unitName;
  final double balance;
  final String nextDue;
  final String area;
  final bool showUnitButton;

  const _UnitSummaryCard({
    required this.unitName,
    required this.balance,
    required this.nextDue,
    required this.area,
    this.showUnitButton = true,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isDebt = balance < 0;

    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          decoration: BoxDecoration(
            color: cs.surface.withOpacity(.28),
            border: Border.all(color: cs.outlineVariant.withOpacity(.6)),
            borderRadius: BorderRadius.circular(18),
          ),
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icono
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: cs.primaryContainer.withOpacity(.6),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.home_work, color: cs.onPrimaryContainer),
              ),
              const SizedBox(width: 12),

              // Contenido flexible (evita overflow)
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Fila: título + botón opcional
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            unitName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: cs.onSurface,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (showUnitButton)
                          TextButton(
                            style: TextButton.styleFrom(
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                              ),
                            ),
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const MyUnitPage(),
                                ),
                              );
                            },
                            child: Text(
                              'Ver unidad',
                              style: TextStyle(color: cs.primary),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    // Fila: estado (icono + texto expandido)
                    Row(
                      children: [
                        Icon(
                          isDebt
                              ? Icons.warning_amber_rounded
                              : Icons.check_circle,
                          size: 16,
                          color: isDebt
                              ? Colors.orangeAccent
                              : Colors.lightGreen,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            isDebt
                                ? 'Saldo pendiente: S/. ${(-balance).toStringAsFixed(2)} • Vence: $nextDue'
                                : 'Sin deudas • Área: $area • 08:00–16:00',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(color: cs.onSurfaceVariant),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GlassTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;

  const _GlassTile({
    required this.icon,
    required this.title,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: Stack(
        children: [
          BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
            child: Container(),
          ),
          InkWell(
            onTap: onTap,
            child: Container(
              decoration: BoxDecoration(
                color: cs.surface.withOpacity(.28),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: cs.outlineVariant.withOpacity(.6)),
              ),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, size: 42, color: cs.primary),
                    const SizedBox(height: 10),
                    Text(
                      title,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: cs.onSurface,
                        fontWeight: FontWeight.w600,
                        letterSpacing: .2,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// ===============================================================
/// FONDO ADAPTATIVO (mismo estilo que el login moderno)
/// ===============================================================

class _AdaptiveBackground extends StatelessWidget {
  final ColorScheme colorScheme;
  const _AdaptiveBackground({required this.colorScheme});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final gradientColors = isDark
        ? const [Color(0xFF0f2027), Color(0xFF203a43), Color(0xFF2c5364)]
        : const [Color(0xFFE6F0FF), Color(0xFFDDEBFF), Color(0xFFCCE3FF)];

    return Stack(
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: gradientColors,
            ),
          ),
        ),
        CustomPaint(
          painter: _NetworkPatternPainter(isDark: isDark, cs: colorScheme),
        ),
      ],
    );
  }
}

class _NetworkPatternPainter extends CustomPainter {
  final bool isDark;
  final ColorScheme cs;
  _NetworkPatternPainter({required this.isDark, required this.cs});

  @override
  void paint(Canvas canvas, Size size) {
    final grid = Paint()
      ..color = (isDark ? Colors.white : Colors.black).withOpacity(.05)
      ..strokeWidth = 1;
    const step = 36.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }

    final dot = Paint()..color = cs.primary.withOpacity(.10);
    for (double x = step; x < size.width; x += step * 2) {
      for (double y = step; y < size.height; y += step * 2) {
        canvas.drawCircle(Offset(x, y), 7, dot);
      }
    }

    // Ondas suaves
    final wave = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..color = cs.primary.withOpacity(.18);

    Path path(double phase, double heightFactor) {
      final p = Path()..moveTo(0, size.height * .25);
      for (double x = 0; x <= size.width; x += 6) {
        final t = x / size.width;
        final y =
            size.height *
            (.25 + heightFactor * math.sin(t * math.pi * 2 + phase));
        p.lineTo(x, y);
      }
      return p;
    }

    canvas.drawPath(path(.0, .05), wave);
    canvas.drawPath(path(.8, .07), wave);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// ===============================================================
/// STUBS (pantallas placeholder para los CU móviles)
/// ===============================================================

class AccountStatusPage extends StatelessWidget {
  const AccountStatusPage({super.key});
  @override
  Widget build(BuildContext context) =>
      _SimpleScaffold(title: 'Estado de cuenta (CU10)');
}

class OnlinePaymentPage extends StatelessWidget {
  const OnlinePaymentPage({super.key});
  @override
  Widget build(BuildContext context) =>
      _SimpleScaffold(title: 'Pago en línea (CU11)');
}

class ReceiptPage extends StatelessWidget {
  const ReceiptPage({super.key});
  @override
  Widget build(BuildContext context) =>
      _SimpleScaffold(title: 'Comprobante (CU12)');
}

class NoticesPage extends StatelessWidget {
  const NoticesPage({super.key});
  @override
  Widget build(BuildContext context) =>
      _SimpleScaffold(title: 'Avisos y comunicados (CU13)');
}

class CommonAvailabilityPage extends StatelessWidget {
  const CommonAvailabilityPage({super.key});
  @override
  Widget build(BuildContext context) =>
      _SimpleScaffold(title: 'Disponibilidad área común (CU16)');
}

class ManageCommonAreaPage extends StatelessWidget {
  const ManageCommonAreaPage({super.key});
  @override
  Widget build(BuildContext context) =>
      _SimpleScaffold(title: 'Reservas / Área común (CU17)');
}

class ConfirmChargeReservationPage extends StatelessWidget {
  const ConfirmChargeReservationPage({super.key});
  @override
  Widget build(BuildContext context) =>
      _SimpleScaffold(title: 'Confirmar y cobrar reserva (CU18)');
}

class VisitsPage extends StatelessWidget {
  const VisitsPage({super.key});
  @override
  Widget build(BuildContext context) =>
      _SimpleScaffold(title: 'Gestionar Visitas (CU22)');
}

class MyUnitPage extends StatelessWidget {
  const MyUnitPage({super.key});
  @override
  Widget build(BuildContext context) => _SimpleScaffold(title: 'Mi unidad');
}

class _SimpleScaffold extends StatelessWidget {
  final String title;
  const _SimpleScaffold({required this.title});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          _AdaptiveBackground(colorScheme: cs),
          SafeArea(
            child: Column(
              children: [
                AppBar(title: Text(title), backgroundColor: Colors.transparent),
                const Expanded(
                  child: Center(
                    child: Text(
                      'Contenido pendiente de implementar',
                      style: TextStyle(fontSize: 15),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// ===============================================================
/// DATA
/// ===============================================================

class _NavTileData {
  final IconData icon;
  final String title;
  final Widget page;
  const _NavTileData({
    required this.icon,
    required this.title,
    required this.page,
  });
}
