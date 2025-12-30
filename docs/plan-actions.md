# Action UI + behaviors plan (terse)

## Data model

- `BehaviorAction` stored in blueprints: `{ action: string; settings: ActionSettings }`.
- `BlueprintBehaviors`: `Partial<Record<TriggerName, BehaviorAction[]>>` (always array; never single).
- `ActionSettings` in behavior: values only (no metadata). Merge with defaults when running/rendering.
- `ActionDefinition` adds param schema + defaults with typed setting variants:
  - `ActionSettingNumber = { kind: "number"; default: number; min?: number; max?: number; step?: number }`
  - `ActionSettingString = { kind: "string"; default: string; maxLength?: number; placeholder?: string }`
  - `ActionSettingBoolean = { kind: "boolean"; default: boolean }`
  - `ActionSettingEnum = { kind: "enum"; default: string; options: string[] }`
  - `ActionSetting = ActionSettingNumber | ActionSettingString | ActionSettingBoolean | ActionSettingEnum`
  - `settings: Record<string, ActionSetting>`
  - UI uses `kind` + options metadata to render controls.
  - Runtime uses `default` when a setting is missing.

## Actions

- Keep `moveWithArrows` name; update to use params schema `{ speed: { kind: "number", default: 6 } }` and accept arrow/WASD.
- Add `spawnObject`: params `{ blueprint: { kind: "enum", default: "" } }`; allowed triggers: all; spawn at same position as thing; warn if blueprint missing.
- Add `destroy`: no params (`settings: {}`); allowed triggers: all.
- Action labels derived from key (camelCase → Sentence case) for UI.

## Engine/runtime

- Normalize behaviors on load/hot reload:
  - Assume `BehaviorAction[]` only. Port existing data to this shape as part of migration.
  - Merge `ActionDefinition.settings.default` into behavior settings.
- Execution:
  - `ActionDefinition.code` receives an `ActionContext` (trigger-specific args + resolved settings).
  - Respect `allowedTriggers`.

## UI (Action tab)

- Add new **Action** tab last in panel.
- **When** control: select with hint text “When”; selecting adds a trigger entry if missing.
- For each trigger entry:
  - Render a padded container with trigger name header.
  - Render action lozenges with delete “x”.
  - Show a **Then** select (no button) with hint text “Then…”. Choosing adds action with default settings.
  - Do not remove trigger section when its action list becomes empty.
- Spawn action settings UI: dropdown of available blueprint names; warn if saved blueprint no longer exists.

## Blueprint rename handling

- On rename, update any `spawnObject` settings that reference the old blueprint name.
- Share rename-update logic between reducer and engine if it stays clean (e.g., a small pure helper). Duplication is acceptable if sharing would contort code.

## Validation/tests

- Migrate existing data (game.json + in-memory) to the new `BehaviorAction[]` shape; do not accept or coerce any other formats at runtime.
- `npx tsc` must pass.
