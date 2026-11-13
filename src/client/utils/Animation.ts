export class Animation {
  frame = 0;
  done = false;
  indexChanged = false;
  readonly path: string;
  readonly frameCount: number;
  imgDur: number;
  readonly loop: boolean;

  constructor(
    path: string,
    frameCount: number,
    imgDur: number,
    loop = true
  ) {
    if (!Number.isInteger(frameCount) || frameCount < 1) {
      throw new RangeError('frameCount must be a positive integer.');
    }

    if (!Number.isInteger(imgDur) || imgDur < 1) {
      throw new RangeError('imgDur must be a positive integer.');
    }

    this.path = path;
    this.frameCount = frameCount;
    this.imgDur = imgDur;
    this.loop = loop;
  }

  update() {
    const previousIndex = Math.floor(this.frame / this.imgDur);

    if (this.loop) {
      this.frame = (this.frame + 1) % (this.imgDur * this.frameCount);
    } else {
      const lastFrame = this.imgDur * this.frameCount - 1;
      this.frame = Math.min(this.frame + 1, lastFrame);
      if (this.frame >= lastFrame) {
        this.done = true;
      }
    }

    this.indexChanged =
      Math.floor(this.frame / this.imgDur) !== previousIndex;
  }

  img() {
    return `${this.path}/${Math.floor(this.frame / this.imgDur)}`;
  }

  copy() {
    return new Animation(this.path, this.frameCount, this.imgDur, this.loop);
  }
}
