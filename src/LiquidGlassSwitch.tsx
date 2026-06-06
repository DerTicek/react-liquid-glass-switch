import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import "./LiquidGlassSwitch.css";
import { MultiPassRenderer } from "./internal/GLUtils";

import VertexShader from "./internal/shaders/vertex.glsl?raw";
import FragmentBgShader from "./internal/shaders/fragment-bg.glsl?raw";
import FragmentBgVblurShader from "./internal/shaders/fragment-bg-vblur.glsl?raw";
import FragmentBgHblurShader from "./internal/shaders/fragment-bg-hblur.glsl?raw";
import FragmentMainShader from "./internal/shaders/fragment-main.glsl?raw";

export type LiquidGlassSwitchColors = {
  off?: string;
  on?: string;
  onLight?: string;
  onDark?: string;
  puck?: string;
  focus?: string;
};

export type LiquidGlassSwitchBackdrop = "plain" | "checker" | "quadrants" | "split" | "demo";

export type LiquidGlassSwitchGlassSettings = {
  refThickness: number;
  refFactor: number;
  refDispersion: number;
  refFresnelRange: number;
  refFresnelHardness: number;
  reverseLens: number;
  blurRadius: number;
  blurEdge: boolean;
  shapeRoundness: number;
  mergeRate: number;
  step: number;
  glareSize: number;
  glareHardness: number;
  glareIntensity: number;
  glareConvergence: number;
  glareOppositeSide: number;
  glareAngle: number;
};

export type LiquidGlassSwitchProps = {
  ariaLabelOff?: string;
  ariaLabelOn?: string;
  checked?: boolean;
  className?: string;
  colors?: LiquidGlassSwitchColors;
  defaultChecked?: boolean;
  disabled?: boolean;
  backdrop?: LiquidGlassSwitchBackdrop;
  glass?: Partial<LiquidGlassSwitchGlassSettings>;
  grabbable?: boolean;
  height?: number;
  holdable?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  style?: CSSProperties;
  width?: number;
};

type Point = {
  x: number;
  y: number;
};

type Size = {
  width: number;
  height: number;
};

type CanvasInfo = Size & {
  dpr: number;
};

type SwitchMetrics = {
  x: number;
  y: number;
  trackWidth: number;
  trackHeight: number;
  inset: number;
  puckTop: number;
  puckWidth: number;
  puckHeight: number;
  travel: number;
};

type SwitchViewState = {
  on: boolean;
  active: boolean;
  progress: number;
  colorProgress: number;
  glassAlpha: number;
  restOpacity: number;
  restProgress: number;
  restScale: number;
};

type SpringState = SwitchViewState & {
  startProgress: number;
  target: number;
  velocity: number;
  lastTime: number | null;
  startedAt: number | null;
  outroStartedAt: number | null;
  glassScale: number;
};

type PillState = {
  size: Size;
  position: Point;
};

type RenderState = {
  renderer: MultiPassRenderer | null;
  canvasInfo: CanvasInfo;
  raf: number | null;
};

type DragState = {
  pointerId: number;
  startX: number;
  startProgress: number;
  startTime: number;
  lastProgress: number;
  lastTime: number;
  dragging: boolean;
};

const defaultGlassSettings: LiquidGlassSwitchGlassSettings = {
  refThickness: 4.92,
  refFactor: 1.52,
  refDispersion: 9.06,
  refFresnelRange: 30,
  refFresnelHardness: 20,
  reverseLens: 0.17,
  blurRadius: 1,
  blurEdge: true,
  shapeRoundness: 2,
  mergeRate: 0.05,
  step: 9,
  glareSize: 27.76,
  glareHardness: 20,
  glareIntensity: 90,
  glareConvergence: 50,
  glareOppositeSide: 80,
  glareAngle: -45,
};

const glassRenderSettings = {
  tint: {
    r: 255,
    g: 255,
    b: 255,
    a: 0,
  },
  shadowExpand: 25,
  shadowPosition: {
    x: 0,
    y: -10,
  },
  shapeRadius: 100,
};

const glassBleed = 72;
const introDurationMs = 130;
const outroDurationMs = 205;
const outroGlassDurationMs = 118;
const outroRestRevealMs = 105;
const springStiffness = 180;
const springDamping = 21;
const settleDistance = 0.045;
const settleVelocity = 1;
const toggleImpulse = 1.95;
const refThicknessMultiplier = 2.7;
const refDispersionMultiplier = 1.25;
const restMorphUndershoot = 0.085;
const glassMorphUndershoot = 0.12;
const dragStartThreshold = 4;
const dragClickSuppressMs = 180;
const holdClickSuppressMs = 170;
const defaultColors: Required<LiquidGlassSwitchColors> = {
  off: "#8e8e93",
  on: "#34c759",
  onLight: "#62e77e",
  onDark: "#1ca446",
  puck: "#ffffff",
  focus: "rgba(255, 255, 255, 0.82)",
};

function computeGaussianKernelByRadius(radius: number) {
  if (radius <= 0) {
    return [1];
  }

  const sigma = radius / 3.0;
  const kernel = [];
  let sum = 0;

  for (let i = 0; i <= radius; i += 1) {
    const weight = Math.exp(-0.5 * (i * i) / (sigma * sigma));
    kernel.push(weight);
    sum += i === 0 ? weight : weight * 2;
  }

  return kernel.map((weight) => weight / sum);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function smootherstep(edge0: number, edge1: number, value: number) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);

  return x * x * x * (x * (x * 6 - 15) + 10);
}

function getWindowWidth() {
  return typeof window === "undefined" ? 284 : window.innerWidth;
}

function getDevicePixelRatio() {
  return typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
}

function normalizeHexColor(value: string) {
  const color = value.trim();

  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }

  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }

  return "#000000";
}

function hexToRgb01(value: string): [number, number, number] {
  const color = normalizeHexColor(value);
  const int = Number.parseInt(color.slice(1), 16);

  return [
    ((int >> 16) & 255) / 255,
    ((int >> 8) & 255) / 255,
    (int & 255) / 255,
  ];
}

function getSwitchColors(colors: LiquidGlassSwitchProps["colors"]) {
  return {
    ...defaultColors,
    ...colors,
  };
}

function getSwitchGlassSettings(settings: LiquidGlassSwitchProps["glass"]) {
  return {
    ...defaultGlassSettings,
    ...settings,
    blurRadius: Math.round(clamp(settings?.blurRadius ?? defaultGlassSettings.blurRadius, 0, 200)),
    mergeRate: clamp(settings?.mergeRate ?? defaultGlassSettings.mergeRate, 0, 1),
    shapeRoundness: clamp(settings?.shapeRoundness ?? defaultGlassSettings.shapeRoundness, 0.5, 8),
    step: Math.round(clamp(settings?.step ?? defaultGlassSettings.step, 0, 9)),
    refFresnelHardness: clamp(
      settings?.refFresnelHardness ?? defaultGlassSettings.refFresnelHardness,
      0,
      100,
    ),
    glareHardness: clamp(settings?.glareHardness ?? defaultGlassSettings.glareHardness, 0, 100),
    glareIntensity: clamp(settings?.glareIntensity ?? defaultGlassSettings.glareIntensity, 0, 100),
    glareConvergence: clamp(settings?.glareConvergence ?? defaultGlassSettings.glareConvergence, 0, 100),
    glareOppositeSide: clamp(settings?.glareOppositeSide ?? defaultGlassSettings.glareOppositeSide, 0, 100),
  };
}

function getBackdropType(backdrop: LiquidGlassSwitchBackdrop) {
  if (backdrop === "checker") {
    return 0;
  }
  if (backdrop === "quadrants") {
    return 1;
  }
  if (backdrop === "split") {
    return 2;
  }
  if (backdrop === "demo") {
    return 13;
  }

  return 12;
}

function getOutroRestScale(progress: number) {
  const rebound = smootherstep(0, 1, progress);

  return 1 - (1 - rebound) * restMorphUndershoot;
}

function getOutroGlassScale(glassOutro: number) {
  const undershoot = smootherstep(0.45, 0.83, glassOutro) * (1 - smootherstep(0.83, 1, glassOutro));

  return 1 - glassOutro - undershoot * glassMorphUndershoot;
}

function getSwitchMetrics(width?: number, height?: number): SwitchMetrics {
  const trackWidth = Math.round(width ?? clamp(getWindowWidth() - 48, 176, 236));
  const trackHeight = Math.round(height ?? clamp(trackWidth * 0.43, 82, 102));
  const inset = Math.round(clamp(trackHeight * 0.06, 5, 7));
  const puckHeight = trackHeight - inset * 2;
  const puckWidth = Math.round(Math.min(trackWidth - inset * 2 - 18, puckHeight * 1.68));
  const puckTop = inset;
  const travel = trackWidth - puckWidth - inset * 2;

  return {
    x: glassBleed,
    y: glassBleed,
    trackWidth,
    trackHeight,
    inset,
    puckTop,
    puckWidth,
    puckHeight,
    travel,
  };
}

function getCanvasInfo(metrics: SwitchMetrics): CanvasInfo {
  return {
    width: metrics.trackWidth + glassBleed * 2,
    height: metrics.trackHeight + glassBleed * 2,
    dpr: getDevicePixelRatio(),
  };
}

function getPillCenterUniform(pill: PillState, canvasInfo: CanvasInfo): Point {
  return {
    x: (pill.position.x + pill.size.width / 2) * canvasInfo.dpr,
    y: (canvasInfo.height - (pill.position.y + pill.size.height / 2)) * canvasInfo.dpr,
  };
}

function getSwitchTrackUniform(metrics: SwitchMetrics, canvasInfo: CanvasInfo) {
  return [
    metrics.x * canvasInfo.dpr,
    (canvasInfo.height - metrics.y - metrics.trackHeight) * canvasInfo.dpr,
    metrics.trackWidth * canvasInfo.dpr,
    metrics.trackHeight * canvasInfo.dpr,
  ];
}

function getGlassPill(spring: SpringState, metrics: SwitchMetrics): PillState {
  if (!spring.active) {
    return {
      position: { x: -1000, y: -1000 },
      size: { width: 1, height: 1 },
    };
  }

  const progress = clamp(spring.progress, -0.08, 1.08);
  const direction = Math.abs(spring.velocity) > 0.01 ? Math.sign(spring.velocity) : spring.target >= spring.progress ? 1 : -1;
  const speed = clamp(Math.abs(spring.velocity) / 9, 0, 1);
  const height =
    metrics.puckHeight + (metrics.trackHeight * (1.2 + speed * 0.08) - metrics.puckHeight) * spring.glassScale;
  const width = metrics.puckWidth * (height / metrics.puckHeight);
  const baseX = metrics.x + metrics.inset + progress * metrics.travel;
  const baseY = metrics.y + metrics.puckTop;
  const lead = direction * speed * 8;

  return {
    position: {
      x: baseX + (metrics.puckWidth - width) / 2 + lead,
      y: baseY + (metrics.puckHeight - height) / 2,
    },
    size: {
      width,
      height,
    },
  };
}

export default function LiquidGlassSwitch({
  ariaLabelOff = "Turn switch off",
  ariaLabelOn = "Turn switch on",
  backdrop = "plain",
  checked,
  className = "",
  colors,
  defaultChecked = false,
  disabled = false,
  glass,
  grabbable = true,
  height,
  holdable = true,
  onCheckedChange,
  style,
  width,
}: LiquidGlassSwitchProps) {
  const isControlled = checked !== undefined;
  const initialOn = checked ?? defaultChecked;
  const initialProgress = initialOn ? 1 : 0;
  const switchColors = getSwitchColors(colors);
  const switchGlass = getSwitchGlassSettings(glass);
  const initialMetrics = getSwitchMetrics(width, height);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRafRef = useRef<number | null>(null);
  const [metrics, setMetrics] = useState<SwitchMetrics>(() => initialMetrics);
  const [canvasInfo, setCanvasInfo] = useState<CanvasInfo>(() => getCanvasInfo(initialMetrics));
  const [switchState, setSwitchState] = useState<SwitchViewState>({
    on: initialOn,
    active: false,
    progress: initialProgress,
    colorProgress: initialProgress,
    glassAlpha: 0,
    restOpacity: 1,
    restProgress: initialProgress,
    restScale: 1,
  });
  const metricsRef = useRef(metrics);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickUntilRef = useRef(0);
  const reportedOnRef = useRef(initialOn);
  const springRef = useRef<SpringState>({
    on: initialOn,
    active: false,
    progress: initialProgress,
    colorProgress: initialProgress,
    glassAlpha: 0,
    restOpacity: 1,
    restProgress: initialProgress,
    restScale: 1,
    startProgress: initialProgress,
    target: initialProgress,
    velocity: 0,
    lastTime: null,
    startedAt: null,
    outroStartedAt: null,
    glassScale: 0,
  });
  const renderStateRef = useRef<RenderState>({
    renderer: null,
    canvasInfo,
    raf: null,
  });
  const switchColorsRef = useRef(switchColors);
  const switchGlassRef = useRef(switchGlass);
  const backdropRef = useRef(backdrop);

  metricsRef.current = metrics;
  renderStateRef.current.canvasInfo = canvasInfo;
  switchColorsRef.current = switchColors;
  switchGlassRef.current = switchGlass;
  backdropRef.current = backdrop;

  const publishSwitchState = useCallback(() => {
    const spring = springRef.current;

    setSwitchState({
      on: spring.on,
      active: spring.active,
      progress: clamp(spring.progress, 0, 1),
      colorProgress: spring.colorProgress,
      glassAlpha: spring.glassAlpha,
      restOpacity: spring.restOpacity,
      restProgress: spring.restProgress,
      restScale: spring.restScale,
    });

    if (reportedOnRef.current !== spring.on) {
      reportedOnRef.current = spring.on;
      onCheckedChange?.(spring.on);
    }
  }, [onCheckedChange]);

  const cancelSwitchAnimation = useCallback(() => {
    if (animationRafRef.current !== null) {
      cancelAnimationFrame(animationRafRef.current);
      animationRafRef.current = null;
    }
  }, []);

  const updateDragProgress = useCallback(
    (clientX: number, time: number) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }

      const currentMetrics = metricsRef.current;
      const spring = springRef.current;
      const progress = clamp(drag.startProgress + (clientX - drag.startX) / Math.max(currentMetrics.travel, 1), 0, 1);
      const dt = Math.max((time - drag.lastTime) / 1000, 0.016);
      const velocity = clamp((progress - drag.lastProgress) / dt, -4, 4);

      drag.lastProgress = progress;
      drag.lastTime = time;

      spring.on = progress >= 0.5;
      spring.active = true;
      spring.progress = progress;
      spring.colorProgress = progress;
      spring.target = progress;
      spring.velocity = velocity;
      spring.lastTime = null;
      spring.startedAt = spring.startedAt ?? time;
      spring.outroStartedAt = null;
      spring.glassAlpha = smootherstep(0, introDurationMs, time - (spring.startedAt ?? time));
      spring.glassScale = spring.glassAlpha;
      spring.restOpacity = 1 - spring.glassAlpha;
      spring.restProgress = progress;
      spring.restScale = 0.96 + 0.04 * spring.restOpacity;

      publishSwitchState();
    },
    [publishSwitchState],
  );

  const animateSwitch = useCallback(
    (time: number) => {
      const spring = springRef.current;
      const previousTime = spring.lastTime ?? time - 16;
      const startedAt = spring.startedAt ?? time;
      const dt = Math.min(0.032, Math.max(0.001, (time - previousTime) / 1000));
      const displacement = spring.target - spring.progress;
      const intro = smootherstep(0, introDurationMs, time - startedAt);
      const springSettled = Math.abs(displacement) < settleDistance && Math.abs(spring.velocity) < settleVelocity;

      spring.lastTime = time;
      spring.startedAt = startedAt;

      if (dragRef.current !== null) {
        spring.active = true;
        spring.glassAlpha = intro;
        spring.glassScale = intro;
        spring.restOpacity = 1 - intro;
        spring.restProgress = spring.progress;
        spring.restScale = 0.96 + 0.04 * spring.restOpacity;
        publishSwitchState();

        if (intro >= 1) {
          animationRafRef.current = null;
          return;
        }

        animationRafRef.current = requestAnimationFrame(animateSwitch);
        return;
      }

      if (spring.outroStartedAt !== null || springSettled) {
        const outroStartedAt = spring.outroStartedAt ?? time;
        const outroElapsed = time - outroStartedAt;
        const outroProgress = clamp(outroElapsed / outroDurationMs, 0, 1);
        const glassOutro = smootherstep(0, outroGlassDurationMs, outroElapsed);
        const restReveal = smootherstep(0, outroRestRevealMs, outroElapsed);

        spring.progress = spring.target;
        spring.velocity = 0;
        spring.outroStartedAt = outroStartedAt;
        spring.colorProgress = spring.on ? 1 : 0;
        spring.glassAlpha = 1 - glassOutro;
        spring.glassScale = getOutroGlassScale(glassOutro);
        spring.restOpacity = restReveal;
        spring.restProgress = spring.target;
        spring.restScale = getOutroRestScale(outroProgress);

        if (outroProgress >= 1) {
          spring.active = false;
          spring.lastTime = null;
          spring.startedAt = null;
          spring.outroStartedAt = null;
          spring.glassAlpha = 0;
          spring.glassScale = 0;
          spring.restOpacity = 1;
          spring.restProgress = spring.target;
          spring.restScale = 1;
          spring.colorProgress = spring.on ? 1 : 0;
          animationRafRef.current = null;
          publishSwitchState();
          return;
        }
      } else {
        spring.velocity += displacement * springStiffness * dt;
        spring.velocity *= Math.exp(-springDamping * dt);
        spring.progress += spring.velocity * dt;
        spring.colorProgress = spring.on ? 1 : 0;
        spring.glassAlpha = intro;
        spring.glassScale = intro;
        spring.restOpacity = 1 - intro;
        spring.restProgress = spring.startProgress;
        spring.restScale = 0.96 + 0.04 * spring.restOpacity;
      }

      spring.active = true;
      publishSwitchState();
      animationRafRef.current = requestAnimationFrame(animateSwitch);
    },
    [publishSwitchState],
  );

  const settleSwitchToTarget = useCallback(
    (target: number, velocity: number) => {
      const spring = springRef.current;
      const now = performance.now();

      spring.startProgress = clamp(spring.progress, 0, 1);
      spring.progress = spring.startProgress;
      spring.target = target;
      spring.on = target === 1;
      spring.active = true;
      spring.colorProgress = target;
      spring.lastTime = null;
      spring.startedAt = now - introDurationMs;
      spring.outroStartedAt = null;
      spring.glassAlpha = 1;
      spring.glassScale = 1;
      spring.restOpacity = 0;
      spring.restProgress = spring.progress;
      spring.restScale = 0.96;
      spring.velocity = clamp(velocity, -3, 3);
      publishSwitchState();

      cancelSwitchAnimation();
      animationRafRef.current = requestAnimationFrame(animateSwitch);
    },
    [animateSwitch, cancelSwitchAnimation, publishSwitchState],
  );

  const toggleSwitch = useCallback(() => {
    if (disabled) {
      return;
    }

    if (performance.now() < suppressClickUntilRef.current) {
      dragRef.current = null;
      return;
    }

    dragRef.current = null;

    const spring = springRef.current;
    const nextTarget = spring.target === 1 ? 0 : 1;
    const isLiquidGlassVisible = spring.active && (spring.glassAlpha > 0 || spring.restOpacity < 1);
    const retainedGlassAlpha = clamp(Math.max(spring.glassAlpha, 1 - spring.restOpacity, 0.55), 0, 1);
    const retainedGlassScale = clamp(Math.max(spring.glassScale, retainedGlassAlpha), 0, 1);
    const impulse = nextTarget === 1 ? toggleImpulse : -toggleImpulse;

    spring.startProgress = clamp(spring.progress, 0, 1);
    spring.target = nextTarget;
    spring.on = nextTarget === 1;
    spring.active = true;
    spring.progress = spring.startProgress;
    spring.colorProgress = nextTarget;
    spring.lastTime = null;
    spring.startedAt = isLiquidGlassVisible ? performance.now() - introDurationMs : null;
    spring.outroStartedAt = null;
    spring.glassAlpha = isLiquidGlassVisible ? retainedGlassAlpha : 0;
    spring.glassScale = isLiquidGlassVisible ? retainedGlassScale : 0;
    spring.restOpacity = isLiquidGlassVisible ? 0 : 1;
    spring.restProgress = spring.startProgress;
    spring.restScale = isLiquidGlassVisible ? 0.96 : 1;
    spring.velocity = impulse;
    publishSwitchState();

    cancelSwitchAnimation();
    animationRafRef.current = requestAnimationFrame(animateSwitch);
  }, [animateSwitch, cancelSwitchAnimation, disabled, publishSwitchState]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (disabled || (!grabbable && !holdable)) {
        return;
      }

      const spring = springRef.current;
      const progress = clamp(spring.active ? spring.progress : spring.on ? 1 : 0, 0, 1);
      const now = performance.now();
      const isLiquidGlassVisible = spring.active && (spring.glassAlpha > 0 || spring.restOpacity < 1);
      const retainedGlassAlpha = clamp(Math.max(spring.glassAlpha, 1 - spring.restOpacity, 0.55), 0, 1);
      const retainedGlassScale = clamp(Math.max(spring.glassScale, retainedGlassAlpha), 0, 1);

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startProgress: progress,
        startTime: now,
        lastProgress: progress,
        lastTime: now,
        dragging: false,
      };

      if (holdable) {
        cancelSwitchAnimation();
        spring.on = progress >= 0.5;
        spring.active = true;
        spring.progress = progress;
        spring.colorProgress = progress;
        spring.target = progress;
        spring.velocity = 0;
        spring.lastTime = null;
        spring.startedAt = isLiquidGlassVisible ? now - introDurationMs : now;
        spring.outroStartedAt = null;
        spring.glassAlpha = isLiquidGlassVisible ? retainedGlassAlpha : 0;
        spring.glassScale = isLiquidGlassVisible ? retainedGlassScale : 0;
        spring.restOpacity = isLiquidGlassVisible ? 0 : 1;
        spring.restProgress = progress;
        spring.restScale = isLiquidGlassVisible ? 0.96 : 1;
        publishSwitchState();

        animationRafRef.current = requestAnimationFrame(animateSwitch);
      }

      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [animateSwitch, cancelSwitchAnimation, disabled, grabbable, holdable, publishSwitchState],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      if (!grabbable) {
        return;
      }

      if (!drag.dragging) {
        const dragDistance = Math.abs(event.clientX - drag.startX);
        if (dragDistance < dragStartThreshold) {
          return;
        }

        drag.dragging = true;
      }

      updateDragProgress(event.clientX, performance.now());
      if (animationRafRef.current === null) {
        animationRafRef.current = requestAnimationFrame(animateSwitch);
      }
      event.preventDefault();
    },
    [animateSwitch, grabbable, updateDragProgress],
  );

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (!drag.dragging) {
        const shouldSuppressClick = performance.now() - drag.startTime >= holdClickSuppressMs;

        if (holdable && shouldSuppressClick) {
          suppressClickUntilRef.current = performance.now() + dragClickSuppressMs;
        }

        dragRef.current = null;
        if (holdable) {
          settleSwitchToTarget(drag.startProgress >= 0.5 ? 1 : 0, 0);
        }
        if (holdable && shouldSuppressClick) {
          event.preventDefault();
        }
        return;
      }

      updateDragProgress(event.clientX, performance.now());

      const finalProgress = drag.lastProgress;
      const finalVelocity = springRef.current.velocity;

      dragRef.current = null;
      suppressClickUntilRef.current = performance.now() + dragClickSuppressMs;
      settleSwitchToTarget(finalProgress >= 0.5 ? 1 : 0, finalVelocity);
      event.preventDefault();
    },
    [holdable, settleSwitchToTarget, updateDragProgress],
  );

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const width = Math.max(1, Math.round(canvasInfo.width * canvasInfo.dpr));
    const height = Math.max(1, Math.round(canvasInfo.height * canvasInfo.dpr));

    if (canvas.width !== width) {
      canvas.width = width;
    }
    if (canvas.height !== height) {
      canvas.height = height;
    }

    const gl = canvas.getContext("webgl2");
    gl?.viewport(0, 0, width, height);

    const renderer = renderStateRef.current.renderer;
    if (renderer) {
      renderer.resize(width, height);
      renderer.setUniform("u_resolution", [width, height]);
    }
  }, [canvasInfo]);

  useLayoutEffect(() => {
    resizeCanvas();
  }, [resizeCanvas]);

  useLayoutEffect(() => {
    const onResize = () => {
      const nextMetrics = getSwitchMetrics(width, height);

      setMetrics(nextMetrics);
      setCanvasInfo(getCanvasInfo(nextMetrics));
    };

    window.addEventListener("resize", onResize);
    onResize();

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [height, width]);

  useEffect(() => {
    if (!isControlled) {
      return;
    }

    const target = checked ? 1 : 0;
    const spring = springRef.current;
    const alreadySynced =
      spring.on === checked &&
      spring.target === target &&
      !spring.active;

    if (alreadySynced) {
      return;
    }

    settleSwitchToTarget(target, checked ? toggleImpulse : -toggleImpulse);
  }, [checked, isControlled, settleSwitchToTarget]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const renderer = new MultiPassRenderer(canvas, [
      { name: "bgPass", shader: { vertex: VertexShader, fragment: FragmentBgShader } },
      {
        name: "vBlurPass",
        shader: { vertex: VertexShader, fragment: FragmentBgVblurShader },
        inputs: { u_prevPassTexture: "bgPass" },
      },
      {
        name: "hBlurPass",
        shader: { vertex: VertexShader, fragment: FragmentBgHblurShader },
        inputs: { u_prevPassTexture: "vBlurPass" },
      },
      {
        name: "mainPass",
        shader: { vertex: VertexShader, fragment: FragmentMainShader },
        inputs: { u_blurredBg: "hBlurPass", u_bg: "bgPass" },
        outputToScreen: true,
      },
    ]);
    const gl = canvas.getContext("webgl2");
    const effectState = renderStateRef.current;

    effectState.renderer = renderer;
    resizeCanvas();

    if (gl) {
      gl.clearColor(0, 0, 0, 0);
    }

    const render = () => {
      const state = renderStateRef.current;
      const currentCanvasInfo = state.canvasInfo;
      const currentColors = switchColorsRef.current;
      const currentGlass = switchGlassRef.current;
      const blurRadius = currentGlass.blurRadius;
      const glassPill = getGlassPill(springRef.current, metricsRef.current);
      const center = getPillCenterUniform(glassPill, currentCanvasInfo);

      state.raf = requestAnimationFrame(render);

      renderer.setUniforms({
        u_resolution: [
          currentCanvasInfo.width * currentCanvasInfo.dpr,
          currentCanvasInfo.height * currentCanvasInfo.dpr,
        ],
        u_dpr: currentCanvasInfo.dpr,
        u_blurWeights: computeGaussianKernelByRadius(blurRadius),
        u_blurRadius: blurRadius,
        u_mouse: [center.x, center.y],
        u_mouseSpring: [center.x, center.y],
        u_shapeWidth: glassPill.size.width,
        u_shapeHeight: glassPill.size.height,
        u_shapeRadius:
          (Math.min(glassPill.size.width, glassPill.size.height) / 2) *
          (glassRenderSettings.shapeRadius / 100),
        u_shapeRoundness: currentGlass.shapeRoundness,
        u_mergeRate: currentGlass.mergeRate,
        u_glareAngle: (currentGlass.glareAngle * Math.PI) / 180,
        u_showShape1: 0,
      });

      renderer.render({
        bgPass: {
          u_bgType: getBackdropType(backdropRef.current),
          u_bgTextureRatio: 1,
          u_bgTextureReady: 0,
          u_switchOffColor: hexToRgb01(currentColors.off),
          u_switchOnColor: hexToRgb01(currentColors.on),
          u_switchTrackRect: getSwitchTrackUniform(metricsRef.current, currentCanvasInfo),
          u_switchProgress: springRef.current.colorProgress,
          u_shadowExpand: glassRenderSettings.shadowExpand,
          u_shadowFactor: 0,
          u_shadowPosition: [-glassRenderSettings.shadowPosition.x, -glassRenderSettings.shadowPosition.y],
        },
        mainPass: {
          u_tint: [
            glassRenderSettings.tint.r / 255,
            glassRenderSettings.tint.g / 255,
            glassRenderSettings.tint.b / 255,
            glassRenderSettings.tint.a,
          ],
          u_refThickness: currentGlass.refThickness * refThicknessMultiplier,
          u_refFactor: currentGlass.refFactor,
          u_refDispersion: currentGlass.refDispersion * refDispersionMultiplier,
          u_refFresnelRange: currentGlass.refFresnelRange,
          u_refFresnelHardness: currentGlass.refFresnelHardness / 100,
          u_refFresnelFactor: 0,
          u_glareRange: currentGlass.glareSize,
          u_glareHardness: currentGlass.glareHardness / 100,
          u_glareConvergence: currentGlass.glareConvergence / 100,
          u_glareOppositeFactor: currentGlass.glareOppositeSide / 100,
          u_glareFactor: currentGlass.glareIntensity / 100,
          u_glassAlpha: springRef.current.glassAlpha,
          u_reverseLensFactor: currentGlass.reverseLens,
          u_blurEdge: currentGlass.blurEdge ? 1 : 0,
          STEP: currentGlass.step,
        },
      });
    };

    renderStateRef.current.raf = requestAnimationFrame(render);

    return () => {
      if (effectState.raf !== null) {
        cancelAnimationFrame(effectState.raf);
        effectState.raf = null;
      }
      if (animationRafRef.current !== null) {
        cancelAnimationFrame(animationRafRef.current);
        animationRafRef.current = null;
      }
      renderer.dispose();
      effectState.renderer = null;
    };
  }, [resizeCanvas]);

  return (
    <div
      className={`liquid-glass-switch${disabled ? " is-disabled" : ""}${grabbable ? " is-grabbable" : ""}${holdable ? " is-holdable" : ""}${className ? ` ${className}` : ""}`}
      style={
        {
          ...style,
          "--glass-bleed": `${glassBleed}px`,
          "--lg-switch-focus": switchColors.focus,
          "--lg-switch-off": switchColors.off,
          "--lg-switch-on": switchColors.on,
          "--lg-switch-on-dark": switchColors.onDark,
          "--lg-switch-on-light": switchColors.onLight,
          "--lg-switch-puck": switchColors.puck,
          "--track-width": `${metrics.trackWidth}px`,
          "--track-height": `${metrics.trackHeight}px`,
          "--switch-inset": `${metrics.inset}px`,
          "--puck-top": `${metrics.puckTop}px`,
          "--puck-width": `${metrics.puckWidth}px`,
          "--puck-height": `${metrics.puckHeight}px`,
          "--switch-travel": `${metrics.travel}px`,
          "--switch-progress": `${switchState.colorProgress}`,
          "--rest-opacity": `${switchState.restOpacity}`,
          "--rest-progress": `${switchState.restProgress}`,
          "--rest-shadow": `${switchState.restOpacity}`,
          "--rest-scale": `${switchState.restScale}`,
        } as CSSProperties
      }
    >
      <canvas ref={canvasRef} className="liquid-glass-switch__canvas" />
      <span aria-hidden="true" className="liquid-glass-switch__track">
        <span className="liquid-glass-switch__track-fill" />
      </span>
      <span aria-hidden="true" className="liquid-glass-switch__rest-puck" />
      <button
        aria-label={switchState.on ? ariaLabelOff : ariaLabelOn}
        aria-pressed={switchState.on}
        className="liquid-glass-switch__button"
        disabled={disabled}
        onClick={toggleSwitch}
        onLostPointerCapture={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        type="button"
      />
    </div>
  );
}
