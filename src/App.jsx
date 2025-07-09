import { useState, useEffect, useRef, useCallback } from "react";
import { useSwipeable } from 'react-swipeable';
import "./index.css";
import Preloader from "./Preloader";
import TaskItem from "./TaskItem";
import ArchiveView from "./ArchiveView";
import useStore from "./store";
import { ErrorBoundary } from 'react-error-boundary';
import { Bell, Plus, Trash2, FolderPlus, FolderOpen, X } from "lucide-react";

const COLORS = [
  "#d62338", "#357C74", "#4D4D4D", "#1C1C1C", "#fbbf24", "#2563eb"
];
const MAX_LIST_NAME = 25;
const UNDO_TIMEOUT = 6000;
const LOCAL_STORAGE_LIMIT = 5 * 1024 * 1024;
const TASKS_PER_PAGE = 100;

function isTaskExpired(task) {
  if (!task.dueDate) return false;
  return !task.done && !task.archived && new Date(task.dueDate).getTime() < Date.now();
}
function formatDuration(ms) {
  const min = Math.round(ms / 60000);
  if (min >= 120) return `${Math.round(min / 60)} hours`;
  if (min >= 60) return `${Math.round(min / 60)} hour`;
  if (min > 1) return `${min} minutes`;
  return "a moment";
}
function setFaviconBadge(count) {
  const favicon = document.querySelector("link[rel~='icon']");
  if (!favicon) return;
  if (!setFaviconBadge.originalHref) {
    setFaviconBadge.originalHref = favicon.href;
  }
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = document.createElement("img");
  img.src = setFaviconBadge.originalHref;
  img.onload = () => {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    if (count > 0) {
      ctx.beginPath();
      ctx.arc(size - 8, 8, 8, 0, 2 * Math.PI);
      ctx.fillStyle = "#e11d48";
      ctx.fill();
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        count > 99 ? "99+" : count.toString(),
        size - 8,
        8
      );
    }
    favicon.href = canvas.toDataURL("image/png");
  };
  if (count === 0) {
    favicon.href = setFaviconBadge.originalHref;
  }
}
function sanitizeInput(str) {
  return String(str).replace(/[<>&"'`]/g, c => ({
    "<": "",
    ">": "",
    "&": "",
    "\"": "",
    "'": "",
    "`": ""
  }[c]));
}
function getStorageSize() {
  let total = 0;
  for (let key in localStorage) {
    if (!localStorage.hasOwnProperty(key)) continue;
    total += (localStorage[key].length + key.length) * 2;
  }
  return total;
}
function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="text-white text-center p-4">
      <h2 className="text-xl font-bold">Something Went Wrong</h2>
      <p>{error.message}</p>
      <button
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
        onClick={resetErrorBoundary}
      >
        Try Again
      </button>
    </div>
  );
}

const App = () => {
  const {
    lists,
    tasks,
    archive,
    notifications,
    addTask,
    toggleDone,
    archiveTask,
    undoArchiveTask,
    removeTask,
    addList,
    removeList,
    undoDeleteList,
    addNotification,
    clearNotifications,
    setData
  } = useStore();

  const [bgColor, setBgColor] = useState(localStorage.getItem("bgColor") || COLORS[3]);
  const [loading, setLoading] = useState(true);
  const [currentList, setCurrentList] = useState("");
  const [badgeAnim, setBadgeAnim] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [newTask, setNewTask] = useState({
    text: "",
    dueDate: "",
    subtasks: ""
  });
  const [dueDatePrompt, setDueDatePrompt] = useState(false);
  const [undoListQueue, setUndoListQueue] = useState([]);
  const [undoTaskQueue, setUndoTaskQueue] = useState([]);
  const [showNotifCenter, setShowNotifCenter] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [highlightedTask, setHighlightedTask] = useState(null);
  const taskRefs = useRef({});
  const [page, setPage] = useState(0);
  const [lastSeenNotifCount, setLastSeenNotifCount] = useState(() => {
    return parseInt(localStorage.getItem("lastSeenNotifCount") || "0");
  });

  useEffect(() => {
    const savedNotifications = localStorage.getItem("notifications");
    if (savedNotifications) {
      setData({ notifications: JSON.parse(savedNotifications) });
    }
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem("notifications", JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    if (!currentList && lists.length > 0) {
      setCurrentList(lists[0].id);
    } else if (lists.length === 0) {
      setCurrentList(null);
    }
    console.log("Store state in App:", { lists, tasks, currentList });
  }, [lists, currentList]);

  useEffect(() => {
    if (!loading) {
      let timeoutId = null;
      const checkTasks = () => {
        const reminderSent = JSON.parse(localStorage.getItem("reminderSent") || "{}");
        let nextCheck = 60000;
        Object.keys(tasks).forEach(listId => {
          (tasks[listId] || []).forEach((task) => {
            if (task.dueDate && !task.done && !task.archived) {
              const due = new Date(task.dueDate).getTime();
              const now = Date.now();
              const timeLeft = due - now;
              const uniqueKey = `${listId}:${task.id}:${task.dueDate}`;
              if (timeLeft <= 0 && !reminderSent[uniqueKey + ":expired"]) {
                reminderSent[uniqueKey + ":expired"] = true;
                pushNotification({
                  type: "expired",
                  message: `Task "${task.text}" has expired!`,
                  task,
                  list: listId
                });
                showBrowserNotification("Task Expired", `Task "${task.text}" has expired!`);
              }
              if (!reminderSent[uniqueKey + ":reminder"] && timeLeft > 2 * 60 * 1000) {
                const totalTime = due - now;
                const halfTime = totalTime / 2;
                if (timeLeft <= halfTime + 60000 && timeLeft >= halfTime - 60000) {
                  reminderSent[uniqueKey + ":reminder"] = true;
                  pushNotification({
                    type: "reminder",
                    message: `Task "${task.text}" is due in ${formatDuration(timeLeft)}!`,
                    task,
                    list: listId
                  });
                  showBrowserNotification("Task Reminder", `Task "${task.text}" is due in ${formatDuration(timeLeft)}!`);
                }
              }
              if (timeLeft > 0 && timeLeft < nextCheck) {
                nextCheck = Math.max(1000, timeLeft);
              }
            }
          });
        });
        localStorage.setItem("reminderSent", JSON.stringify(reminderSent));
        timeoutId = setTimeout(checkTasks, nextCheck);
      };
      checkTasks();
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
      };
    }
  }, [loading, tasks]);

  useEffect(() => {
    try {
      localStorage.setItem("bgColor", bgColor);
      if (getStorageSize() > LOCAL_STORAGE_LIMIT * 0.9) {
        addNotification({
          id: Date.now() + Math.random(),
          type: "warning",
          message: "Storage almost full. Archive or export data soon.",
          time: new Date().toISOString()
        });
      }
    } catch (e) {
      addNotification({
        id: Date.now() + Math.random(),
        type: "error",
        message: "Storage quota exceeded! Delete some tasks/lists.",
        time: new Date().toISOString()
      });
    }
  }, [bgColor]);

  useEffect(() => {
    if (selectedTask) {
      const handleKey = e => {
        if (e.key === "Escape") setSelectedTask(null);
      };
      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    }
  }, [selectedTask]);

  useEffect(() => {
    if (showNotifCenter) {
      const handleKey = e => {
        if (e.key === "Escape") setShowNotifCenter(false);
      };
      window.addEventListener("keydown", handleKey);
      setLastSeenNotifCount(notifications.length);
      localStorage.setItem("lastSeenNotifCount", notifications.length);
      setFaviconBadge(0);
      return () => window.removeEventListener("keydown", handleKey);
    } else if (!showNotifCenter && lastSeenNotifCount >= 0) {
      const unseenCount = notifications.length > lastSeenNotifCount ? notifications.length - lastSeenNotifCount : 0;
      setFaviconBadge(unseenCount);
    }
  }, [showNotifCenter, notifications.length, lastSeenNotifCount]);

  useEffect(() => {
    if (highlightedTask && highlightedTask.listId === currentList) {
      const el = taskRefs.current[highlightedTask.idx];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-glow");
        setTimeout(() => el.classList.remove("highlight-glow"), 2000);
      }
    }
  }, [highlightedTask, currentList]);

  const completedCount = (tasks[currentList] || []).filter(t => t.done && !t.archived).length;
  useEffect(() => {
    if (completedCount > 0) {
      setBadgeAnim(true);
      const timeout = setTimeout(() => setBadgeAnim(false), 700);
      return () => clearTimeout(timeout);
    }
  }, [completedCount]);

  function showBrowserNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body, icon: "/favicon.ico" });
      } catch {
        addNotification({
          id: Date.now() + Math.random(),
          type: "fallback",
          message: `${title}: ${body}`,
          time: new Date().toISOString()
        });
      }
    } else {
      addNotification({
        id: Date.now() + Math.random(),
        type: "fallback",
        message: `${title}: ${body}`,
        time: new Date().toISOString()
      });
    }
  }
  function pushNotification({ type, message, task, list }) {
    addNotification({
      id: Date.now() + Math.random(),
      type,
      message,
      taskText: task?.text,
      dueDate: task?.dueDate,
      listId: list,
      time: new Date().toISOString()
    });
    setBadgeAnim(true);
    setTimeout(() => setBadgeAnim(false), 700);
  }

  const handleAddTask = useCallback(() => {
    const sanitizedText = sanitizeInput(newTask.text.trim());
    if (!sanitizedText) return;
    if (!newTask.dueDate) {
      setDueDatePrompt(true);
      setTimeout(() => setDueDatePrompt(false), 2000);
      return;
    }
    if ((tasks[currentList] || []).some(t => t.text === sanitizedText && t.dueDate === newTask.dueDate)) {
      alert("Duplicate task with same text and due date exists.");
      return;
    }
    const task = {
      id: uuid(),
      text: sanitizedText,
      dueDate: newTask.dueDate,
      subtasks: newTask.subtasks || "",
      done: false,
      archived: false,
      created: Date.now()
    };
    addTask(currentList, task);
    setNewTask({ text: "", dueDate: "", subtasks: "" });

    setTimeout(() => {
      setHighlightedTask({ listId: currentList, idx: 0 });
      setPage(0);
      setTimeout(() => setHighlightedTask(null), 2000);
    }, 100);
  }, [newTask, tasks, currentList, addTask]);

  const handleFinishTask = useCallback((idx) => {
    const globalIdx = page * TASKS_PER_PAGE + idx;
    toggleDone(currentList, globalIdx);
    const task = (tasks[currentList] || [])[globalIdx];
    if (task.done) {
      pushNotification({
        type: "completed",
        message: `Task "${task.text}" completed!`,
        task,
        list: currentList
      });
      showBrowserNotification("Task Completed", `Task "${task.text}" completed!`);
    }
  }, [currentList, page, tasks, toggleDone, pushNotification]);

  const handleArchiveTask = useCallback((idx) => {
    const globalIdx = page * TASKS_PER_PAGE + idx;
    const taskToArchive = (tasks[currentList] || [])[globalIdx];
    archiveTask(currentList, globalIdx);
    setUndoTaskQueue(prevQueue => {
      const existing = prevQueue.find(u => u.task.id === taskToArchive.id);
      if (existing) {
        clearTimeout(existing.timer);
        return prevQueue.map(u =>
          u.task.id === taskToArchive.id ? { ...u, timer: setTimeout(() => {
            setUndoTaskQueue(q2 => q2.filter(u2 => u2.task.id !== taskToArchive.id));
          }, UNDO_TIMEOUT) } : u
        );
      } else {
        return [
          ...prevQueue,
          {
            task: taskToArchive,
            idx: globalIdx,
            listId: currentList,
            timer: setTimeout(() => {
              setUndoTaskQueue(q2 => q2.filter(u => u.task.id !== taskToArchive.id));
            }, UNDO_TIMEOUT)
          }
        ];
      }
    });
  }, [currentList, tasks, page, archiveTask]);

  const handleUndoArchiveTask = useCallback((taskId) => {
    const undoInfo = undoTaskQueue.find(u => u.task.id === taskId);
    if (!undoInfo) return;
    clearTimeout(undoInfo.timer);
    undoArchiveTask(undoInfo.listId, undoInfo.task, undoInfo.idx);
    setUndoTaskQueue(q => q.filter(u => u.task.id !== taskId));
  }, [undoTaskQueue, undoArchiveTask]);

  const handleRemoveTask = useCallback((idx) => {
    removeTask(currentList, page * TASKS_PER_PAGE + idx);
  }, [currentList, page, removeTask]);

  const handleAddList = useCallback(() => {
    let name = prompt(`List name? (max ${MAX_LIST_NAME} characters)`);
    if (!name) return;
    name = sanitizeInput(name.trim());
    if (name.length > MAX_LIST_NAME) {
      alert(`List name too long! Max ${MAX_LIST_NAME} characters.`);
      return;
    }
    if (lists.some(l => l.name === name)) {
      alert("A list with this name already exists.");
      return;
    }
    const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
    addList(id, name);
    setCurrentList(id);
  }, [lists, addList]);

  const handleRemoveList = useCallback((id) => {
    if (!window.confirm("Delete this list and all its tasks?")) return;
    const deletedList = lists.find(l => l.id === id);
    const deletedTasks = tasks[id] || [];
    const deletedArchive = archive[id] || [];
    removeList(id);
    setUndoListQueue(q => [
      ...q,
      {
        list: deletedList,
        tasks: deletedTasks,
        archive: deletedArchive,
        prevCurrentList: currentList,
        timer: setTimeout(() => {
          setUndoListQueue(q2 => q2.filter(u => u.list.id !== id));
        }, UNDO_TIMEOUT)
      }
    ]);
    setCurrentList(lists.length > 0 ? lists[0].id : null);
  }, [lists, tasks, archive, currentList, removeList]);

  const handleUndoDeleteList = useCallback((listId) => {
    const undoInfo = undoListQueue.find(u => u.list.id === listId);
    if (!undoInfo) return;
    clearTimeout(undoInfo.timer);
    undoDeleteList(undoInfo.list, undoInfo.tasks, undoInfo.archive);
    setCurrentList(undoInfo.list.id);
    setUndoListQueue(q => q.filter(u => u.list.id !== listId));
  }, [undoListQueue, undoDeleteList]);

  const unseenCount = notifications.length > lastSeenNotifCount ? notifications.length - lastSeenNotifCount : 0;

  if (loading) return <Preloader />;

  const filteredTasks = (tasks[currentList] || []).filter(t => !t.archived);
  const totalPages = Math.ceil(filteredTasks.length / TASKS_PER_PAGE);
  const pagedTasks = filteredTasks.slice(page * TASKS_PER_PAGE, (page + 1) * TASKS_PER_PAGE);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
      <div
        className="min-h-screen transition-colors duration-300 relative px-1 sm:px-2 md:px-4"
        style={{ backgroundColor: bgColor }}
      >
        <>
          <div className="flex justify-center pt-8">
            {COLORS.map((color) => (
              <div key={color} className="relative mx-1">
                <button
                  className="w-6 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                  onClick={() => setBgColor(color)}
                  aria-label={`Set background color to ${color}`}
                ></button>
                {bgColor === color && (
                  <div className="absolute top-3 left-1/2 transform -translate-x-1/2 text-white">▾</div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-4 gap-2 flex-wrap">
            {lists.map(list => (
              <button
                key={list.id}
                className="px-3 py-1 rounded-full font-semibold transition text-sm sm:text-base"
                title={list.name}
                style={{
                  background: currentList === list.id ? "#fff" : "rgba(0,0,0,0.3)",
                  color: currentList === list.id ? "#000" : "#fff",
                  boxShadow: currentList === list.id ? "0 1px 4px rgba(0,0,0,0.08)" : undefined,
                  border: "none"
                }}
                onClick={() => { setCurrentList(list.id); setPage(0); }}
                aria-label={`Switch to list ${list.name}`}
              >
                {list.name}
                <Trash2
                  className="inline ml-2 w-4 h-4 text-red-400 hover:text-red-600"
                  onClick={e => {
                    e.stopPropagation();
                    handleRemoveList(list.id);
                  }}
                  aria-label={`Delete list ${list.name}`}
                  tabIndex={-1}
                />
              </button>
            ))}
            <button
              className="px-2 py-1 rounded-full bg-green-500 text-white flex items-center gap-1 text-sm sm:text-base"
              onClick={handleAddList}
              aria-label="Add new list"
            >
              <FolderPlus className="w-4 h-4" /> Add List
            </button>
            <button
              className={`px-2 py-1 rounded-full flex items-center gap-1 text-sm sm:text-base ${
                showArchive ? "bg-yellow-400 text-black" : "bg-black/30 text-white"
              }`}
              onClick={() => setShowArchive(a => !a)}
              aria-label={showArchive ? "Hide Archive" : "Show Archive"}
            >
              <FolderOpen className="w-4 h-4" /> {showArchive ? "Hide" : "Show"} Archive
            </button>
          </div>

          {undoTaskQueue.map((undoInfo, idx) => (
            <div
              key={undoInfo.task.id}
              className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 z-50 animate-fade-in"
              role="alert"
              style={{ bottom: `${4 + idx * 60}px` }}
            >
              <span>
                Task <b>{undoInfo.task.text}</b> archived.
              </span>
              <button
                className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded-full font-semibold transition"
                onClick={() => handleUndoArchiveTask(undoInfo.task.id)}
                aria-label="Undo archive task"
              >
                Undo
              </button>
            </div>
          ))}

          {undoListQueue.map((undoInfo, idx) => (
            <div
              key={undoInfo.list.id}
              className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 z-50 animate-fade-in"
              role="alert"
              style={{ bottom: `${4 + idx * 60}px` }}
            >
              <span>
                List <b>{undoInfo.list.name}</b> deleted.
              </span>
              <button
                className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded-full font-semibold transition"
                onClick={() => handleUndoDeleteList(undoInfo.list.id)}
                aria-label="Undo delete list"
              >
                Undo
              </button>
            </div>
          ))}

          <div className="flex items-center justify-center mt-6 relative">
            <h1 className="text-4xl text-white font-bold">TO DO LIST</h1>
            <div className="relative ml-4">
              <button
                className="focus:outline-none"
                onClick={() => {
                  setShowNotifCenter(true);
                  setLastSeenNotifCount(notifications.length);
                  localStorage.setItem("lastSeenNotifCount", notifications.length);
                  setFaviconBadge(0);
                }}
                aria-label="Show notifications"
              >
                <Bell
                  className={`w-8 h-8 transition-transform duration-300 ${
                    bgColor === "#fbbf24" ? "text-white" : "text-yellow-400"
                  } ${badgeAnim ? "animate-bell-ring" : ""}`}
                />
                {!showNotifCenter && unseenCount > 0 && (
                  <span
                    className={`absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center z-10
                      ${badgeAnim ? "animate-ping-short" : ""}
                    `}
                    aria-label={`${unseenCount} new notifications`}
                  >
                    {unseenCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {showNotifCenter && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-xs sm:max-w-md mx-2 p-2 sm:p-4 relative overflow-auto">
                <button
                  className="absolute top-2 right-2 text-gray-500 hover:text-black"
                  onClick={() => setShowNotifCenter(false)}
                  aria-label="Close notifications"
                  style={{ zIndex: 10 }}
                >
                  <X className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-yellow-400" /> Notifications
                </h2>
                {notifications.length === 0 && (
                  <div className="text-gray-500 text-center py-8">No notifications yet.</div>
                )}
                <ul className="max-h-80 overflow-y-auto space-y-3">
                  {notifications.map((notif, i) => (
                    <li
                      key={notif.id}
                      className="border-b pb-2 last:border-b-0 cursor-pointer hover:bg-gray-100 transition rounded"
                      onClick={() => {
                        if (tasks[notif.listId]) {
                          setCurrentList(notif.listId);
                          setShowNotifCenter(false);
                          const currentTasks = tasks[notif.listId] || [];
                          const idx = currentTasks.findIndex(
                            t => t.text === notif.taskText && t.dueDate === notif.dueDate
                          );
                          if (idx !== -1) {
                            setHighlightedTask({ listId: notif.listId, idx });
                            setTimeout(() => {
                              const el = taskRefs.current[idx];
                              if (el) {
                                el.scrollIntoView({ behavior: "smooth", block: "center" });
                                el.classList.add("highlight-glow");
                                setTimeout(() => el.classList.remove("highlight-glow"), 2000);
                              }
                              setTimeout(() => setHighlightedTask(null), 2000);
                            }, 200);
                          }
                        }
                      }}
                      title={
                        lists.find(l => l.id === notif.listId)
                          ? `Go to list: ${lists.find(l => l.id === notif.listId).name}`
                          : "Go to list"
                      }
                      tabIndex={0}
                      aria-label={`Notification: ${notif.message}`}
                    >
                      <div className="flex items-center gap-2">
                        {notif.type === "reminder" && (
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-400" title="Reminder"></span>
                        )}
                        {notif.type === "expired" && (
                          <span className="inline-block w-2 h-2 rounded-full bg-red-500" title="Expired"></span>
                        )}
                        {notif.type === "completed" && (
                          <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Completed"></span>
                        )}
                        <span className="text-sm">
                          {notif.message}
                          {lists.find(l => l.id === notif.listId) && (
                            <span className="ml-2 text-xs text-gray-500">
                              [List: {lists.find(l => l.id === notif.listId).name}]
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(notif.time).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  className="mt-4 w-full bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full py-2 font-semibold"
                  onClick={() => clearNotifications()}
                  aria-label="Clear all notifications"
                >
                  Clear All Notifications
                </button>
              </div>
            </div>
          )}

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
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-400"></span>
                  Task Details
                </h2>
                <div className="mb-2">
                  <span className="font-semibold">Text:</span>
                  <div className="break-words">{selectedTask.text}</div>
                </div>
                <div className="mb-2">
                  <span className="font-semibold">Type:</span> {selectedTask.type || "N/A"}
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
                  <span className="font-semibold">Status:</span>{" "}
                  {selectedTask.done ? "Completed" : isTaskExpired(selectedTask) ? "Expired" : "Active"}
                </div>
                {!selectedTask.done && (
                  <button
                    className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white rounded py-2"
                    onClick={() => {
                      handleFinishTask(pagedTasks.findIndex(t => t.id === selectedTask.id));
                      setSelectedTask(null);
                    }}
                    aria-label="Finish task"
                  >
                    Finish Task
                  </button>
                )}
              </div>
            </div>
          )}

          {!showArchive && (
            <div className="flex flex-col items-center gap-2 w-full mt-2">
              {lists.length === 0 ? (
                <div
                  className="w-full max-w-lg rounded-2xl px-4 py-4 text-center font-semibold shadow-md text-base"
                  style={{
                    background: "#fff3",
                    backdropFilter: "blur(6px)",
                    border: "1.5px solid #fff5",
                    color: "#e5e7eb",
                    textShadow: "0 1px 4px #000a"
                  }}
                >
                  Add a new list first to start adding tasks.
                </div>
              ) : (
                <form
                  className="w-full max-w-lg rounded-2xl px-3 py-2 flex flex-col sm:flex-row items-center justify-center gap-2 shadow-lg bg-white/70 backdrop-blur-md border border-gray-200"
                  style={{ minHeight: 56 }}
                  onSubmit={e => {
                    e.preventDefault();
                    handleAddTask();
                  }}
                >
                  <input
                    type="text"
                    value={newTask.text}
                    placeholder="Enter your task here..."
                    className="flex-grow min-w-[120px] px-3 py-2 text-sm md:text-base bg-white text-gray-900 outline-none rounded-lg placeholder-gray-500 border border-gray-200 focus:ring-2 focus:ring-offset-2 focus:ring-black/20 transition w-full sm:w-auto"
                    onChange={e => setNewTask(nt => ({ ...nt, text: e.target.value }))}
                    maxLength={100}
                    required
                    aria-label="Task text"
                  />
                  <div className="flex flex-col relative w-full sm:w-auto">
                    <button
                      type="button"
                      className="pick-due-date flex items-center px-3 py-2 h-10 rounded-lg bg-white border border-gray-200 text-gray-700 text-base font-medium shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 transition w-full sm:w-auto whitespace-nowrap text-center leading-tight"
                      style={{
                        minWidth: 130, // Ensures enough width for one line on desktop
                        lineHeight: 1.1, // Tighter if it wraps
                      }}
                      onClick={() => document.getElementById('dueDateInput').showPicker && document.getElementById('dueDateInput').showPicker()}
                      aria-label="Pick due date"
                    >
                      <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2" fill="none"/>
                        <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                      {newTask.dueDate
                        ? new Date(newTask.dueDate).toLocaleString()
                        : <span className="whitespace-nowrap">Pick due date</span>
                      }
                    </button>
                    <input
                      id="dueDateInput"
                      type="datetime-local"
                      className="hidden"
                      value={newTask.dueDate}
                      onChange={e => setNewTask(nt => ({ ...nt, dueDate: e.target.value }))}
                    />
                    {dueDatePrompt && (
                      <div className="absolute left-0 top-full mt-1 bg-white border border-yellow-400 rounded shadow px-3 py-2 flex items-center text-yellow-700 text-sm z-50">
                        <svg className="w-5 h-5 mr-2 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Please fill out this field.
                      </div>
                    )}
                  </div>
                  {newTask.subtasks && (
                    <input
                      type="text"
                      className="px-2 py-2 rounded-lg text-xs text-gray-900 min-w-[120px] w-full sm:w-auto flex-shrink-0 border border-gray-200 bg-white focus:ring-2 focus:ring-offset-2 focus:ring-black/20"
                      placeholder="Subtasks (comma separated)"
                      value={newTask.subtasks}
                      onChange={e => setNewTask(nt => ({ ...nt, subtasks: e.target.value }))}
                      maxLength={100}
                      aria-label="Subtasks"
                    />
                  )}
                  <button
                    type="submit"
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg transition"
                    aria-label="Add task"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </form>
              )}
            </div>
          )}

          {!showArchive && (
            <div className="flex flex-col items-center gap-3 w-full px-1 sm:px-2 md:px-4 mt-4">
              {pagedTasks.length === 0 && lists.length > 0 && (
                <div className="text-white opacity-60 mt-4">No tasks yet. Add one above!</div>
              )}
              {pagedTasks.map((task, index) => (
                <TaskItem
                  key={task.id || task.created || index}
                  task={task}
                  index={index}
                  globalIdx={page * TASKS_PER_PAGE + index}
                  finishTask={() => handleFinishTask(index)}
                  archiveTask={() => handleArchiveTask(index)}
                  removeTask={() => handleRemoveTask(index)}
                  isHighlighted={highlightedTask && highlightedTask.listId === currentList && highlightedTask.idx === page * TASKS_PER_PAGE + index}
                  taskRefs={taskRefs}
                  setSelectedTask={setSelectedTask}
                  isDone={task.done}
                />
              ))}
              {totalPages > 1 && (
                <div className="flex gap-2 mt-2">
                  <button
                    className="px-3 py-1 rounded bg-gray-200 text-gray-700"
                    disabled={page === 0}
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                  >
                    Prev
                  </button>
                  <span className="text-white">{page + 1} / {totalPages}</span>
                  <button
                    className="px-3 py-1 rounded bg-gray-200 text-gray-700"
                    disabled={page === totalPages - 1}
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {showArchive && (
            <ArchiveView currentList={currentList} />
          )}

          <footer className="text-white text-center mt-10 text-sm">
            <p>Developed by VectorMedia</p>
            <p className="opacity-70">©{new Date().getFullYear()} - All rights reserved</p>
            <p className="opacity-70">V1.3</p>
          </footer>
        </>
      </div>
    </ErrorBoundary>
  );
};

export default App;