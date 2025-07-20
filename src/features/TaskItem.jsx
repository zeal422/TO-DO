import { useEffect, useRef, useState } from "react";
import { Archive as ArchiveIcon, Trash2, CheckCircle, XCircle } from "lucide-react";

const TaskItem = ({
  task,
  index,
  globalIdx,
  finishTask,
  archiveTask,
  removeTask,
  isHighlighted,
  taskRefs,
  setSelectedTask,
  isDone,
}) => {
  const taskRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [completionProgress, setCompletionProgress] = useState(task.done ? 100 : 0);

  useEffect(() => {
    taskRefs.current[globalIdx] = taskRef.current;
    if (!task.archived && task.dueDate) {
      const updateProgress = () => {
        const now = Date.now();
        const due = new Date(task.dueDate).getTime();
        const totalDuration = due - now;
        if (totalDuration <= 0 && !isDone) {
          setProgress(100);
          return;
        }
        const elapsed = Math.max(0, due - now);
        const initialDuration = new Date(task.dueDate).getTime() - new Date(task.created || now).getTime();
        const progressPercent = ((initialDuration - elapsed) / initialDuration) * 100;
        setProgress(Math.min(100, Math.max(0, progressPercent)));
      };

      updateProgress();
      const interval = setInterval(updateProgress, 1000);
      return () => clearInterval(interval);
    } else {
      setProgress(0);
    }
  }, [globalIdx, taskRefs, task, finishTask, isDone]);

  useEffect(() => {
    if (task.done && completionProgress < 100) {
      setCompletionProgress(100);
    } else if (!task.done && completionProgress > 0) {
      setCompletionProgress(0);
    }
  }, [task.done, completionProgress]);

  const isExpired = task.dueDate && new Date(task.dueDate).getTime() <= Date.now() && !isDone && !task.archived;

  return (
    <div
      ref={taskRef}
      className={`relative w-full max-w-lg rounded-full px-4 py-2 shadow-md transition-all duration-300 ${
        isHighlighted ? "bg-yellow-100" : ""
      } ${
        isDone && !task.archived && !isExpired ? "bg-green-100 opacity-80" : ""
      } ${
        (task.archived || isExpired) ? "bg-red-500" : "bg-white"
      }`}
      style={{ minHeight: "48px", position: "relative", overflow: "hidden" }}
    >
      {!isDone && !task.archived && task.dueDate && (
        <div
          className="absolute top-0 left-0 h-full bg-blue-200 opacity-75 rounded-full transition-all duration-1000 ease-in-out"
          style={{
            width: `${progress}%`,
            zIndex: 0,
          }}
        />
      )}
      {isDone && !task.archived && (
        <div
          className="absolute top-0 left-0 h-full bg-green-500 opacity-75 rounded-full transition-all duration-400 ease-in-out"
          style={{
            width: `${completionProgress}%`,
            zIndex: 0,
          }}
        />
      )}
      <div className="relative z-10 flex items-center justify-between w-full h-full" style={{ alignItems: "center", height: "48px" }}>
        <div className="flex items-center flex-grow overflow-hidden" style={{ alignItems: "center" }}>
          <button
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-2 ${
              (task.archived || isExpired)
                ? "bg-red-500 border-red-500"
                : isDone
                ? "bg-green-500 border-green-500"
                : "bg-gray-200 border-gray-400 hover:bg-gray-300"
            }`}
            onClick={() => {
              if (!isDone && !isExpired && !task.archived) {
                finishTask(index);
              }
            }}
            disabled={isDone || isExpired || task.archived}
            aria-label={
              task.archived
                ? "Task archived"
                : isExpired
                ? "Task expired"
                : isDone
                ? "Task completed"
                : "Mark task as finished"
            }
            style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}
          >
            {(task.archived || isExpired) && (
              <XCircle className="w-4 h-4 text-white" />
            )}
            {isDone && !isExpired && !task.archived && (
              <CheckCircle className="w-4 h-4 text-white" />
            )}
            {!isDone && !isExpired && !task.archived && (
              <CheckCircle className="w-4 h-4 text-gray-400" style={{ opacity: 0.5 }} />
            )}
          </button>
          <div
            className="flex-grow min-w-0 pr-2 md:pr-0 text-sm md:text-base truncate flex items-center"
            onClick={() => !task.archived && setSelectedTask(task)}
            style={{
              cursor: task.archived ? "default" : "pointer",
              padding: "2px 0",
              display: "flex",
              alignItems: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {task.text}
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0 task-item-date" style={{ display: "flex", alignItems: "center" }}>
            {task.dueDate && (
              <span className="text-xs text-black flex items-center">
                {new Date(task.dueDate).toLocaleString()}
              </span>
            )}
            {task.type === "longterm" && task.subtasks && (
              <span className="text-xs text-black flex items-center">
                [{task.subtasks}]
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2" style={{ alignItems: "center", height: "48px" }}>
          {!task.archived && (
            <button
              className="w-6 h-6 text-black hover:text-gray-700"
              onClick={() => archiveTask(globalIdx)}
              disabled={task.archived}
              aria-label={task.archived ? "Task already archived" : "Archive task"}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}
            >
              <ArchiveIcon className="w-5 h-5" />
            </button>
          )}
          <button
            className="w-6 h-6 text-black hover:text-gray-700"
            onClick={() => removeTask(globalIdx)}
            disabled={task.archived}
            aria-label={task.archived ? "Cannot remove archived task" : "Remove task"}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
      {!task.archived && !task.dueDate && (
        <button
          type="button"
          className="pick-due-date flex items-center px-3 py-1 h-10 rounded-lg bg-white border border-gray-200 text-gray-700 text-base font-medium shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 transition w-full sm:w-auto whitespace-nowrap text-center"
          onClick={() => document.getElementById('dueDateInput')?.showPicker && document.getElementById('dueDateInput')?.showPicker()}
          aria-label="Pick due date"
        >
          <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2" fill="none"/>
            <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <span className="whitespace-nowrap">Pick due date</span>
        </button>
      )}
    </div>
  );
};

export default TaskItem;