import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useSpring } from "framer-motion";
import "./index.css";
import Preloader from "./Preloader";
import TaskItem from "./features/TaskItem";
import ArchiveView from "./features/ArchiveView";
import useStore from "./features/store";
import { ErrorBoundary } from "react-error-boundary";
import { Bell, Plus, Trash2, FolderPlus, FolderOpen, X, Info } from "lucide-react";
import { exportTasksToPDF } from "./features/exportUtils";

const COLORS = ["#d62338", "#357C74", "#4D4D4D", "#1C1C1C", "#2563eb"];
const MAX_LIST_NAME = 25;
const UNDO_TIMEOUT = 6000;
const LOCAL_STORAGE_LIMIT = 5 * 1024 * 1024;
const TASKS_PER_PAGE = 100;

function isTaskExpired(task) {
  if (!task.dueDate) return false;
  return !task.done && new Date(task.dueDate).getTime() < Date.now();
}

function formatDuration(ms) {
  const min = Math.round(ms / 60000);
  if (min >= 120) return `${Math.round(min / 60)} hours`;
  if (min >= 60) return `${Math.round(min / 60)} hour`;
  if (min > 1) return `${min} minutes`;
  return "a moment";
}

function setFaviconBadge(count, targetIcon) {
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
    if (count > 0 && targetIcon === "bell") {
      ctx.beginPath();
      ctx.arc(size - 8, 8, 8, 0, 2 * Math.PI);
      ctx.fillStyle = "#e11d48";
      ctx.fill();
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(count > 99 ? "99+" : count.toString(), size - 8, 8);
    }
    favicon.href = canvas.toDataURL("image/png");
  };
  if (count === 0 || targetIcon !== "bell") {
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
    "`": "",
  })[c]);
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
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="text-white text-center p-4">
      <h2 className="text-xl font-bold">Something Went Wrong</h2>
      <p>{error.message}</p>
      <motion.button
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
        whileHover={{ scale: 1.1 }}
        transition={{ duration: 0.3 }}
        onClick={resetErrorBoundary}
      >
        Try Again
      </motion.button>
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
    setData,
    clearArchive,
  } = useStore();

  const [bgColor, setBgColor] = useState(localStorage.getItem("bgColor") || COLORS[3]);
  const [loading, setLoading] = useState(true);
  const [currentList, setCurrentList] = useState("");
  const [badgeAnim, setBadgeAnim] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [newTask, setNewTask] = useState({ text: "", dueDate: "", subtasks: "" });
  const [dueDatePrompt, setDueDatePrompt] = useState(false);
  const [undoTaskQueue, setUndoTaskQueue] = useState([]);
  const [undoListQueue, setUndoListQueue] = useState([]);
  const [showNotifCenter, setShowNotifCenter] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [highlightedTask, setHighlightedTask] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const taskRefs = useRef({});
  const [page, setPage] = useState(0);
  const [lastSeenNotifCount, setLastSeenNotifCount] = useState(() =>
    parseInt(localStorage.getItem("lastSeenNotifCount") || "0")
  );
  const [unseenCount, setUnseenCount] = useState(0);

  const springProgress = useSpring(
    (tasks[currentList]?.length || 0) > 0
      ? (tasks[currentList]?.filter((t) => t.done).length || 0) / (tasks[currentList]?.length || 1)
      : 0,
    { stiffness: 100, damping: 20 }
  );

  useEffect(() => {
    const savedNotifications = localStorage.getItem("notifications");
    if (savedNotifications) {
      setData({ notifications: JSON.parse(savedNotifications) });
    }
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    console.log("Notifications:", notifications);
    console.log("Last Seen Notif Count:", lastSeenNotifCount);
    const newUnseenCount = notifications.length > lastSeenNotifCount ? notifications.length - lastSeenNotifCount : 0;
    console.log("Calculated Unseen Count:", newUnseenCount);
    setUnseenCount(newUnseenCount);
    setFaviconBadge(newUnseenCount, "bell");
    if (newUnseenCount > 0) {
      setBadgeAnim(true);
      setTimeout(() => setBadgeAnim(false), 700);
    }
  }, [notifications, lastSeenNotifCount]);

  useEffect(() => {
    localStorage.setItem("notifications", JSON.stringify(notifications));
    if (!currentList && lists.length > 0) {
      setCurrentList(lists[0].id);
    } else if (lists.length === 0) {
      setCurrentList(null);
    }
  }, [notifications, lists, currentList]);

  useEffect(() => {
    if (showNotifCenter) {
      const handleKey = (e) => {
        if (e.key === "Escape") setShowNotifCenter(false);
      };
      window.addEventListener("keydown", handleKey);
      setLastSeenNotifCount(notifications.length);
      localStorage.setItem("lastSeenNotifCount", notifications.length);
      setUnseenCount(0);
      setFaviconBadge(0, "bell");
      return () => window.removeEventListener("keydown", handleKey);
    }
  }, [showNotifCenter, notifications.length]);

  useEffect(() => {
    if (selectedTask) {
      const handleKey = (e) => {
        if (e.key === "Escape") setSelectedTask(null);
      };
      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    }
  }, [selectedTask]);

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

  useEffect(() => {
    try {
      localStorage.setItem("bgColor", bgColor);
      if (getStorageSize() > LOCAL_STORAGE_LIMIT * 0.9) {
        addNotification({
          id: Date.now() + Math.random(),
          type: "warning",
          message: "Storage almost full. Archive or export data soon.",
          time: new Date().toISOString(),
        });
      }
    } catch (e) {
      addNotification({
        id: Date.now() + Math.random(),
        type: "error",
        message: "Storage quota exceeded! Delete some tasks/lists.",
        time: new Date().toISOString(),
      });
    }
  }, [bgColor]);

  useEffect(() => {
    if (!loading) {
      let timeoutId = null;
      const checkTasks = () => {
        const reminderSent = JSON.parse(localStorage.getItem("reminderSent") || "{}");
        let nextCheck = 60000;
        Object.keys(tasks).forEach((listId) => {
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
                  list: listId,
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
                    list: listId,
                  });
                  showBrowserNotification(
                    "Task Reminder",
                    `Task "${task.text}" is due in ${formatDuration(timeLeft)}!`
                  );
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

  function showBrowserNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body, icon: "/favicon.ico" });
      } catch {
        addNotification({
          id: Date.now() + Math.random(),
          type: "fallback",
          message: `${title}: ${body}`,
          time: new Date().toISOString(),
        });
      }
    } else {
      addNotification({
        id: Date.now() + Math.random(),
        type: "fallback",
        message: `${title}: ${body}`,
        time: new Date().toISOString(),
      });
    }
  }

  function pushNotification({ type, message, task, list }) {
    console.log("Pushing notification:", { type, message, task, list }); // Debug log
    addNotification({
      id: Date.now() + Math.random(),
      type,
      message,
      taskText: task?.text,
      dueDate: task?.dueDate,
      listId: list,
      time: new Date().toISOString(),
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
    if ((tasks[currentList] || []).some((t) => t.text === sanitizedText && t.dueDate === newTask.dueDate)) {
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
      created: Date.now(),
    };
    addTask(currentList, task);
    setNewTask({ text: "", dueDate: "", subtasks: "" });

    setTimeout(() => {
      setHighlightedTask({ listId: currentList, idx: 0 });
      setPage(0);
      setTimeout(() => setHighlightedTask(null), 2000);
    }, 100);
  }, [newTask, tasks, currentList, addTask]);

  const handleFinishTask = useCallback(
    (idx) => {
      const globalIdx = page * TASKS_PER_PAGE + idx;
      const originalTask = (tasks[currentList] || [])[globalIdx];
      const updatedTask = {
        ...originalTask,
        done: true,
        completedAt: new Date().toISOString(),
      };
      toggleDone(currentList, globalIdx, updatedTask);
      if (updatedTask.done) {
        pushNotification({
          type: "completed",
          message: `Task "${updatedTask.text}" completed!`,
          task: updatedTask,
          list: currentList,
        });
        showBrowserNotification("Task Completed", `Task "${updatedTask.text}" completed!`);
      }
    },
    [currentList, page, tasks, toggleDone, pushNotification]
  );

  const handleArchiveTask = useCallback(
    (idx) => {
      const globalIdx = page * TASKS_PER_PAGE + idx;
      const taskToArchive = { ...((tasks[currentList] || [])[globalIdx]), archived: true };
      archiveTask(currentList, globalIdx);
      setUndoTaskQueue((prevQueue) => [
        ...prevQueue.filter((u) => u.taskId !== taskToArchive.id),
        {
          task: taskToArchive,
          taskId: taskToArchive.id,
          listId: currentList,
          idx: globalIdx,
          isArchive: true,
          timer: setTimeout(() => {
            setUndoTaskQueue((q) => q.filter((u) => u.taskId !== taskToArchive.id));
          }, UNDO_TIMEOUT),
        },
      ]);
    },
    [currentList, page, tasks, archiveTask]
  );

  const handleRemoveTask = useCallback(
    (idx) => {
      const globalIdx = page * TASKS_PER_PAGE + idx;
      const taskToRemove = (tasks[currentList] || [])[globalIdx];
      removeTask(currentList, globalIdx, false);
      setUndoTaskQueue((prevQueue) => [
        ...prevQueue.filter((u) => u.taskId !== taskToRemove.id),
        {
          task: taskToRemove,
          taskId: taskToRemove.id,
          listId: currentList,
          idx: globalIdx,
          isArchive: false,
          timer: setTimeout(() => {
            setUndoTaskQueue((q) => q.filter((u) => u.taskId !== taskToRemove.id));
          }, UNDO_TIMEOUT),
        },
      ]);
    },
    [currentList, page, tasks, removeTask]
  );

  const handleUndoArchiveTask = useCallback(
    (taskId) => {
      const undoInfo = undoTaskQueue.find((u) => u.taskId === taskId);
      if (undoInfo && undoInfo.task) {
        clearTimeout(undoInfo.timer);
        undoArchiveTask(undoInfo.listId, undoInfo.taskId);
        setUndoTaskQueue((prevQueue) => prevQueue.filter((u) => u.taskId !== taskId));
      }
    },
    [undoTaskQueue, undoArchiveTask]
  );

  const handleUndoRemoveTask = useCallback(
    (taskId) => {
      const undoInfo = undoTaskQueue.find((u) => u.taskId === taskId);
      if (undoInfo) {
        clearTimeout(undoInfo.timer);
        addTask(undoInfo.listId, undoInfo.task);
        setUndoTaskQueue((prevQueue) => prevQueue.filter((u) => u.taskId !== taskId));
      }
    },
    [undoTaskQueue, addTask]
  );

  const handleAddList = useCallback(() => {
    let name = prompt(`List name? (max ${MAX_LIST_NAME} characters)`);
    if (!name) return;
    name = sanitizeInput(name.trim());
    if (name.length > MAX_LIST_NAME) {
      alert(`List name too long! Max ${MAX_LIST_NAME} characters.`);
      return;
    }
    if (lists.some((l) => l.name === name)) {
      alert("A list with this name already exists.");
      return;
    }
    const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
    addList(id, name);
    setCurrentList(id);
  }, [lists, addList]);

  const handleRemoveList = useCallback(
    (id) => {
      if (!window.confirm("Are you sure?")) return;
      const deletedList = lists.find((l) => l.id === id);
      const deletedTasks = tasks[id] || [];
      const deletedArchive = archive[id] || [];
      removeList(id);
      setUndoListQueue((prevQueue) => [
        ...prevQueue.filter((u) => u.list.id !== id),
        {
          list: deletedList,
          tasks: deletedTasks,
          archive: deletedArchive,
          prevCurrentList: currentList,
          timer: setTimeout(() => {
            setUndoListQueue((q) => q.filter((u) => u.list.id !== id));
          }, UNDO_TIMEOUT),
        },
      ]);
      setCurrentList(lists.length > 0 ? lists[0].id : null);
    },
    [lists, tasks, archive, currentList, removeList]
  );

  const handleUndoDeleteList = useCallback(
    (listId) => {
      const undoInfo = undoListQueue.find((u) => u.list.id === listId);
      if (!undoInfo) return;
      clearTimeout(undoInfo.timer);
      undoDeleteList(undoInfo.list, undoInfo.tasks, undoInfo.archive);
      setCurrentList(undoInfo.list.id);
      setUndoListQueue((q) => q.filter((u) => u.list.id !== listId));
    },
    [undoListQueue, undoDeleteList]
  );

  const handleDeleteAllArchived = useCallback(() => {
    if (window.confirm("Are you sure you want to delete all archived tasks? This action cannot be undone.")) {
      clearArchive(currentList);
    }
  }, [currentList, clearArchive]);

  if (loading) return <Preloader />;

  const filteredTasks = (tasks[currentList] || []).filter((t) => !t.archived);
  const totalPages = Math.ceil(filteredTasks.length / TASKS_PER_PAGE);
  const pagedTasks = filteredTasks.slice(page * TASKS_PER_PAGE, (page + 1) * TASKS_PER_PAGE);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
      <div className="min-h-screen transition-colors duration-300 relative px-1 sm:px-2 md:px-4" style={{ backgroundColor: bgColor }}>
        <>
          <div className="flex justify-center pt-8">
            {COLORS.map((color) => (
              <div key={color} className="relative mx-1">
                <motion.button
                  className="w-6 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => setBgColor(color)}
                  aria-label={`Set background color to ${color}`}
                />
                {bgColor === color && <div className="absolute top-3 left-1/2 transform -translate-x-1/2 text-white">▾</div>}
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-4 gap-2 flex-wrap">
            {lists.map((list) => (
              <motion.button
                key={list.id}
                className="px-3 py-1 rounded-full font-semibold text-sm sm:text-base relative flex items-center"
                title={list.name}
                style={{
                  background: currentList === list.id ? "rgb(255, 255, 255)" : "rgba(0,0,0,0.3)",
                  color: currentList === list.id ? "rgb(0, 0, 0)" : "#fff",
                  border: "none",
                  transform: "none",
                  boxShadow: currentList === list.id ? "rgba(0, 0, 0, 0.08) 0px 1px 4px" : undefined,
                  position: "relative",
                  overflow: "visible",
                }}
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.3 }}
                onClick={() => {
                  setCurrentList(list.id);
                  setPage(0);
                }}
                aria-label={`Switch to list ${list.name}`}
              >
                <span className="flex-grow">{list.name}</span>
                <span style={{ position: "relative", zIndex: 1 }}>
                  <div
                    role="button"
                    className="ml-2 w-4 h-4 text-red-400 hover:text-red-600 cursor-pointer flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveList(list.id);
                    }}
                    aria-label={`Delete list ${list.name}`}
                    tabIndex={0}
                    style={{ background: "none", border: "none", padding: 0 }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </div>
                </span>
                <motion.div
                  className="absolute inset-0"
                  style={{
                    borderRadius: "inherit",
                    border: "2px solid transparent",
                    background: "linear-gradient(45deg, #00cc99, #ff66cc) border-box",
                    backgroundSize: "200% 200%",
                    WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "destination-out",
                    maskComposite: "exclude",
                    animation: "borderAnimation 6s linear infinite",
                  }}
                />
              </motion.button>
            ))}
            <motion.button
              className="px-6 py-2 rounded-full bg-green-500 text-white flex items-center gap-2 text-sm sm:text-base relative"
              style={{ borderRadius: "9999px", position: "relative" }}
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.3 }}
              onClick={handleAddList}
              aria-label="Add new list"
            >
              <FolderPlus className="w-5 h-5" /> Add List
              <motion.div
                className="absolute inset-0"
                style={{
                  borderRadius: "inherit",
                  border: "2px solid transparent",
                  background: "linear-gradient(45deg, #00cc99, #ff66cc) border-box",
                  backgroundSize: "200% 200%",
                  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "destination-out",
                  maskComposite: "exclude",
                  animation: "borderAnimation 6s linear infinite",
                }}
              />
            </motion.button>
            <motion.button
              className={`px-6 py-2 rounded-full flex items-center gap-2 text-sm sm:text-base relative ${
                showArchive ? "bg-[#fbbf24] text-black" : "bg-black/30 text-white"
              }`}
              style={{ borderRadius: "9999px", position: "relative" }}
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.3 }}
              onClick={() => setShowArchive((a) => !a)}
              aria-label={showArchive ? "Hide Archive" : "Show Archive"}
            >
              <FolderOpen className="w-5 h-5" /> {showArchive ? "Hide" : "Show"} Archive
              <motion.div
                className="absolute inset-0"
                style={{
                  borderRadius: "inherit",
                  border: "2px solid transparent",
                  background: "linear-gradient(45deg, #00cc99, #ff66cc) border-box",
                  backgroundSize: "200% 200%",
                  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "destination-out",
                  maskComposite: "exclude",
                  animation: "borderAnimation 6s linear infinite",
                }}
              />
            </motion.button>
            <motion.button
              className="px-2 py-1 rounded-full bg-blue-500 text-white flex items-center gap-1 text-sm sm:text-base"
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.3 }}
              onClick={() => exportTasksToPDF(lists, tasks, archive)}
              aria-label="Export tasks to PDF"
            >
              Export to PDF
            </motion.button>
          </div>

          {undoTaskQueue.map((undoInfo, idx) => (
            undoInfo.task && (
              <div
                key={`${undoInfo.taskId}-${Date.now()}-${idx}`}
                className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 z-50 animate-fade-in"
                role="alert"
                style={{ bottom: `${4 + idx * 60}px` }}
                onClick={(e) => e.stopPropagation()}
              >
                <span>
                  Task "{undoInfo.task.text}" {undoInfo.isArchive ? "archived" : "removed"}.
                </span>
                <motion.button
                  className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded-full font-semibold"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (undoInfo.isArchive) {
                      handleUndoArchiveTask(undoInfo.taskId);
                    } else {
                      handleUndoRemoveTask(undoInfo.taskId);
                    }
                  }}
                  aria-label={undoInfo.isArchive ? "Undo archive task" : "Undo remove task"}
                >
                  Undo
                </motion.button>
              </div>
            )
          ))}

          {undoListQueue.map((undoInfo, idx) => (
            <div
              key={`${undoInfo.list.id}-${Date.now()}-${idx}`}
              className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 z-50 animate-fade-in"
              role="alert"
              style={{ bottom: `${4 + idx * 60}px` }}
            >
              <span>List <b>{undoInfo.list.name}</b> deleted.</span>
              <motion.button
                className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded-full font-semibold"
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.3 }}
                onClick={() => handleUndoDeleteList(undoInfo.list.id)}
                aria-label="Undo delete list"
              >
                Undo
              </motion.button>
            </div>
          ))}

          <div className="flex justify-center items-center mt-5 relative">
            <h1 className="text-4xl text-white font-bold mr-4">TO DO LIST</h1>
            <div className="relative flex items-center gap-4">
              <motion.button
                className="focus:outline-none relative"
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.3 }}
                onClick={() => {
                  setShowNotifCenter(true);
                  setLastSeenNotifCount(notifications.length);
                  localStorage.setItem("lastSeenNotifCount", notifications.length);
                  setUnseenCount(0);
                  setFaviconBadge(0, "bell");
                }}
                aria-label="Show notifications"
              >
                <Bell
                  className={`w-8 h-8 text-yellow-400 ${badgeAnim ? "animate-bell-ring" : ""}`}
                />
                {!showNotifCenter && unseenCount > 0 && (
                  <span
                    className={`absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center z-10 ${
                      badgeAnim ? "animate-ping-short" : ""
                    }`}
                    aria-label={`${unseenCount} new notifications`}
                  >
                    {unseenCount}
                  </span>
                )}
              </motion.button>
              <motion.button
                className="focus:outline-none"
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.3 }}
                onClick={() => setShowInfoModal(true)}
                aria-label="Show app info"
              >
                <Info className="w-8 h-8 text-blue-400" />
              </motion.button>
            </div>
          </div>

          {showNotifCenter && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-xs sm:max-w-md mx-2 p-2 sm:p-4 relative overflow-auto">
                <motion.button
                  className="absolute top-2 right-2 text-gray-500 hover:text-black"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => setShowNotifCenter(false)}
                  aria-label="Close notifications"
                  style={{ zIndex: 10 }}
                >
                  <X className="w-6 h-6" />
                </motion.button>
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
                            (t) => t.text === notif.taskText && t.dueDate === notif.dueDate
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
                        lists.find((l) => l.id === notif.listId)
                          ? `Go to list: ${lists.find((l) => l.id === notif.listId).name}`
                          : "Go to list"
                      }
                      tabIndex={0}
                      aria-label={`Notification: ${notif.message}`}
                    >
                      <div className="flex items-center gap-2">
                        {notif.type === "reminder" && (
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-400" title="Reminder" />
                        )}
                        {notif.type === "expired" && (
                          <span className="inline-block w-2 h-2 rounded-full bg-red-500" title="Expired" />
                        )}
                        {notif.type === "completed" && (
                          <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Completed" />
                        )}
                        <span className="text-sm">
                          {notif.message}
                          {lists.find((l) => l.id === notif.listId) && (
                            <span className="ml-2 text-xs text-gray-500">
                              [List: {lists.find((l) => l.id === notif.listId).name}]
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
                <motion.button
                  className="mt-6 w-full bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full py-2 font-semibold"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => clearNotifications()}
                  aria-label="Clear all notifications"
                >
                  Clear All Notifications
                </motion.button>
              </div>
            </div>
          )}

          {selectedTask && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-xs sm:max-w-md mx-2 p-4 relative overflow-hidden">
                <motion.button
                  className="absolute top-2 right-2 text-gray-500 hover:text-black"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => setSelectedTask(null)}
                  aria-label="Close task details"
                  style={{ zIndex: 10 }}
                >
                  <X className="w-6 h-6" />
                </motion.button>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                  Task Details
                </h2>
                <div className="mb-2">
                  <span className="font-semibold">Text:</span>
                  <div className="break-words">{selectedTask.text}</div>
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
                  {selectedTask.done ? (
                    <>
                      Completed
                      {selectedTask.completedAt && !isNaN(Date.parse(selectedTask.completedAt)) && (
                        <> {new Date(selectedTask.completedAt).toLocaleString()}</>
                      )}
                    </>
                  ) : isTaskExpired(selectedTask) ? (
                    "Expired"
                  ) : selectedTask.archived ? (
                    "Archived"
                  ) : (
                    "Active"
                  )}
                </div>
                {!selectedTask.archived && !selectedTask.done && (
                  <div className="mt-4">
                    <motion.button
                      className="w-full bg-green-500 hover:bg-green-600 text-white rounded py-2"
                      whileHover={{ scale: 1.1 }}
                      transition={{ duration: 0.3 }}
                      onClick={() => {
                        handleFinishTask(pagedTasks.findIndex((t) => t.id === selectedTask.id));
                        setSelectedTask(null);
                      }}
                      aria-label="Finish task"
                    >
                      Finish Task
                    </motion.button>
                  </div>
                )}
              </div>
            </div>
          )}

          {showInfoModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-xs sm:max-w-md mx-2 p-4 relative overflow-hidden">
                <motion.button
                  className="absolute top-2 right-2 text-gray-500 hover:text-black"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => setShowInfoModal(false)}
                  aria-label="Close info modal"
                  style={{ zIndex: 10 }}
                >
                  <X className="w-6 h-6" />
                </motion.button>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-400" /> How to Use This App
                </h2>
                <ul className="list-disc pl-5 space-y-2 text-gray-700">
                  <li>Add a new list by clicking "Add List" to organize your tasks.</li>
                  <li>Create tasks with text and due dates using the form below the lists.</li>
                  <li>Finish or archive tasks by clicking the options on each task card.</li>
                  <li>Check notifications (bell icon) for reminders and task updates.</li>
                  <li>Switch lists or view the archive using the buttons above.</li>
                  <li>Export tasks to PDF using the export to PDF button.</li>
                  <li>Clear all tasks or lists using the trash icon.</li>
                  <li>Use the search bar to filter tasks by name or due date.</li>
                  <li>Use the keyboard shortcuts to navigate and interact with the app.</li>
                  <li>Have fun!</li>
                </ul>
                <div className="mt-4">
                  <motion.button
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded py-2"
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => setShowInfoModal(false)}
                    aria-label="Close info modal"
                  >
                    Got It
                  </motion.button>
                </div>
              </div>
            </div>
          )}

          {!showArchive && (
            <div className="flex flex-col items-center gap-2 w-full mt-5">
              {lists.length === 0 ? (
                <motion.button
                  className="w-full max-w-lg rounded-2xl px-4 py-4 text-center font-semibold shadow-md text-base bg-green-500 text-white"
                  style={{
                    backdropFilter: "blur(6px)",
                    border: "1.5px solid #fff5",
                    textShadow: "0 1px 4px #000a",
                  }}
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                  onClick={handleAddList}
                  aria-label="Add a new list to start adding tasks"
                >
                  Add a new list first to start adding tasks.
                </motion.button>
              ) : (
                <form
                  className="w-full max-w-lg rounded-2xl px-3 py-2 flex flex-col sm:flex-row items-center justify-center gap-2 shadow-lg bg-white/70 backdrop-blur-md border border-gray-200"
                  style={{ minHeight: 56 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddTask();
                  }}
                >
                  <input
                    type="text"
                    value={newTask.text}
                    placeholder="Enter your task here..."
                    className="flex-grow min-w-[120px] px-3 py-2 text-sm md:text-base bg-white text-gray-900 outline-none rounded-lg placeholder-gray-500 border border-gray-200 focus:ring-2 focus:ring-offset-2 focus:ring-black/20 transition w-full sm:w-auto"
                    onChange={(e) => setNewTask((nt) => ({ ...nt, text: e.target.value }))}
                    maxLength={100}
                    required
                    aria-label="Task text"
                  />
                  <div className="flex flex-col relative w-full sm:w-auto">
                    <motion.button
                      type="button"
                      className="pick-due-date flex items-center px-3 py-2 h-10 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 transition w-full sm:w-auto whitespace-nowrap text-center leading-tight"
                      style={{ minWidth: 130, lineHeight: 1.1 }}
                      whileHover={{ scale: 1.1 }}
                      transition={{ duration: 0.3 }}
                      onClick={() =>
                        document.getElementById("dueDateInput").showPicker &&
                        document.getElementById("dueDateInput").showPicker()
                      }
                      aria-label="Pick due date"
                    >
                      <svg
                        className="w-4 h-4 mr-2 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <rect
                          x="3"
                          y="4"
                          width="18"
                          height="18"
                          rx="4"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                        />
                        <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      {newTask.dueDate ? new Date(newTask.dueDate).toLocaleString() : <span className="whitespace-nowrap">Pick due date</span>}
                    </motion.button>
                    <input
                      id="dueDateInput"
                      type="datetime-local"
                      className="hidden"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask((nt) => ({ ...nt, dueDate: e.target.value }))}
                    />
                    {dueDatePrompt && (
                      <div className="absolute left-0 top-full mt-1 bg-white border border-yellow-400 rounded shadow px-3 py-2 flex items-center text-yellow-700 text-sm z-50">
                        <svg
                          className="w-5 h-5 mr-2 text-yellow-500"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
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
                      onChange={(e) => setNewTask((nt) => ({ ...nt, subtasks: e.target.value }))}
                      maxLength={100}
                      aria-label="Subtasks"
                    />
                  )}
                  <motion.button
                    type="submit"
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg"
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                    aria-label="Add task"
                  >
                    <Plus className="w-5 h-5" />
                  </motion.button>
                </form>
              )}
              <motion.div
                className="w-full max-w-lg h-2 bg-gray-300 rounded-full mt-4"
                initial={{ scaleX: 0 }}
                style={{ scaleX: springProgress, transformOrigin: "left", backgroundColor: "#4CAF50" }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
              />
            </div>
          )}

          {!showArchive && (
            <div className="flex flex-col items-center gap-3 w-full px-1 sm:px-2 md:px-4 mt-4">
              {pagedTasks.length === 0 && lists.length > 0 && (
                <div className="text-white opacity-60 mt-4">No tasks yet. Add one above!</div>
              )}
              {pagedTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  index={pagedTasks.indexOf(task)}
                  globalIdx={page * TASKS_PER_PAGE + pagedTasks.indexOf(task)}
                  finishTask={() => handleFinishTask(pagedTasks.indexOf(task))}
                  archiveTask={() => handleArchiveTask(pagedTasks.indexOf(task))}
                  removeTask={() => handleRemoveTask(pagedTasks.indexOf(task))}
                  isHighlighted={
                    highlightedTask &&
                    highlightedTask.listId === currentList &&
                    highlightedTask.idx === page * TASKS_PER_PAGE + pagedTasks.indexOf(task)
                  }
                  taskRefs={taskRefs}
                  setSelectedTask={setSelectedTask}
                  isDone={task.done}
                />
              ))}
              {totalPages > 1 && (
                <div className="flex gap-2 mt-2">
                  <motion.button
                    className="px-3 py-1 rounded bg-gray-200 text-gray-700"
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Prev
                  </motion.button>
                  <span className="text-white">{page + 1} / {totalPages}</span>
                  <motion.button
                    className="px-3 py-1 rounded bg-gray-200 text-gray-700"
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                    disabled={page === totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    Next
                  </motion.button>
                </div>
              )}
            </div>
          )}

          {showArchive && (
            <ArchiveView
              currentList={currentList}
              setShowArchive={setShowArchive}
              setSelectedTask={setSelectedTask}
              taskRefs={taskRefs}
              onDeleteAllArchived={handleDeleteAllArchived}
            />
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