// src/Stats.js

class Stats {
  static median(dataSet) {
    if (dataSet.length === 1) return dataSet[0];
    const sorted = [...dataSet].sort();
    const ceil = Math.ceil(sorted.length / 2);
    const floor = Math.floor(sorted.length / 2);
    if (ceil === floor) return sorted[floor];
    return (sorted[ceil] + sorted[floor]) / 2;
  }
}
export { Stats as default };
