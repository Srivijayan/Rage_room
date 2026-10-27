// The 3D game is a self-contained HTML page (Three.js + cannon-es) bundled in
// assets/game/index.html. On Android/iOS it runs in a WebView; on the web it
// runs in an iframe.
export 'game_view_mobile.dart' if (dart.library.js_interop) 'game_view_web.dart';
