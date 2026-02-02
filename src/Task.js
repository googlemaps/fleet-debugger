/*
 * src/Task.js
 *
 * Processed log for a task.  Handles computing the state of
 * a task at a specified time.
 */
import _ from "lodash";

class Task {
  constructor(date, taskIdx, taskId, taskReq, taskResp) {
    this.taskIdx = taskIdx;
    this.taskId = taskId;
    this.updates = [];
    this.firstUpdate = date;
    this.addUpdate(date, taskReq, taskResp);
  }

  /**
   * Returns the status of the task at the specified date.  Note that
   * many task changes are actually done as side-effects of vehicle changes
   * and thus the debugger only has visibily into a task change if there
   * is an update_task call made.
   */
  getTaskInfo(maxDate) {
    const taskInfo = {
      taskid: this.taskId,
    };
    const lastUpdate = _(this.updates)
      .filter((update) => update.date <= maxDate)
      .last();

    if (lastUpdate) {
      // The create vs update task input and output protos are annoyingly
      // different.  The following code attemps to handle both.
      taskInfo.type = lastUpdate.taskResp.type || lastUpdate.taskReq.task.type;
      taskInfo.plannedlocation = lastUpdate.taskResp.plannedlocation || lastUpdate.taskReq.task.plannedlocation;
      taskInfo.taskoutcome = lastUpdate.taskResp.taskoutcome;
      taskInfo.state = lastUpdate.taskResp.state;
      taskInfo.taskoutcomelocationsource = lastUpdate.taskResp.taskoutcomelocationsource;
      taskInfo.taskoutcomelocation = lastUpdate.taskResp.taskoutcomelocation;
      taskInfo.taskoutcometime = lastUpdate.taskResp.taskoutcometime;
      taskInfo.trackingid = lastUpdate.taskResp.trackingid || lastUpdate.taskReq.task.trackingid;
      if (
        taskInfo.taskoutcomelocationsource &&
        taskInfo.plannedlocation &&
        taskInfo.plannedlocation.point &&
        taskInfo.taskoutcomelocation &&
        taskInfo.taskoutcomelocation.point
      ) {
        taskInfo.plannedVsActualDeltaMeters = window.google.maps.geometry.spherical.computeDistanceBetween(
          {
            lat: taskInfo.plannedlocation.point.latitude,
            lng: taskInfo.plannedlocation.point.longitude,
          },
          {
            lat: taskInfo.taskoutcomelocation.point.latitude,
            lng: taskInfo.taskoutcomelocation.point.longitude,
          }
        );
      }
    }
    return taskInfo;
  }

  addUpdate(date, taskReq, taskResp) {
    this.lastUpdate = date;
    this.updates.push({
      date,
      taskReq,
      taskResp,
    });
  }
}
export { Task as default };
