const sidebarTree = document.getElementById("sidebarTree");
const createFolderBtn = document.getElementById("createFolderBtn");
const createNoteBtn = document.getElementById("createNoteBtn");
const noteTitleInput = document.getElementById("noteTitle");
const editorContent = document.getElementById("editorContent");
const timestampDisplay = document.getElementById("timestamp");
const deleteBtn = document.getElementById("deleteBtn");
const renameBtn = document.getElementById("renameBtn");
const searchInput = document.querySelector(".search-box");

let appState = {
    root: null,
    selectedFolderId: null,
    selectedNoteId: null
};

const STORAGE_KEY = "miniNotionData";

// Generate Unique ID
function generateId() {
    return "id-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
}

// Create Default Root Folder
function createDefaultRoot() {
    return {
        id: generateId(),
        name: "Root",
        type: "folder",
        children: []
    };
}

// Find Note by ID (Recursive)
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

// Find Folder by ID (Recursive)
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

// Remove Folder Recursively
function removeFolderById(parentFolder, folderId) {

    for (let i = 0; i < parentFolder.children.length; i++) {

        const child = parentFolder.children[i];

        if (child.type === "folder" && child.id === folderId) {
            parentFolder.children.splice(i, 1);
            return true;
        }

        if (child.type === "folder") {
            const deleted = removeFolderById(child, folderId);
            if (deleted) return true;
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
}

function renderTree(folder, parentElement, searchTerm = "") {
    const li = document.createElement("li");
    li.classList.add("folder");
    const folderDiv = document.createElement("div");
    folderDiv.classList.add("item");
    folderDiv.textContent = folder.name;

    if (folder.id === appState.selectedFolderId) {
        folderDiv.classList.add("active");
    }

    folderDiv.addEventListener("click", function (e) {
        e.stopPropagation();

        appState.selectedFolderId = folder.id;
        appState.selectedNoteId = null;

        saveAppState();
        renderSidebar();
    });

    li.appendChild(folderDiv);

    const ul = document.createElement("ul");

    folder.children.forEach(child => {

        if (child.type === "folder") {
            renderTree(child, ul, searchTerm);
        }

        else if (child.type === "note") {

            const matchesSearch =
                child.title.toLowerCase().includes(searchTerm) ||
                child.content.toLowerCase().includes(searchTerm);

            if (searchTerm && !matchesSearch) return;

            const noteLi = document.createElement("li");
            noteLi.classList.add("note");

            const noteDiv = document.createElement("div");
            noteDiv.classList.add("item");
            noteDiv.textContent = child.title;

            if (child.id === appState.selectedNoteId) {
                noteDiv.classList.add("active");
            }

            noteDiv.addEventListener("click", function (e) {
                e.stopPropagation();

                const selectedNote = findNoteById(appState.root, child.id);
                if (!selectedNote) return;

                appState.selectedNoteId = child.id;

                appState.selectedFolderId = folder.id;

                openNote(selectedNote);

                saveAppState();
                renderSidebar();
            });

            noteLi.appendChild(noteDiv);
            ul.appendChild(noteLi);
        }
    });

    li.appendChild(ul);
    parentElement.appendChild(li);
}

function openNote(note) {
    appState.selectedNoteId = note.id;

    noteTitleInput.value = note.title;
    editorContent.innerHTML = note.content;

    timestampDisplay.textContent =
        "Last edited: " + new Date(note.lastEdited).toLocaleString();

    saveAppState();
    renderSidebar();
}

function createFolder() {
    const folderName = prompt("Enter folder name:");
    if (!folderName) return;

    const parentFolder = findFolderById(appState.root, appState.selectedFolderId);
    if (!parentFolder) return;

    const newFolder = {
        id: generateId(),
        name: folderName,
        type: "folder",
        children: []
    };

    parentFolder.children.push(newFolder);

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

    // Delete Note
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
    editorContent.innerHTML = "";
    timestampDisplay.textContent = "Last edited: --";

    saveAppState();
    renderSidebar();
}

function renameItem() {

    let element = null;
    let currentName = "";
    let isNote = false;

    if (appState.selectedNoteId) {

        const note = findNoteById(appState.root, appState.selectedNoteId);
        if (!note) return;

        currentName = note.title;
        isNote = true;

        element = document.querySelector(".note .item.active");
    }

    else if (
        appState.selectedFolderId &&
        appState.selectedFolderId !== appState.root.id
    ) {

        const folder = findFolderById(appState.root, appState.selectedFolderId);
        if (!folder) return;

        currentName = folder.name;
        element = document.querySelector(".folder .item.active");
    }

    if (!element) return;

    const input = document.createElement("input");
    input.type = "text";
    input.value = currentName;
    input.classList.add("rename-input");

    element.innerHTML = "";
    element.appendChild(input);

    input.focus();
    input.select();

    input.addEventListener("keydown", function (e) {

        if (e.key === "Enter") {

            const newName = input.value.trim();
            if (!newName) return;

            if (isNote) {
                const note = findNoteById(appState.root, appState.selectedNoteId);
                note.title = newName;
                note.lastEdited = new Date().toISOString();
                noteTitleInput.value = newName;
            } else {
                const folder = findFolderById(appState.root, appState.selectedFolderId);
                folder.name = newName;
            }

            saveAppState();
            renderSidebar();
        }

        if (e.key === "Escape") {
            renderSidebar();
        }
    });

    input.addEventListener("blur", function () {
        renderSidebar();
    });
}

// AUTO SAVE
noteTitleInput.addEventListener("input", function () {

    if (!appState.selectedNoteId) return;

    const note = findNoteById(appState.root, appState.selectedNoteId);
    if (!note) return;

    note.title = noteTitleInput.value;
    note.lastEdited = new Date().toISOString();

    saveAppState();
    renderSidebar();

    timestampDisplay.textContent =
        "Last edited: " + new Date(note.lastEdited).toLocaleString();
});

editorContent.addEventListener("input", function () {

    if (!appState.selectedNoteId) return;

    const note = findNoteById(appState.root, appState.selectedNoteId);
    if (!note) return;

    note.content = editorContent.innerHTML;
    note.lastEdited = new Date().toISOString();

    saveAppState();

    timestampDisplay.textContent =
        "Last edited: " + new Date(note.lastEdited).toLocaleString();
});

searchInput.addEventListener("input", function () {

    const searchValue = searchInput.value.trim();

    renderSidebar(searchValue);
});

createFolderBtn.addEventListener("click", createFolder);
createNoteBtn.addEventListener("click", createNote);
deleteBtn.addEventListener("click", deleteItem);
renameBtn.addEventListener("click", renameItem);

function initializeApp() {

    loadAppState();
    renderSidebar();

    if (appState.selectedNoteId) {
        const note = findNoteById(appState.root, appState.selectedNoteId);
        if (note) openNote(note);
    }

    console.log("App Initialized:", appState);
}

initializeApp();
