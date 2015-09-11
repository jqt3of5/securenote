var currentNote = undefined


self.port.on("setup-for-note", function(note){
    if (note == null || note == undefined)
    {
	document.getElementById("note-title").value = ""
	document.getElementById("note-body").value = ""
	currentNote = {}
    }
    else
    {
	document.getElementById("note-title").value = note.title
	document.getElementById("note-body").value = note.text
	currentNote = note
    }
});

document.getElementById("save-button").addEventListener("click", function(event){
    currentNote.title = document.getElementById("note-title").value
    currentNote.text = document.getElementById("note-body").value
    
    self.port.emit("save-note", currentNote)
})

document.getElementById("cancel-button").addEventListener("click", function(event){
    self.port.emit("cancel-edit")
})

