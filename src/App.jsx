import { useState, useEffect, useRef } from "react";
import "./index.css";
import Preloader from "./Preloader";
import { Bell, Plus, Trash2, FolderPlus, FolderOpen, X } from "lucide-react";

const COLORS = [
  "#d62338", "#357C74", "#4D4D4D", "#1C1C1C", "#fbbf24", "#2563eb"
];

const DEFAULT_LISTS = [
  { id: "personal", name: "Personal" },
  { id: "work", name: "Work" },
  { id: "groceries", name: "Groceries" }
];

const TASK_TYPES = [
  { value: "quick", label: "Quick" },
  { value: "daily", label: "Daily" },
  { value: "longterm", label: "Long-term" }
];

const MAX_LIST_NAME = 25;

function isTaskExpired(task) {
  if (!task.dueDate) return false;
  return !task.done && !task.archived && new Date(task.dueDate).getTime() < Date.now();
}

function getInitialData() {
  const lists = JSON.parse(localStorage.getItem("lists")) || DEFAULT_LISTS;
  const tasks = JSON.parse(localStorage.getItem("tasks")) || {};
  const archive = JSON.parse(localStorage.getItem("archive")) || {};
  const notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  return { lists, tasks, archive, notifications };
}

const UNDO_TIMEOUT = 6000;

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

const App = () => {
  const [bgColor, setBgColor] = useState(
    localStorage.getItem("bgColor") || COLORS[3]
  );
  const [loading, setLoading] = useState(true);

  const [{ lists, tasks, archive, notifications }, setData] = useState(getInitialData());
  const [currentList, setCurrentList] = useState(
    localStorage.getItem("currentList") || (lists[0]?.id || "")
  );
  const [badgeAnim, setBadgeAnim] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const [newTask, setNewTask] = useState({
    text: "",
    type: "quick",
    dueDate: "",
    subtasks: ""
  });

  const [dueDatePrompt, setDueDatePrompt] = useState(false);

  const [undoInfo, setUndoInfo] = useState(null);
  const undoTimer = useRef(null);

  const [showNotifCenter, setShowNotifCenter] = useState(false);
  const [notifViewed, setNotifViewed] = useState(false);

  const [lastNotifView, setLastNotifView] = useState(() => {
    return JSON.parse(localStorage.getItem("lastNotifView") || "{}");
  });

  const [highlightedTask, setHighlightedTask] = useState(null);
  const taskRefs = useRef({});

  useEffect(() => {
    localStorage.setItem("lastNotifView", JSON.stringify(lastNotifView));
  }, [lastNotifView]);

  const shownExpiredNotifications = useRef(new Set(
    JSON.parse(localStorage.getItem("shownExpiredNotifications") || "[]")
  ));

  useEffect(() => {
    localStorage.setItem(
      "shownExpiredNotifications",
      JSON.stringify(Array.from(shownExpiredNotifications.current))
    );
  }, [tasks]);

  const completedCount = (tasks[currentList] || []).filter(t => t.done && !t.archived).length;

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem("bgColor", bgColor);
  }, [bgColor]);
  useEffect(() => {
    localStorage.setItem("lists", JSON.stringify(lists));
    localStorage.setItem("tasks", JSON.stringify(tasks));
    localStorage.setItem("archive", JSON.stringify(archive));
    localStorage.setItem("currentList", currentList);
    localStorage.setItem("notifications", JSON.stringify(notifications));
  }, [lists, tasks, archive, currentList, notifications]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    let timers = [];
    Object.keys(tasks).forEach(listId => {
      (tasks[listId] || []).forEach((task, idx) => {
        if (task.dueDate && !task.done && !task.archived) {
          const due = new Date(task.dueDate).getTime();
          const now = Date.now();
          const timeLeft = due - now;
          if (timeLeft > 2 * 60 * 1000) {
            const halfTime = Math.floor(timeLeft / 2);
            timers.push(setTimeout(() => {
              pushNotification({
                type: "reminder",
                message: `Task "${task.text}" is due in ${formatDuration(halfTime)}!`,
                task,
                list: listId
              });
              showBrowserNotification("Task Reminder", `Task "${task.text}" is due in ${formatDuration(halfTime)}!`);
            }, halfTime));
          }
          const uniqueKey = `${listId}:${task.text}:${task.dueDate}`;
          if (timeLeft > 0) {
            timers.push(setTimeout(() => {
              if (!shownExpiredNotifications.current.has(uniqueKey)) {
                shownExpiredNotifications.current.add(uniqueKey);
                pushNotification({
                  type: "expired",
                  message: `Task "${task.text}" has expired!`,
                  task,
                  list: listId
                });
                showBrowserNotification("Task Expired", `Task "${task.text}" has expired!`);
                localStorage.setItem(
                  "shownExpiredNotifications",
                  JSON.stringify(Array.from(shownExpiredNotifications.current))
                );
              }
            }, timeLeft));
          }
        }
      });
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line
  }, [tasks]);

  useEffect(() => {
    if (completedCount > 0) {
      setBadgeAnim(true);
      const timeout = setTimeout(() => setBadgeAnim(false), 700);
      return () => clearTimeout(timeout);
    }
  }, [completedCount]);

  function showBrowserNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  }

  function pushNotification({ type, message, task, list }) {
    setData(prev => ({
      ...prev,
      notifications: [
        {
          id: Date.now() + Math.random(),
          type,
          message,
          taskText: task?.text,
          dueDate: task?.dueDate,
          listId: list,
          time: new Date().toISOString()
        },
        ...prev.notifications
      ]
    }));
    setBadgeAnim(true);
    setTimeout(() => setBadgeAnim(false), 700);
  }

  // --- Task CRUD ---
  const addTask = () => {
    if (!newTask.text.trim()) return;
    if (!newTask.dueDate) {
      setDueDatePrompt(true);
      setTimeout(() => setDueDatePrompt(false), 2000);
      return;
    }
    const task = {
      text: newTask.text,
      type: newTask.type,
      dueDate: newTask.dueDate,
      subtasks: newTask.type === "longterm" ? newTask.subtasks : "",
      done: false,
      archived: false,
      created: Date.now()
    };
    setData(prev => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [currentList]: [task, ...(prev.tasks[currentList] || [])]
      }
    }));
    setNewTask({ text: "", type: "quick", dueDate: "", subtasks: "" });

    // Highlight the new task at index 0
    setTimeout(() => {
      setHighlightedTask({ listId: currentList, idx: 0 });
      setTimeout(() => setHighlightedTask(null), 2000);
    }, 100);
  };

  const removeTask = idx => {
    setData(prev => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [currentList]: prev.tasks[currentList].filter((_, i) => i !== idx)
      }
    }));
  };

  const toggleDone = idx => {
    setData(prev => {
      const updated = [...prev.tasks[currentList]];
      if (!updated[idx].done && !isTaskExpired(updated[idx])) {
        updated[idx].done = true;
        pushNotification({
          type: "completed",
          message: `Task "${updated[idx].text}" marked as completed!`,
          task: updated[idx],
          list: currentList
        });
        showBrowserNotification("Task Completed", `Task "${updated[idx].text}" marked as completed!`);
      }
      return {
        ...prev,
        tasks: { ...prev.tasks, [currentList]: updated }
      };
    });
  };

  const archiveTask = idx => {
    setData(prev => {
      const updated = [...prev.tasks[currentList]];
      const [archivedTask] = updated.splice(idx, 1);
      archivedTask.archived = true;
      return {
        ...prev,
        tasks: { ...prev.tasks, [currentList]: updated },
        archive: {
          ...prev.archive,
          [currentList]: [...(prev.archive[currentList] || []), archivedTask]
        }
      };
    });
  };

  const clearArchive = () => {
    if (
      window.confirm(
        "Are you sure you want to permanently delete all archived tasks in this list? This cannot be undone."
      )
    ) {
      setData(prev => ({
        ...prev,
        archive: { ...prev.archive, [currentList]: [] }
      }));
    }
  };

  const addList = () => {
    let name = prompt(`List name? (max ${MAX_LIST_NAME} characters)`);
    if (!name) return;
    name = name.trim();
    if (name.length > MAX_LIST_NAME) {
      alert(`List name too long! Max ${MAX_LIST_NAME} characters.`);
      return;
    }
    const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
    setData(prev => ({
      ...prev,
      lists: [...prev.lists, { id, name }],
      tasks: { ...prev.tasks, [id]: [] },
      archive: { ...prev.archive, [id]: [] }
    }));
    setCurrentList(id);
  };

  const removeList = id => {
    if (!window.confirm("Delete this list and all its tasks?")) return;
    const deletedList = lists.find(l => l.id === id);
    const deletedTasks = tasks[id] || [];
    const deletedArchive = archive[id] || [];
    setUndoInfo({
      list: deletedList,
      tasks: deletedTasks,
      archive: deletedArchive,
      prevCurrentList: currentList,
    });
    setData(prev => {
      const newLists = prev.lists.filter(l => l.id !== id);
      const newTasks = { ...prev.tasks };
      const newArchive = { ...prev.archive };
      delete newTasks[id];
      delete newArchive[id];
      return { lists: newLists, tasks: newTasks, archive: newArchive, notifications: prev.notifications };
    });
    setCurrentList(lists.find(l => l.id !== id)?.id || "");
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoInfo(null), UNDO_TIMEOUT);
  };

  const undoDeleteList = () => {
    if (!undoInfo) return;
    setData(prev => ({
      ...prev,
      lists: [...prev.lists, undoInfo.list],
      tasks: { ...prev.tasks, [undoInfo.list.id]: undoInfo.tasks },
      archive: { ...prev.archive, [undoInfo.list.id]: undoInfo.archive }
    }));
    setCurrentList(undoInfo.list.id);
    setUndoInfo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  };

  const unseenCount = notifications.filter(
    n => !lastNotifView[n.listId] || new Date(n.time).getTime() > lastNotifView[n.listId]
  ).length;

  useEffect(() => {
    setFaviconBadge(unseenCount);
  }, [unseenCount]);

  useEffect(() => {
    if (highlightedTask && highlightedTask.listId === currentList) {
      const el = taskRefs.current[highlightedTask.idx];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedTask, currentList]);

  if (loading) return <Preloader />;

  return (
    <div
      className="min-h-screen transition-colors duration-300 relative px-1"
      style={{ backgroundColor: bgColor }}
    >

      {/* Color Picker */}
      <div className="flex justify-center pt-8">
        {COLORS.map((color) => (
          <div key={color} className="relative mx-1">
            <button
              className={`w-6 h-2 rounded-full`}
              style={{ backgroundColor: color }}
              onClick={() => setBgColor(color)}
            ></button>
            {bgColor === color && (
              <div className="absolute top-3 left-1/2 transform -translate-x-1/2 text-white">
                ▾
              </div>
            )}
          </div>
        ))}
      </div>

      {/* List Tabs */}
      <div className="flex justify-center mt-4 gap-2 flex-wrap">
        {lists.map(list => (
          <button
            key={list.id}
            className="px-3 py-1 rounded-full font-semibold transition"
            title={list.name}
            style={{
              background: currentList === list.id ? "#fff" : "rgba(0,0,0,0.3)",
              color: currentList === list.id ? "#000" : "#fff",
              boxShadow: currentList === list.id ? "0 1px 4px rgba(0,0,0,0.08)" : undefined,
              border: "none"
            }}
            onClick={() => setCurrentList(list.id)}
          >
            {list.name}
            <Trash2
              className="inline ml-2 w-4 h-4 text-red-400 hover:text-red-600"
              onClick={e => {
                e.stopPropagation();
                removeList(list.id);
              }}
            />
          </button>
        ))}
        <button
          className="px-2 py-1 rounded-full bg-green-500 text-white flex items-center gap-1"
          onClick={addList}
        >
          <FolderPlus className="w-4 h-4" /> Add List
        </button>
        <button
          className={`px-2 py-1 rounded-full flex items-center gap-1 ${
            showArchive ? "bg-yellow-400 text-black" : "bg-black/30 text-white"
          }`}
          onClick={() => setShowArchive(a => !a)}
        >
          <FolderOpen className="w-4 h-4" /> {showArchive ? "Hide" : "Show"} Archive
        </button>
      </div>

      {/* Undo Snackbar */}
      {undoInfo && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 z-50 animate-fade-in">
          <span>
            List <b>{undoInfo.list.name}</b> deleted.
          </span>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded-full font-semibold transition"
            onClick={undoDeleteList}
          >
            Undo
          </button>
        </div>
      )}

      {/* Title and Bell */}
      <div className="flex items-center justify-center mt-6 relative">
        <h1 className="text-4xl text-white font-bold">TO DO LIST</h1>
        <div className="relative ml-4">
          <button
            className="focus:outline-none"
            onClick={() => {
              setShowNotifCenter(true);
              const newLastNotifView = { ...lastNotifView };
              notifications.forEach(n => {
                const notifTime = new Date(n.time).getTime();
                if (!newLastNotifView[n.listId] || notifTime > newLastNotifView[n.listId]) {
                  newLastNotifView[n.listId] = notifTime;
                }
              });
              setLastNotifView(newLastNotifView);
            }}
            aria-label="Show notifications"
          >
            <Bell
              className={`w-8 h-8 transition-transform duration-300 ${
                bgColor === "#fbbf24" ? "text-white" : "text-yellow-400"
              } ${badgeAnim ? "animate-bell-ring" : ""}`}
            />
            {unseenCount > 0 && (
              <span
                className={`absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center z-10
                  ${badgeAnim ? "animate-ping-short" : ""}
                `}
              >
                {unseenCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Notification Center Modal */}
      {showNotifCenter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
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
                    setCurrentList(notif.listId);
                    setShowNotifCenter(false);
                    const currentTasks = tasks[notif.listId] || [];
                    const idx = currentTasks.findIndex(
                      t => t.text === notif.taskText && t.dueDate === notif.dueDate
                    );
                    if (idx !== -1) {
                      setHighlightedTask(null);
                      setTimeout(() => {
                        const el = taskRefs.current[idx];
                        if (el) {
                          const isLast = idx >= currentTasks.length - 2;
                          el.scrollIntoView({
                            behavior: "smooth",
                            block: isLast ? "end" : "center"
                          });

                          let scrollTimeout;
                          let observer;
                          const triggerHighlight = () => {
                            setHighlightedTask({ listId: notif.listId, idx });
                            setTimeout(() => setHighlightedTask(null), 2000);
                            if (observer) observer.disconnect();
                            window.removeEventListener("scroll", onScroll, true);
                          };

                          const onScroll = () => {
                            clearTimeout(scrollTimeout);
                            scrollTimeout = setTimeout(() => {
                              if (el.getBoundingClientRect().top >= 0 &&
                                  el.getBoundingClientRect().bottom <= (window.innerHeight || document.documentElement.clientHeight)) {
                                triggerHighlight();
                              }
                            }, 120);
                          };
                          window.addEventListener("scroll", onScroll, true);

                          observer = new window.IntersectionObserver(
                            (entries, obs) => {
                              if (entries[0].intersectionRatio >= 0.9) {
                                clearTimeout(scrollTimeout);
                                scrollTimeout = setTimeout(triggerHighlight, 120);
                              }
                            },
                            { threshold: 0.9 }
                          );
                          observer.observe(el);

                          setTimeout(() => {
                            if (observer) observer.disconnect();
                            window.removeEventListener("scroll", onScroll, true);
                            setHighlightedTask({ listId: notif.listId, idx });
                            setTimeout(() => setHighlightedTask(null), 2000);
                          }, 2500);
                        } else {
                          setHighlightedTask({ listId: notif.listId, idx });
                          setTimeout(() => setHighlightedTask(null), 2000);
                        }
                      }, 200);
                    }
                  }}
                  title={
                    lists.find(l => l.id === notif.listId)
                      ? `Go to list: ${lists.find(l => l.id === notif.listId).name}`
                      : "Go to list"
                  }
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
              onClick={() =>
                setData(prev => ({ ...prev, notifications: [] }))
              }
            >
              Clear All Notifications
            </button>
          </div>
        </div>
      )}

      {/* Add Task */}
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
              className="w-full max-w-lg rounded-2xl px-3 py-2 flex flex-wrap gap-2 items-center shadow-lg bg-white/70 backdrop-blur-md border border-gray-200"
              style={{
                minHeight: 56
              }}
              onSubmit={e => {
                e.preventDefault();
                addTask();
              }}
            >
              <select
                className="px-2 py-2 rounded-lg text-xs font-semibold bg-white text-gray-800 flex-shrink-0 border border-gray-200 focus:ring-2 focus:ring-offset-2 focus:ring-black/20"
                value={newTask.type}
                onChange={e => setNewTask(nt => ({ ...nt, type: e.target.value }))}
              >
                {TASK_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={newTask.text}
                placeholder="Enter your task here..."
                className="flex-grow min-w-[120px] px-3 py-2 text-sm md:text-base bg-white text-gray-900 outline-none rounded-lg placeholder-gray-500 border border-gray-200 focus:ring-2 focus:ring-offset-2 focus:ring-black/20 transition"
                onChange={e => setNewTask(nt => ({ ...nt, text: e.target.value }))}
                maxLength={100}
                required
              />
              <div className="flex flex-col relative">
                <button
                  type="button"
                  className="flex items-center px-3 py-2 h-10 rounded-lg bg-white border border-gray-200 text-gray-700 text-base font-medium shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                  onClick={() => document.getElementById('dueDateInput').showPicker && document.getElementById('dueDateInput').showPicker()}
                  style={{ minWidth: 180, justifyContent: "flex-start" }}
                >
                  <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2" fill="none"/>
                    <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  {newTask.dueDate
                    ? new Date(newTask.dueDate).toLocaleString()
                    : <span className="text-gray-400">Pick due date</span>
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
              {newTask.type === "longterm" && (
                <input
                  type="text"
                  className="px-2 py-2 rounded-lg text-xs text-gray-900 min-w-[120px] w-auto flex-shrink-0 border border-gray-200 bg-white focus:ring-2 focus:ring-offset-2 focus:ring-black/20"
                  placeholder="Subtasks (comma separated)"
                  value={newTask.subtasks}
                  onChange={e => setNewTask(nt => ({ ...nt, subtasks: e.target.value }))}
                  maxLength={100}
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

      {/* Task List */}
      {!showArchive && (
        <div className="flex flex-col items-center gap-3 w-full px-1 sm:px-2 mt-4">
          {(tasks[currentList] || []).filter(t => !t.archived).length === 0 && (
            <div className="text-white opacity-60 mt-4">No tasks yet. Add one above!</div>
          )}
          {(tasks[currentList] || []).filter(t => !t.archived).map((task, index) => {
            const expired = isTaskExpired(task);
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
            const isHighlighted = highlightedTask &&
              highlightedTask.listId === currentList &&
              highlightedTask.idx === index;

            return (
              <div
                key={index}
                ref={el => { if (isHighlighted) taskRefs.current[index] = el; }}
                className={`flex flex-nowrap items-center rounded-full px-2 py-1 w-11/12 md:w-1/2 shadow-md overflow-x-auto ${bg} ${border} ${isHighlighted ? "z-20 highlight-glow" : ""}`}
                style={{ minHeight: "48px", transition: "box-shadow 0.3s, ring 0.3s" }}
              >
                <span className={`font-bold mr-2 text-sm md:text-base flex-shrink-0 ${text}`}>{index + 1})</span>
                <span className={`flex-grow min-w-0 pr-2 text-sm md:text-base truncate ${text}`}>
                  {task.text}
                </span>
                {task.dueDate && (
                  <span className="ml-2 text-xs text-gray-700 flex-shrink-0">
                    {new Date(task.dueDate).toLocaleString()}
                  </span>
                )}
                {task.type === "longterm" && task.subtasks && (
                  <span className="ml-2 text-xs text-gray-500 flex-shrink-0">
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
                  } border-2 flex-shrink-0`}
                  onClick={() => !expired && !completed && toggleDone(index)}
                  aria-label="Mark as done"
                  disabled={completed || expired}
                  title={
                    completed
                      ? "Completed"
                      : expired
                      ? "Expired"
                      : "Mark as done"
                  }
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
                  className="ml-2 w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-red-200 hover:text-red-600 transition flex-shrink-0"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete this task?")) {
                      archiveTask(index);
                    }
                  }}
                  aria-label="Archive task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Archive/History */}
      {showArchive && (
        <div className="flex flex-col items-center gap-3 w-full px-1 sm:px-2 mt-4">
          <div className="text-white text-lg font-semibold mb-2">Archived Tasks</div>
          {(archive[currentList] || []).length === 0 && (
            <div className="text-white opacity-60">No archived tasks.</div>
          )}
          {(archive[currentList] || []).map((task, idx) => {
            const completed = task.done;
            const expired = !task.done;
            let bg, border, text;
            if (completed) {
              bg = "bg-green-100";
              border = "border-green-400";
              text = "text-green-700";
            } else {
              bg = "bg-red-100";
              border = "border-red-400";
              text = "text-red-700";
            }
            return (
              <div
                key={idx}
                className={`flex flex-nowrap items-center rounded-full px-2 py-1 w-11/12 md:w-1/2 shadow-md overflow-x-auto ${bg} ${border}`}
                style={{ minHeight: "48px" }}
              >
                <span className={`font-bold mr-2 text-sm md:text-base flex-shrink-0 ${text}`}>{idx + 1})</span>
                <span className={`flex-grow min-w-0 pr-2 text-sm md:text-base truncate ${text}`}>
                  {task.text}
                </span>
                {task.dueDate && (
                  <span className="ml-2 text-xs text-gray-700 flex-shrink-0">
                    {new Date(task.dueDate).toLocaleString()}
                  </span>
                )}
                {task.type === "longterm" && task.subtasks && (
                  <span className="ml-2 text-xs text-gray-500 flex-shrink-0">
                    [{task.subtasks}]
                  </span>
                )}
                <span
                  className={`ml-2 w-7 h-7 flex items-center justify-center rounded-full border-2 flex-shrink-0
                    ${
                      completed
                        ? "bg-green-500 border-green-500 text-white"
                        : "bg-red-300 border-red-400 text-white"
                    }
                  `}
                  title={completed ? "Completed" : "Failed"}
                >
                  {completed ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </span>
              </div>
            );
          })}
          {(archive[currentList] || []).length > 0 && (
            <button
              className="mt-4 px-6 py-2 rounded-full bg-red-500 hover:bg-red-700 text-white font-semibold shadow transition"
              onClick={clearArchive}
            >
              Delete All Archived Tasks
            </button>
          )}
        </div>
      )}

      <footer className="text-white text-center mt-10 text-sm">
        <p>Developed by VectorMedia</p>
        <p className="opacity-70">©{new Date().getFullYear()} - All rights reserved</p>
        <p className="opacity-70">V1.1.8</p>
      </footer>
    </div>
  );
};

export default App;