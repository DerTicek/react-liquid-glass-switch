# Liquid Glass Switch

A draggable React toggle switch with a WebGL liquid glass puck, reverse lens distortion, smooth morphing, and themeable colors.

This package is built for frontends that want a polished switch without bringing in a full design system.

## Live Demo

[Try the live demo](https://react-liquid-glass-switch-9135f5ito-derticeks-projects.vercel.app/)

<p align="center">
  <img src="https://raw.githubusercontent.com/DerTicek/react-liquid-glass-switch/main/assets/liquid-glass-switch-demo.gif" alt="Liquid Glass Switch animation" width="640" />
</p>

## Features

- React component with TypeScript types
- WebGL2 liquid glass puck with refraction, dispersion, glare, and reverse lens distortion
- Click, hold, and drag interactions
- Controlled and uncontrolled modes
- Themeable on color, off color, puck color, size, labels, interaction behavior, and glass tuning
- Live Vite playground with real-time controls for size, colors, backdrop previews, local image backdrops, drag, hold, refraction, glare, and reverse lens settings
- CSS included, no Tailwind requirement
- Vite demo included

## Attribution

The WebGL renderer and shader approach are adapted from [Liquid Glass Studio](https://github.com/iyinchao/liquid-glass-studio) by [Charles Yin](https://github.com/iyinchao), licensed under MIT.

See [NOTICE](NOTICE) and [LICENSE](LICENSE) for details.

## Install

```bash
npm install liquid-glass-switch
```

You can also install the GitHub repo directly:

```bash
npm install github:DerTicek/react-liquid-glass-switch
```

## Quick Start

```tsx
import { LiquidGlassSwitch } from "liquid-glass-switch";
import "liquid-glass-switch/styles.css";

export function SettingsRow() {
  return <LiquidGlassSwitch defaultChecked />;
}
```

## Controlled Usage

```tsx
import { useState } from "react";
import { LiquidGlassSwitch } from "liquid-glass-switch";
import "liquid-glass-switch/styles.css";

export function ControlledExample() {
  const [enabled, setEnabled] = useState(false);

  return (
    <LiquidGlassSwitch
      checked={enabled}
      onCheckedChange={setEnabled}
    />
  );
}
```

## Custom Colors

Use `colors` when you want the visible track and the WebGL refraction to match.

```tsx
<LiquidGlassSwitch
  defaultChecked
  colors={{
    off: "#8e8e93",
    on: "#34c759",
    onLight: "#62e77e",
    onDark: "#1ca446",
    puck: "#ffffff",
    focus: "rgba(255, 255, 255, 0.82)"
  }}
/>
```

## Custom Size

```tsx
<LiquidGlassSwitch width={286} height={126} />
```

If you only provide `width`, the switch derives a proportional height.

## Glass Tuning

The `glass` prop exposes the same kind of shader controls used by the demo playground.

```tsx
<LiquidGlassSwitch
  defaultChecked
  backdrop="demo"
  glass={{
    refThickness: 4.92,
    refFactor: 1.52,
    refDispersion: 9.06,
    reverseLens: 0.17,
    glareSize: 27.76,
    glareHardness: 20,
    glareIntensity: 90,
    glareConvergence: 50,
    glareOppositeSide: 80,
    glareAngle: -45
  }}
/>
```

Use `grabbable={false}` for click-only switches. Use `holdable={false}` if press-and-hold should not morph the puck before movement starts.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `checked` | `boolean` | `undefined` | Controlled checked value. |
| `defaultChecked` | `boolean` | `false` | Initial checked value for uncontrolled usage. |
| `onCheckedChange` | `(checked: boolean) => void` | `undefined` | Called whenever the switch changes state. |
| `disabled` | `boolean` | `false` | Disables pointer interaction. |
| `grabbable` | `boolean` | `true` | Allows the puck to be dragged along the track. |
| `holdable` | `boolean` | `true` | Lets press-and-hold morph the puck into liquid glass before dragging. |
| `width` | `number` | responsive `176` to `236` | Track width in CSS pixels. |
| `height` | `number` | proportional | Track height in CSS pixels. |
| `colors` | `LiquidGlassSwitchColors` | green theme | Theme tokens for the track, puck, and focus ring. |
| `glass` | `Partial<LiquidGlassSwitchGlassSettings>` | iOS-like preset | Shader tuning for refraction, glare, blur, reverse lens, and shape behavior. |
| `backdrop` | `"plain" \| "checker" \| "quadrants" \| "demo" \| "image"` | `"plain"` | Internal shader backdrop sampled by the glass puck. Use `"demo"` to make refraction easy to inspect. |
| `backdropImage` | `string \| null` | `null` | Object URL or image URL used when `backdrop="image"`. |
| `ariaLabelOn` | `string` | `"Turn switch on"` | Label when the current action turns the switch on. |
| `ariaLabelOff` | `string` | `"Turn switch off"` | Label when the current action turns the switch off. |
| `className` | `string` | `""` | Extra class on the root element. |
| `style` | `CSSProperties` | `undefined` | Extra inline style on the root element. |

## CSS Variables

The component sets these variables internally from props. You can still override them in CSS for advanced themes.

```css
.my-switch {
  --lg-switch-off: #5d6470;
  --lg-switch-on: #34c759;
  --lg-switch-on-light: #62e77e;
  --lg-switch-on-dark: #1ca446;
  --lg-switch-puck: #ffffff;
  --lg-switch-focus: rgba(255, 255, 255, 0.82);
}
```

## Framework Notes

This component uses WebGL2 and the DOM, so render it on the client.

For Next.js, load it through a client component:

```tsx
"use client";

import { LiquidGlassSwitch } from "liquid-glass-switch";
import "liquid-glass-switch/styles.css";

export default function ClientSwitch() {
  return <LiquidGlassSwitch />;
}
```

## Development

For contributors working on the package locally:

```bash
npm install
npm run dev
npm run build:lib
npm run build:demo
```

The demo runs through Vite and imports the local source component.

## Demo Deployment

The demo can be deployed as a static Vite site on Vercel.

Vercel uses [vercel.json](vercel.json):

```json
{
  "buildCommand": "npm run build:demo",
  "outputDirectory": "demo-dist"
}
```

Use the project root when importing the repository. The demo build outputs `demo-dist`, while `npm run build` and `npm run build:lib` produce the package files in `dist`.

For a local production preview of the demo:

```bash
npm run build:demo
npm run preview:demo
```

## Browser Support

The effect requires WebGL2. Modern Chromium, Firefox, and Safari versions support WebGL2. If WebGL2 is unavailable, the component will not be able to render the liquid puck shader.

## Accessibility

The root control is a native `button` with `aria-pressed`. Use `ariaLabelOn` and `ariaLabelOff` when your UI language or action copy differs from the defaults.

## License

MIT. See [LICENSE](LICENSE).
