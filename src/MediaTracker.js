export default class MediaTracker {
  constructor(el, config) {
    this.onPlay = this.onPlay.bind(this);
    this.onPause = this.onPause.bind(this);
    this.onEnded = this.onEnded.bind(this);

    this.isPlaying = false;

    this.el = el;
    this.config = config;

    this.el.addEventListener("play", this.onPlay);
    this.el.addEventListener("pause", this.onPause);
    this.el.addEventListener("ended", this.onEnded);
  }

  onPlay(e) {
    this.isPlaying = true;
    if (this.config && typeof this.config.onPlay === "function") {
      this.config.onPlay({ time: this.el.currentTime }, e);
    }
  }

  onPause(e) {
    this.isPlaying = false;
    if (this.el.currentTime === this.el.duration) return;
    if (this.config && typeof this.config.onPause === "function") {
      this.config.onPause({ time: this.el.currentTime }, e);
    }
  }

  onEnded(e) {
    this.isPlaying = false;
    if (this.config && typeof this.config.onEnded === "function") {
      this.config.onEnded({ time: this.el.currentTime }, e);
    }
  }

  interrupt() {
    if (this.isPlaying && this.config && typeof this.config.onInterrupted === "function") {
      this.config.onInterrupted({ time: this.el.currentTime });
    }
  }

  destroy() {
    this.stop();
    this.el.removeEventListener("play", this.onPlay);
    this.el.removeEventListener("pause", this.onPause);
    this.el.removeEventListener("ended", this.onEnded);
  }
}
