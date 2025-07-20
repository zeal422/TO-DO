# Task Management App

A feature-rich task management application by Me, Vector Media (@VectorMediaGR)

## 🛠 Technologies Used

### Core Technologies
- **React** - JavaScript library for building the UI
- **React Hooks** (`useState`, `useEffect`, `useRef`, `useCallback`) - For state management and side effects
- **JSX** - Syntax extension for JavaScript

### State Management
- **Zustand** - Lightweight state management library
- **zustand/middleware/persist** - For persisting state to localStorage

### UI & Animations
- **Framer Motion** - Animation library for React
- **Lucide React** (formerly Feather Icons) - Icon library (Bell, Plus, Trash2, etc.)
- **Tailwind CSS** - Utility-first CSS framework
- **CSS Animations** - Custom keyframe animations

### Utility Libraries
- **jspdf** - For generating PDF exports
- **jspdf-autotable** - Plugin for creating tables in PDFs
- **uuid** - For generating unique IDs

## ✨ Key Features

### Task Management
- ✅ Create/Read/Update/Delete tasks  
- 🗃 Task archiving system  
- ✔️ Task completion tracking  
- 📋 Subtasks support  
- ⏰ Due dates with reminders  
- 📊 Progress tracking with visual indicators  

### List Management
- 📂 Multiple task lists  
- ➕ List creation/deletion  
- 🔄 List switching  

### Notifications
- 🔔 Browser notifications (when permitted)  
- 📲 In-app notification center  
- 🔴 Badge counters for unread notifications  
- 🚨 Notification types (reminders, completions, etc.)  

### Undo Functionality
- ↩️ Undo task deletion (6-second window)  
- ↩️ Undo task archiving  
- ↩️ Undo list deletion  

### Data Management
- 💾 Local storage persistence  
- 📦 Storage quota monitoring  
- 📄 PDF export functionality  

### UI/UX Features
- 🎨 Color theming system  
- 📶 Progress bars with smooth animations  
- 📱 Fully responsive design  
- 🔢 Pagination for large task lists  
- 🪟 Modal dialogs for detailed views  
- ✔️ Form validation  

### Accessibility
- ♿ ARIA attributes for screen readers  
- ⌨️ Keyboard navigation support  
- 🔍 Focus management  

### Error Handling
- ⚠️ React Error Boundaries  
- 🆘 Error fallback UI  
- 💽 Storage error handling  

## 📦 Installation

```bash
# Install all dependencies
npm install react react-dom zustand @zustand/persist framer-motion lucide-react tailwindcss postcss autoprefixer jspdf jspdf-autotable uuid

# Initialize Tailwind CSS
npx tailwindcss init -p

# Optional development dependencies
npm install --save-dev @types/react @types/node

# Start development server
npm run dev