// src/Utils.js
import { toast } from "react-toastify";

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

/**
 * Pads a partial UTC timestamp string to the full HH:mm:ss format.
 * Treats the input as a literal UTC string with no timezone conversion.
 * @param {string} timeString The user-provided time string (e.g., "2025-09-06T" or "2025-09-06T14:30").
 * @returns {string} The fully padded string (e.g., "2025-09-06T00:00:00" or "2025-09-06T14:30:00").
 */
export function padUtcTimestamp(timeString) {
  if (!timeString) {
    return timeString;
  }

  const [datePart, timePart] = timeString.split("T");

  // If there's no 'T' or the date part is missing, it's not a format we can pad.
  if (timePart === undefined || !datePart) {
    return timeString;
  }

  const timeSegments = timePart.split(":").filter(Boolean); // filter(Boolean) handles the "T" with nothing after it.

  while (timeSegments.length < 3) {
    timeSegments.push("00");
  }

  const paddedTimePart = timeSegments.join(":");
  return `${datePart}T${paddedTimePart}`;
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
  const validToastTypes = ["info", "success", "warn", "error"];
  const lastArg = args[args.length - 1];
  let toastType = null;

  // First, check for an explicit toast type (e.g., 'info', 'warn')
  if (typeof lastArg === "string" && validToastTypes.includes(lastArg)) {
    toastType = args.pop();
  }

  // If no explicit type, infer 'error' if an Error object is present
  if (!toastType && args.some((arg) => arg instanceof Error)) {
    toastType = "error";
  }

  // Exit early if debug is off AND no toast is requested.
  if (!Utils.isDebugEnabled && !toastType) {
    return;
  }

  const consoleMethod =
    {
      warn: console.warn,
      error: console.error,
    }[toastType] || console.log;

  consoleMethod(...args);

  if (toastType) {
    const message = args
      .map((arg) => {
        if (arg instanceof Error) return arg.message;
        if (typeof arg === "object" && arg !== null) return JSON.stringify(arg);
        return String(arg);
      })
      .join(" ");
    toast[toastType](message);
  }
};

export { Utils as default };
