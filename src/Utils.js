class Utils {
  // If undefined defaults to false
  static isDebugEnabled = localStorage.getItem("debug") === "true";

  /*
   * Formats a duration into something friendly
   * for human consumption.
   */
  static formatDuration(duration) {
    let sec_num = duration / 1000;
    let hours = Math.floor(sec_num / 3600);
    let minutes = Math.floor((sec_num - hours * 3600) / 60);
    let seconds = Math.floor(sec_num - hours * 3600 - minutes * 60);
    let timeStr = "";

    if (hours > 0) {
      timeStr += hours + " hours ";
    }
    if (minutes > 0) {
      timeStr += minutes + " minutes ";
    }
    if (seconds > 0) {
      timeStr += seconds + " seconds";
    }
    return timeStr;
  }
}

window.debug = {
  enable: () => {
    Utils.isDebugEnabled = true;
    localStorage.setItem("debug", "true");
    console.log("Debug enabled");
  },
  disable: () => {
    Utils.isDebugEnabled = false;
    localStorage.setItem("debug", "false");
    console.log("Debug disabled");
  },
  status: () => {
    console.log("Debug is", Utils.isDebugEnabled ? "enabled" : "disabled");
    return Utils.isDebugEnabled;
  },
};

// Export the log function directly
export const log = (...args) => {
  if (Utils.isDebugEnabled) {
    console.log(...args);
  }
};

export { Utils as default };
