import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import useStore from "./store";

const ArchiveView = ({ currentList, setShowArchive }) => {
  const { archive, removeTask, undoArchiveTask } = useStore();
  const [undoTaskQueue, setUndoTaskQueue] = useState([]);

  useEffect(() => {
    return () => {
      undoTaskQueue.forEach(undo => clearTimeout(undo.timer));
      setUndoTaskQueue([]);
    };
  }, [currentList]);

  const handleRemoveTask = (listId, idx) => {
    removeTask(listId, idx);
  };

  const handleUndoArchiveTask = (taskId, listId, idx) => {
    const undoInfo = undoTaskQueue.find(u => u.task.id === taskId);
    if (undoInfo) {
      clearTimeout(undoInfo.timer);
      undoArchiveTask(listId, undoInfo.task, idx);
      setUndoTaskQueue(q => q.filter(u => u.task.id !== taskId));
    }
  };

  const archivedTasks = archive[currentList] || [];

  return (
    <div className="flex flex-col items-center gap-3 w-full px-1 sm:px-2 md:px-4 mt-4">
      <button
        className="w-full max-w-lg mb-4 px-4 py-2 bg-[#fbbf24] text-white rounded-full font-semibold hover:bg-[#d9a316]"
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
            className="w-full max-w-lg rounded-full px-4 py-2 bg-gray-200 opacity-60 shadow-md flex items-center justify-between"
            style={{ minHeight: "48px" }}
          >
            <span className="text-sm md:text-base text-gray-700 truncate">{task.text}</span>
            <button
              className="w-6 h-6 text-gray-500 hover:text-red-500"
              onClick={() => {
                const globalIdx = index;
                handleRemoveTask(currentList, globalIdx);
                setUndoTaskQueue(prevQueue => [
                  ...prevQueue,
                  {
                    task,
                    idx: globalIdx,
                    listId: currentList,
                    timer: setTimeout(() => {
                      setUndoTaskQueue(q => q.filter(u => u.task.id !== task.id));
                    }, 6000)
                  }
                ]);
              }}
              aria-label="Delete archived task"
            >
              <Trash2 className="w-5 h-5" />
            </button>
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
            onClick={() => handleUndoArchiveTask(undoInfo.task.id, undoInfo.listId, undoInfo.idx)}
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