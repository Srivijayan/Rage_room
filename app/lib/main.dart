import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'game_view.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const RageRoomApp());
}

const pink = Color(0xFFFF2D6F);
const background = Color(0xFF0C0A0F);

class RageRoomApp extends StatelessWidget {
  const RageRoomApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Rage Room',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: background,
        colorScheme: ColorScheme.fromSeed(seedColor: pink, brightness: Brightness.dark),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  void _enter(BuildContext context) {
    Navigator.of(context).push(
      PageRouteBuilder<void>(
        pageBuilder: (_, _, _) => const GameScreen(),
        transitionsBuilder: (_, animation, _, child) => FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.4),
            radius: 1.1,
            colors: [Color(0xFF3A0F22), background],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('💥', style: TextStyle(fontSize: 64)),
                  const SizedBox(height: 12),
                  RichText(
                    text: const TextSpan(
                      style: TextStyle(fontSize: 44, fontWeight: FontWeight.w900, letterSpacing: 3),
                      children: [
                        TextSpan(text: 'RAGE ', style: TextStyle(color: Colors.white)),
                        TextSpan(
                          text: 'ROOM',
                          style: TextStyle(color: pink, shadows: [Shadow(color: pink, blurRadius: 18)]),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Bat, fists, knife, or pick things up and throw them.\nWreck TVs, rip pillows, slash tyres, trash a car and a bus.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white70, fontSize: 16, height: 1.4),
                  ),
                  const SizedBox(height: 36),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: pink,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 18),
                      textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, letterSpacing: 1),
                    ),
                    onPressed: () => _enter(context),
                    child: const Text('ENTER THE ROOM'),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Walk up close · Tap to hit · Drag to look',
                    style: TextStyle(color: Colors.white38, fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class GameScreen extends StatefulWidget {
  const GameScreen({super.key});

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  @override
  void initState() {
    super.initState();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  @override
  void dispose() {
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  // The game reports hits so phones can buzz along with the smashing.
  void _onGameEvent(String event) {
    switch (event) {
      case 'heavy':
        HapticFeedback.heavyImpact();
      case 'break':
        HapticFeedback.mediumImpact();
      default:
        HapticFeedback.lightImpact();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: background,
      body: Stack(
        children: [
          Positioned.fill(child: GameView(onEvent: _onGameEvent)),
          Positioned(
            left: 12,
            top: 12,
            child: SafeArea(
              child: IconButton.filledTonal(
                tooltip: 'Leave the room',
                icon: const Icon(Icons.arrow_back),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
