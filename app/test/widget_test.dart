import 'package:flutter_test/flutter_test.dart';

import 'package:rage_room/main.dart';

void main() {
  testWidgets('Home screen shows the title and enter button', (tester) async {
    await tester.pumpWidget(const RageRoomApp());
    expect(find.text('ENTER THE ROOM'), findsOneWidget);
    expect(find.textContaining('Tap to hit'), findsOneWidget);
  });
}
