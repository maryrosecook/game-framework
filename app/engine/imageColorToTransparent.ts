const DEFAULT_WHITE_THRESHOLD = 245;

type ColorKeyOptions = {
  threshold?: number;
};

export function imageColorToTransparent(
  images: ImageData[],
  options: ColorKeyOptions = {}
): ImageData[] {
  const threshold = options.threshold ?? DEFAULT_WHITE_THRESHOLD;

  return images.map((source) => {
    const copy = new ImageData(
      new Uint8ClampedArray(source.data),
      source.width,
      source.height
    );
    const { data } = copy;

    for (let index = 0; index < data.length; index += 4) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      if (red >= threshold && green >= threshold && blue >= threshold) {
        data[index + 3] = 0;
      }
    }

    return copy;
  });
}

export const WHITE_THRESHOLD = DEFAULT_WHITE_THRESHOLD;
