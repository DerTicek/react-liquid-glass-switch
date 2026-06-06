import { useEffect, useState, type CSSProperties } from "react";
import {
  LiquidGlassSwitch,
  type LiquidGlassSwitchBackdrop,
  type LiquidGlassSwitchGlassSettings,
} from "../index";

const defaultGlass: LiquidGlassSwitchGlassSettings = {
  refThickness: 7.2,
  refFactor: 1.85,
  refDispersion: 8.48,
  refFresnelRange: 34,
  refFresnelHardness: 16,
  reverseLens: 0.22,
  blurRadius: 1,
  blurEdge: true,
  shapeRoundness: 2,
  mergeRate: 0.055,
  step: 9,
  glareSize: 31,
  glareHardness: 18,
  glareIntensity: 82,
  glareConvergence: 56,
  glareOppositeSide: 78,
  glareAngle: -42,
};

type RangeControlProps = {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
  value: number;
};

type ToggleControlProps = {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

type ColorControlProps = {
  label: string;
  onChange: (value: string) => void;
  value: string;
};

type BackdropChoice = {
  label: string;
  value: Exclude<LiquidGlassSwitchBackdrop, "image">;
};

const backdropChoices: BackdropChoice[] = [
  { label: "Demo grid", value: "demo" },
  { label: "Plain", value: "plain" },
  { label: "Checker", value: "checker" },
  { label: "Quadrants", value: "quadrants" },
];

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
}

function RangeControl({ label, max, min, onChange, step = 1, suffix = "", value }: RangeControlProps) {
  return (
    <label className="demo-range-control">
      <span className="demo-control-row">
        <span>{label}</span>
        <output>
          {formatNumber(value)}
          {suffix}
        </output>
      </span>
      <input
        aria-label={label}
        max={max}
        min={min}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

function ToggleControl({ checked, label, onChange }: ToggleControlProps) {
  return (
    <label className="demo-toggle-control">
      <span>{label}</span>
      <input
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        type="checkbox"
      />
    </label>
  );
}

function ColorControl({ label, onChange, value }: ColorControlProps) {
  return (
    <label className="demo-color-control">
      <span>{label}</span>
      <input
        aria-label={label}
        onChange={(event) => onChange(event.currentTarget.value)}
        type="color"
        value={value}
      />
    </label>
  );
}

export default function DemoApp() {
  const [checked, setChecked] = useState(true);
  const [width, setWidth] = useState(236);
  const [height, setHeight] = useState(102);
  const [grabbable, setGrabbable] = useState(true);
  const [holdable, setHoldable] = useState(true);
  const [backdrop, setBackdrop] = useState<LiquidGlassSwitchBackdrop>("demo");
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const [localImageName, setLocalImageName] = useState("");
  const [offColor, setOffColor] = useState("#8e8e93");
  const [onColor, setOnColor] = useState("#34c759");
  const [onLightColor, setOnLightColor] = useState("#5ee878");
  const [onDarkColor, setOnDarkColor] = useState("#1fb84a");
  const [glass, setGlass] = useState<LiquidGlassSwitchGlassSettings>(defaultGlass);

  function updateGlass<K extends keyof LiquidGlassSwitchGlassSettings>(
    key: K,
    value: LiquidGlassSwitchGlassSettings[K],
  ) {
    setGlass((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetDefaults() {
    setChecked(true);
    setWidth(236);
    setHeight(102);
    setGrabbable(true);
    setHoldable(true);
    setBackdrop("demo");
    setOffColor("#8e8e93");
    setOnColor("#34c759");
    setOnLightColor("#5ee878");
    setOnDarkColor("#1fb84a");
    setGlass(defaultGlass);
  }

  function chooseImage(file: File | undefined) {
    if (!file) {
      return;
    }

    const nextUrl = URL.createObjectURL(file);

    setLocalImageUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return nextUrl;
    });
    setLocalImageName(file.name);
    setBackdrop("image");
  }

  useEffect(() => {
    return () => {
      if (localImageUrl) {
        URL.revokeObjectURL(localImageUrl);
      }
    };
  }, [localImageUrl]);

  const previewStyle = localImageUrl
    ? ({
        "--demo-local-image": `url("${localImageUrl}")`,
      } as CSSProperties)
    : undefined;

  return (
    <main className="demo-shell">
      <section className="demo-playground" aria-labelledby="demo-title">
        <div className="demo-preview" aria-label="Live liquid glass switch preview">
          <div className={`demo-distortion-field demo-backdrop-${backdrop}`} style={previewStyle}>
            <LiquidGlassSwitch
              backdrop={backdrop}
              backdropImage={localImageUrl}
              checked={checked}
              colors={{
                off: offColor,
                on: onColor,
                onDark: onDarkColor,
                onLight: onLightColor,
              }}
              glass={glass}
              grabbable={grabbable}
              height={height}
              holdable={holdable}
              onCheckedChange={setChecked}
              width={width}
            />
          </div>

          <div className="demo-preview-bar">
            <span>{checked ? "ON" : "OFF"}</span>
            <button type="button" onClick={() => setChecked((value) => !value)}>
              Toggle
            </button>
          </div>
        </div>

        <div className="demo-controls" aria-label="Switch settings">
          <header className="demo-heading">
            <p>React component</p>
            <h1 id="demo-title">Liquid Glass Switch</h1>
          </header>

          <section className="demo-control-group" aria-label="Size">
            <h2>Size</h2>
            <RangeControl label="Width" max={340} min={176} onChange={setWidth} suffix="px" value={width} />
            <RangeControl label="Height" max={140} min={72} onChange={setHeight} suffix="px" value={height} />
          </section>

          <section className="demo-control-group" aria-label="Behavior">
            <h2>Behavior</h2>
            <div className="demo-toggle-grid">
              <ToggleControl checked={grabbable} label="Grabbable puck" onChange={setGrabbable} />
              <ToggleControl checked={holdable} label="Hold morph" onChange={setHoldable} />
              <ToggleControl
                checked={glass.blurEdge}
                label="Blur edge"
                onChange={(value) => updateGlass("blurEdge", value)}
              />
            </div>
            <div className="demo-backdrop-picker" aria-label="Shader backdrop">
              <span className="demo-backdrop-title">Shader backdrop</span>
              <div className="demo-backdrop-grid">
                {backdropChoices.map((choice) => (
                  <button
                    aria-pressed={backdrop === choice.value}
                    className="demo-backdrop-card"
                    key={choice.value}
                    onClick={() => setBackdrop(choice.value)}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className={`demo-backdrop-thumb demo-backdrop-thumb-${choice.value}`}
                    />
                    <span>{choice.label}</span>
                  </button>
                ))}
                <label
                  className={`demo-backdrop-card demo-backdrop-upload${backdrop === "image" ? " is-selected" : ""}`}
                >
                  <input
                    accept="image/*"
                    aria-label="Choose local image backdrop"
                    onChange={(event) => chooseImage(event.currentTarget.files?.[0])}
                    type="file"
                  />
                  <span
                    aria-hidden="true"
                    className="demo-backdrop-thumb demo-backdrop-thumb-image"
                    style={previewStyle}
                  />
                  <span>{localImageName || "Local image"}</span>
                </label>
              </div>
            </div>
          </section>

          <section className="demo-control-group" aria-label="Track colors">
            <h2>Track Colors</h2>
            <div className="demo-color-grid">
              <ColorControl label="Off" onChange={setOffColor} value={offColor} />
              <ColorControl label="On" onChange={setOnColor} value={onColor} />
              <ColorControl label="On light" onChange={setOnLightColor} value={onLightColor} />
              <ColorControl label="On dark" onChange={setOnDarkColor} value={onDarkColor} />
            </div>
          </section>

          <section className="demo-control-group demo-control-group-wide" aria-label="Glass settings">
            <h2>Liquid Glass</h2>
            <div className="demo-range-grid">
              <RangeControl
                label="Ref thickness"
                max={12}
                min={0}
                onChange={(value) => updateGlass("refThickness", value)}
                step={0.01}
                value={glass.refThickness}
              />
              <RangeControl
                label="Ref factor"
                max={4}
                min={0}
                onChange={(value) => updateGlass("refFactor", value)}
                step={0.01}
                value={glass.refFactor}
              />
              <RangeControl
                label="Ref dispersion"
                max={20}
                min={0}
                onChange={(value) => updateGlass("refDispersion", value)}
                step={0.01}
                value={glass.refDispersion}
              />
              <RangeControl
                label="Reverse lens"
                max={0.36}
                min={0}
                onChange={(value) => updateGlass("reverseLens", value)}
                step={0.01}
                value={glass.reverseLens}
              />
              <RangeControl
                label="Blur radius"
                max={24}
                min={0}
                onChange={(value) => updateGlass("blurRadius", value)}
                value={glass.blurRadius}
              />
              <RangeControl
                label="Fresnel range"
                max={80}
                min={1}
                onChange={(value) => updateGlass("refFresnelRange", value)}
                step={0.5}
                value={glass.refFresnelRange}
              />
              <RangeControl
                label="Fresnel hardness"
                max={100}
                min={0}
                onChange={(value) => updateGlass("refFresnelHardness", value)}
                value={glass.refFresnelHardness}
              />
              <RangeControl
                label="Shape roundness"
                max={6}
                min={1}
                onChange={(value) => updateGlass("shapeRoundness", value)}
                step={0.1}
                value={glass.shapeRoundness}
              />
              <RangeControl
                label="Merge rate"
                max={0.18}
                min={0}
                onChange={(value) => updateGlass("mergeRate", value)}
                step={0.01}
                value={glass.mergeRate}
              />
              <RangeControl
                label="Render step"
                max={9}
                min={0}
                onChange={(value) => updateGlass("step", value)}
                value={glass.step}
              />
              <RangeControl
                label="Glare size"
                max={80}
                min={1}
                onChange={(value) => updateGlass("glareSize", value)}
                step={0.01}
                value={glass.glareSize}
              />
              <RangeControl
                label="Glare hardness"
                max={100}
                min={0}
                onChange={(value) => updateGlass("glareHardness", value)}
                value={glass.glareHardness}
              />
              <RangeControl
                label="Glare intensity"
                max={100}
                min={0}
                onChange={(value) => updateGlass("glareIntensity", value)}
                value={glass.glareIntensity}
              />
              <RangeControl
                label="Glare convergence"
                max={100}
                min={0}
                onChange={(value) => updateGlass("glareConvergence", value)}
                value={glass.glareConvergence}
              />
              <RangeControl
                label="Glare opposite side"
                max={100}
                min={0}
                onChange={(value) => updateGlass("glareOppositeSide", value)}
                value={glass.glareOppositeSide}
              />
              <RangeControl
                label="Glare angle"
                max={180}
                min={-180}
                onChange={(value) => updateGlass("glareAngle", value)}
                suffix="deg"
                value={glass.glareAngle}
              />
            </div>
          </section>

          <button className="demo-reset" type="button" onClick={resetDefaults}>
            Reset defaults
          </button>
        </div>
      </section>
    </main>
  );
}
