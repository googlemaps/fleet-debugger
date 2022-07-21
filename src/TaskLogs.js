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
          (le["@type"].match("createTask") ||
            le["@type"].match("updateTask")) &&
          le.response
      )
      .forEach((le, taskIdx) => {
        const taskReq = le.request;
        const taskResp = le.response;
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
