self.port.on("setup-for-note", function(note){
    document.getElementById("note-title").value = note.title
    document.getElementById("note-body").value = note.text
    console.log(note.title)
});
