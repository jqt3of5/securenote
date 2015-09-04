var {ToggleButton} = require("sdk/ui/button/toggle");
var panels = require("sdk/panel");
var self = require("sdk/self");
var Request = require("sdk/request").Request;


var button = ToggleButton({
    id : "my-button",
    label : "my button",
    icon : {
	"16" :"./icon-16.png",
        "32" : "./icon-32.png",
	"64" : "./icon-64.png"
    },
    badgeColor:"#AA0000",
    
    onChange: function(state){
	if (state.checked) { panel.show({position:button})}
    }
});

var panel = panels.Panel({
    contentURL: self.data.url("panel.html"),
    contentScriptFile: self.data.url("panel.js"),
    onHide: function() { button.state('window', {checked:false})}
});

var credentials = undefined;
var notes = []
panel.port.on("credentials-entered", function(username, password, shouldSavePassword) {
    //TODO Execute authentication
    if (shouldSavePassword) {
	//store credentials
	require("sdk/passwords").store({
	    realm:"SecureNote User Login",
	    username:username,
	    password:password
	});
    }
    credentials = {username:username, password:password};

    Request({
	url: "http://localhost:8080",
	onComplete:function(response) {
	    panel.port.emit("login-success", response.json);
	}}).get();
});

panel.port.on("add-note", function(){
    editNotePanel.show()
});

panel.port.on("note-selected", function(note){
    //Decrypt the note, pass it to the edit panel 
    editNotePanel.show()
    editNotePanel.port.emit("setup-for-note", note);
});

var editNotePanel = panels.Panel({
    contentURL:self.data.url("editNotePanel.html"),
    contentScriptFile:self.data.url("editNotePanel.js")
});



