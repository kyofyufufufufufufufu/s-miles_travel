document.addEventListener("DOMContentLoaded", () => {
    const packingToggle = document.getElementById("show-packing");
    const todoToggle = document.getElementById("show-todo");
    const savingToggle = document.getElementById("saving");
  
    const showSectionIfYes = (selectEl, sectionId) => {
      const section = document.getElementById(sectionId);
      if (selectEl && section) {
        section.style.display = selectEl.value === "yes" ? "block" : "none";
        selectEl.addEventListener("change", () => {
          section.style.display = selectEl.value === "yes" ? "block" : "none";
        });
      }
    };
  
    showSectionIfYes(packingToggle, "packing-section");
    showSectionIfYes(todoToggle, "todo-section");
    showSectionIfYes(savingToggle, "saving-section");
  });
  