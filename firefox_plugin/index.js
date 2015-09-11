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

panel.port.on("note-selected", function(note){
    //Decrypt the note, pass it to the edit panel
    decryptNote(note, credentials.encPassword)
	.then(function(decryptedNote){
	    editNotePanel.show()
	    editNotePanel.port.emit("setup-for-note", decryptedNote);
	}, handleError)
});

editNotePanel.port.on("save-note", function(note){
    keyForNote(note)
	.then(function(noteKey){
	    encryptNote(note, noteKey, credentials.encPassword)
		.then(function(encryptedNote){
		    saveNote(credentials.sessionToken, encryptedNote)
		    editNotePanel.hide()
	    }, handleError)
	})
})

editNotePanel.port.on("cancel-edit", function(){
    editNotePanel.hide()
})


//HTTP Methods ===========================================================================================
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
		     panel.port.emit("setup-ui-for-notes", response.json)
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

function keyForNote(note)
{
    if (note.key == undefined)
    {
	return crypto.subtle.generateKey({name:"AES-CBC", length:256}, true, ["encrypt", "decrypt"])
	    .then(function(noteKey){
		return noteKey;
	    })
    }
    return crypto.subtle.decrypt({"name":"AES-CBC", iv:Unibabel.hexToBuffer(note.iv)}, credentials.encPassword, Unibabel.hexToBuffer(note.key))
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
function encryptNote(note, noteKey, masterKey)
{
    var initVector = new Uint8Array(16)
    crypto.getRandomValues(initVector)
    note.iv = Unibabel.bufferToHex(initVector)
    
    return crypto.subtle.exportKey("raw", noteKey)
	.then(function(rawKey){
	    return crypto.subtle.encrypt({name:"AES-CBC",iv:initVector}, masterKey, rawKey)
		.then(function(encryptedKey){
		    note.key = Unibabel.bufferToHex(new Uint8Array(encryptedKey))
		    return crypto.subtle.encrypt({name:"AES-CBC", iv:initVector}, noteKey, Unibabel.utf8ToBuffer(note.title))
			.then(function(encryptedTitle){
			    note.title = Unibabel.bufferToHex(new Uint8Array(encryptedTitle))
			    return crypto.subtle.encrypt({name:"AES-CBC", iv:initVector}, noteKey, Unibabel.utf8ToBuffer(note.text))
				.then(function(encryptedText){
				    note.text = Unibabel.bufferToHex(new Uint8Array(encryptedText))
				    return note;
				}, handleError)
			}, handleError)
		}, handleError)
	}, handleError)
}

function decryptNote(note, masterKey)
{
    var initVector = Unibabel.hexToBuffer(note.iv)
    return crypto.subtle.decrypt({name:"AES-CBC", iv:initVector}, masterKey, Unibabel.hexToBuffer(note.key))
	.then(function(rawKey){
	    return crypto.subtle.importKey("raw", rawKey,{name: "AES-CBC", length:256}, true, ["encrypt", "decrypt"])
		.then(function(noteKey){
		    return crypto.subtle.decrypt({name:"AES-CBC", iv:initVector}, noteKey, Unibabel.hexToBuffer(note.title))
			.then(function(decryptedTitle){
			    note.title = Unibabel.bufferToUtf8(new Uint8Array(decryptedTitle))
			    return crypto.subtle.decrypt({name:"AES-CBC", iv:initVector}, noteKey, Unibabel.hexToBuffer(note.text))
				.then(function(decryptedText){
				    console.log("decrypted text")
				    note.text = Unibabel.bufferToUtf8(new Uint8Array(decryptedText))
				    return note;
				}, handleError)
			}, handleError)
		},handleError)
	},handleError)
}


function handleError(error)
{
    console.log(error)
    console.log(error.message);
    panel.port.emit("login-failed", error.message);
}




