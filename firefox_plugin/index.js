var {ToggleButton} = require("sdk/ui/button/toggle");
var panels = require("sdk/panel");
var self = require("sdk/self");
var Request = require("sdk/request").Request;
var Unibabel  = require("bower_components/unibabel");
let {Cu, Cc, Ci} = require('chrome');
Cu.importGlobalProperties(["crypto"])

var credentials = {username:undefined,
		   sessionToken:undefined,
		   authHexKey:undefined,
		   encPassword:undefined}
let baseURL = "http://localhost:8080/"

//UI ======================================================================================================
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

var editNotePanel = panels.Panel({
    contentURL:self.data.url("editNotePanel.html"),
    contentScriptFile:self.data.url("editNotePanel.js")
});

//Events ================================================================================================
panel.port.on("credentials-entered", function(username, password, shouldSavePassword) {
    if (shouldSavePassword) {
	//store credentials
	require("sdk/passwords").store({
	    realm:"SecureNote User Login",
	    username:username,
	    password:password
	});
    }
    credentials.username = username

    getSalts(username, function(salts){
	//derive the encryption password using the encryption salt
	deriveKeyFrom(password, Unibabel.hexToBuffer(salts.encSalt)).then(function(cryptoKey){
	    credentials.encPassword = cryptoKey;
	}, handleError)
	//derive the authentication password using the authentication salt
	deriveHexKeyFrom(password, Unibabel.hexToBuffer(salts.authSalt)).then(function(hexKey){
	    credentials.authHexKey = hexKey
	    login(username, hexKey)
	},handleError);
    });
});

panel.port.on("new-user-credentials-entered", function(username, password, shouldSavePassword) {
    if (shouldSavePassword) {
	//store credentials
	require("sdk/passwords").store({
	    realm:"SecureNote User Login",
	    username:username,
	    password:password
	});
    }

    var encSalt = new Uint8Array(16)
    var authSalt = new Uint8Array(16);
    crypto.getRandomValues(encSalt)
    crypto.getRandomValues(authSalt)

    credentials.username = username;
    deriveKeyFrom(password, encSalt).then(function(cyptoKey){
	credentials.encPassword = cryptoKey
    })

    deriveHexKeyFrom(password, authSalt).then(function(hexKey){
 	credentials.authHexKey = hexKey
	createUser(username,
		   hexKey,
		   Unibabel.bufferToHex(authSalt),
		   Unibabel.bufferToHex(encSalt))
    })
})

panel.port.on("add-note", function(){
    editNotePanel.show()
    editNotePanel.port.emit("setup-for-note", null);
});

panel.port.on("delete-note", function(note){
    deleteNote(credentials.sessionToken, note)
})

panel.port.on("note-selected", function(note){
    //Decrypt the note, pass it to the edit panel
    editNotePanel.show()
    editNotePanel.port.emit("setup-for-note", note);
});
panel.port.on("logout", function() {
    credentials = {}
})
editNotePanel.port.on("save-note", function(note){
    encryptNote(note, credentials.encPassword)
	.then(function(encryptedNote){
	    saveNote(credentials.sessionToken, encryptedNote)
	    editNotePanel.hide()
	})
})

editNotePanel.port.on("cancel-edit", function(){
    editNotePanel.hide()
})


//HTTP Methods ===========================================================================================
function deleteNote(token, note)
{
    Request({url:baseURL+"deletenote",
	     content:note.id,
	     contentType:"text/json",
	     headers:{"session-token":token},
	     onComplete:(response) => {
		 panel.port.emit("delete-note", note)
	     }}).post()
}
function login(username, authKey)
{
    Request({url:baseURL+"login",
	     headers:{"username":username, "password":authKey},
	     onComplete:(response) => {
		 if (response.status == 200)
		 {
		     credentials.sessionToken = response.text
		     panel.port.emit("login-success");

		     refreshNotes(credentials.sessionToken)
		 }
		 else
		 {
		     panel.port.emit("login-failed", response.text);
		 }
	     }}).post()
}

function saveNote(token, note)
{
    Request({url:baseURL+"savenote",
	     content:JSON.stringify(note),
	     contentType:"text/json",
	     headers:{"session-token":token},
	     onComplete:(response) => {
		 if (response.status == 200)
		 {
		     refreshNotes(token)
		 }
		 else
		 {
		     //HTTP Error
		 }
	     }}).post()
}

function createUser(username, authKey, authSalt, encSalt)
{
    Request({url:baseURL+"adduser",
	     content:JSON.stringify({username:username, password:authKey, encsalt:encSalt, authsalt:authSalt}),
	     onComplete: (response) => {
		 if (response.status == 200)
		 {
		     login(username, authKey)		     
		 }
		 else
		 {
		     panel.port.emit("login-failed", response.text)
		 }
	     }}).post()
}

function refreshNotes(token)
{
    Request({url:baseURL+"notes",
	     headers:{"session-token": token},
	     onComplete: (response) => {
		 if (response.status == 200)
		 {
		     var decryptedNotes = []
		     var notes = response.json
		     for (var i in notes)
		     {
			 decryptNote(notes[i], credentials.encPassword)
			     .then(function(note){
				 decryptedNotes.push(note)
				 if (decryptedNotes.length == notes.length)
				 {
				     panel.port.emit("setup-ui-for-notes", decryptedNotes)			     
				 }
			     })
		     }
		 }
		 else
		 {
		     //TODO HandleHttpError
		 }
	     }}).get()
}
function getSalts(username, onComplete)
{
    Request({
	url: baseURL+"getsalts",
	content: {username:username},
	onComplete:function(response){
	    if (response.status == 200)
	    {
		onComplete(response.json)
	    }
	    else
	    {
		panel.port.emit("login-failed", response.text);
	    }
	}}).get();
}

//Key generation ==========================================================================================
function createNoteKey()
{
    return crypto.subtle.generateKey({name:"AES-CBC", length:256}, true, ["encrypt", "decrypt"])
	.then(function(noteKey){
	    return noteKey;
	})
}

function decryptNoteKey(encryptedNoteKey, masterKey)
{
    return crypto.subtle.decrypt({"name":"AES-CBC", iv:Unibabel.hexToBuffer(encryptedNoteKey.iv)}, masterKey, Unibabel.hexToBuffer(encryptedNoteKey.data))
	.then(function(rawkey){
	    return crypto.subtle.importKey("raw",
					   rawkey,
					   {name: "AES-CBC"},
					   true,
					   ["encrypt", "decrypt"])
		.then(function(noteKey){
		    return noteKey
		})
	})
}

function deriveKeyFrom(password, salt)
{
    return crypto.subtle.importKey("raw", 
				   Unibabel.utf8ToBuffer(password),
				   {name: "PBKDF2"},
				   true,
				   ["deriveKey"]
				  ).then(function(key){
				      return crypto.subtle.deriveKey({"name":'PBKDF2',
								      "salt":salt,
								      "iterations":1024,
								      "hash":{name: 'SHA-1'}},
								     key,
								     {"name": 'AES-CBC', length:256},
								     true,
								     ["encrypt", "decrypt"]);
				  }, handleError)
}
function deriveHexKeyFrom(password, salt)
{
    return deriveKeyFrom(password, salt).then(function (webKey) {
	return crypto.subtle.exportKey("raw", webKey)
    }, handleError).then(function (rawKey){
	return Unibabel.bufferToHex(new Uint8Array(rawKey))
    });
}

//Encryption ====================================================================================================
var plaintextProperties = ["key", "id", "owner"]

function encryptNote(note, masterKey)
{
    if (note.key == undefined)
    {
	var initVector = new Uint8Array(16)
	crypto.getRandomValues(initVector)
	return createNoteKey()
	    .then(function(noteKey){
		return crypto.subtle.exportKey("raw", noteKey)
		    .then(function(rawKey){
			return crypto.subtle.encrypt({name:"AES-CBC",iv:initVector}, masterKey, rawKey)
			    .then(function(encryptedKey){
				note.key = {}
				note.key.data = Unibabel.bufferToHex(new Uint8Array(encryptedKey))
				note.key.iv = Unibabel.bufferToHex(new Uint8Array(initVector))
				return _encryptNote(note, noteKey)
			    })
		    })
	    })
    }
    else
    {
	return decryptNoteKey(note.key, masterKey)
	    .then(function(noteKey){
		return _encryptNote(note, noteKey)
	    })
    }
}

function _encryptNote(note, noteKey)
{
    var initVector = new Uint8Array(16)
    crypto.getRandomValues(initVector)

    var encryptedNote = {}

    for (var i in plaintextProperties)
    {
	var prop = plaintextProperties[i]
	encryptedNote[prop] = note[prop]
	note[prop] = undefined
    }
    
    encryptedNote.iv = Unibabel.bufferToHex(new Uint8Array(initVector))
    
    var noteData = JSON.stringify(note)
    return crypto.subtle.encrypt({name:"AES-CBC", iv:initVector}, noteKey, Unibabel.utf8ToBuffer(noteData))
	.then(function(encryptedNoteData){
	    encryptedNote.data = Unibabel.bufferToHex(new Uint8Array(encryptedNoteData))
	    return encryptedNote;
	}, handleError)
}

function decryptNote(encryptedNote, masterKey)
{
    var keyInitVector = Unibabel.hexToBuffer(encryptedNote.key.iv)
    return crypto.subtle.decrypt({name:"AES-CBC", iv:keyInitVector}, masterKey, Unibabel.hexToBuffer(encryptedNote.key.data))
	.then(function(rawKey){
	    return crypto.subtle.importKey("raw", rawKey,{name: "AES-CBC", length:256}, true, ["encrypt", "decrypt"])
		.then(function(noteKey){
		    var initVector = Unibabel.hexToBuffer(encryptedNote.iv)
		    return crypto.subtle.decrypt({name:"AES-CBC", iv:initVector}, noteKey, Unibabel.hexToBuffer(encryptedNote.data))
			.then(function(decryptedNoteData){
			    var note = JSON.parse(Unibabel.bufferToUtf8(new Uint8Array(decryptedNoteData)))
			    for (var i in plaintextProperties)
			    {
				var prop = plaintextProperties[i]
				note[prop] = encryptedNote[prop]
			    }
			    return note
			}, handleError)
		},handleError)
	},handleError)
}


function handleError(error)
{
    console.log(error)
    console.log(error.message);
    console.log(error.stack)
    panel.port.emit("login-failed", error.message);
}




