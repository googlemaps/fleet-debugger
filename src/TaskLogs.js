/*
 * TaskLogs.js
 *
 * Processes raw logs into task oriented logs where a single entry
 * contains all the information about a task.
 */
import _ from "lodash";
import Task from "./Task";
class TaskLogs {
  constructor(tripLogs) {
    this.tasks = {};
    this.processTasks(tripLogs.getRawLogs_());
    this.minDate = tripLogs.minDate;
    this.maxDate = tripLogs.maxDate;
  }

  processTasks(logs) {
    _(logs)
      .filter(
        // TODO #133: response can be empty on errors -- we should highlight those rows!!
        (le) =>
          (le.logname.match("create_task") ||
            le.logname.match("update_task")) &&
          le.jsonpayload.response
      )
      .forEach((le, taskIdx) => {
        const taskReq = le.jsonpayload.request;
        const taskResp = le.jsonpayload.response;
        let task = this.tasks[taskReq.taskid];
        if (!task) {
          task = this.tasks[taskReq.taskid] = new Task(
            le.date,
            taskIdx,
            taskReq,
            taskResp
          );
        } else {
          task.addUpdate(le.date, taskReq, taskResp);
        }
      });
  }

  /*
   * Tasks are always shown -- no matter the state of the timeslider.
   *
   * The timeslider is used purely to control what task state/outcome
   * is displayed.
   */
  getTasks(maxDate) {
    maxDate = maxDate || this.maxDate;
    return _(this.tasks)
      .values()
      .map((task) => task.getTaskInfo(maxDate))
      .compact();
  }
}

export { TaskLogs as default };
