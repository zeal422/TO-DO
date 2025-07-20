import { create } from "zustand";
import { persist } from "zustand/middleware";

const useStore = create(
  persist(
    (set, get) => ({
      lists: [],
      tasks: {},
      archive: {},
      notifications: [],
      addTask: (listId, task) =>
        set((state) => ({
          tasks: {
            ...state.tasks,
            [listId]: [task, ...(state.tasks[listId] || [])],
          },
        })),
      toggleDone: (listId, idx, updatedTask) =>
        set((state) => {
          const updated = [...(state.tasks[listId] || [])];
          if (idx >= 0 && idx < updated.length) {
            if (updatedTask) {
              updated[idx] = { ...updatedTask, completedAt: updatedTask.done ? (updatedTask.completedAt || new Date().toISOString()) : undefined };
            } else {
              updated[idx].done = !updated[idx].done;
              updated[idx].completedAt = updated[idx].done ? new Date().toISOString() : undefined;
            }
          }
          return {
            tasks: { ...state.tasks, [listId]: updated },
          };
        }),
      archiveTask: (listId, idx) =>
        set((state) => {
          const taskList = state.tasks[listId] || [];
          if (idx >= 0 && idx < taskList.length && !taskList[idx].archived) {
            const task = { ...taskList[idx], archived: true };
            const updatedTasks = taskList.filter((_, i) => i !== idx);
            const updatedArchive = [...(state.archive[listId] || []), task];
            return {
              tasks: { ...state.tasks, [listId]: updatedTasks },
              archive: { ...state.archive, [listId]: updatedArchive },
            };
          }
          return state;
        }),
      undoArchiveTask: (listId, taskId) =>
        set((state) => {
          const archivedTasks = state.archive[listId] || [];
          const taskToUndo = archivedTasks.find((t) => t.id === taskId);
          if (taskToUndo) {
            const updatedArchive = archivedTasks.filter((t) => t.id !== taskId);
            const updatedTasks = [...(state.tasks[listId] || []), { ...taskToUndo, archived: false }];
            return {
              tasks: { ...state.tasks, [listId]: updatedTasks },
              archive: { ...state.archive, [listId]: updatedArchive },
            };
          }
          console.warn("No task found to undo in archive for taskId:", taskId);
          return state;
        }),
      removeTask: (listId, idx, isArchive = false) =>
        set((state) => {
          if (isArchive) {
            const updatedArchive = (state.archive[listId] || []).filter((_, i) => i !== idx);
            return {
              archive: { ...state.archive, [listId]: updatedArchive },
            };
          } else {
            const updatedTasks = (state.tasks[listId] || []).filter((_, i) => i !== idx);
            return {
              tasks: { ...state.tasks, [listId]: updatedTasks },
            };
          }
        }),
      deleteTaskFromArchive: (listId, idx) =>
        set((state) => {
          const updatedArchive = (state.archive[listId] || []).filter((_, i) => i !== idx);
          return {
            archive: { ...state.archive, [listId]: updatedArchive },
          };
        }),
      undoDeleteTaskFromArchive: (listId, task, idx) =>
        set((state) => {
          const updatedArchive = [...(state.archive[listId] || [])];
          updatedArchive.splice(idx, 0, task);
          return {
            archive: { ...state.archive, [listId]: updatedArchive },
          };
        }),
      addList: (id, name) =>
        set((state) => ({
          lists: [...state.lists, { id, name }],
          tasks: { ...state.tasks, [id]: [] },
          archive: { ...state.archive, [id]: [] },
        })),
      removeList: (id) =>
        set((state) => {
          const newLists = state.lists.filter((l) => l.id !== id);
          const { [id]: _, ...newTasks } = state.tasks;
          const { [id]: __, ...newArchive } = state.archive;
          return {
            lists: newLists,
            tasks: newTasks,
            archive: newArchive,
          };
        }),
      undoDeleteList: (list, tasks, archive) =>
        set((state) => ({
          lists: [...state.lists, list],
          tasks: { ...state.tasks, [list.id]: tasks },
          archive: { ...state.archive, [list.id]: archive },
        })),
      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 100),
        })),
      clearNotifications: () =>
        set((state) => ({ notifications: [] })),
      setData: (newData) =>
        set((state) => ({ ...state, ...newData })),
      clearArchive: (listId) =>
        set((state) => ({
          archive: { ...state.archive, [listId]: [] },
        })),
    }),
    {
      name: "task-app-storage",
      getStorage: () => localStorage,
      partialize: (state) => ({
        lists: state.lists,
        tasks: state.tasks,
        archive: state.archive,
        notifications: state.notifications,
      }),
    }
  )
);

export default useStore;