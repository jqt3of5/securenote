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
					      console.log(note)
					      self.port.emit("note-selected", note)
					  }
				      }(notes[i]));
	    
	    var textNode = document.createTextNode(notes[i].title);
	    listItem.appendChild(textNode);
	    noteList.appendChild(listItem);
	}
    }
});

self.port.on("login-failed", function(message){
    
});
	     
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
