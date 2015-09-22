SecureNote
======

SecureNote is a Firefox plugin meant to store notes remotely in a host proof way. Gauranteeing that you'll have access to your notes where ever you are, while giving you piece of mind. It uses clojure for the back end. 

Instalation
------

1. Firefox plugin.

   The Firefox plugin requires jpm to install. jpm can be installed using npm, like so:
   > npm install -g jpm

   Then run with:
   > jpm run

2. Secure Server

   The best way to compile and run the server is with leiningen. Which can be downloaded from [https://raw.githubusercontent.com/technomancy/leiningen/stable/bin/lein](github)

   Then execute the command, which will install all of the dependancies as well

   > lein run

And that's it!


How It Works
------

The whole goal of SecureNote is to encrypt the notes on the client before it stores it on the server. This way an unencrypted note is never transmitted over the wire, nor stored unencrypted on any thing other that the client machine. An additional requirement of this is to never transmit or store the decryption key in such a way that the host and/or  evesdropper can intercept or derive. While also allowing the user to only have a single password to access the entire system.

This is primarily accomplished by creating two different password salts. When the user wishes to log in, the server will send both salts to the client. One will be used to salt the password, and sent to the server for authentication. The other will be used to derive the master symetric key, which is only ever stored on the client, and never transmitted.

Once the user is authenticated, a token is created for the client to reference for further communication.

The encrypted notes are then sent to the client to be decrypted and displayed. Each note is encrypted using AES-CBC with a different encryption key, which is then encrypted with the master key. The server stores both the encrypted key, and the encrypted note data. This way, if one note key is compromised, all other notes remain secure. It also adds the possibily of securely sharing notes, without having to share the users master password, or incidentally giving access to any other notes.


