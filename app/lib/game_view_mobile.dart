import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class GameView extends StatefulWidget {
  const GameView({super.key, required this.onEvent});

  /// Called with 'hit', 'break' or 'heavy' when something gets smashed.
  final void Function(String event) onEvent;

  @override
  State<GameView> createState() => _GameViewState();
}

class _GameViewState extends State<GameView> {
  late final WebViewController _controller;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0C0A0F))
      ..addJavaScriptChannel('RageRoom', onMessageReceived: (m) => widget.onEvent(m.message))
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) {
          // Tell the game it runs inside the app, so it leaves room for the back button.
          _controller.runJavaScript("document.body.classList.add('in-app')");
          if (mounted) setState(() => _loading = false);
        },
      ))
      ..loadFlutterAsset('assets/game/index.html');
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        WebViewWidget(controller: _controller),
        if (_loading) const Center(child: CircularProgressIndicator()),
      ],
    );
  }
}
