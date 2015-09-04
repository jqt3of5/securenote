self.port.on("login-success", function(notes) {
    document.getElementById("login-section").style.display = "none";
    document.getElementById("notes-section").style.display = "block";

    var noteList = document.getElementById("note-list")
    if (notes.length > 0)
    {
	noteList.innerHTML = ''
    }
    
    for (var i in notes)
    {
	var listItem = document.createElement("li");
	listItem.className="note-li";
	listItem.id=notes[i].id;
	listItem.addEventListener("click", function(note)
				  {
				      return function(event){
					  console.log(note)
					  self.port.emit("note-selected", note)
				      }
				  }(notes[i]));
	
	var textNode = document.createTextNode(notes[i].title);
	listItem.appendChild(textNode);
	noteList.appendChild(listItem);
    }
});

document.getElementById("sign-in-button").addEventListener("click", function(event) {
    var password = document.getElementById("password").value;
    var username = document.getElementById("username").value;
    var remember = document.getElementById("savePassword").checked;
    
    self.port.emit("credentials-entered", username, password, remember);
});

document.getElementById("add-note-button").addEventListener("click", function(event) {
    self.port.emit("add-note");
});
