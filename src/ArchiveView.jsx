import React from "react";
import { useState } from "react";
import { Trash2, X } from "lucide-react";
import useStore from "./store";

const ArchiveView = ({ currentList }) => {
  const { archive, removeTask } = useStore();
  const [selectedTask, setSelectedTask] = useState(null);

  const archivedTasks = archive[currentList] || [];

  function isTaskExpired(task) {
    if (!task.dueDate) return false;
    return !task.done && new Date(task.dueDate).getTime() < Date.now();
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full px-1 sm:px-2 md:px-4 mt-4">
      {archivedTasks.length === 0 && (
        <div className="text-white opacity-60 mt-4">No archived tasks yet.</div>
      )}
      {archivedTasks.map((task, index) => (
        <div
          key={task.id || task.created || index}
          className="w-full max-w-lg bg-white/70 backdrop-blur-md rounded-2xl px-4 py-3 flex items-center justify-between shadow-lg cursor-pointer transition hover:bg-gray-100"
          onClick={() => setSelectedTask(task)}
          aria-label={`View details for archived task ${task.text}`}
        >
          <div className="flex items-center gap-2 truncate">
            <span className="text-gray-900 font-medium truncate">{task.text}</span>
            {task.dueDate && (
              <span className="text-gray-500 text-xs">
                (Due: {new Date(task.dueDate).toLocaleDateString()})
              </span>
            )}
            {task.done && (
              <span className="inline-flex items-center justify-center w-5 h-5 ml-2 text-green-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            )}
            {isTaskExpired(task) && (
              <span className="inline-flex items-center justify-center w-5 h-5 ml-2 text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="text-red-500 hover:text-red-700 transition"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete "${task.text}" permanently?`)) {
                  removeTask(currentList, index, true); // true indicates archived task
                }
              }}
              aria-label={`Delete archived task ${task.text}`}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xs sm:max-w-md mx-2 p-4 relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
              onClick={() => setSelectedTask(null)}
              aria-label="Close task details"
              style={{ zIndex: 10 }}
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-gray-400"></span>
              Task Details
            </h2>
            <div className="mb-2">
              <span className="font-semibold">Text:</span>
              <div className="break-words">{selectedTask.text}</div>
            </div>
            <div className="mb-2">
              <span className="font-semibold">Type:</span> {selectedTask.type}
            </div>
            {selectedTask.dueDate && (
              <div className="mb-2">
                <span className="font-semibold">Due:</span> {new Date(selectedTask.dueDate).toLocaleString()}
              </div>
            )}
            {selectedTask.subtasks && (
              <div className="mb-2">
                <span className="font-semibold">Subtasks:</span> {selectedTask.subtasks}
              </div>
            )}
            <div className="mb-2">
              <span className="font-semibold">Status:</span> Archived
              {selectedTask.done && <span className="ml-2 text-green-500"> (Completed)</span>}
              {isTaskExpired(selectedTask) && <span className="ml-2 text-red-500"> (Expired)</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchiveView;