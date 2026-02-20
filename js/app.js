let appState = {
    root: null,
    selectedFolderId: null,
    selectedNoteId: null
};

let saveTimeout = null;
let userClickedFolder = false;

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
                <span class="arrow ${!hasChildren ? "empty" : ""}">
                    ${
                        hasChildren
                            ? `<img src="assets/icons/${child.expanded ? "down-arrow.png" : "arrow.png"}" class="arrow-icon" />`
                            : ""
                    }
                </span>
                <img src="assets/icons/folder.png" class="icon" />
                <span class="label">${child.name}</span>
            `;

            folderDiv.addEventListener("click", function () {

                appState.selectedFolderId = child.id;
                appState.selectedNoteId = null;
                userClickedFolder = true;

                child.expanded = !child.expanded;

                editorContent.innerHTML =
                    "<p style='color:#9ca3af;'>Select or create a note to start writing...</p>";
                editorContent.contentEditable = "false";
                noteTitleInput.value = "";
                noteTitleInput.disabled = true;

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
    if (!parentFolder) {
        alert("Please select a folder first.");
        return;
    }

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
};

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

    let parentFolder;

    if (
        userClickedFolder &&
        appState.selectedFolderId &&
        appState.selectedFolderId !== appState.root.id
    ) {
        parentFolder = findFolderById(appState.root, appState.selectedFolderId);
    } else {
        parentFolder = appState.root;
    }

    parentFolder.children.push({
        id: generateId(),
        name: folderName,
        type: "folder",
        expanded: true,
        children: []
    });

    userClickedFolder = false;

    saveAppState();
    renderSidebar();

    modalOverlay.classList.add("hidden");
};

createFolderBtn.addEventListener("click", function (e) {

    if (e.shiftKey) {
        userClickedFolder = false;
        appState.selectedFolderId = appState.root.id;
    }

    openFolderModal();
});

sidebarTree.addEventListener("click", function (e) {

    if (e.target === sidebarTree) {

        appState.selectedFolderId = appState.root.id;
        appState.selectedNoteId = null;

        userClickedFolder = false;

        renderSidebar();
    }
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