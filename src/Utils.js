class Utils {
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
export { Utils as default };
