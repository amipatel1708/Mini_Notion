let appState = {
    root: null,
    selectedFolderId: null,
    selectedNoteId: null
};

let saveTimeout = null;

const STORAGE_KEY = "miniNotionData";

const sidebarTree = document.getElementById("sidebarTree");
const createFolderBtn = document.getElementById("createFolderBtn");
const createNoteBtn = document.getElementById("createNoteBtn");
const noteTitleInput = document.getElementById("noteTitle");
const editorContent = document.getElementById("editorContent");
const timestampDisplay = document.getElementById("timestamp");
const deleteBtn = document.getElementById("deleteBtn");
const renameBtn = document.getElementById("renameBtn");
const searchInput = document.querySelector(".search-box");
const toolbarButtons = document.querySelectorAll(".toolbar button");
const linkBtn = document.getElementById("linkBtn");
const saveStatus = document.getElementById("saveStatus");
const headingSelect = document.getElementById("headingSelect");

const modalOverlay = document.getElementById("modalOverlay");
const modalInput = document.getElementById("modalInput");
const modalConfirm = document.getElementById("modalConfirm");
const modalCancel = document.getElementById("modalCancel");

const deleteOverlay = document.getElementById("deleteOverlay");
const deleteConfirm = document.getElementById("deleteConfirm");
const deleteCancel = document.getElementById("deleteCancel");

const renameOverlay = document.getElementById("renameOverlay");
const renameInput = document.getElementById("renameInput");
const renameConfirm = document.getElementById("renameConfirm");
const renameCancel = document.getElementById("renameCancel");

const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");

const toastContainer = document.getElementById("toastContainer");

function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("hide");
        setTimeout(() => {
            toast.remove();
        }, 400);
    }, 3000);
}

function debounceSave(callback, delay = 500) {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(callback, delay);
}

function generateId() {
    return "id-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
}

function createDefaultRoot() {
    return {
        id: generateId(),
        name: "Root",
        type: "folder",
        expanded: true,
        children: []
    };
}

function findNoteById(folder, id) {
    for (let child of folder.children) {
        if (child.type === "note" && child.id === id) return child;
        if (child.type === "folder") {
            const found = findNoteById(child, id);
            if (found) return found;
        }
    }
    return null;
}

function findFolderById(folder, id) {
    if (folder.id === id) return folder;
    for (let child of folder.children) {
        if (child.type === "folder") {
            const found = findFolderById(child, id);
            if (found) return found;
        }
    }
    return null;
}

function removeFolderById(parentFolder, folderId) {
    for (let i = 0; i < parentFolder.children.length; i++) {
        const child = parentFolder.children[i];
        if (child.type === "folder" && child.id === folderId) {
            parentFolder.children.splice(i, 1);
            return true;
        }
        if (child.type === "folder") {
            const removed = removeFolderById(child, folderId);
            if (removed) return true;
        }
    }
    return false;
}

function loadAppState() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
        try {
            appState = JSON.parse(savedData);
            console.log("State loaded from localStorage");
        } catch (error) {
            console.error("Error parsing saved data. Resetting...");
            resetAppState();
        }
    } else {
        resetAppState();
    }
}

function saveAppState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function resetAppState() {
    appState.root = createDefaultRoot();
    appState.selectedFolderId = appState.root.id;
    appState.selectedNoteId = null;
    saveAppState();
}

function renderSidebar(searchTerm = "") {
    sidebarTree.innerHTML = "";
    if (!appState.root) return;
    renderTree(appState.root, sidebarTree, searchTerm.toLowerCase());
    renderNotePanel();
}

function renderTree(folder, parentElement, searchTerm = "") {
    folder.children.forEach(child => {

        if (child.type === "folder") {

            if (searchTerm && !folderHasMatch(child, searchTerm)) return;

            const folderDiv = document.createElement("div");
            folderDiv.className = "item folder";

            if (appState.selectedFolderId === child.id) {
                folderDiv.classList.add("active");
            }

            const hasChildren = child.children.length > 0;

            folderDiv.innerHTML = `
                <span class="arrow">
                    <img src="assets/icons/${child.expanded ? "down-arrow.png" : "arrow.png"}" class="arrow-icon" width="12"/>
                </span>
                <img src="assets/icons/folder.png" class="icon" />
                <span class="label">${child.name}</span>
            `;

            folderDiv.addEventListener("click", function (e) {

                e.stopPropagation();

                appState.selectedFolderId = child.id;
                appState.selectedNoteId = null;

                child.expanded = !child.expanded;

                sidebarTree.classList.remove("root-active");

                renderSidebar(searchTerm);
            });

            folderDiv.addEventListener("dragover", function (e) {
                e.preventDefault();
                folderDiv.classList.add("folder-drop-target");
            });

            folderDiv.addEventListener("dragleave", function () {
                folderDiv.classList.remove("folder-drop-target");
            });

            folderDiv.addEventListener("drop", function (e) {
                e.preventDefault();
                folderDiv.classList.remove("folder-drop-target");

                const noteId = e.dataTransfer.getData("text/plain");
                if (!noteId) return;

                moveNoteToFolder(noteId, child.id);
            });

            parentElement.appendChild(folderDiv);

            const childrenContainer = document.createElement("div");
            childrenContainer.className = "nested";

            if (child.expanded || searchTerm) {
                childrenContainer.classList.add("open");
            }

            parentElement.appendChild(childrenContainer);

            renderTree(child, childrenContainer, searchTerm);
        }

        if (child.type === "note") {

            if (searchTerm) {
                const match =
                    (child.title || "").toLowerCase().includes(searchTerm) ||
                    (child.content || "").toLowerCase().includes(searchTerm);
                if (!match) return;
            }

            const noteDiv = document.createElement("div");
            noteDiv.className = "item note";

            if (appState.selectedNoteId === child.id) {
                noteDiv.classList.add("active");
            }

            noteDiv.innerHTML = `
                <img src="assets/icons/note.png" class="icon" />
                <span class="label">${child.title}</span>
            `;

            noteDiv.addEventListener("click", function (e) {
                e.stopPropagation();

                appState.selectedNoteId = child.id;
                appState.selectedFolderId = folder.id;

                const note = findNoteById(appState.root, child.id);
                if (note) openNote(note);

                renderSidebar(searchTerm);
            });

            noteDiv.setAttribute("draggable", "true");

            noteDiv.addEventListener("dragstart", function (e) {
                e.stopPropagation();
                e.dataTransfer.setData("text/plain", child.id);
                noteDiv.classList.add("dragging");
            });

            noteDiv.addEventListener("dragend", function () {
                noteDiv.classList.remove("dragging");
            });

            parentElement.appendChild(noteDiv);
        }
    });
}

function renderNotePanel() {
    const noteListPanel = document.getElementById("noteListPanel");
    if (!noteListPanel) return;

    noteListPanel.innerHTML = "";

    const folder = findFolderById(appState.root, appState.selectedFolderId);
    if (!folder) return;

    folder.children.forEach(child => {
        if (child.type === "note") {
            const li = document.createElement("li");
            li.textContent = child.title;

            if (child.id === appState.selectedNoteId) {
                li.classList.add("active");
            }

            li.onclick = () => {
                const note = findNoteById(appState.root, child.id);
                if (!note) return;

                appState.selectedNoteId = child.id;
                openNote(note);

                renderSidebar();
                renderNotePanel();
            };

            noteListPanel.appendChild(li);
        }
    });
}

function folderHasMatch(folder, searchTerm) {

    if (!searchTerm) return true;

    if (folder.name.toLowerCase().includes(searchTerm)) return true;

    return folder.children.some(child => {
        if (child.type === "note") {
            return (
                (child.title || "").toLowerCase().includes(searchTerm) ||
                (child.content || "").toLowerCase().includes(searchTerm)
            );
        }
        if (child.type === "folder") {
            return folderHasMatch(child, searchTerm);
        }
        return false;
    });
}

function openFolderModal() {
    modalOverlay.classList.remove("hidden");
    modalInput.value = "";
    modalInput.focus();
}

function moveNoteToFolder(noteId, targetFolderId) {

    if (!noteId || !targetFolderId) return;

    let noteToMove = null;

    function removeNote(folder) {
        for (let i = 0; i < folder.children.length; i++) {

            const child = folder.children[i];

            if (child.type === "note" && child.id === noteId) {
                noteToMove = child;
                folder.children.splice(i, 1);
                return true;
            }

            if (child.type === "folder") {
                if (removeNote(child)) return true;
            }
        }
        return false;
    }

    removeNote(appState.root);

    if (!noteToMove) return;

    const targetFolder = findFolderById(appState.root, targetFolderId);
    if (!targetFolder) return;

    targetFolder.children.push(noteToMove);

    appState.selectedFolderId = targetFolderId;

    saveAppState();
    renderSidebar();
}

function openNote(note) {
    appState.selectedNoteId = note.id;

    editorContent.contentEditable = "true";
    noteTitleInput.disabled = false;
    noteTitleInput.value = note.title;
    editorContent.innerHTML = note.content;

    timestampDisplay.textContent =
        "Last edited: " + new Date(note.lastEdited).toLocaleString();

    saveAppState();
    renderSidebar();
}

function createNote() {

    const parentFolder = findFolderById(appState.root, appState.selectedFolderId);

    const newNote = {
        id: generateId(),
        title: "Untitled Note",
        content: "",
        type: "note",
        createdAt: new Date().toISOString(),
        lastEdited: new Date().toISOString()
    };

    parentFolder.children.push(newNote);

    appState.selectedNoteId = newNote.id;

    saveAppState();
    renderSidebar();
    openNote(newNote);

    showToast("Note created successfully!", "success");
}

function deleteItem() {
    if (appState.selectedNoteId) {

        const parentFolder = findFolderById(appState.root, appState.selectedFolderId);
        if (!parentFolder) return;

        parentFolder.children = parentFolder.children.filter(child =>
            !(child.type === "note" && child.id === appState.selectedNoteId)
        );

        appState.selectedNoteId = null;
    }

    else if (
        appState.selectedFolderId &&
        appState.selectedFolderId !== appState.root.id
    ) {

        removeFolderById(appState.root, appState.selectedFolderId);

        appState.selectedNoteId = null;

        appState.selectedFolderId = appState.root.id;
    }

    noteTitleInput.value = "";
    timestampDisplay.textContent = "Last edited: --";

    editorContent.contentEditable = "false";
    noteTitleInput.disabled = true;
    editorContent.innerHTML =
        "<p style='color:#9ca3af;'>Select or create a note to start writing...</p>";

    saveAppState();
    renderSidebar();
}

function renameItem() {
    let currentName = "";

    if (appState.selectedNoteId) {
        const note = findNoteById(appState.root, appState.selectedNoteId);
        if (!note) return;
        currentName = note.title;
    } else if (
        appState.selectedFolderId &&
        appState.selectedFolderId !== appState.root.id
    ) {
        const folder = findFolderById(appState.root, appState.selectedFolderId);
        if (!folder) return;
        currentName = folder.name;
    } else {
        return;
    }
    renameInput.value = currentName;
    renameOverlay.classList.remove("hidden");
    renameInput.focus();
}

function exportData() {
    try {
        const dataStr = JSON.stringify(appState, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");

        const date = new Date().toISOString().split("T")[0];
        a.href = url;
        a.download = `mini-notion-backup-${date}.json`;

        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast("Backup exported successfully!", "success");
    } catch (error) {
        showToast("Export failed.", "error");
        console.error(error);
    }
}

function collectAllIds(folder, idSet = new Set()) {
    idSet.add(folder.id);
    folder.children.forEach(child => {
        idSet.add(child.id);
        if (child.type === "folder") {
            collectAllIds(child, idSet);
        }
    });
    return idSet;
}

function generateUniqueName(parentFolder, baseName, type) {
    let counter = 1;
    let newName = baseName;

    while (parentFolder.children.some(child =>
        child.type === type &&
        ((type === "folder" && child.name === newName) ||
         (type === "note" && child.title === newName))
    )) {
        newName = `${baseName} (${counter})`;
        counter++;
    }
    return newName;
}

function smartMergeFolders(targetFolder, importedFolder, existingIds) {

    importedFolder.children.forEach(importedChild => {

        const newChild = JSON.parse(JSON.stringify(importedChild));

        if (existingIds.has(newChild.id)) {
            newChild.id = generateId();
        }

        existingIds.add(newChild.id);

        if (newChild.type === "folder") {
            newChild.name = generateUniqueName(
                targetFolder,
                newChild.name,
                "folder"
            );
            fixChildrenIds(newChild, existingIds);
            targetFolder.children.push(newChild);

        } else if (newChild.type === "note") {
            newChild.title = generateUniqueName(
                targetFolder,
                newChild.title,
                "note"
            );
            targetFolder.children.push(newChild);
        }
    });
}

function fixChildrenIds(folder, existingIds) {

    folder.children.forEach(child => {

        if (existingIds.has(child.id)) {
            child.id = generateId();
        }

        existingIds.add(child.id);

        if (child.type === "folder") {
            fixChildrenIds(child, existingIds);
        }
    });
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const parsedData = JSON.parse(event.target.result);
            if (!parsedData.root || !parsedData.root.children) {
                showToast("Invalid backup file.", "error");
                return;
            }
            const confirmImport = confirm(
                "Smart Merge will combine imported data with current data. Continue?"
            );

            if (!confirmImport) return;
            const existingIds = collectAllIds(appState.root);

            smartMergeFolders(appState.root, parsedData.root, existingIds);
            saveAppState();
            renderSidebar();

            showToast("Import completed successfully!", "success");

        } catch (error) {
            showToast("Invalid JSON file.", "error");
            console.error(error);
        }
    };
    reader.readAsText(file);
}

function updateToolbarState() {

    if (!appState.selectedNoteId) {
        toolbarButtons.forEach(button => button.classList.remove("active"));
        if (headingSelect) headingSelect.value = "p";
        return;
    }

    toolbarButtons.forEach(button => button.classList.remove("active"));

    if (document.queryCommandState("bold"))
        document.querySelector('[data-command="bold"]')?.classList.add("active");

    if (document.queryCommandState("italic"))
        document.querySelector('[data-command="italic"]')?.classList.add("active");

    if (document.queryCommandState("insertUnorderedList"))
        document.querySelector('[data-command="insertUnorderedList"]')?.classList.add("active");

    if (document.queryCommandState("underline"))
        document.querySelector('[data-command="underline"]')?.classList.add("active");

    if (document.queryCommandState("insertOrderedList"))
        document.querySelector('[data-command="insertOrderedList"]')?.classList.add("active");

    if (document.queryCommandState("justifyLeft"))
        document.querySelector('[data-command="justifyLeft"]')?.classList.add("active");

    if (document.queryCommandState("justifyCenter"))
        document.querySelector('[data-command="justifyCenter"]')?.classList.add("active");

    if (document.queryCommandState("justifyRight"))
        document.querySelector('[data-command="justifyRight"]')?.classList.add("active");

    if (document.queryCommandState("link"))
        document.querySelector('[data-command="link"]')?.classList.add("active");

    const selection = window.getSelection();

    if (selection.rangeCount > 0) {
        let node = selection.anchorNode;

        while (node) {
            if (node.nodeType === 1 && node.tagName === "A") {
                document.getElementById("linkBtn")?.classList.add("active");
                break;
            }
            node = node.parentNode;
        }
    }

    const currentBlock = document.queryCommandValue("formatBlock");

    if (currentBlock) {
        const normalizedBlock = currentBlock.toLowerCase();

        toolbarButtons.forEach(button => {
            if (
                button.dataset.command === "formatBlock" &&
                button.dataset.value === normalizedBlock
            ) {
                button.classList.add("active");
            }
        });

        if (headingSelect) {
            const allowedTags = ["p", "h1", "h2", "h3", "h4", "h5", "h6"];
            headingSelect.value =
                allowedTags.includes(normalizedBlock) ? normalizedBlock : "p";
        }
    }
}

document.querySelector(".sidebar").addEventListener("click", function (e) {

    if (e.target === e.currentTarget) {

        appState.selectedFolderId = appState.root.id;
        appState.selectedNoteId = null;

        renderSidebar();
    }
});

editorContent.addEventListener("click", function (e) {
    if (!appState.selectedNoteId) return;
    const anchor = e.target.closest("a");
    if (anchor) {
        e.preventDefault();
        window.open(anchor.href, "_blank");
    }
});

toolbarButtons.forEach(button => {
    button.addEventListener("click", function () {

        if (!appState.selectedNoteId) return;

        const command = this.dataset.command;
        const value = this.dataset.value;

        if (command === "removeFormat") {

            if (document.queryCommandState("insertOrderedList")) {
                document.execCommand("insertOrderedList", false, null);
            }

            if (document.queryCommandState("insertUnorderedList")) {
                document.execCommand("insertUnorderedList", false, null);
            }

            document.execCommand("removeFormat", false, null);

            document.execCommand("formatBlock", false, "p");

            document.execCommand("justifyLeft", false, null);

            editorContent.focus();
            updateToolbarState();
            return;
        }

        if (command === "formatBlock") {
            document.execCommand(command, false, value);
        } else {
            document.execCommand(command, false, null);
        }

        editorContent.focus();
        updateToolbarState();
    });
});

headingSelect.addEventListener("change", function () {
    if (!appState.selectedNoteId) return;
    document.execCommand("formatBlock", false, this.value);
    editorContent.focus();
});

linkBtn.addEventListener("click", function () {
    if (!appState.selectedNoteId) return;
    const url = prompt("Enter URL:");
    if (!url) return;
    document.execCommand("createLink", false, url);
});

createNoteBtn.addEventListener("click", createNote);
renameBtn.addEventListener("click", renameItem);

searchInput.addEventListener("input", function () {
    renderSidebar(searchInput.value.trim());
});

noteTitleInput.addEventListener("input", function () {

    if (!appState.selectedNoteId) return;

    saveStatus.textContent = "Saving...";

    debounceSave(() => {

        const note = findNoteById(appState.root, appState.selectedNoteId);
        if (!note) return;

        note.title = noteTitleInput.value;
        note.lastEdited = new Date().toISOString();

        saveAppState();
        renderSidebar();

        timestampDisplay.textContent =
            "Last edited: " + new Date(note.lastEdited).toLocaleString();

        saveStatus.textContent = "Saved";
    });
});

editorContent.addEventListener("input", function () {

    if (!appState.selectedNoteId) return;

    saveStatus.textContent = "Saving...";

    debounceSave(() => {

        const note = findNoteById(appState.root, appState.selectedNoteId);
        if (!note) return;

        note.content = editorContent.innerHTML;
        note.lastEdited = new Date().toISOString();

        saveAppState();

        timestampDisplay.textContent =
            "Last edited: " + new Date(note.lastEdited).toLocaleString();

        saveStatus.textContent = "Saved";
    });
});

editorContent.addEventListener("keyup", updateToolbarState);
editorContent.addEventListener("mouseup", updateToolbarState);

document.addEventListener("selectionchange", function () {
    if (document.activeElement === editorContent) {
        updateToolbarState();
    }
});

exportBtn.addEventListener("click", exportData);

importBtn.addEventListener("click", function () {
    importFile.click();
});

importFile.addEventListener("change", function () {
    const file = importFile.files[0];
    if (!file) return;

    importData(file);

    importFile.value = "";
});

deleteBtn.onclick = () => {
    if (!appState.selectedNoteId &&
        (!appState.selectedFolderId || appState.selectedFolderId === appState.root.id)) {
        return;
    }
    deleteOverlay.classList.remove("hidden");
};

deleteCancel.onclick = () => deleteOverlay.classList.add("hidden");

deleteConfirm.onclick = () => {
    if (!appState.selectedNoteId &&
    (!appState.selectedFolderId || appState.selectedFolderId === appState.root.id)) {
        deleteOverlay.classList.add("hidden");
        return;
    }
    deleteOverlay.classList.add("hidden");
    deleteItem();

    showToast("Deleted successfully!", "error");
};

document.addEventListener("keydown", function (e) {

    if (deleteOverlay.classList.contains("hidden")) return;

    if (e.key === "Enter") {
        e.preventDefault();
        deleteConfirm.click();
    }

    if (e.key === "Escape") {
        e.preventDefault();
        deleteOverlay.classList.add("hidden");
    }
});

renameConfirm.onclick = () => {

    const newName = renameInput.value.trim();
    if (!newName) return;

    if (appState.selectedNoteId) {

        const note = findNoteById(appState.root, appState.selectedNoteId);
        if (!note) return;

        note.title = newName;
        note.lastEdited = new Date().toISOString();
        noteTitleInput.value = newName;

    } else if (
        appState.selectedFolderId &&
        appState.selectedFolderId !== appState.root.id
    ) {

        const folder = findFolderById(appState.root, appState.selectedFolderId);
        if (!folder) return;

        folder.name = newName;
    }

    saveAppState();
    renderSidebar();

    showToast("Renamed successfully!", "success");
    renameOverlay.classList.add("hidden");
};

renameCancel.onclick = () => {
    renameOverlay.classList.add("hidden");
};

modalCancel.onclick = () => {
    modalOverlay.classList.add("hidden");
};

modalConfirm.onclick = () => {

    const folderName = modalInput.value.trim();
    if (!folderName) return;

    const parentFolder = findFolderById(
        appState.root,
        appState.selectedFolderId || appState.root.id
    );

    parentFolder.children.push({
        id: generateId(),
        name: folderName,
        type: "folder",
        expanded: true,
        children: []
    });

    saveAppState();
    renderSidebar();

    showToast("Folder created successfully!", "success");
    modalOverlay.classList.add("hidden");
};

modalInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        e.preventDefault();
        modalConfirm.click();
    }

    if (e.key === "Escape") {
        e.preventDefault();
        modalOverlay.classList.add("hidden");
    }
});

renameInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        e.preventDefault();
        renameConfirm.click();
    }

    if (e.key === "Escape") {
        e.preventDefault();
        renameOverlay.classList.add("hidden");
    }
});

createFolderBtn.addEventListener("click", function (e) {
    openFolderModal();
});

document.addEventListener("keydown", function (e) {

    if (!appState.selectedNoteId) return;

    const isCtrl = e.ctrlKey || e.metaKey;

    if (!isCtrl) return;

    switch (true) {

        // CTRL + B → Bold
        case e.key.toLowerCase() === "b":
            e.preventDefault();
            document.execCommand("bold");
            editorContent.focus();
            break;

        // CTRL + I → Italic
        case e.key.toLowerCase() === "i":
            e.preventDefault();
            document.execCommand("italic");
            editorContent.focus();
            break;

        // CTRL + U → Underline
        case e.key.toLowerCase() === "u":
            e.preventDefault();
            document.execCommand("underline");
            editorContent.focus();
            break;

        // CTRL + 1 → H1
        case e.key === "1":
            e.preventDefault();
            document.execCommand("formatBlock", false, "h1");
            editorContent.focus();
            break;

        // CTRL + 2 → H2
        case e.key === "2":
            e.preventDefault();
            document.execCommand("formatBlock", false, "h2");
            editorContent.focus();
            break;

        // CTRL + 3 → H3
        case e.key === "3":
            e.preventDefault();
            document.execCommand("formatBlock", false, "h3");
            editorContent.focus();
            break;

        // CTRL + 4 → H4
        case e.key === "4":
            e.preventDefault();
            document.execCommand("formatBlock", false, "h4");
            editorContent.focus();
            break;

        // CTRL + 5 → H5
        case e.key === "5":
            e.preventDefault();
            document.execCommand("formatBlock", false, "h5");
            editorContent.focus();
            break;

        // CTRL + 6 → H6
        case e.key === "6":
            e.preventDefault();
            document.execCommand("formatBlock", false, "h6");
            editorContent.focus();
            break;

        // CTRL + ` → Code Block
        case e.key === "`":
            e.preventDefault();
            document.execCommand("formatBlock", false, "pre");
            editorContent.focus();
            break;

        // CTRL + SHIFT + Q → Quote
        case e.shiftKey && e.key.toLowerCase() === "q":
            e.preventDefault();
            document.execCommand("formatBlock", false, "blockquote");
            editorContent.focus();
            break;

        // CTRL + K → Link
        case e.key.toLowerCase() === "k":
            e.preventDefault();
            const url = prompt("Enter URL:");
            if (url) {
                document.execCommand("createLink", false, url);
            }
            editorContent.focus();
            break;

        // CTRL + SHIFT + C → Clear Formatting
        case e.shiftKey && e.key.toLowerCase() === "c":
            e.preventDefault();
            document.execCommand("removeFormat");
            document.execCommand("formatBlock", false, "p");
            editorContent.focus();
            break;
    }
    editorContent.focus();
    updateToolbarState();
});

function initializeApp() {
    loadAppState();
    renderSidebar();

    if (appState.selectedNoteId) {
        const note = findNoteById(appState.root, appState.selectedNoteId);
        if (note) openNote(note);
    } else {
        editorContent.innerHTML =
            "<p style='color:#9ca3af;'>Select or create a note to start writing...</p>";
        editorContent.contentEditable = "false";
        noteTitleInput.disabled = true;
    }

    console.log("App Initialized:", appState);
}

initializeApp();