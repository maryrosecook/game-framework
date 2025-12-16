# Space shooter spec (first-person, 2D-rendered)

- Screenshot mockup - ./space-game.png
- Perspective: fly through pseudo-3D space; all objects are 2D squares
  that always face the camera.
- Movement: ship auto-moves forward at constant speed; heading changes only via
  arrow keys (up/down/left/right).
- UI: always show a centered crosshair.
- Combat: key `1` fires a hitscan laser through the crosshair; hit detection is
  instantaneous. Laser should appear for 200ms.
- Targets: ~10 stationary square targets distributed evenly around the player's
  start position; they never move position.
- Rendering: squares scale with distance (closer draws larger), no 3D
  models or depth-based meshes.
