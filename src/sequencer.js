class EuclideanSequencer {

  constructor(steps, pulses, offset) {

    this.steps = [];
    for (let i = 0; i < steps; ++i)
      this.steps.push(false);

    const setPulse = ix => this.steps[(ix + offset) % steps] = true;
    let gap = steps / pulses;
    let pulseCount = 0;
    let travel = 0;
    for (let i = 0; i < steps; ++i) {
      if (pulseCount == pulses) break;
      if (travel == 0 || travel >= Math.round(gap)) {
        setPulse(i);
        if (travel > 0) travel -= gap;
      }
      travel += 1;
    }
  }

  isPulse(stepIx) {
    stepIx = stepIx % this.steps.length;
    return this.steps[stepIx];
  }

  printSeq() {
    let res = "";
    for (let i = 0; i < this.steps.length; ++i) {
      if (i > 0) res += " ";
      res += this.steps[i] ? "1" : "0";
    }
    return res;
  }
}

export {EuclideanSequencer}
