import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const exportTasksToPDF = (lists, tasks, archive) => {
  const doc = new jsPDF();
  const date = new Date().toLocaleDateString();
  doc.setFontSize(16);
  doc.text("Task List Export", 10, 10);
  doc.setFontSize(12);
  doc.text(`Generated on: ${date}`, 10, 20);

  let yOffset = 30;
  lists.forEach((list) => {
    const listTasks = tasks[list.id] || [];
    const archivedTasks = archive[list.id] || [];

    // Check available space before starting a new list
    const pageHeight = doc.internal.pageSize.height;
    const availableSpace = pageHeight - yOffset;
    const minSpaceRequired = 40; // Minimum space needed for title and some table rows

    if (availableSpace < minSpaceRequired && (listTasks.length > 0 || archivedTasks.length > 0)) {
      doc.addPage();
      yOffset = 20; // Reset yOffset with margin on new page
    }

    if (listTasks.length > 0 || archivedTasks.length > 0) {
      doc.setFontSize(14);
      doc.text(list.name, 10, yOffset);
      yOffset += 10;

      if (listTasks.length > 0) {
        autoTable(doc, {
          head: [["Task", "Due Date", "Status"]],
          body: listTasks.map((task) => {
            const isExpired = !task.done && task.dueDate && new Date(task.dueDate).getTime() < Date.now();
            const dueDateStr = task.dueDate ? new Date(task.dueDate).toLocaleString() : "N/A";
            const completedDateStr = task.done && task.completedAt ? `\nCompleted: ${new Date(task.completedAt).toLocaleString()}` : "";
            const status = isExpired ? "Expired" : task.done ? "Completed" : task.archived ? "Archived" : "Active";

            return [
              task.text,
              dueDateStr + (completedDateStr ? completedDateStr : ""),
              status,
            ];
          }),
          startY: yOffset,
          theme: "grid",
          styles: { fontSize: 10, cellPadding: 2 },
          headStyles: { fillColor: [0, 102, 204], textColor: [255, 255, 255] }, // Blue for active tasks
          pageBreak: "auto",
        });
        yOffset = doc.lastAutoTable.finalY + 10;
      }

      if (archivedTasks.length > 0) {
        doc.setFontSize(12);
        doc.text("Archived Tasks", 10, yOffset);
        yOffset += 10;
        autoTable(doc, {
          head: [["Task", "Due Date", "Status"]],
          body: archivedTasks.map((task) => {
            const isExpired = !task.done && task.dueDate && new Date(task.dueDate).getTime() < Date.now();
            const dueDateStr = task.dueDate ? new Date(task.dueDate).toLocaleString() : "N/A";
            const completedDateStr = task.done && task.completedAt ? `\nCompleted: ${new Date(task.completedAt).toLocaleString()}` : "";
            const status = isExpired ? "Expired" : task.done ? "Completed" : "Archived";

            return [
              task.text,
              dueDateStr + (completedDateStr ? completedDateStr : ""),
              status,
            ];
          }),
          startY: yOffset,
          theme: "grid",
          styles: { fontSize: 10, cellPadding: 2 },
          headStyles: { fillColor: [139, 0, 0], textColor: [255, 255, 255] }, // Red for archived tasks
          pageBreak: "auto",
        });
        yOffset = doc.lastAutoTable.finalY + 10;
      }
    }
  });

  doc.save(`task-export-${new Date().toISOString().split('T')[0]}.pdf`);
};