self.port.on("login-success", function() {
    document.getElementById("login-section").style.display = "none";
    document.getElementById("notes-section").style.display = "block";
})

self.port.on("setup-ui-for-notes", function(notes){
    if (notes != null && notes.length > 0)
    {
	var noteList = document.getElementById("note-list")
	noteList.innerHTML = ''
	
	for (var i in notes)
	{
	    var listItem = document.createElement("li");
	    listItem.className="note-li";
	    listItem.id=notes[i].id;
	    listItem.addEventListener("click", function(note)
				      {
					  return function(event){
					      self.port.emit("note-selected", note)
					  }
				      }(notes[i]));
	    
	    var textNode = document.createTextNode(notes[i].title);
	    listItem.appendChild(textNode);

	    var floatingDiv = document.createElement("div")
	    floatingDiv.style = "float:right"
	    
	    var button = document.createElement("button");
	    button.className = "btn btn-error"
	    button.addEventListener("click", function(note)
				    {
					return function(event){
					    event.stopPropagation()
					    self.port.emit("delete-note", note)
					}
				    }(notes[i]));
	    var buttonTextNode = document.createTextNode("Delete");
	    button.appendChild(buttonTextNode)
	    floatingDiv.appendChild(button)
	    listItem.appendChild(floatingDiv);
	    
	    noteList.appendChild(listItem);
	}
    }
});

self.port.on("login-failed", function(message){
    console.log("Login Failed: " + message)
});

//TODO: For performance sakes
self.port.on("update-note", function(note){
})
self.port.on("insert-note", function(note){
})
self.port.on("delete-note", function(note){
    var noteList = document.getElementById("note-list")
    var noteItem = document.getElementById(note.id)
    noteList.removeChild(noteItem)
})

document.getElementById("sign-in-button").addEventListener("click", function(event) {
    var password = document.getElementById("password").value;
    var username = document.getElementById("username").value;
    var remember = document.getElementById("savePassword").checked;
    
    self.port.emit("credentials-entered", username, password, remember);
});

document.getElementById("create-user-button").addEventListener("click", function(event){
    var password = document.getElementById("password").value;
    var username = document.getElementById("username").value;
    var remember = document.getElementById("savePassword").checked;
    
    self.port.emit("new-user-credentials-entered", username, password, remember);
    
})

document.getElementById("add-note-button").addEventListener("click", function(event) {
    self.port.emit("add-note");
});

document.getElementById("logout-link").addEventListener("click", function(event) {
    document.getElementById("login-section").style.display = "block";
    document.getElementById("notes-section").style.display = "none";

    var noteList = document.getElementById("note-list")
    while (noteList.firstChild) {
	noteList.removeChild(noteList.firstChild);
    }

    self.port.emit("logout")
})


