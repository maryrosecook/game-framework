# Space shooter spec (first-person, 2D-rendered)

- Screenshot mockup - ./space-game.png
- World model + render: treat everything as 3D coordinates but render in 2D. Use
  billboarding (every square faces the camera) and a custom render that projects
  3D positions onto the 2D screen and scales size by distance.
- Movement: the ship always moves forward with a velocity vector of constant
  magnitude (10 units/sec). The rendered view is the camera looking along this
  vector. Arrow keys rotate the vector (left/right yaw, up/down pitch) while
  keeping its magnitude unchanged. The ship should be able to loop fully.
- UI: always show a centered crosshair.
- Combat: key `1` fires a hitscan laser through the crosshair; hit detection is
  instantaneous. Laser should appear for 200ms. Render laser as a largish dot in the center of the crosshair.
- Targets: 100 stationary square targets that never move after spawning. When
  spawning, pick each square's X, Y, Z randomly in [-100, 100] relative to the
  player start at (0, 0, 0) to loosely distribute them around the player. Some
  will be nearer or farther; that's fine.
- Rendering: squares billboard and scale correctly with distance using the
  custom projection (no 3D models or meshes).
