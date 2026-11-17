## Devvit Phaser Starter

A starter to build web applications on Reddit's developer platform

- [Devvit](https://developers.reddit.com/): A way to build and deploy immersive games on Reddit
- [Vite](https://vite.dev/): For compiling the webView
- [Phaser](https://phaser.io/): 2D game engine
- [Hono](https://hono.dev/): For backend logic
- [TypeScript](https://www.typescriptlang.org/): For type safety

## Getting Started

> Make sure you have Node 22 downloaded on your machine before running!

1. Run `npm create devvit@latest --template=phaser`
2. Go through the installation wizard. You will need to create a Reddit account and connect it to Reddit developers
3. Copy the command on the success page into your terminal

## Commands

- `npm run dev`: Starts a development server where you can develop your application live on Reddit.
- `npm run local`: Runs the game client locally at `http://127.0.0.1:5173` without Reddit or the Devvit backend.
- `npm run editor`: Runs the standalone editor shell locally at `http://127.0.0.1:5174`.
- `npm run build`: Builds your client and server projects
- `npm run deploy`: Uploads a new version of your app
- `npm run launch`: Publishes your app for review
- `npm run login`: Logs your CLI into Reddit
- `npm run type-check`: Type checks, lints, and prettifies your app

## Documentation

- [Enemy Detection AI System](docs/ENEMY_DETECTION.md): Detailed specifications for enemy vision range, Line-of-Sight raycasting, and proximity detection.
- [Hit Spark Effects](docs/HIT_SPARKS.md): Spark counts and motion for enemy and player hits.
- [Virtual Touch Controls](docs/TOUCH_CONTROLS.md): Viewport-based visibility, touch behavior, and debug testing.

## Credits

Thanks to the Phaser team for [providing a great template](https://github.com/phaserjs/template-vite-ts)!
