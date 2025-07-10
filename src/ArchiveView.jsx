import { useState, useEffect } from "react";
import { Trash2, CheckCircle, XCircle } from "lucide-react";
import useStore from "./store";

const ArchiveView = ({ currentList, setShowArchive, setSelectedTask, taskRefs }) => {
  const { archive, deleteTaskFromArchive, undoDeleteTaskFromArchive } = useStore();
  const [undoTaskQueue, setUndoTaskQueue] = useState([]);

  useEffect(() => {
    return () => {
      undoTaskQueue.forEach(undo => clearTimeout(undo.timer));
      setUndoTaskQueue([]);
    };
  }, [currentList]);

  const handleRemoveTask = (listId, idx) => {
    const taskToRemove = archive[listId][idx];
    deleteTaskFromArchive(listId, idx);
    setUndoTaskQueue(prevQueue => [
      ...prevQueue,
      {
        task: taskToRemove,
        idx,
        listId,
        timer: setTimeout(() => {
          setUndoTaskQueue(q => q.filter(u => u.task.id !== taskToRemove.id));
        }, 6000)
      }
    ]);
  };

  const handleUndoDeleteTask = (taskId, listId, idx) => {
    const undoInfo = undoTaskQueue.find(u => u.task.id === taskId);
    if (undoInfo) {
      clearTimeout(undoInfo.timer);
      undoDeleteTaskFromArchive(listId, undoInfo.task, undoInfo.idx);
      setUndoTaskQueue(q => q.filter(u => u.task.id !== taskId));
    }
  };

  const archivedTasks = archive[currentList] || [];

  const isExpired = (task) => task.dueDate && new Date(task.dueDate).getTime() <= Date.now() && !task.done;

  const formatDate = (dateStr) => {
    return dateStr ? new Date(dateStr).toLocaleString() : "N/A";
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full px-1 sm:px-2 md:px-4 mt-4">
      <button
        className="w-full max-w-lg mb-4 px-4 py-2 bg-[#fbbf24] text-white rounded-full font-semibold hover:bg-[#d9a316] transition"
        onClick={() => setShowArchive(false)}
        aria-label="Back to active tasks"
      >
        Back to Active Tasks
      </button>
      {archivedTasks.length === 0 ? (
        <div className="text-white opacity-60 mt-4">No archived tasks yet.</div>
      ) : (
        archivedTasks.map((task, index) => (
          <div
            key={task.id || task.created || index}
            ref={el => (taskRefs.current[index] = el)}
            className={`relative w-full max-w-lg rounded-full px-4 py-2 shadow-md transition-all duration-300 ${
              isExpired(task) ? "bg-red-100 opacity-60" : task.done ? "bg-green-100 opacity-80" : "bg-gray-200"
            }`}
            style={{ minHeight: "48px", position: "relative", overflow: "hidden", cursor: "pointer" }}
            onClick={() => setSelectedTask(task)}
          >
            <div className="relative z-10 flex items-center justify-between w-full h-full" style={{ alignItems: "center", height: "48px" }}>
              <div className="flex items-center flex-grow overflow-hidden" style={{ alignItems: "center" }}>
                <button
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-2 ${
                    isExpired(task)
                      ? "bg-red-500 border-red-500"
                      : task.done
                      ? "bg-green-500 border-green-500"
                      : "bg-gray-200 border-gray-400"
                  }`}
                  disabled={true}
                  aria-label={
                    isExpired(task)
                      ? "Task expired"
                      : task.done
                      ? "Task completed"
                      : "Task incomplete"
                  }
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}
                >
                  {isExpired(task) && <XCircle className="w-4 h-4 text-white" />}
                  {task.done && !isExpired(task) && <CheckCircle className="w-4 h-4 text-white" />}
                  {!task.done && !isExpired(task) && <CheckCircle className="w-4 h-4 text-gray-400" style={{ opacity: 0.5 }} />}
                </button>
                <div className="flex items-center gap-2 flex-grow min-w-0">
                  <div
                    className="text-sm md:text-base truncate flex-grow"
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {task.text}
                  </div>
                  {task.dueDate && (
                    <div className="text-xs text-gray-500 ml-2" style={{ whiteSpace: "nowrap" }}>
                      {isExpired(task)
                        ? `Expired: ${formatDate(task.dueDate)}`
                        : task.done
                        ? `Completed: ${formatDate(task.dueDate)}`
                        : `Due: ${formatDate(task.dueDate)}`}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2" style={{ alignItems: "center", height: "48px" }}>
                <button
                  className="w-6 h-6 text-gray-500 hover:text-red-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    const globalIdx = index;
                    handleRemoveTask(currentList, globalIdx);
                  }}
                  aria-label="Delete archived task"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))
      )}
      {undoTaskQueue.map((undoInfo, idx) => (
        <div
          key={undoInfo.task.id}
          className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 z-50 animate-fade-in"
          role="alert"
          style={{ bottom: `${4 + idx * 60}px` }}
        >
          <span>
            Task <b>{undoInfo.task.text}</b> deleted from archive.
          </span>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded-full font-semibold transition"
            onClick={() => handleUndoDeleteTask(undoInfo.task.id, undoInfo.listId, undoInfo.idx)}
            aria-label="Undo delete archived task"
          >
            Undo
          </button>
        </div>
      ))}
    </div>
  );
};

export default ArchiveView;