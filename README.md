# Rage Room

A 3D virtual rage room with a garage. Walk around, then smash glasses, bottles, plates, mugs, vases, jars, a teapot, plants, a lamp, a laptop, a printer, a CRT TV, a monitor, chairs, crates, a standing mirror, a bed with pillows and a teddy, a sofa, spare tyres, a car and a city bus. Runs on the web, Android and iOS from one Flutter project.

**Controls**
- **Walk:** joystick (phone) or WASD / arrow keys (computer)
- **Look around:** drag on the screen (phone); on a computer, click once to lock the mouse, then move it to look and click to hit what's under the crosshair (Esc unlocks)
- **Zoom:** pinch with two fingers (phone), mouse wheel (computer), the + / − buttons, or the + / − keys
- **Hit / grab / throw:** tap (or click, or Space)
- **Switch mode:** the Bat / Fists / Knife / Grab buttons, or keys 1 / 2 / 3 / 4 (Q cycles)
- **Refill** brings everything back; 🔊 toggles sound

**Modes**
- **Bat**: 2 m reach, 2 damage per hit
- **Fists**: 1.4 m reach, 1 damage per punch, left and right in turn
- **Knife**: 1.5 m reach. The only thing that rips soft stuff: pillows burst into feathers, the mattress, sofa, cushions and teddy spill foam and tear apart, tyres (spare ones and the vehicles') hiss and go flat, and car paint gets scratched. Every stab leaves a cut mark.
- **Grab**: 1.8 m reach; pick up anything up to 15 kg, carry it, tap again to throw it. Thrown things break on impact, and can break vehicle windows.

You have to walk up to things (reach is measured along the floor, so you can bend down to tyres): anything further than your reach shows "Too far — walk closer".

**Toughness:** glass and ceramics break in one hit; chairs and crates take 2 bat hits; the laptop 2; the monitor and printer 2; the TV 3 (twice as many punches each). Vehicle windows crack on the first hit and shatter on the next; lights and the bus destination board shatter in one hit; mirrors snap off; the bodywork dents where you hit it. Hitting the car sets off its alarm; hitting the bus sounds its horn. Bats and fists just bounce off soft things and tyres. A flat tyre makes the vehicle sag onto that corner. Soft things take knife stabs: pillows, cushions and the teddy 2, the mattress 5, the sofa 8.

**Furniture breaks too:** the table, shelf, workbench, TV crate, monitor desk and bed frame crack with each bat hit or punch, make whatever is standing on them hop, and finally collapse into planks, dropping everything on top. Bat hits to break: monitor desk 2, table and TV crate 3, shelf and workbench 4, bed 5 (twice as many punches). A knife only carves them. Refill rebuilds them.

## Project layout

```
rage_room/
├── app/          Flutter app (web, Android, iOS)
│   ├── lib/main.dart              Home screen + game screen, haptics
│   ├── lib/game_view_mobile.dart  Runs the game in a WebView (Android/iOS)
│   ├── lib/game_view_web.dart     Runs the game in an iframe (web)
│   └── assets/game/index.html     The built 3D game (generated, don't edit)
└── game_src/     The 3D game itself (JavaScript)
    ├── src/main.js      Building, walking, weapons, physics, smashing
    ├── src/objects.js   Every smashable object (look, physics, toughness)
    ├── src/vehicles.js  The car and the bus, built from breakable parts
    ├── src/audio.js     All sounds (synthesized, no audio files)
    ├── src/textures.js  Brick, concrete, wood and neon textures
    ├── src/index.html   Page + on-screen buttons
    └── build.mjs        Bundles everything into app/assets/game/index.html
```

The 3D game uses **Three.js** (3D graphics) and **cannon-es** (physics). Flutter's own 3D support is still experimental, so the game runs inside the Flutter app as one self-contained HTML page. It works fully offline and needs no internet connection.

## Run it

You need the [Flutter SDK](https://docs.flutter.dev/get-started/install). For Android you also need Android Studio; for iOS you need a Mac with Xcode.

```bash
cd app
flutter pub get

flutter run -d chrome          # in the browser
flutter run                    # on a connected Android/iPhone
```

## Build for release

```bash
cd app
flutter build apk --release                         # Android APK → build/app/outputs/flutter-apk/app-release.apk
flutter build appbundle --release                   # Play Store bundle
flutter build ios --release                         # iOS (on a Mac)
flutter build web --release --no-web-resources-cdn  # website → build/web (upload to any static host)
```

To install the APK on your phone, copy `app-release.apk` to the phone and open it. You'll need to allow "Install unknown apps".

## Put it on the web with Vercel

`vercel_site/` is ready to deploy: the whole game in one `index.html` (about 650 KB, loads fast on phones) plus `vercel.json`. `node build.mjs` keeps it up to date.

**From the command line** (needs Node.js):

```bash
npm i -g vercel
cd vercel_site
vercel          # first time: log in and answer the setup questions (defaults are fine)
vercel --prod   # publish to your live URL
```

**From GitHub:** push this project to a GitHub repository, then in Vercel choose *Add New → Project*, import the repository, set **Root Directory** to `vercel_site`, set **Framework Preset** to *Other*, leave the build command empty, and deploy.

The full Flutter web app (`app/build/web`, with the home screen) also works on Vercel, but browsers download about 8 MB before it starts, so the single-page game is the better choice for the website. Keep Flutter for the Android and iPhone apps.

## Change the game

Edit files in `game_src/src/`, then rebuild the game asset:

```bash
cd game_src
npm install
node build.mjs     # writes app/assets/game/index.html and dist/index.html
```

Open `game_src/dist/index.html` in a browser to try changes without Flutter.

Ideas: add objects to `TYPES` in `objects.js` and place them in `layoutRoom()` in `main.js`; add vehicles in `vehicles.js` and `VEHICLE_SPOTS` in `main.js`; change the neon signs in the `neonSign(...)` calls.
