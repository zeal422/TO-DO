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
            [listId]: [task, ...(state.tasks[listId] || [])], // Prepend new task
          },
        })),
      toggleDone: (listId, idx) =>
        set((state) => {
          const updated = [...(state.tasks[listId] || [])];
          if (idx >= 0 && idx < updated.length) {
            updated[idx].done = !updated[idx].done;
          }
          return {
            tasks: { ...state.tasks, [listId]: updated },
          };
        }),
      archiveTask: (listId, idx) =>
        set((state) => {
          const task = (state.tasks[listId] || [])[idx];
          if (task && !task.archived) {
            const updatedTasks = (state.tasks[listId] || []).filter((_, i) => i !== idx);
            const updatedArchive = [
              ...(state.archive[listId] || []),
              { ...task, archived: true },
            ];
            return {
              tasks: { ...state.tasks, [listId]: updatedTasks },
              archive: { ...state.archive, [listId]: updatedArchive },
            };
          }
          return state;
        }),
      undoArchiveTask: (listId, task, idx) =>
        set((state) => {
          const updatedArchive = (state.archive[listId] || []).filter((t, i) => i !== idx);
          const updatedTasks = [
            ...(state.tasks[listId] || []),
            { ...task, archived: false },
          ];
          return {
            tasks: { ...state.tasks, [listId]: updatedTasks },
            archive: { ...state.archive, [listId]: updatedArchive },
          };
        }),
      removeTask: (listId, idx, isArchive = false) =>
        set((state) => {
          if (isArchive) {
            const updatedArchive = (state.archive[listId] || []).filter((_, i) => i !== idx);
            return {
              archive: { ...state.archive, [listId]: updatedArchive },
            };
          } else {
            const updated = (state.tasks[listId] || []).filter((_, i) => i !== idx);
            return {
              tasks: { ...state.tasks, [listId]: updated },
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
          updatedArchive.splice(idx, 0, task); // Reinsert at original index
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
          notifications: [notification, ...state.notifications].slice(0, 50),
        })),
      clearNotifications: () =>
        set((state) => ({ notifications: [] })),
      setData: (newData) =>
        set((state) => ({ ...state, ...newData })),
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