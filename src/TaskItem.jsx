import { useEffect, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import { Trash2, X } from "lucide-react";

const TaskItem = ({ task, index, globalIdx, toggleDone, archiveTask, removeTask, isHighlighted, taskRefs, setSelectedTask, progress, isDone }) => {
  const expired = !task.done && task.dueDate && new Date(task.dueDate).getTime() < Date.now();
  const completed = task.done;
  let bg = "bg-white";
  let border = "border-2 border-gray-300";
  let text = "text-black";
  if (completed) {
    bg = "bg-green-100";
    border = "border-green-400";
    text = "text-green-700";
  } else if (expired) {
    bg = "bg-red-100";
    border = "border-red-400";
    text = "text-red-700";
  } else if (task.dueDate) {
    bg = "bg-yellow-100";
    border = "border-yellow-400";
    text = "text-yellow-700";
  }

  const progressRef = useRef(null);
  const wasDone = useRef(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (progressRef.current && isInitialMount.current) {
      // Only reset to 0% for new tasks (created within the last 5 seconds)
      const isNewTask = !task.created || (Date.now() - task.created < 5000);
      if (isNewTask) {
        progressRef.current.style.width = '0%';
        progressRef.current.style.transition = 'none'; // Disable transition for initial reset
      }
      // Apply transition after initial render for all tasks
      progressRef.current.style.transition = 'width 1s ease-in-out';
      isInitialMount.current = false;
    }
  }, []);

  useEffect(() => {
    if (isDone && !wasDone.current && progressRef.current) {
      // Get the current width percentage
      const currentWidth = parseFloat(progressRef.current.style.width) || progress || 0;
      // Set initial width to current progress
      progressRef.current.style.width = `${currentWidth}%`;
      // Trigger animation to 100% over 0.5 seconds
      requestAnimationFrame(() => {
        progressRef.current.style.transition = 'width 0.5s ease-out';
        progressRef.current.style.width = '100%';
      });
      // Reset transition after animation
      setTimeout(() => {
        progressRef.current.style.transition = 'width 1s ease-in-out';
      }, 500);
      wasDone.current = true; // Prevent re-triggering
    }
  }, [isDone, progress]);

  const handlers = useSwipeable({
    onSwipedRight: () => {
      if (!expired && !completed) {
        toggleDone(globalIdx);
      }
    },
    delta: 50,
    preventDefaultTouchmoveEvent: true,
  });

  return (
    <div
      ref={el => { if (isHighlighted) taskRefs.current[globalIdx] = el; }}
      {...handlers}
      className={`flex flex-nowrap items-center rounded-full px-2 py-1 w-11/12 md:w-1/2 shadow-md overflow-x-auto relative ${bg} ${border} ${isHighlighted ? "highlight-glow" : ""}`}
      style={{ minHeight: "48px", transition: "box-shadow 0.3s, transform 0.3s" }}
      onClick={() => setSelectedTask(task)}
      tabIndex={0}
      role="button"
      aria-label={`Show details for task ${task.text}, swipe right to mark as done`}
    >
      {/* Progress Bar Overlay */}
      {task.dueDate && (
        <div
          ref={progressRef}
          className={`absolute top-0 left-0 h-full rounded-full opacity-50 ${isDone ? 'bg-gradient-to-r from-green-200 via-green-300 to-green-400' : 'bg-gradient-to-r from-green-400 via-yellow-400 to-red-500'}`}
          style={{
            width: `${isDone ? 100 : progress}%`, // Use 100% when done, otherwise use real-time progress
            zIndex: 1,
          }}
        />
      )}
      <span className={`font-bold mr-2 text-sm md:text-base flex-shrink-0 ${text} z-10`}>{globalIdx + 1})</span>
      <span
        className={`flex-grow min-w-0 pr-2 text-sm md:text-base truncate ${text} transition-transform duration-300 z-10`}
        style={{ transform: completed ? 'translateX(20px)' : 'translateX(0)' }}
      >
        {task.text}
      </span>
      {completed && (
        <svg className="w-5 h-5 text-green-500 flex-shrink-0 ml-2 z-10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {task.dueDate && (
        <span className="ml-2 text-xs text-gray-700 flex-shrink-0 z-10">
          {new Date(task.dueDate).toLocaleString()}
        </span>
      )}
      {task.type === "longterm" && task.subtasks && (
        <span className="ml-2 text-xs text-gray-500 flex-shrink-0 z-10">
          [{task.subtasks}]
        </span>
      )}
      <button
        className={`ml-2 w-7 h-7 flex items-center justify-center rounded-full transition-colors duration-200 ${
          completed
            ? "bg-green-500 border-green-500 text-white"
            : expired
            ? "bg-red-300 border-red-400 text-white cursor-not-allowed"
            : "bg-white border-gray-300 text-gray-700"
        } border-2 flex-shrink-0 z-10`}
        onClick={e => {
          e.stopPropagation();
          !expired && !completed && toggleDone(globalIdx);
        }}
        aria-label="Mark as done"
        disabled={completed || expired}
        title={completed ? "Completed" : expired ? "Expired" : "Mark as done"}
      >
        {completed ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : expired ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : null}
      </button>
      <button
        className="ml-2 w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-red-200 hover:text-red-600 transition flex-shrink-0 z-10"
        onClick={e => {
          e.stopPropagation();
          if (window.confirm("Are you sure you want to archive this task?")) {
            archiveTask(globalIdx);
          }
        }}
        aria-label="Archive task"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      <button
        className="ml-2 w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-black hover:text-white transition flex-shrink-0 z-10"
        onClick={e => {
          e.stopPropagation();
          if (window.confirm("Are you sure you want to permanently delete this task? This cannot be undone.")) {
            removeTask(globalIdx);
          }
        }}
        aria-label="Delete task"
        title="Delete task permanently"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default TaskItem;