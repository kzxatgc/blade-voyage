import { requestExpandedMode } from '@devvit/web/client';

type BitmapGlyph = {
  x: number;
  y: number;
  width: number;
  height: number;
  xOffset: number;
  yOffset: number;
  xAdvance: number;
};

type BitmapFont = {
  image: HTMLImageElement;
  glyphs: Map<number, BitmapGlyph>;
  lineHeight: number;
};

const CHEST_IDLE = '/assets/img/ui/splash/chest/idle.png';
const CHEST_OPEN_FRAMES = Array.from(
  { length: 8 },
  (_, index) => `/assets/img/ui/splash/chest/open-${index + 1}.png`
);
const FONT_IMAGE = '/assets/img/font/font.png';
const FONT_DEFINITION = '/assets/img/font/font.fnt';
const PROMPT_LINES = ['OPEN'];
const FONT_SCALE = 2.4;
const LINE_GAP = 6;
const FRAME_INTERVAL_MS = 90;

const scaleFontValue = (value: number): number =>
  Math.round(value * FONT_SCALE);

const loadImage = (source: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load image: ${source}`));
    image.src = source;
  });

const parseNumberAttribute = (element: Element, attribute: string): number => {
  const value = element.getAttribute(attribute);
  const number = Number(value);
  if (value === null || !Number.isFinite(number)) {
    throw new Error(`Invalid bitmap font attribute: ${attribute}`);
  }
  return number;
};

const loadBitmapFont = async (): Promise<BitmapFont> => {
  const [image, response] = await Promise.all([
    loadImage(FONT_IMAGE),
    fetch(FONT_DEFINITION),
  ]);
  if (!response.ok) {
    throw new Error(
      `Unable to load bitmap font definition: ${response.status}`
    );
  }

  const xml = new DOMParser().parseFromString(
    await response.text(),
    'application/xml'
  );
  if (xml.querySelector('parsererror')) {
    throw new Error('The bitmap font definition is invalid.');
  }

  const common = xml.querySelector('common');
  if (!common) {
    throw new Error('The bitmap font definition has no common metrics.');
  }

  const glyphs = new Map<number, BitmapGlyph>();
  for (const element of xml.querySelectorAll('chars > char')) {
    const id = parseNumberAttribute(element, 'id');
    glyphs.set(id, {
      x: parseNumberAttribute(element, 'x'),
      y: parseNumberAttribute(element, 'y'),
      width: parseNumberAttribute(element, 'width'),
      height: parseNumberAttribute(element, 'height'),
      xOffset: parseNumberAttribute(element, 'xoffset'),
      yOffset: parseNumberAttribute(element, 'yoffset'),
      xAdvance: parseNumberAttribute(element, 'xadvance'),
    });
  }

  return {
    image,
    glyphs,
    lineHeight: parseNumberAttribute(common, 'lineHeight'),
  };
};

const measureLine = (line: string, font: BitmapFont): number => {
  let width = 0;
  for (const character of line) {
    const glyph = font.glyphs.get(character.charCodeAt(0));
    if (!glyph) {
      throw new Error(`The bitmap font is missing "${character}".`);
    }
    width += glyph.xAdvance;
  }
  return scaleFontValue(width);
};

const drawPrompt = (canvas: HTMLCanvasElement, font: BitmapFont): void => {
  const logicalWidth = Math.max(
    ...PROMPT_LINES.map((line) => measureLine(line, font))
  );
  const lineHeight = scaleFontValue(font.lineHeight);
  const logicalHeight =
    PROMPT_LINES.length * lineHeight + (PROMPT_LINES.length - 1) * LINE_GAP;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.ceil(logicalWidth * pixelRatio);
  canvas.height = Math.ceil(logicalHeight * pixelRatio);
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create the splash prompt canvas.');
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.imageSmoothingEnabled = false;

  PROMPT_LINES.forEach((line, lineIndex) => {
    const x = Math.round((logicalWidth - measureLine(line, font)) / 2);
    let advance = 0;
    const y = lineIndex * (lineHeight + LINE_GAP);
    for (const character of line) {
      const glyph = font.glyphs.get(character.charCodeAt(0));
      if (!glyph) {
        throw new Error(`The bitmap font is missing "${character}".`);
      }
      if (glyph.width > 0 && glyph.height > 0) {
        context.drawImage(
          font.image,
          glyph.x,
          glyph.y,
          glyph.width,
          glyph.height,
          x + scaleFontValue(advance + glyph.xOffset),
          y + scaleFontValue(glyph.yOffset),
          scaleFontValue(glyph.width),
          scaleFontValue(glyph.height)
        );
      }
      advance += glyph.xAdvance;
    }
  });
};

const openChestAndStart = (
  event: MouseEvent,
  button: HTMLButtonElement,
  sprite: HTMLImageElement,
  status: HTMLParagraphElement,
  frames: HTMLImageElement[]
): void => {
  button.disabled = true;
  button.classList.add('is-opening');
  status.textContent = 'Opening the chest...';

  let frameIndex = 0;
  const showNextFrame = (): void => {
    const frame = frames[frameIndex];
    if (!frame) {
      status.textContent = 'Starting Blade Voyage...';
      requestExpandedMode(event, 'game');
      return;
    }

    sprite.src = frame.src;
    frameIndex += 1;
    window.setTimeout(showNextFrame, FRAME_INTERVAL_MS);
  };

  showNextFrame();
};

const initSplash = async (): Promise<void> => {
  const button = document.getElementById('chest-start');
  const sprite = document.getElementById('chest-sprite');
  const prompt = document.getElementById('chest-prompt');
  const status = document.getElementById('splash-status');
  if (
    !(button instanceof HTMLButtonElement) ||
    !(sprite instanceof HTMLImageElement) ||
    !(prompt instanceof HTMLCanvasElement) ||
    !(status instanceof HTMLParagraphElement)
  ) {
    throw new Error('The splash screen is missing required elements.');
  }

  const [idle, frames, font] = await Promise.all([
    loadImage(CHEST_IDLE),
    Promise.all(CHEST_OPEN_FRAMES.map(loadImage)),
    loadBitmapFont(),
  ]);
  sprite.src = idle.src;
  drawPrompt(prompt, font);
  button.disabled = false;
  button.addEventListener('click', (event: MouseEvent) => {
    openChestAndStart(event, button, sprite, status, frames);
  });
};

void initSplash().catch((error: unknown) => {
  console.error('Unable to initialize the splash screen.', error);
  const status = document.getElementById('splash-status');
  if (status instanceof HTMLParagraphElement) {
    status.textContent =
      'Unable to load the chest. Please refresh to try again.';
  }
});
