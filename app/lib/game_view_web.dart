import 'dart:ui_web' as ui_web;

import 'package:flutter/material.dart';
import 'package:web/web.dart' as web;

class GameView extends StatefulWidget {
  const GameView({super.key, required this.onEvent});

  /// Unused on the web: the browser handles vibration inside the game page.
  final void Function(String event) onEvent;

  @override
  State<GameView> createState() => _GameViewState();
}

class _GameViewState extends State<GameView> {
  static bool _registered = false;
  static const _viewType = 'rage-room-game';

  @override
  void initState() {
    super.initState();
    if (!_registered) {
      _registered = true;
      ui_web.platformViewRegistry.registerViewFactory(_viewType, (int viewId) {
        return web.HTMLIFrameElement()
          ..src = 'assets/assets/game/index.html?app=1'
          ..allow = 'autoplay; fullscreen'
          ..style.border = 'none'
          ..style.width = '100%'
          ..style.height = '100%';
      });
    }
  }

  @override
  Widget build(BuildContext context) => const HtmlElementView(viewType: _viewType);
}
