var currentNote = {}

self.port.on("show", function(){
    document.getElementById("note-title").value = ""
    document.getElementById("note-body").value = ""
    document.getElementById("note-id").value = ""
    document.getElementById("note-key").value = ""
})
self.port.on("setup-for-note", function(note){
    currentNote = note
    document.getElementById("note-title").value = note.title
    document.getElementById("note-body").value = note.text
    console.log(note.title)
});

document.getElementById("save-button").addEventListener("click", function(event){
    currentNote.title = document.getElementById("note-title").value
    currentNote.text = document.getElementById("note-body").value
    
    self.port.emit("save-note", currentNote)
})

document.getElementById("cancel-button").addEventListener("click", function(event){
    
})

